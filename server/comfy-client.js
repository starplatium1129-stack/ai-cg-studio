'use strict';

/**
 * ComfyUI 客户端身份与重启孤儿清理（2026-08-16 审计，方案 A）。
 *
 * 背景：网关每次重启都随机生成 client_id 时，重启前提交给 ComfyUI 的任务会变成
 * 「没人认领」的孤儿——继续占 GPU、无人轮询、结果无人消费（详见 docs/audit-2026-08-16.md
 * 第九节）。方案 A：client_id 持久化（与 gateway_token 同目录），启动时清理属于
 * 本网关的遗留 prompt（定向取消，GPU 立即释放；结果本就在重启时丢失，不重收养）。
 *
 * 任何失败都静默降级（ComfyUI 未就绪/接口差异不影响网关启动；持久化失败退回
 * 随机 id，功能不受影响只是重启后无法识别旧任务）。
 */

var crypto = require('crypto');
var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');

var CLIENT_ID_PATTERN = /^[a-zA-Z0-9-]{8,80}$/;

function stateDir(config) {
  if (config && config.RUNTIME && config.RUNTIME.state) return config.RUNTIME.state;
  if (config && config.RUNTIME_ROOT) return path.join(config.RUNTIME_ROOT, 'state');
  return '';
}

/** 稳定 client_id：首次生成后原子持久化（tmp+rename），此后重启复用。 */
function clientIdFor(config, namespace) {
  var dir = stateDir(config);
  var randomId = function () {
    return 'aics-' + namespace + '-' + crypto.randomBytes(12).toString('hex');
  };
  if (!dir) return randomId();
  var file = path.join(dir, 'comfy_client_' + namespace + '.id');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    return randomId();
  }
  try {
    // 读已有 id（文件不存在属正常首启，不能走异常路径）。
    var existing = '';
    try { existing = fs.readFileSync(file, 'utf8').trim(); } catch (error) { existing = ''; }
    if (existing && CLIENT_ID_PATTERN.test(existing)) return existing;
    var fresh = randomId();
    var temporary = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(temporary, fresh + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, file);
    return fresh;
  } catch (error) {
    // 状态目录不可写：退回随机 id。
    return randomId();
  }
}

function requestComfy(config, method, pathname, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var target;
    try { target = new URL(config.COMFY_HOST); } catch (error) {
      reject(new Error('ComfyUI 地址无效'));
      return;
    }
    target.pathname = pathname;
    target.search = '';
    var client = target.protocol === 'https:' ? https : http;
    var req = client.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: method,
      path: target.pathname,
      headers: { Accept: 'application/json' },
      timeout: timeoutMs || 8000,
    }, function (res) {
      var chunks = [];
      var size = 0;
      res.on('data', function (chunk) {
        size += chunk.length;
        if (size > 1024 * 1024) { req.destroy(new Error('响应过大')); return; }
        chunks.push(chunk);
      });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf8');
        var data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (error) { /* 非 JSON 视为空 */ }
        resolve({ status: res.statusCode || 0, data: data });
      });
    });
    req.on('error', function (error) { reject(error); });
    req.on('timeout', function () { req.destroy(new Error('超时')); });
    req.end();
  });
}

/** 从 ComfyUI /queue 的 running/pending 里挑出属于本网关的 prompt_id。 */
function ownedPromptIds(queue, clientId) {
  var ids = [];
  (Array.isArray(queue) ? queue : []).forEach(function (item) {
    // ComfyUI 队列项结构：[exec_info, prompt_id, number, client_id, ...]
    if (Array.isArray(item) && item[1] && item[3] === clientId) ids.push(String(item[1]));
  });
  return ids;
}

/**
 * 启动清理：取消属于本网关（client_id 匹配）但已无人跟踪的遗留任务。
 * 返回实际取消的 prompt_id 列表；任何一步失败都静默跳过。
 */
async function cancelOrphanPrompts(config, clientId) {
  var cancelled = [];
  try {
    var queue = await requestComfy(config, 'GET', '/queue', 8000);
    var data = queue.data || {};
    var running = data.queue_running || data.running;
    var pending = data.queue_pending || data.pending;
    var targets = ownedPromptIds(running, clientId).concat(ownedPromptIds(pending, clientId));
    for (var i = 0; i < targets.length; i += 1) {
      try {
        var response = await requestComfy(config, 'POST', '/api/jobs/' + encodeURIComponent(targets[i]) + '/cancel', 8000);
        if (response.status >= 200 && response.status < 300) cancelled.push(targets[i]);
      } catch (error) {
        // 单条取消失败继续其余。
      }
    }
  } catch (error) {
    // ComfyUI 未就绪或接口差异：跳过清理。
  }
  return cancelled;
}

/**
 * 启动清理接线：立即 + 30s 后各试一次（网关常先于 ComfyUI 启动，重试幂等无害）。
 * anima/video 两路由曾各有一份相同实现（仅日志前缀不同），2026-08-21 收口到这里。
 * 任何失败都静默降级（见 cancelOrphanPrompts）。
 */
function sweepOrphanPromptsAfterStart(config, clientId, logLabel) {
  var run = function () {
    void cancelOrphanPrompts(config, clientId).then(function (cancelled) {
      if (cancelled.length) {
        console.warn('[' + logLabel + '] 启动清理：已取消 ' + cancelled.length + ' 个重启遗留的 ComfyUI 任务');
      }
    });
  };
  run();
  var retry = setTimeout(run, 30 * 1000);
  if (typeof retry.unref === 'function') retry.unref();
}

module.exports = {
  clientIdFor: clientIdFor,
  cancelOrphanPrompts: cancelOrphanPrompts,
  sweepOrphanPromptsAfterStart: sweepOrphanPromptsAfterStart,
};
