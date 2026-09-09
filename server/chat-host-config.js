'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function chatHostConfigPath(config) {
  return path.resolve(config.RUNTIME.state, 'chat_api_config.json');
}

// Chat and video share invalidation. File identity is part of the cache key.
function createHostConfigStore(io = fs) {
  const cache = new Map();
  function readHostConfig(config) {
    const file = chatHostConfigPath(config);
    try {
      const stat = io.statSync(file);
      const signature = [stat.mtimeMs, stat.ctimeMs, stat.size, stat.ino].join(':');
      const cached = cache.get(file);
      if (cached?.signature === signature) return { ...cached.value };
      const parsed = JSON.parse(io.readFileSync(file, 'utf8'));
      const baseUrl = String(parsed?.baseUrl || '').trim();
      const model = String(parsed?.model || '').trim();
      const apiKey = String(parsed?.apiKey || '').trim();
      if (!baseUrl || !model) { cache.delete(file); return null; }
      const pathname = typeof parsed.pathname === 'string' && parsed.pathname
        ? parsed.pathname : new URL('chat/completions', baseUrl.replace(/\/+$/, '') + '/').pathname;
      const value = { baseUrl, pathname, model, apiKey };
      cache.delete(file);
      cache.set(file, { signature, value });
      if (cache.size > 16) cache.delete(cache.keys().next().value);
      return { ...value };
    } catch { cache.delete(file); return null; }
  }

  function writeHostConfig(config, value) {
    const file = chatHostConfigPath(config);
    io.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = file + '.' + randomUUID() + '.tmp';
    let descriptor;
    try {
      descriptor = io.openSync(temporary, 'wx', 0o600);
      io.writeFileSync(descriptor, JSON.stringify(value, null, 2));
      io.fsyncSync(descriptor);
      io.closeSync(descriptor); descriptor = undefined;
      io.renameSync(temporary, file);
      cache.delete(file);
    } finally {
      if (descriptor !== undefined) io.closeSync(descriptor);
      try { io.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }

  function deleteHostConfig(config) {
    const file = chatHostConfigPath(config);
    try { io.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    cache.delete(file);
  }
  return { readHostConfig, writeHostConfig, deleteHostConfig };
}

module.exports = { chatHostConfigPath, createHostConfigStore, ...createHostConfigStore() };
