#!/usr/bin/env node

/** Third-pass prompt corrections for the 21 scenes still rejected after round 2. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const SHARD_DIR = path.join(ROOT, 'data', 'scenes');
const files = [path.join(ROOT, 'data', 'scenes.json'), ...fs.readdirSync(SHARD_DIR)
  .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
  .map((name) => path.join(SHARD_DIR, name))];

const NO_TEXT = 'text, writing, letters, words, typography, symbols, logo, graphic print, speech bubble, dialogue bubble, captions, subtitles, comic panel, manga panel, gibberish text, unreadable text, Japanese text';
const NO_EXTRA = '2girls, multiple girls, extra girl, duplicate character, cloned character, identical twins, background person';

const fixes = {
  sc009: {
    add: '(manga book held upright directly in front of her mouth:1.65), both hands gripping the left and right cover edges, shy eyes peeking over the top edge, one coffee cup on cafe table',
    remove: ['reading_manga', 'sharing_cake'],
  },
  sc017: {
    add: '(large classroom blackboard filled with colorful farewell chalk doodles:1.6), chalk hearts and flowers, deliberately blurred chalk marks, holding one uniform button',
    remove: ['signed_blackboard', 'colorful chalk writing across blackboard', '(large classroom blackboard covered with farewell chalk messages:1.55)'],
    neg: NO_TEXT,
  },
  sc028: {
    replace: '2girls, two women only, (Ayachi Nene on the left:1.55), (white hair, very long low twintails, purple eyes, pink hair ribbons:1.5), (Shiki Natsume on the right:1.55), (black hair, long hair, yellow eyes, red hairclips, mole under eye:1.5), clearly different faces, Nene wearing a white wedding dress and veil, Natsume wearing an elegant black formal dress, interlocked fingers, standing close together in a candlelit newlywed bedroom, shy emotional smiles, wedding night, warm soft light, medium shot, <lora:ayachi_nene_v14:0.52>, <lora:shiki_natsume_v14:0.52>',
    neg: '3girls, extra girl, duplicate, cloned face, identical twins, apron, kitchen, cooking, witch hat, swapped eye colors, heterochromia, wrong eye color',
    removeTags: ['close_up', 'face_focus'],
    addTags: ['medium_shot'],
    camera: '半身中景',
  },
  sc044: {
    add: '(woman straddling the male viewer on a living room sofa:1.65), her knees on both sides of viewer hips, visible male trousered thighs beneath her, POV male hands around her waist, television remote in her right hand',
    remove: ['solo', 'sitting'],
    neg: 'sitting alone, empty lap, armchair, single-person portrait',
  },
  sc052: {
    add: '(one white-haired girl receiving a cheek kiss from a partial male profile at frame edge:1.65), male hand holding her hand, chain-link rooftop fence, starry sky',
    remove: ['solo', 'kissing'],
    neg: `${NO_EXTRA}, second white-haired girl, two female faces, girl kissing girl`,
  },
  sc059: {
    add: '(exactly two empty ceramic coffee cups side by side in the foreground:1.7), both cups resting on kitchen table, her hands away from the cups, oversized white shirt with two buttons open',
    remove: ['coffee_cup'],
    neg: 'one cup, single cup, holding cup, three cups, full cup',
  },
  sc064: {
    add: '(one white-haired girl lying with her head on a male lap:1.65), visible dark male trousers beneath her head, male hand gently touching her hair, closed book on her chest, POV looking down',
    remove: ['solo'],
    neg: `${NO_EXTRA}, second white-haired girl, female lap, two female faces`,
  },
  sc065: {
    add: '(open book held vertically and covering her mouth and nose:1.7), both hands holding book directly in front of face, only shy yellow eyes visible above top edge, close-up portrait',
    remove: ['closed_eyes', 'profile'],
    neg: 'book below chin, book on table, unobstructed mouth, side profile',
  },
  sc080: {
    add: 'clean unobstructed sky, plain background without overlays',
    remove: ['confession', 'clean cinematic illustration', 'no written dialogue'],
    neg: NO_TEXT,
  },
  sc086: {
    add: '(fully clothed in complete navy school uniform:1.7), navy blazer, white blouse, pleated skirt, black thighhighs, transparent umbrella, wet road after rain, rainbow',
    neg: 'nude, naked, topless, bottomless, bare breasts, bare buttocks, underwear, swimsuit, transparent clothes',
  },
  sc090: {
    add: '(fully clothed in complete school uniform:1.7), navy blazer, white blouse, pleated skirt, black thighhighs, (crouching and tracing a heart shape in fallen cherry petals with one finger:1.65), hand touching petal-covered ground, medium shot',
    remove: ['standing', 'full_body', 'wide_shot', '(crouching and drawing a name shape with one finger in fallen cherry petals:1.55)'],
    neg: `nude, naked, topless, bottomless, underwear, swimsuit, ${NO_TEXT}`,
    removeTags: ['standing', 'full_body', 'wide_shot'],
    addTags: ['crouching', 'medium_shot'],
    camera: '半身中景',
  },
  sc096: {
    add: '(solid plain pastel blue oversized t-shirt with completely blank fabric:1.7), (exactly two ice cream cones:1.55), one cone in each hand',
    remove: ['plain oversized t-shirt without print', '(two ice cream cones:1.55)'],
    neg: `${NO_TEXT}, shirt print, animal logo, mascot, slogan, patterned shirt`,
  },
  sc102: {
    add: '(both wrists visibly tied to separate chair armrests with black silk ribbons:1.7), open palms, ribbon knots clearly visible, seated upright in metal chair, black tactical vest and thigh holster',
    remove: ['(wrists bound behind a chair:1.5)', 'bound'],
    neg: 'hands behind head, arms overhead, hidden hands, free wrists, extra hand, detached hand, malformed hand',
  },
  sc106: {
    add: '(POV male hand firmly pinning her wrist overhead against concrete wall:1.7), second male hand lifting her chin, close face-to-face distance, black tactical vest, thigh holster',
    remove: ['1girl'],
    neg: 'standing alone, empty hands, no interaction, distant full body',
  },
  sc107: {
    add: '(traditional photographic darkroom under saturated red safelight:1.7), hanging photographic prints, photo enlarger with lens column, shallow chemical developing trays, Nene lying on darkroom workbench',
    remove: ['red safelight', 'film developing trays', 'photo enlarger', 'workbench'],
    neg: 'hospital, clinic, medical tray, medical equipment, kitchen, bedroom, blue lighting, daylight',
  },
  sc140: {
    add: 'plain dark office wall, clean uninterrupted background',
    remove: ['clean cinematic illustration', 'no written dialogue'],
    neg: NO_TEXT,
  },
  sc148: {
    replace: '2girls, two women only, (white-haired Ayachi Nene standing on the left:1.6), Nene has very long white low twintails and purple eyes and pink hair ribbons, Nene wears her pink-and-black strappy witch costume and black witch hat, (black-haired Shiki Natsume standing on the right:1.6), Natsume has long black hair and yellow eyes and two red hairclips and mole under eye, Natsume is bareheaded and wears a black tactical vest and thigh holster, both women standing side by side in ruined city at dawn, purple magic circle behind Nene, Natsume holding one energy blade, cinematic medium full shot, <lora:ayachi_nene_v14:0.45>, <lora:shiki_natsume_v14:0.45>',
    neg: '3girls, extra girl, pink hair, pink-haired person, duplicate, cloned face, identical twins, witch hat on black-haired woman, witch costume on black-haired woman, tactical vest on white-haired woman, swapped hair colors, swapped eye colors, heterochromia',
  },
  sc167: {
    add: '(both wrists visibly tied together overhead with a wide black leather belt:1.75), belt loop and buckle clearly encircling wrists, arms fully extended, black tactical vest, safehouse sofa',
    remove: ['(wrists bound overhead:1.55)', 'bound'],
    neg: 'free wrists, hands merely clasped, hands behind head, invisible restraint',
  },
  sc189: {
    add: 'plain concrete interrogation room walls, clean uninterrupted background',
    remove: ['clean cinematic illustration', 'no written dialogue'],
    neg: NO_TEXT,
  },
  sc215: {
    add: '(open book facing the viewer with two completely blank cream pages:1.7), no visible front cover, hands holding page edges, moonlit library',
    remove: ['(plain unmarked antique book cover:1.55)', 'closed old book without writing', 'holding_book'],
    neg: `${NO_TEXT}, book cover facing viewer, title on book, decorated cover`,
  },
  sc251: {
    add: '(open book facing the viewer with two completely blank cream pages:1.7), no visible front cover, hands holding page edges, sunny balcony',
    remove: ['(plain unmarked book cover:1.55)', 'open book with blank cream pages', 'no printed writing', 'holding_book'],
    neg: `${NO_TEXT}, book cover facing viewer, title on book, decorated cover`,
  },
};

function parts(value = '') {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function dedupe(values) {
  const seen = new Set();
  return values.filter((item) => {
    const key = item.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateScene(scene) {
  const fix = fixes[scene.id];
  if (!fix) return;
  if (fix.replace) {
    scene.prompt = fix.replace;
  } else {
    const remove = new Set((fix.remove || []).map((item) => item.toLowerCase().replace(/_/g, ' ').trim()));
    const kept = parts(scene.prompt).filter((item) => !remove.has(item.toLowerCase().replace(/_/g, ' ').trim()));
    scene.prompt = dedupe([...parts(fix.add), ...kept]).join(', ');
  }
  if (fix.neg) scene.negative = dedupe([...parts(scene.negative), ...parts(fix.neg)]).join(', ');
  if (Array.isArray(scene.tags) && (fix.removeTags || fix.addTags)) {
    const removed = new Set(fix.removeTags || []);
    scene.tags = dedupe([...scene.tags.filter((tag) => !removed.has(tag)), ...(fix.addTags || [])]);
  }
  if (fix.camera) scene.camera = fix.camera;
  scene.auditRevision = 'round3-2026-07-22';
}

const found = new Set();
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) continue;
  const local = data.filter((scene) => fixes[scene.id]);
  for (const scene of local) {
    found.add(scene.id);
    updateScene(scene);
  }
  if (WRITE && local.length) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  if (local.length) console.log(`${WRITE ? 'updated' : 'would update'} ${path.relative(ROOT, file)}: ${local.length}`);
}

const missing = Object.keys(fixes).filter((id) => !found.has(id));
console.log(`round-3 definitions: ${Object.keys(fixes).length}; located: ${found.size}; missing: ${missing.length}`);
if (missing.length) process.exitCode = 1;
