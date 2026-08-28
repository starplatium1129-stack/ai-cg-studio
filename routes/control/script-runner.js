'use strict';

/**
 * routes/control/script-runner.js —— 控制面 PowerShell 脚本执行器
 * （2026-08-29 审计 P1-10 自 routes/control.js 拆出，行为未改）。
 *
 * createScriptRunner({ rootDir }) 返回 runScriptAsync(scriptPath, args, timeoutMs)。
 * 连子孙一起终止（server/process-tree.js 唯一实现）：Windows 上 child.kill()
 * 只杀 powershell.exe 本体，它启动的 SD WebUI / GPT-SoVITS 会变成孤儿继续占
 * 显存 —— server.js 里停隧道时早就知道要用 taskkill /T /F，这条路径漏了。
 */

var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var processTree = require('../../server/process-tree');

function createScriptRunner(options) {
  options = options || {};
  var rootDir = options.rootDir || process.cwd();

  function runScriptAsync(scriptPath, args, timeoutMs) {
    return new Promise(function (resolve) {
      if (!fs.existsSync(scriptPath)) {
        resolve({ ok:false, error:'脚本未安装：' + path.basename(scriptPath) });
        return;
      }
      var child;
      try {
        child = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath].concat(args || []), {
          cwd: rootDir,
          windowsHide: true
        });
      } catch (error) {
        resolve({ ok:false, error:error.message });
        return;
      }
      var stdout = '';
      var stderr = '';
      var finished = false;
      function done(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(result);
      }
      var timer = setTimeout(function () {
        // child.kill() 在 Windows 上只终止 powershell.exe 本体，
        // 会把它启动的 SD WebUI / GPT-SoVITS 孤立掉。整棵树一起收。
        processTree.killProcessTree(child);
        done({ ok:false, error:'操作超时（' + Math.round((timeoutMs || 60000) / 1000) + ' 秒）' });
      }, timeoutMs || 60000);
      // 输出加上限：脚本多话时不要把字符串撑到无穷大
      var OUTPUT_CAP = 64 * 1024;
      child.stdout.on('data', function (chunk) {
        if (stdout.length < OUTPUT_CAP) stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', function (chunk) {
        if (stderr.length < OUTPUT_CAP) stderr += chunk.toString('utf8');
      });
      child.on('error', function (error) { done({ ok:false, error:error.message }); });
      child.on('close', function (code) {
        var output = String(stdout || '').trim();
        if (code === 0) done({ ok:true, message: output, stdout: output, stderr: String(stderr || '').trim() });
        else done({ ok:false, error:(stderr || stdout || '脚本退出码 ' + code).trim(), message: output });
      });
    });
  }

  return { runScriptAsync: runScriptAsync };
}

module.exports = { createScriptRunner: createScriptRunner };
