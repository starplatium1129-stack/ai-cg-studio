#!/usr/bin/env node

/** Fourth-pass prompt corrections for the final ten unstable scenes. */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const shardDir = path.join(ROOT, 'data', 'scenes');
const files = [path.join(ROOT, 'data', 'scenes.json'), ...fs.readdirSync(shardDir)
  .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
  .map((name) => path.join(shardDir, name))];

const NO_TEXT = 'text, writing, letters, words, typography, title, logo, symbols, graphic print, gibberish text, unreadable text, speech bubble, dialogue bubble, captions, subtitles';
const fixes = {
  sc009: {
    prompt: '1girl, solo, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, pink hair ribbons, (large plain pink hardcover book held upright in both hands directly in front of her mouth:1.75), both hands gripping book edges, only her shy eyes peeking over the top edge, window-side cafe booth, one white coffee cup on table, golden afternoon light, medium shot, <lora:ayachi_nene_v14:0.8>',
    negative: `${NO_TEXT}, illustrated book cover, magazine on table, drinking coffee, book below mouth`,
  },
  sc052: {
    prompt: '1girl, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, pink hair ribbons, (single unified image:1.75), one continuous scene, partial male face entering from left edge and kissing her cheek, male hand holding her hand, school rooftop chain-link fence, starry summer night, shy happy blush, medium close-up, <lora:ayachi_nene_v14:0.8>',
    negative: '2girls, second white-haired girl, duplicate, cloned character, split screen, comic panel, manga panel, triptych, storyboard, inset portrait, picture-in-picture, frame border',
  },
  sc059: {
    prompt: '1girl, solo, shiki_natsume, black hair, long hair, yellow eyes, red hairclips, mole under eye, oversized white button-up shirt with two buttons open, bare legs, subtle blush, morning kitchen, (one red empty coffee mug and one blue empty coffee mug side by side on table:1.8), exactly two mugs total, both mugs same size, no mug in hand, medium shot, window light, <lora:shiki_natsume_v14:0.9>',
    negative: 'one mug, single mug, third mug, extra mug, many mugs, cup collection, mug held toward viewer, full mug, teapot',
    removeTags: ['close_up'],
    addTags: ['medium_shot'],
    camera: '半身中景',
  },
  sc065: {
    prompt: '1girl, solo, shiki_natsume, black hair, long hair, yellow eyes, red hairclips, mole under eye, (solid plain burgundy hardcover book held vertically in both hands:1.75), blank book with absolutely no markings, book covering her mouth and nose, only shy yellow eyes visible above the book, library window, autumn afternoon light, close-up portrait, <lora:shiki_natsume_v14:0.9>',
    negative: `${NO_TEXT}, decorated book, printed book spine, book below chin, open mouth visible`,
  },
  sc086: {
    prompt: '1girl, solo, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, pink hair ribbons, complete navy school uniform, navy blazer, white blouse, pleated skirt, black thighhighs, holding one transparent umbrella, wet empty road after rain, rainbow, looking back with bright smile, (one partial male hand entering from bottom edge:1.4), medium full shot, <lora:ayachi_nene_v14:0.8>',
    negative: '2girls, multiple girls, second white-haired girl, extra girl, duplicate, clone, twin, background person, crowd, nude, naked, topless, bottomless, underwear, swimsuit',
  },
  sc090: {
    prompt: '1girl, solo, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, pink hair ribbons, complete navy school uniform, navy blazer, white blouse, pleated skirt, black thighhighs, (crouching alone in extreme foreground:1.5), (right index finger touching the ground and tracing one heart groove through fallen pink cherry petals:1.8), hand and petal heart clearly visible, empty cherry tree path, spring morning, medium shot, <lora:ayachi_nene_v14:0.8>',
    negative: `2girls, multiple girls, second white-haired girl, extra girl, duplicate, clone, twin, background person, standing, finger on lips, shushing, nude, naked, topless, bottomless, ${NO_TEXT}`,
  },
  sc096: {
    prompt: '1girl, solo, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, pink hair ribbons, solid plain pastel blue oversized t-shirt with blank fabric, midnight kitchen, (red strawberry ice cream cone in her left hand:1.7), (blue mint ice cream cone in her right hand:1.7), two separate hands, exactly two complete waffle cones, one scoop on each cone, shy smile, refrigerator light, medium shot, <lora:ayachi_nene_v14:0.8>',
    negative: `${NO_TEXT}, shirt print, animal logo, mascot, slogan, one cone, single cone, cone with two scoops, third cone, extra cone, merged cones`,
  },
  sc148: {
    prompt: '2girls, two women only, ruined city street at dawn, (white-haired Ayachi Nene on left:1.6), Nene has purple eyes and very long white low twintails and pink hair ribbons, Nene wears pink crisscross strappy top and black short cape with pink lining and black pleated skirt and striped thighhigh and black witch hat with large pink bow, Nene has both empty hands raised around a purple magic circle, (black-haired Shiki Natsume on right:1.6), Natsume has yellow eyes and two red hairclips and mole under eye, Natsume is bareheaded and wears a black tactical vest with utility pouches and thigh holster, (Natsume alone holds a glowing blue energy blade in her right hand:1.65), standing side by side, cinematic medium full shot, <lora:ayachi_nene_v14:0.47>, <lora:shiki_natsume_v14:0.47>',
    negative: '3girls, extra girl, pink hair, duplicate, clone, identical twins, witch hat on black-haired woman, witch costume on black-haired woman, weapon in white-haired woman hands, school uniform on black-haired woman, tactical vest on white-haired woman, swapped hair colors, swapped eye colors',
  },
  sc215: {
    prompt: '1girl, solo, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, pink hair ribbons, navy school uniform, moonlit library, (one thick antique book opened in both of her hands:1.75), both hands visibly gripping the book covers, blank cream pages facing viewer, no loose paper, holding book forward as an invitation to read together, gentle brave smile, desk lamp, medium shot, <lora:ayachi_nene_v14:0.8>',
    negative: `${NO_TEXT}, loose paper, separate sheet, letter, note card, book left on table, empty hands, closed book`,
  },
  sc251: {
    prompt: '1girl, solo, shiki_natsume, black hair, long hair, yellow eyes, red hairclips, mole under eye, white casual blouse, sunny apartment balcony, windblown hair brushing toward viewer, (one open book held securely in both of her hands at chest height:1.75), fingers gripping both sides of the book, blank cream pages angled toward her, no loose paper, sitting close to viewer, subtle blush, eye contact, warm afternoon light, close-up, <lora:shiki_natsume_v14:0.9>',
    negative: `${NO_TEXT}, loose paper, separate sheet, letter, note card, book left on table, empty hands, closed book`,
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
    scene.auditRevision = 'round4-2026-07-22';
    if (Array.isArray(scene.tags) && (fix.removeTags || fix.addTags)) {
      const removed = new Set(fix.removeTags || []);
      scene.tags = dedupe([...scene.tags.filter((tag) => !removed.has(tag)), ...(fix.addTags || [])]);
    }
    if (fix.camera) scene.camera = fix.camera;
  }
  if (WRITE && selected.length) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  if (selected.length) console.log(`${WRITE ? 'updated' : 'would update'} ${path.relative(ROOT, file)}: ${selected.length}`);
}
const missing = Object.keys(fixes).filter((id) => !found.has(id));
console.log(`round-4 definitions: ${Object.keys(fixes).length}; located: ${found.size}; missing: ${missing.length}`);
if (missing.length) process.exitCode = 1;
