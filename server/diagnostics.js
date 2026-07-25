'use strict';

var fs = require('fs');
var path = require('path');

var TOKEN_IN_URL = /([?&]token=)[^&\s"'`]+/gi;
var TOKEN_KV = /\b(token|aics_token)\b(\s*[:=]\s*)(["']?)[A-Za-z0-9+/=_-]{8,}\3/gi;
var HEX_LONG = /\b[a-f0-9]{32,}\b/gi;

function maskSecret(value) {
  var text = String(value || '');
  if (!text) return '';
  if (text.length <= 4) return '****';
  return '…' + text.slice(-4);
}

function redactText(text) {
  return String(text || '')
    .replace(TOKEN_IN_URL, '$1[REDACTED]')
    .replace(TOKEN_KV, function (_, key, sep) { return key + sep + '[REDACTED]'; })
    .replace(HEX_LONG, function (match) {
      // Keep short structural hashes alone; mask likely tokens (>=32 hex).
      return match.length >= 32 ? ('…' + match.slice(-4)) : match;
    });
}

function readLogTail(filePath, maxBytes) {
  maxBytes = Math.max(1024, Number(maxBytes) || 64 * 1024);
  try {
    if (!fs.existsSync(filePath)) return { path:filePath, available:false, text:'' };
    var size = fs.statSync(filePath).size;
    var start = Math.max(0, size - maxBytes);
    var fd = fs.openSync(filePath, 'r');
    try {
      var length = size - start;
      var buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, start);
      return {
        path:filePath,
        available:true,
        bytes:size,
        truncated:start > 0,
        text:redactText(buffer.toString('utf8'))
      };
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    return { path:filePath, available:false, error:String(error && error.message || error), text:'' };
  }
}

function redactConfig(raw) {
  var source = raw && typeof raw === 'object' ? raw : {};
  var out = {};
  Object.keys(source).forEach(function (key) {
    var value = source[key];
    if (/token|password|secret|auth/i.test(key) && (typeof value === 'string' || typeof value === 'number')) {
      out[key] = maskSecret(value);
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactConfig(value);
      return;
    }
    out[key] = value;
  });
  return out;
}

function summarizeToken(token) {
  var text = String(token || '');
  return {
    present:!!text,
    length:text.length,
    suffix:text ? maskSecret(text) : ''
  };
}

function buildDiagnosticsPayload(options) {
  options = options || {};
  var logs = options.logs || {};
  return {
    type:'aics-diagnostics',
    schemaVersion:1,
    exportedAt:options.exportedAt || new Date().toISOString(),
    appVersion:String(options.appVersion || ''),
    nodeVersion:String(options.nodeVersion || process.version || ''),
    platform:String(options.platform || process.platform || ''),
    control:options.control || {},
    gateway:options.gateway || {},
    tunnel:options.tunnel || {},
    showcase:options.showcase || {},
    config:redactConfig(options.config || {}),
    token:summarizeToken(options.token || ''),
    logs:{
      control:logs.control || null,
      gateway:logs.gateway || null,
      tunnel:logs.tunnel || null
    }
  };
}

module.exports = {
  maskSecret:maskSecret,
  redactText:redactText,
  redactConfig:redactConfig,
  readLogTail:readLogTail,
  summarizeToken:summarizeToken,
  buildDiagnosticsPayload:buildDiagnosticsPayload
};
