'use strict';
// 与网关共用参考图根目录；缺素材仍然失败，不将开发机缺图变成虚假通过。
const fs = require('fs');
const path = require('path');
const { resolveCharRefRoot } = require('../../server/config');

function auditReferenceView(data, root, env = process.env) {
  const appRoot = path.resolve(env.AICS_APP_ROOT || root);
  const assetsRoot = path.resolve(env.AICS_ASSETS_ROOT || path.join(appRoot, 'assets'));
  const refRoot = resolveCharRefRoot(appRoot, env, env.AI_WORKSPACE_ROOT);
  const result = { total: 0, missing: 0, pending: 0, refRoot, errors: [] };
  for (const [id, profile] of Object.entries(data)) {
    const seen = new Set();
    for (const outfit of profile.outfits || []) {
      if (seen.has(outfit.outfitId)) result.errors.push(id + ': duplicate outfit ' + outfit.outfitId);
      seen.add(outfit.outfitId);
      for (const ref of outfit.references || []) {
        if (ref.pending === true) { result.pending++; continue; }
        result.total++;
        let target = '';
        const url = typeof ref.url === 'string' ? ref.url : '';
        const prefix = url.startsWith('/character-references/') ? '/character-references/' :
          url.startsWith('/assets/') ? '/assets/' : '';
        const base = prefix === '/character-references/' ? refRoot : assetsRoot;
        if (prefix && base) {
          try {
            const suffix = decodeURIComponent(url.slice(prefix.length));
            const candidate = path.resolve(base, suffix);
            const relative = path.relative(base, candidate);
            if (relative && !relative.startsWith('..') && !path.isAbsolute(relative) && !/[?#\0]/.test(suffix)) target = candidate;
          } catch { /* 无效编码视作断链，不访问越界路径。 */ }
        }
        let exists = false;
        try { exists = Boolean(target) && fs.statSync(target).isFile(); } catch { /* 缺图 */ }
        if (!exists) {
          result.missing++;
          if (result.missing <= 15) result.errors.push(id + '/' + outfit.outfitId + ': ' + (url || '(missing URL)'));
        }
      }
    }
  }
  return result;
}

function main() {
  const root = path.resolve(__dirname, '..', '..');
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/character-reference-view.json'), 'utf8'));
  const result = auditReferenceView(data, root);
  console.log('total urls:', result.total, '| missing:', result.missing, '| pending:', result.pending, '| refRoot:', result.refRoot || '(not configured)');
  for (const error of result.errors) console.error('REFERENCE:', error);
  if (result.errors.length) {
    console.error('先核对 AICS_CHARACTER_REF_ROOT / AI_WORKSPACE_ROOT 与素材同步；不要用修改索引或 pending 掩盖缺图。');
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { auditReferenceView };
