'use strict';
// 验证 character-reference-view.json 的 URL 与磁盘参考图文件是否匹配
// （2026-08-21 起数据源从 characterReferenceData.ts 内嵌字面量外移为运行时 JSON）
const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync('data/character-reference-view.json', 'utf8'));
const root = process.cwd();
let total = 0, missing = 0;
for (const profile of Object.values(data)) {
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
