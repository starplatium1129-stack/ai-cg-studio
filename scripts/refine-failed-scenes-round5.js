#!/usr/bin/env node

/** Final compatibility rewrite for four scenes that need a simpler visual contract. */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const shardDir = path.join(ROOT, 'data', 'scenes');
const files = [path.join(ROOT, 'data', 'scenes.json'), ...fs.readdirSync(shardDir)
  .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
  .map((name) => path.join(shardDir, name))];

const fixes = {
  sc052: {
    prompt: '1girl, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, pink hair ribbons, complete navy school uniform, (one single full-frame illustration:1.8), side view, Nene and one partial dark-haired male standing in the same scene, male face beside her cheek giving one gentle cheek kiss, their shoulders visible together, her hand clasping his hand, school rooftop chain-link fence, starry summer night, shy happy blush, medium close-up, <lora:ayachi_nene_v14:0.8>',
    negative: '2girls, second white-haired girl, duplicate, clone, split screen, comic panel, manga panel, triptych, storyboard, inset portrait, picture-in-picture, frame border, collage, multiple views, close-up inset',
  },
  sc096: {
    prompt: '1girl, solo, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, pink hair ribbons, solid plain pastel blue oversized t-shirt, midnight kitchen, (one large open ice cream tub held against her chest:1.7), spoon in her left hand, (second spoon extended toward the viewer with her right hand:1.7), sharing ice cream, startled shy smile, open refrigerator light, medium shot, <lora:ayachi_nene_v14:0.8>',
    negative: 'ice cream cone, waffle cone, extra arms, extra hands, merged spoons, spoon through body, text, writing, shirt print, logo, mascot, slogan',
  },
  sc148: {
    story: '【成年 After Story · 究极幻想大片 · 史诗级双女主】跨越魔法与超能力的界限，两个世界的防线在废墟中重叠。黎明第一缕曙光破开长夜，宁宁与夏目并肩站在发光的星空法阵上，披着同系黑色战斗披风；宁宁的粉色束带与夏目的战术腰带仍保留着各自鲜明的印记。两人各自握住一柄冷光利刃，同时回头看向作为最终指挥官的你，红晕与决绝在熟悉的脸上交织——「我们的灵魂协定，将在此刻斩断终焉！」',
    storyJa: '【寧々＆夏目・大人のアフターストーリー・究極の幻想大作・二人のヒロイン】魔法と異能の境界を越え、二つの世界の防衛線が廃墟で重なった。夜明けの最初の光が長い夜を切り裂き、寧々と夏目は輝く星空の魔法陣の上に並び、同じ意匠の黒い戦闘用マントを羽織っている。寧々の桃色のストラップと夏目の戦術ベルトには、それぞれの面影が残っていた。二人は一振りずつ冷光の刃を握り、最後の指揮官であるあなたへ同時に振り返る。見慣れた顔には赤みと決意が交差した。――「私たちの魂の盟約で、今ここに終焉を断ち切る！」',
    prompt: '2girls, two women only, (Ayachi Nene with white hair and purple eyes and pink hair ribbons on left:1.6), (Shiki Natsume with black hair and yellow eyes and two red hairclips and mole under eye on right:1.6), distinct different faces, both women wearing matching black battle capes over dark fitted combat uniforms, Nene has pink crisscross straps, Natsume has black tactical utility belt, each woman holding one identical glowing blue energy blade, standing side by side on one purple star magic circle, ruined city at dawn, both looking back at viewer, cinematic medium full shot, <lora:ayachi_nene_v14:0.5>, <lora:shiki_natsume_v14:0.5>',
    negative: '3girls, extra girl, pink hair, duplicate, clone, identical twins, witch hat, school uniform, different costumes, dress, swapped hair colors, swapped eye colors, heterochromia, one weapon, extra weapon',
  },
  sc251: {
    prompt: '1girl, solo, shiki_natsume, black hair, very long hair, yellow eyes, two red hairclips, mole under eye, white casual blouse, (standing directly beside an apartment balcony railing:1.7), outdoor balcony clearly visible, laundry fluttering behind her, (one open book held in both hands at chest height:1.75), both hands gripping book covers, strong breeze blowing her long black hair sideways toward viewer, hair crossing foreground, close eye contact, red ears, subtle blush, autumn afternoon sunlight, medium shot, <lora:shiki_natsume_v14:0.9>',
    negative: 'table, desk, book on table, loose paper, separate sheet, indoor room, closed window, still hair, empty hands, text, writing, logo',
    removeTags: ['close_up'],
    addTags: ['medium_shot'],
    camera: '半身中景',
  },
};

function tokens(value = '') {
  return value.split(',').map((token) => token.trim()).filter(Boolean);
}

function dedupe(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = value.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const found = new Set();
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) continue;
  const selected = data.filter((scene) => fixes[scene.id]);
  for (const scene of selected) {
    const fix = fixes[scene.id];
    found.add(scene.id);
    scene.prompt = fix.prompt;
    scene.negative = dedupe([...tokens(scene.negative), ...tokens(fix.negative)]).join(', ');
    if (fix.story) scene.story = fix.story;
    if (fix.storyJa) scene.storyJa = fix.storyJa;
    if (Array.isArray(scene.tags) && (fix.removeTags || fix.addTags)) {
      const removed = new Set(fix.removeTags || []);
      scene.tags = dedupe([...scene.tags.filter((tag) => !removed.has(tag)), ...(fix.addTags || [])]);
    }
    if (fix.camera) scene.camera = fix.camera;
    scene.auditRevision = 'round5-2026-07-22';
  }
  if (WRITE && selected.length) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  if (selected.length) console.log(`${WRITE ? 'updated' : 'would update'} ${path.relative(ROOT, file)}: ${selected.length}`);
}
const missing = Object.keys(fixes).filter((id) => !found.has(id));
console.log(`round-5 definitions: ${Object.keys(fixes).length}; located: ${found.size}; missing: ${missing.length}`);
if (missing.length) process.exitCode = 1;
