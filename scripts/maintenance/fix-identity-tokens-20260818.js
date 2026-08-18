'use strict';
// 2026-08-18 重渲染前置修正：白夜/塞西莉亚 identityTokens 剥离完整服装词
// （身份层只保留发/眼/体型/饰品特征；服装归 outfit 层，避免渲染互相污染）
const fs = require('fs');

const REMOVE = {
  mimori_byakuya: ['victorian_white_dress', 'lolita_dress', 'high_collar', 'frilled_collar', 'lace_trim', 'ribbon_bowtie'],
  saint_cecilia: ['white_dress', 'nun_habit', 'frilled_collar', 'high_collar'],
};

// 1. popular-characters.json
{
  const file = 'data/popular-characters.json';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [id, remove] of Object.entries(REMOVE)) {
    const c = data.characters.find(x => x.id === id);
    c.identityTokens = c.identityTokens.filter(t => !remove.includes(t));
    console.log('popular', id, '->', c.identityTokens.length, 'tokens');
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// 2. characters.json traits 同步
{
  const file = 'data/characters.json';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const pc = JSON.parse(fs.readFileSync('data/popular-characters.json', 'utf8'));
  for (const id of Object.keys(REMOVE)) {
    const ch = data.find(x => x.id === id);
    const pop = pc.characters.find(x => x.id === id);
    ch.traits = [...pop.identityTokens];
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('characters.json traits synced');
}

// 3. character-reference-standards.json identityTokens 同步
{
  const file = 'data/character-reference-standards.json';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const pc = JSON.parse(fs.readFileSync('data/popular-characters.json', 'utf8'));
  for (const id of Object.keys(REMOVE)) {
    const std = data.characters.find(x => x.id === id);
    const pop = pc.characters.find(x => x.id === id);
    std.identityTokens = [...pop.identityTokens];
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('standards identityTokens synced');
}
console.log('OK');
