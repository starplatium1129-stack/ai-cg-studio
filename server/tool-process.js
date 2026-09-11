'use strict';

var cp = require('child_process');
var processTree = require('./process-tree');

function toolProcessError(code, message) {
  return Object.assign(new Error(message), { code: code });
}

/** Own the process until close: abort, timeout and overflow also terminate descendants. */
function runToolProcess(command, args, options) {
  options = options || {};
  var signal = options.signal;
  if (signal && signal.aborted) return Promise.reject(toolProcessError('ABORT_ERR', '工具操作已取消'));
  return new Promise(function (resolve, reject) {
    var child;
    var timer;
    var terminationTimer;
    var stopped;
    var settled = false;
    var bytes = 0;
    var stdout = [];
    var stderr = [];
    var limit = options.maxBuffer || 64 * 1024;

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(terminationTimer);
      if (signal) signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(result);
    }
    function stop(error) {
      if (settled || stopped) return;
      stopped = error;
      processTree.killProcessTree(child, { group: true, force: true });
      terminationTimer = setTimeout(function () {
        finish(toolProcessError('TERMINATION_UNCONFIRMED', '已请求停止工具，但尚未确认进程退出，请检查控制面板。'));
      }, 5000);
    }
    function abort() { stop(toolProcessError('ABORT_ERR', '工具操作已取消')); }
    function collect(target, chunk) {
      if (settled || stopped) return;
      bytes += chunk.length;
      if (bytes > limit) {
        stop(toolProcessError('COMMAND_OUTPUT_LIMIT', '命令输出超过上限，已停止执行'));
        return;
      }
      target.push(chunk);
    }
    try {
      child = cp.spawn(command, args, {
        cwd: options.cwd,
        env: options.env || process.env,
        windowsHide: true,
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) { finish(error); return; }
    child.stdout.on('data', function (chunk) { collect(stdout, chunk); });
    child.stderr.on('data', function (chunk) { collect(stderr, chunk); });
    child.once('error', function (error) { finish(stopped || error); });
    child.once('close', function (code, exitSignal) {
      var result = { stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') };
      if (stopped) { finish(stopped); return; }
      if (code !== 0) {
        var detail = (result.stderr || result.stdout).trim().slice(0, 1500);
        finish(toolProcessError('COMMAND_FAILED', '命令执行失败（' + (exitSignal || code) + '）' + (detail ? '：' + detail : '')));
        return;
      }
      finish(null, result);
    });
    timer = setTimeout(function () {
      stop(toolProcessError('COMMAND_TIMEOUT', '命令执行超时，已停止执行'));
    }, options.timeout || 120000);
    if (signal) {
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    }
  });
}

module.exports = { runToolProcess: runToolProcess };
