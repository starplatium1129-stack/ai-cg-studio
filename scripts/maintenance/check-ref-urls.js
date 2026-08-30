'use strict';
// 验证 character-reference-view.json 的 URL 与磁盘参考图文件是否匹配
// （2026-08-21 起数据源从 characterReferenceData.ts 内嵌字面量外移为运行时 JSON；
//   2026-08-29 参考图迁出项目 → AI 工作区 CharacterReferences，URL 前缀
//   /character-references/，脚本同时兼容旧 /assets/ 前缀兜底）
const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync('data/character-reference-view.json', 'utf8'));
const root = process.cwd();
// 参考图实体根：优先 AI 工作区（AI_WORKSPACE_ROOT/CharacterReferences），
// 找不到则退回项目 assets（兼容未迁移的旧环境）。
const refRoot = (() => {
  const ws = process.env.AI_WORKSPACE_ROOT || path.resolve(root, '..', 'AI');
  const candidate = path.join(ws, 'CharacterReferences');
  return fs.existsSync(candidate) ? candidate : path.join(root, 'assets');
})();
function refUrlToPath(url) {
  if (url.startsWith('/character-references/')) {
    return path.join(refRoot, url.replace(/^\/character-references\//, ''));
  }
  return path.join(root, url.replace(/^\/assets\//, ''));
}
let total = 0, missing = 0;
for (const profile of Object.values(data)) {
  for (const outfit of profile.outfits || []) {
    for (const ref of outfit.references || []) {
      // 2026-08-31 设计图基线占位：pending 无 url（图未生成），门禁跳过不报红。
      if (ref.pending || !ref.url) continue;
      total++;
      if (!fs.existsSync(refUrlToPath(ref.url))) {
        missing++;
        if (missing <= 15) console.log('MISSING:', ref.url);
      }
    }
  }
}
console.log('total urls:', total, '| missing on disk:', missing, '| pending skipped（设计图占位）| refRoot:', refRoot);
