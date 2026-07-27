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

function createTranslationService(options: TranslationServiceOptions) {
  const queue = new SerialQueue('zh-ja-translation');
  let child: ChildProcess | null = null;
  let starting: Promise<boolean> | null = null;
  let ready = false;
  /** 启动探测轮询的 handle —— close() 必须清掉它，否则关服后计时器还活着 */
  let readyPoll: ReturnType<typeof setInterval> | null = null;
  const cache = new Map<string, TranslationResult>();

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
      if (!fs.existsSync(options.python) || !fs.existsSync(options.script)) {
        reject(new Error('本地日语翻译组件尚未安装。'));
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
        reject(error);
        return;
      }
      if (logFd !== 'ignore') fs.closeSync(logFd);

    child.once('exit', function () {
      ready = false;
      child = null;
      // 不在这里清 starting：startServer 的 promise 可能还没结算，
      // 提前置空会让并发的 ensureServer 看到 starting === null 而再 spawn
      // 一个 python.exe。清理交给 ensureServer 的 finally。
      stopReadyPoll();
    });
    child.once('error', function () {
      ready = false;
      stopReadyPoll();
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
            console.log('  🌐 中日翻译常驻服务已就绪 (port ' + options.port + ')');
            resolve(true);
          } else if (attempts >= 120 || !child) {
            stopReadyPoll();
            reject(new Error('翻译常驻服务启动超时'));
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
      const legacy = cp.spawn(options.python, [options.script], {
        windowsHide: true,
        env: Object.assign({}, process.env, { PYTHONUTF8: '1' }),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const timer = setTimeout(function () {
        if (!finished) legacy.kill();
      }, 180000);

      function onAbort() {
        legacy.kill();
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
          output += chunk.toString('utf8');
        });
      }
      if (legacy.stderr) {
        legacy.stderr.on('data', function (chunk: Buffer) {
          errorOutput += chunk.toString('utf8');
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
    });
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
