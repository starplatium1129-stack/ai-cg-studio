'use strict';
// 验证 characterReferenceData.ts 的 URL 与磁盘参考图文件是否匹配
const fs = require('fs');
const path = require('path');
const ts = fs.readFileSync('src/utils/characterReferenceData.ts', 'utf8');
const start = ts.indexOf('= {');
const end = ts.indexOf('\n\nexport function', start);
const jsonText = ts.slice(start + 2, end).trim().replace(/;?\s*$/, '');
const data = JSON.parse(jsonText);
const root = process.cwd();
let total = 0, missing = 0;
for (const [cid, profile] of Object.entries(data)) {
  for (const outfit of profile.outfits || []) {
    for (const ref of outfit.references || []) {
      total++;
      const rel = ref.url.replace(/^\/assets\//, 'assets/');
      const p = path.join(root, rel);
      if (!fs.existsSync(p)) {
        missing++;
        if (missing <= 15) console.log('MISSING:', ref.url);
      }
    }
  }
}
console.log('total urls:', total, '| missing on disk:', missing);
