'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var SerialQueue = require('./serial-queue');
var httpClient = require('./http-client');

function createTranslationService(options) {
  var queue = new SerialQueue('zh-ja-translation');
  var child = null;
  var starting = null;
  var ready = false;
  var cache = new Map();

  function remember(text, result) {
    cache.delete(text);
    cache.set(text, result);
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    return result;
  }

  async function ping(signal, timeoutMs) {
    try {
      var result = await httpClient.request(options.url, '/health', {
        timeoutMs:timeoutMs || 800,
        signal:signal
      });
      result.response.resume();
      return result.response.statusCode === 200;
    } catch (error) {
      if (httpClient.isAbortError(error)) throw error;
      return false;
    }
  }

  async function requestTranslation(text, signal) {
    var data = await httpClient.readJson(options.url, '/translate', {
      method:'POST',
      json:{ text:text },
      timeoutMs:120000,
      timeoutMessage:'翻译请求超时',
      signal:signal
    });
    if (!data || !data.translation) throw new Error('翻译服务没有返回译文');
    return data;
  }

  function startServer() {
    return new Promise(function (resolve, reject) {
      if (!fs.existsSync(options.python) || !fs.existsSync(options.script)) {
        reject(new Error('本地日语翻译组件尚未安装。'));
        return;
      }

      var logFd = 'ignore';
      try {
        fs.mkdirSync(path.dirname(options.logFile), { recursive:true });
        logFd = fs.openSync(options.logFile, 'a');
      } catch (error) {}

      try {
        child = cp.spawn(options.python, [options.script, '--serve', '--port', String(options.port)], {
          windowsHide:true,
          env:Object.assign({}, process.env, {
            PYTHONUTF8:'1',
            AICS_TRANSLATE_PORT:String(options.port)
          }),
          stdio:['ignore', logFd, logFd]
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
        starting = null;
      });
      child.once('error', function () {
        ready = false;
      });

      var attempts = 0;
      var timer = setInterval(function () {
        attempts += 1;
        ping(null, 1000).then(function (online) {
          if (online) {
            clearInterval(timer);
            ready = true;
            console.log('  🌐 中日翻译常驻服务已就绪 (port ' + options.port + ')');
            resolve(true);
          } else if (attempts >= 120 || !child) {
            clearInterval(timer);
            reject(new Error('翻译常驻服务启动超时'));
          }
        }).catch(function () {});
      }, 1000);
    });
  }

  function ensureServer(signal) {
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

  function runLegacy(text, signal) {
    return new Promise(function (resolve, reject) {
      if (!fs.existsSync(options.python) || !fs.existsSync(options.script)) {
        reject(new Error('本地日语翻译组件尚未安装。'));
        return;
      }
      if (signal && signal.aborted) {
        reject(httpClient.abortError());
        return;
      }

      var output = '';
      var errorOutput = '';
      var finished = false;
      var legacy = cp.spawn(options.python, [options.script], {
        windowsHide:true,
        env:Object.assign({}, process.env, { PYTHONUTF8:'1' }),
        stdio:['pipe', 'pipe', 'pipe']
      });
      var timer = setTimeout(function () {
        if (!finished) legacy.kill();
      }, 180000);

      function onAbort() {
        legacy.kill();
        finish(httpClient.abortError());
      }
      function finish(error, result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        if (error) reject(error);
        else resolve(result);
      }

      if (signal) signal.addEventListener('abort', onAbort, { once:true });
      legacy.stdout.on('data', function (chunk) { output += chunk.toString('utf8'); });
      legacy.stderr.on('data', function (chunk) { errorOutput += chunk.toString('utf8'); });
      legacy.once('error', function (error) { finish(error); });
      legacy.once('close', function (code) {
        if (finished) return;
        try {
          var result = JSON.parse(output.trim());
          if (code === 0 && result && result.translation) {
            finish(null, result);
            return;
          }
          finish(new Error(result && result.error || errorOutput.trim() || '本地日语翻译失败。'));
        } catch (error) {
          finish(error);
        }
      });
      legacy.stdin.end(JSON.stringify({ text:text }));
    });
  }

  function translate(text, signal) {
    if (cache.has(text)) return Promise.resolve(cache.get(text));
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

  function prepare(signal) {
    return ensureServer(signal);
  }

  function close() {
    if (child) {
      try { child.kill(); } catch (error) {}
    }
    child = null;
    ready = false;
  }

  return {
    translate:translate,
    prepare:prepare,
    ping:ping,
    close:close,
    status:function () {
      return {
        ready:ready,
        managed:!!child,
        queue:queue.status(),
        cached:cache.size
      };
    }
  };
}

module.exports = { createTranslationService:createTranslationService };
