'use strict';
/**
 * server/process-tree.js —— Windows 进程树终止的唯一实现（网关 P3 收口）。
 *
 * 背景：Windows 上 child.kill() 只杀进程本体，其启动的孙进程（SD WebUI、
 * GPT-SoVITS、cloudflared、训练脚本等）会变成孤儿继续占显存/端口。
 * taskkill /T /F 连树终止；进程可能已退出，失败回退到普通 kill。
 *
 * 调用方：routes/control.js、routes/maintenance.js、server/tunnel.js、
 * services/*.ts（TS 侧经构建产物 require，未迁移的保持各自内联逻辑）。
 */

var cp = require('child_process');

/** 终止一个 ChildProcess 及其整棵进程树 */
function killProcessTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    try {
      cp.execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    } catch (error) { /* 进程可能已退出，回退到 kill */ }
  }
  try { child.kill(); } catch (error) {}
}

/** 按 pid 终止整棵进程树（fallback process.kill） */
function killPid(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try { cp.execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }); }
    catch (error) { try { process.kill(pid); } catch (e) {} }
  } else {
    try { process.kill(pid); } catch (error) {}
  }
}

module.exports = { killProcessTree: killProcessTree, killPid: killPid };
