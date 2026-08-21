'use strict';

/**
 * server/logger.js 单元测试：级别写入、按天文件名、debug 门控、保留期清理。
 * appendFile 为异步落盘，断言前统一等待一拍。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createLogger } = require('../../server/logger');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aics-logger-'));
}

function todayKey() {
  const d = new Date();
  return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

function readLog(dir, prefix) {
  return fs.readFileSync(path.join(dir, `${prefix}-${todayKey()}.log`), 'utf8');
}

const FLUSH_MS = 40;

test('info/warn/error write timestamped lines to the daily file', async () => {
  const dir = makeTmpDir();
  const logger = createLogger({ dir, prefix: 'gw' });
  logger.info('hello info');
  logger.warn('hello warn');
  logger.error('hello error', new Error('boom'));
  await new Promise(r => setTimeout(r, FLUSH_MS));

  const content = readLog(dir, 'gw');
  assert.ok(content.includes('[INFO] hello info'), 'info line present');
  assert.ok(content.includes('[WARN] hello warn'), 'warn line present');
  assert.ok(content.includes('[ERROR] hello error'), 'error line present');
  assert.match(content, /\[\d{4}-\d{2}-\d{2}T/, 'ISO timestamp present');
  assert.ok(content.includes('boom'), 'error detail (stack/message) appended');
});

test('debug() is silent unless enabled, persists to file when enabled', async () => {
  const dir = makeTmpDir();
  const logger = createLogger({ dir, prefix: 'gw', debug: false });
  logger.debug('should not persist');
  await new Promise(r => setTimeout(r, FLUSH_MS));
  if (fs.existsSync(path.join(dir, `gw-${todayKey()}.log`))) {
    assert.ok(!readLog(dir, 'gw').includes('should not persist'));
  }

  const loud = createLogger({ dir, prefix: 'gw2', debug: true });
  loud.debug('debug visible');
  await new Promise(r => setTimeout(r, FLUSH_MS));
  assert.ok(readLog(dir, 'gw2').includes('[DEBUG] debug visible'),
    'enabled debug lines persist with DEBUG level');
});

test('retention sweep removes expired logs at init and keeps fresh/foreign ones', () => {
  const dir = makeTmpDir();
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const key = d => '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  fs.writeFileSync(path.join(dir, 'gateway-' + key(old) + '.log'), 'stale\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'other-' + key(old) + '.log'), 'not-mine\n', 'utf8');

  createLogger({ dir, prefix: 'gateway', retainDays: 14 });
  assert.strictEqual(fs.existsSync(path.join(dir, 'gateway-' + key(old) + '.log')), false,
    'expired gateway log deleted synchronously at init');
  assert.strictEqual(fs.existsSync(path.join(dir, 'other-' + key(old) + '.log')), true,
    'other-prefix logs untouched');
});

test('missing dir degrades to console-only without throwing', () => {
  const logger = createLogger({ dir: '', prefix: 'gw' });
  assert.doesNotThrow(() => {
    logger.info('no-dir ok');
    logger.error('no-dir err');
  });
});
