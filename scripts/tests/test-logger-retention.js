'use strict';

/**
 * server/logger.js 保留期清理契约测试（2026-08-28 补，审计 P1-11）。
 *
 * 覆盖 sweepRetention 双判据（此前只回收本 prefix 的按天日志，
 * comfyui/translate 等旁路日志与旧格式残留无限积压）：
 *   1. 本 prefix 超期按天日志 → 清；
 *   2. 其他 prefix 的超期按天日志（comfyui-YYYYMMDD.log）→ 清；
 *   3. 无日期后缀且 mtime 超期（translate.log 旧残留）→ 清；
 *   4. 新鲜按天日志与活跃旁路日志 → 保留；
 *   5. 非 .log 文件 → 保留。
 */

const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createLogger } = require('../../server/logger');

function touch(full, mtime) {
  fs.writeFileSync(full, 'x');
  if (mtime) fs.utimesSync(full, mtime, mtime);
}

test('logger sweepRetention：双判据回收 + 新鲜文件保留', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-logger-'));
  const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  const freshDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

  // 应被清理
  touch(path.join(dir, 'gateway-20250101.log'), oldDate); // 本 prefix 超期
  touch(path.join(dir, 'comfyui-20250101.log'), oldDate); // 旁路 prefix 超期
  touch(path.join(dir, 'gateway.log'), oldDate);          // 收口前旧格式残留
  touch(path.join(dir, 'translate.log'), oldDate);        // mtime 超期的旁路日志
  // 应保留
  touch(path.join(dir, 'gateway-20260822.log'), freshDate); // 保留期内按天日志
  touch(path.join(dir, 'comfyui.stderr.log'), new Date());  // 活跃旁路日志
  touch(path.join(dir, 'notes.txt'), oldDate);              // 非 .log 不越权

  try {
    createLogger({ dir, prefix: 'gateway', retainDays: 14 });
    const left = fs.readdirSync(dir).sort();
    assert.deepEqual(
      left.filter((n) => n.endsWith('.log')).sort(),
      ['comfyui.stderr.log', 'gateway-20260822.log'],
    );
    assert.ok(left.includes('notes.txt'), '非日志文件不越权清理');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
