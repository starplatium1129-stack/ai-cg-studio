'use strict';
/**
 * server/tunnel.js 自动重连测试
 *
 * 用注入的 spawn mock 模拟 cloudflared：
 *   1. 进程立即退出 → 应自动重新拉起（restartAttempts 递增、restartTimer 激活）
 *   2. 模拟日志出现 Registered tunnel connection → 重连计数清零
 *   3. 手动 stop 后 → 不再自动拉起
 */

var test = require('node:test');
var assert = require('node:assert');
var path = require('path');
var fs = require('fs');
var os = require('os');

var { createTunnelManager } = require('../../server/tunnel');

var { EventEmitter } = require('node:events');

function FakeChild() {
  EventEmitter.call(this);
  this.pid = 99999;
  this.unref = function () {};
}
FakeChild.prototype = Object.create(EventEmitter.prototype);
FakeChild.prototype.constructor = FakeChild;
var fakeProcess = new FakeChild();
var spawned = 0;
var exitHandlers = [];
var errorHandlers = [];

function fakeSpawn() {
  spawned += 1;
  return fakeProcess;
}

function makeManager() {
  spawned = 0;
  exitHandlers = [];
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnel-test-'));
  var config = {
    DISABLE_TUNNEL: false,
    CLOUDFLARED_PATH: __filename,  // 必须真实存在，否则 start() 直接 return
    PORT: 3197,
    RUNTIME: {
      tunnelLog: path.join(dir, 'tunnel.log'),
      tunnelPid: path.join(dir, 'tunnel.pid'),
    },
  };
  fs.writeFileSync(config.RUNTIME.tunnelLog, '');
  var manager = createTunnelManager({
    config: config,
    spawn: fakeSpawn,
    onStateChange: function () {},
  });
  return { manager: manager, dir: dir, config: config };
}

test('tunnel auto-restarts after cloudflared exits unexpectedly', function (t) {
  t.after(function () { manager.stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  var { manager, dir, config } = makeManager();
  manager.start();
  assert.strictEqual(spawned, 1, 'first spawn');

  // 触发进程退出（不清 stop 状态，模拟崩溃）
  fakeProcess.emit('exit', 1);
  assert.strictEqual(spawned, 1, 'no immediate respawn (scheduled, not synchronous)');

  // 等第一次退避（5s）过去
  return new Promise(function (resolve) {
    setTimeout(function () {
      assert.strictEqual(spawned, 2, 'auto respawned after backoff');
      resolve();
    }, 5600);
  });
});

test('restart attempts reset after a registered connection', function (t) {
  t.after(function () { manager.stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  var { manager, dir, config } = makeManager();
  manager.start();
  // 第一次崩溃 → 计划重连
  fakeProcess.emit('exit', 1);
  return new Promise(function (resolve) {
    setTimeout(function () {
      assert.strictEqual(spawned, 2, 'respawned once after failure');
      resolve();
    }, 5600);
  }).then(function () {
    // 注入日志让轮询以为连接成功 → 重连计数清零
    fs.writeFileSync(config.RUNTIME.tunnelLog,
      'https://abc-xyz.trycloudflare.com\nRegistered tunnel connection');
    return new Promise(function (resolve) { setTimeout(resolve, 1200); });
  }).then(function () {
    // 第二次崩溃：计数已清零，仍应继续重连
    fakeProcess.emit('exit', 0);
    return new Promise(function (resolve) {
      setTimeout(function () {
        assert.strictEqual(spawned, 3, 'continues restarting after reset');
        resolve();
      }, 5600);
    });
  });
});

test('stop prevents further auto-restarts', function (t) {
  var { manager, dir } = makeManager();
  t.after(function () { manager.stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  manager.start();
  manager.stop();
  fakeProcess.emit('exit', 1);
  var attemptsBefore = spawned;
  return new Promise(function (resolve) {
    setTimeout(function () {
      assert.strictEqual(spawned, attemptsBefore, 'no respawn after manual stop');
      resolve();
    }, 5600);
  });
});
