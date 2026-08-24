'use strict';

/**
 * ComfyUI execution progress bridge.
 * The monitor is deliberately best-effort: history polling remains authoritative
 * for completion, while this channel only enriches the public job state.
 */
var WebSocket = require('ws');

function websocketUrl(host, clientId) {
  var target = new URL(host);
  target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:';
  target.pathname = '/ws';
  target.search = '?clientId=' + encodeURIComponent(clientId);
  return target.toString();
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampProgress(value, max) {
  if (!finite(value) || !finite(max) || max <= 0) return null;
  return Math.max(0, Math.min(1, value / max));
}

function readMessage(raw) {
  var data = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '');
  try { return JSON.parse(data); } catch (error) { return null; }
}

function createComfyProgressMonitor(config, clientId, options) {
  options = options || {};
  var WebSocketImpl = options.WebSocket || WebSocket;
  var reconnectMs = Number(options.reconnectMs) > 0 ? Number(options.reconnectMs) : 2000;
  var subscriptions = new Map();
  var socket = null;
  var reconnectTimer = null;
  var closed = false;

  function scheduleReconnect() {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connect();
    }, reconnectMs);
    if (typeof reconnectTimer.unref === 'function') reconnectTimer.unref();
  }

  function handleMessage(raw) {
    var message = readMessage(raw);
    if (!message || typeof message.type !== 'string') return;
    var data = message.data && typeof message.data === 'object' ? message.data : {};
    var promptId = data.prompt_id || message.prompt_id;
    if (!promptId || !subscriptions.has(String(promptId))) return;
    var job = subscriptions.get(String(promptId));
    if (!job || job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') return;

    if (message.type === 'execution_start') {
      job.progress = null;
      job.currentNode = null;
      job.progressText = 'ComfyUI 开始执行…';
    } else if (message.type === 'progress') {
      job.progress = clampProgress(data.value, data.max);
      job.currentNode = data.node == null ? job.currentNode : String(data.node);
      job.progressText = job.progress === null
        ? 'ComfyUI 正在推理…'
        : '采样 ' + data.value + ' / ' + data.max + (job.currentNode ? ' · 节点 ' + job.currentNode : '');
    } else if (message.type === 'executing') {
      job.currentNode = data.node == null ? null : String(data.node);
      job.progressText = job.currentNode ? '执行节点 ' + job.currentNode : 'ComfyUI 正在收尾…';
      if (data.node == null) job.progress = 1;
    } else if (message.type === 'execution_cached') {
      job.progressText = 'ComfyUI 使用缓存节点…';
    }
    if (typeof options.onUpdate === 'function') options.onUpdate(job, message.type, data);
  }

  function connect() {
    if (closed || socket) return;
    var next;
    try { next = new WebSocketImpl(websocketUrl(config.COMFY_HOST, clientId)); } catch (error) { scheduleReconnect(); return; }
    socket = next;
    next.on('message', handleMessage);
    next.on('open', function () { if (typeof options.onOpen === 'function') options.onOpen(); });
    next.on('error', function (error) { if (typeof options.onError === 'function') options.onError(error); });
    next.on('close', function () {
      if (socket === next) socket = null;
      scheduleReconnect();
    });
  }

  function watch(promptId, job) {
    subscriptions.set(String(promptId), job);
    connect();
  }

  function unwatch(promptId) { subscriptions.delete(String(promptId)); }

  function close() {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    subscriptions.clear();
    if (socket) {
      var current = socket;
      socket = null;
      try { current.close(); } catch (error) {}
    }
  }

  connect();
  return { watch:watch, unwatch:unwatch, close:close, handleMessage:handleMessage };
}

module.exports = { createComfyProgressMonitor, websocketUrl, clampProgress, readMessage };
