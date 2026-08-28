'use strict';

/**
 * scripts/maintenance/precompress.js
 *
 * 构建后预压 dist/ 与 data/ 里的文本资源为 .br / .gz。
 *
 * 为什么不用 compression 中间件就够：那是每个请求现场压一次（CPU 反复做同样的功），
 * 而且只有 gzip。实测 scenes.json gzip 229.7KB → brotli 155.2KB（−32%）。
 * 预压之后服务端只需按 Accept-Encoding 挑一个已存在的文件发出去。
 *
 * 用法: node scripts/maintenance/precompress.js [--check]
 * 已挂在 npm run build:all 之后。
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET_DIRS = ['dist', 'data'];
const COMPRESSIBLE = /\.(?:js|css|html|json|svg|txt|map)$/i;
/** 小文件压完往往更大，且省不下 RTT */
const MIN_BYTES = 1024;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function compress(file) {
  const raw = fs.readFileSync(file);
  if (raw.length < MIN_BYTES) return null;

  const brotli = zlib.brotliCompressSync(raw, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length
    }
  });
  const gzip = zlib.gzipSync(raw, { level: 9 });

  // 压不小就别留，免得服务端发出比原文更大的响应
  if (brotli.length < raw.length) fs.writeFileSync(file + '.br', brotli);
  else if (fs.existsSync(file + '.br')) fs.unlinkSync(file + '.br');
  if (gzip.length < raw.length) fs.writeFileSync(file + '.gz', gzip);
  else if (fs.existsSync(file + '.gz')) fs.unlinkSync(file + '.gz');

  return { raw: raw.length, brotli: brotli.length, gzip: gzip.length };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  let files = 0;
  let rawTotal = 0;
  let brTotal = 0;
  let gzTotal = 0;
  const missing = [];

  for (const dir of TARGET_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      if (!COMPRESSIBLE.test(file)) continue;
      if (/\.(?:br|gz)$/i.test(file)) continue;
      if (fs.statSync(file).size < MIN_BYTES) continue;

      if (checkOnly) {
        if (!fs.existsSync(file + '.br')) missing.push(path.relative(ROOT, file));
        continue;
      }
      const result = compress(file);
      if (!result) continue;
      files += 1;
      rawTotal += result.raw;
      brTotal += result.brotli;
      gzTotal += result.gzip;
    }
  }

  if (checkOnly) {
    if (missing.length) {
      console.error('缺少预压产物（先跑 npm run precompress）:');
      missing.slice(0, 10).forEach((f) => console.error('  - ' + f));
      process.exit(1);
    }
    console.log('预压产物完整。');
    return;
  }

  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log('Precompressed ' + files + ' files: ' +
    kb(rawTotal) + ' raw → ' + kb(gzTotal) + ' gzip → ' + kb(brTotal) + ' brotli' +
    ' (brotli 比 gzip 再省 ' + (100 - (brTotal / gzTotal) * 100).toFixed(0) + '%)');
}

if (require.main === module) {
  main();
}

/** 供 scripts/lib/ensure-data-build.js 复用：重建数据产物后刷新对应预压文件，
 *  避免 precompressed 中间件按文件名直发陈旧 .br/.gz。 */
module.exports = { compress };
