'use strict';

/**
 * migrate-exact-tokens-space.js — 批量将括号消歧角色 tag 从下划线形式改为
 * Anima 官方空格形式（2026-08-21 待办，A/B 已验证还原度不降）。
 *
 * 改动文件：
 *   - data/popular-characters.json (exactTokens / identityTokens / aliases)
 *   - data/characters.json (traits)
 *   - data/character-reference-standards.json (prompts)
 * 不动 research 字段（Danbooru 标签文献引用，本名即下划线形式）。
 */

const fs = require('fs');
const path = require('path');

function toSpaced(token) {
  const match = String(token).match(/^([a-z0-9_'’]+)_\(([a-z0-9_’']+)\)$/i);
  if (!match) return null;
  return match[1].replace(/_/g, ' ') + ' (' + match[2].replace(/_/g, ' ') + ')';
}

// prompt 字符串内的消歧 tag 整词替换（前后界为逗号/行首行尾/空白）
function toSpacedInText(text) {
  return String(text).replace(/(^|,\s*)([a-z0-9_'’]+)_\(([a-z0-9_’']+)\)(?=\s*,|$)/gim,
    function (_, prefix, name, qualifier) {
      return prefix + name.replace(/_/g, ' ') + ' (' + qualifier.replace(/_/g, ' ') + ')';
    });
}

let totalChanges = [];

/* 1. popular-characters.json */
{
  const file = path.resolve('data', 'popular-characters.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const chars = Array.isArray(data) ? data : data.characters;
  for (const c of chars) {
    for (const field of ['exactTokens', 'identityTokens', 'aliases']) {
      if (!Array.isArray(c[field])) continue;
      c[field] = c[field].map(t => {
        const s = toSpaced(t);
        if (s) { totalChanges.push(`popular:${c.id}.${field}: ${t} -> ${s}`); }
        return s || t;
      });
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/* 2. characters.json */
{
  const file = path.resolve('data', 'characters.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const chars = Array.isArray(data) ? data : data.characters;
  for (const c of chars) {
    if (!Array.isArray(c.traits)) continue;
    c.traits = c.traits.map(t => {
      const s = toSpaced(t);
      if (s) { totalChanges.push(`characters:${c.id}.traits: ${t} -> ${s}`); }
      return s || t;
    });
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/* 3. character-reference-standards.json — token 数组与 prompt 模板都改 */
{
  const file = path.resolve('data', 'character-reference-standards.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const walk = (node, where) => {
    if (Array.isArray(node)) { node.forEach((n, i) => walk(n, where)); return; }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if ((key === 'identityTokens' || key === 'exactTokens' || key === 'aliases') && Array.isArray(value)) {
          node[key] = value.map(t => {
            const s = toSpaced(t);
            if (s) { totalChanges.push(`standards:${where}.${key}: ${t} -> ${s}`); }
            return s || t;
          });
        } else if ((key === 'prompt' || key === 'positive') && typeof value === 'string') {
          const nextValue = toSpacedInText(value);
          if (nextValue !== value) {
            totalChanges.push(`${where}.${key}: replaced`);
            node[key] = nextValue;
          }
        } else {
          walk(value, `${where}.${key}`);
        }
      }
    }
  };
  walk(data, 'standards');
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

console.log(`total changes: ${totalChanges.length}`);
totalChanges.forEach(l => console.log('  ' + l));
