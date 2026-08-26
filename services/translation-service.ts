'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import type { ChildProcess } from 'child_process';
import SerialQueue = require('./serial-queue');
import httpClient = require('./http-client');

interface TranslationServiceOptions {
  url: string;
  python: string;
  script: string;
  port: number | string;
  logFile: string;
}

interface TranslationResult {
  translation: string;
  error?: string;
  [key: string]: unknown;
}

interface QueueStatusView {
  name: string;
  active: number;
  pending: number;
}

interface TranslationStatus {
  ready: boolean;
  managed: boolean;
  queue: QueueStatusView;
  cached: number;
}

function killProcessTree(child: cp.ChildProcess | null): void {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    try {
      cp.execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    } catch { /* 进程可能已退出，回退到 kill */ }
  }
  try { child.kill(); } catch { /* ignore */ }
}

function createTranslationService(options: TranslationServiceOptions) {
  const queue = new SerialQueue('zh-ja-translation');
  let child: ChildProcess | null = null;
  let starting: Promise<boolean> | null = null;
  let ready = false;
  /** 启动探测轮询的 handle —— close() 必须清掉它，否则关服后计时器还活着 */
  let readyPoll: ReturnType<typeof setInterval> | null = null;
  const cache = new Map<string, TranslationResult>();
  /**
   * 2026-08-16 审计：降级路径 runLegacy 每次 translate 会独立 spawn 一个一次性
   * python 子进程，此前只存在局部变量、不在 close() 清理范围 → 网关关停时孤儿进程
   * 残留。这里登记全部 legacy 子进程，close() 统一回收，close 后自动移除。
   */
  const legacyChildren = new Set<ChildProcess>();

  function remember(text: string, result: TranslationResult): TranslationResult {
    cache.delete(text);
    cache.set(text, result);
    if (cache.size > 100) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return result;
  }

  async function ping(signal?: AbortSignal | null, timeoutMs?: number): Promise<boolean> {
    try {
      const result = await httpClient.request(options.url, '/health', {
        timeoutMs: timeoutMs || 800,
        signal: signal || undefined
      });
      result.response.resume();
      return result.response.statusCode === 200;
    } catch (error) {
      if (httpClient.isAbortError(error)) throw error;
      return false;
    }
  }

  async function requestTranslation(text: string, signal?: AbortSignal): Promise<TranslationResult> {
    const data = (await httpClient.readJson(options.url, '/translate', {
      method: 'POST',
      json: { text: text },
      timeoutMs: 120000,
      timeoutMessage: '翻译请求超时',
      signal: signal
    })) as TranslationResult | null;
    if (!data || !data.translation) throw new Error('翻译服务没有返回译文');
    return data;
  }

  function startServer(): Promise<boolean> {
    return new Promise(function (resolve, reject) {
      let settled = false;
      function settle(fn: () => void) {
        if (settled) return;
        settled = true;
        fn();
      }
      if (!fs.existsSync(options.python) || !fs.existsSync(options.script)) {
        settle(function () { reject(new Error('本地日语翻译组件尚未安装。')); });
        return;
      }

      let logFd: number | 'ignore' = 'ignore';
      try {
        fs.mkdirSync(path.dirname(options.logFile), { recursive: true });
        logFd = fs.openSync(options.logFile, 'a');
      } catch {
        // Keep translation usable even if the log file cannot be opened.
      }

      try {
        child = cp.spawn(options.python, [options.script, '--serve', '--port', String(options.port)], {
          windowsHide: true,
          env: Object.assign({}, process.env, {
            PYTHONUTF8: '1',
            AICS_TRANSLATE_PORT: String(options.port)
          }),
          stdio: ['ignore', logFd, logFd]
        });
      } catch (error) {
        if (logFd !== 'ignore') fs.closeSync(logFd);
        settle(function () { reject(error); });
        return;
      }
      if (logFd !== 'ignore') fs.closeSync(logFd);

    child.once('exit', function (code, signal) {
      ready = false;
      child = null;
      // 启动窗口内退出必须结算 startServer 的 promise，否则 ensureServer
      // 的 starting 永远 pending，整条翻译队列会挂死到网关重启。
      stopReadyPoll();
      settle(function () {
        reject(new Error('本地日语翻译组件启动后立即退出（' + (signal ? 'signal ' + signal : 'exit ' + code) + '），请查看日志：' + options.logFile));
      });
    });
    child.once('error', function (error) {
      ready = false;
      stopReadyPoll();
      settle(function () { reject(error); });
    });

    let attempts = 0;
    if (readyPoll) clearInterval(readyPoll);
    readyPoll = setInterval(function () {
      attempts += 1;
      ping(null, 1000)
        .then(function (online) {
          if (online) {
            stopReadyPoll();
            ready = true;
            console.warn('  🌐 中日翻译常驻服务已就绪 (port ' + options.port + ')');
            settle(function () { resolve(true); });
          } else if (attempts >= 120 || !child) {
            stopReadyPoll();
            settle(function () { reject(new Error('翻译常驻服务启动超时')); });
          }
        })
        .catch(function () {});
    }, 1000);
    });
  }

  function ensureServer(signal?: AbortSignal): Promise<boolean> {
    if (ready) return Promise.resolve(true);
    if (starting) return starting;
    starting = ping(signal, 800)
      .then(function (online) {
        if (online) {
          ready = true;
          return true;
        }
        return startServer();
      })
      .finally(function () {
        starting = null;
      });
    return starting;
  }

  function runLegacy(text: string, signal?: AbortSignal): Promise<TranslationResult> {
    return new Promise(function (resolve, reject) {
      if (!fs.existsSync(options.python) || !fs.existsSync(options.script)) {
        reject(new Error('本地日语翻译组件尚未安装。'));
        return;
      }
      if (signal && signal.aborted) {
        reject(httpClient.abortError());
        return;
      }

      let output = '';
      let errorOutput = '';
      let finished = false;
      const OUTPUT_CAP = 64 * 1024;
      const legacy = cp.spawn(options.python, [options.script], {
        windowsHide: true,
        env: Object.assign({}, process.env, { PYTHONUTF8: '1' }),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      legacyChildren.add(legacy);
      legacy.once('close', function () { legacyChildren.delete(legacy); });
      const timer = setTimeout(function () {
        if (!finished) killProcessTree(legacy);
      }, 180000);

      function onAbort() {
        killProcessTree(legacy);
        finish(httpClient.abortError());
      }
      function finish(error?: Error | null, result?: TranslationResult) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        if (error) reject(error);
        else resolve(result as TranslationResult);
      }

      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      if (legacy.stdout) {
        legacy.stdout.on('data', function (chunk: Buffer) {
          if (output.length < OUTPUT_CAP) output += chunk.toString('utf8').slice(0, OUTPUT_CAP - output.length);
        });
      }
      if (legacy.stderr) {
        legacy.stderr.on('data', function (chunk: Buffer) {
          if (errorOutput.length < OUTPUT_CAP) errorOutput += chunk.toString('utf8').slice(0, OUTPUT_CAP - errorOutput.length);
        });
      }
      legacy.once('error', function (error) {
        finish(error);
      });
      legacy.once('close', function (code) {
        if (finished) return;
        try {
          const result = JSON.parse(output.trim()) as TranslationResult;
          if (code === 0 && result && result.translation) {
            finish(null, result);
            return;
          }
          finish(new Error((result && result.error) || errorOutput.trim() || '本地日语翻译失败。'));
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      });
      if (legacy.stdin) legacy.stdin.end(JSON.stringify({ text: text }));
    });
  }

  function translate(text: string, signal?: AbortSignal): Promise<TranslationResult> {
    if (cache.has(text)) return Promise.resolve(cache.get(text) as TranslationResult);
    return queue.run(async function () {
      if (signal && signal.aborted) throw httpClient.abortError();
      try {
        await ensureServer(signal);
        return remember(text, await requestTranslation(text, signal));
      } catch (error) {
        ready = false;
        if (httpClient.isAbortError(error)) throw error;
        try {
          return remember(text, await runLegacy(text, signal));
        } catch (legacyError) {
          if (httpClient.isAbortError(legacyError)) throw legacyError;
          throw error;
        }
      }
    }, { signal });
  }

  function prepare(signal?: AbortSignal): Promise<boolean> {
    return ensureServer(signal);
  }

  function stopReadyPoll(): void {
    if (!readyPoll) return;
    clearInterval(readyPoll);
    readyPoll = null;
  }

  function close(): void {
    // 先停轮询：原先 close() 只 kill 子进程，那个 1 秒一次、最多 120 次的
    // setInterval 会继续跑，把事件循环拖着不让进程退出。
    stopReadyPoll();
    if (child) {
      try {
        child.kill();
      } catch {
        // Best-effort shutdown.
      }
    }
    child = null;
    // 2026-08-16 审计：降级翻译子进程也要一并回收，避免网关关停后孤儿残留。
    legacyChildren.forEach(function (legacy) {
      try { killProcessTree(legacy); } catch { /* Best-effort */ }
    });
    legacyChildren.clear();
    ready = false;
  }

  return {
    translate: translate,
    prepare: prepare,
    ping: ping,
    close: close,
    status: function (): TranslationStatus {
      return {
        ready: ready,
        managed: !!child,
        queue: queue.status(),
        cached: cache.size
      };
    }
  };
}

export = { createTranslationService: createTranslationService };
