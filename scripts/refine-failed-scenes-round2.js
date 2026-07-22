#!/usr/bin/env node

/**
 * Strengthen the 52 scenes rejected by the first direct-vision audit.
 * Run without arguments to preview, or with --write to update aggregate + shards.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const AGGREGATE = path.join(ROOT, 'data', 'scenes.json');
const SHARD_DIR = path.join(ROOT, 'data', 'scenes');

const NO_TEXT = 'speech bubble, dialogue bubble, captions, subtitles, letters, words, typography, gibberish text, unreadable text, comic panel, manga panel';
const NO_DUPLICATE = '2girls, multiple girls, extra girl, extra person, duplicate character, cloned character, background person, crowd';
const WITCH = '(official Ayachi Nene witch costume:1.5), (pink crisscross strappy top:1.45), pink collar with gold buckle, black short cape with vivid pink lining, black pleated mini skirt, asymmetrical legwear, one black-and-white striped thighhigh, one white frilled sock, black strappy boots, wide black witch hat with pink striped hatband and large pink bow';

const fixes = {
  sc008: { add: '(POV hand holding her hand:1.5), interlocked fingers, two joined hands in foreground, walking down shrine steps', remove: ['praying'] },
  sc009: { add: '(open manga held in both hands:1.5), peeking shyly over the manga, window-side cafe seat, coffee cup on table' },
  sc011: { add: '(university lecture hall:1.55), rows of classroom desks, chalkboard, campus morning', neg: 'train interior, bus interior, vehicle interior, carriage' },
  sc017: { add: '(large classroom blackboard covered with farewell chalk messages:1.55), colorful chalk writing across blackboard, holding a school uniform button', remove: ['diploma'], neg: 'diploma, certificate, scroll' },
  sc022: { add: '(open photo album with clearly visible photographs:1.55), turning a thick album page, sitting together at home table', neg: 'loose papers, document folder, blank pages' },
  sc024: { add: '(bedroom bedside visit:1.5), hospital visit bag, medicine boxes, fruit in grocery bag, face mask, worried caring expression', remove: ['apron'], neg: 'maid, maid headdress, restaurant' },
  sc025: { add: '(medium close-up:1.55), (face clearly visible:1.45), whale shark swimming overhead, aquarium tunnel', remove: ['wide_shot', 'wide shot', 'full_body', 'full body'] },
  sc026: { add: '(sports equipment storage room:1.55), shelves packed with balls and rackets, stacked gym mats, metal storage racks, locked door' },
  sc028: { replaceLead: '2girls, (Ayachi Nene on the left:1.5), (white hair, very long low twintails, purple eyes, pink hair ribbons:1.45), (Shiki Natsume on the right:1.5), (black hair, long hair, yellow eyes, red hairclips, mole under eye:1.45), distinct different faces, Nene wearing pale pink apron, Natsume wearing dark red apron, cooking together side by side, warm kitchen', loraWeight: 0.55, neg: 'heterochromia, swapped eye colors, wrong eye color, same eye color, same hair color, duplicate, cloned face, identical twins, extra girl' },
  sc038: { add: '(single girl only:1.5), (one person only:1.5), empty background, no bystanders', neg: NO_DUPLICATE },
  sc039: { add: '(clear corked glass message bottle held in both hands:1.55), blank rolled note visibly inside the bottle, seaside sunset' },
  sc043: { add: '(smartphone held for a video call:1.55), phone screen facing viewer, outdoor hot spring, wet hair', neg: 'no phone, empty hands' },
  sc044: { add: '(living room sofa:1.55), (sitting astride viewer lap:1.5), holding television remote, POV male hands at her waist', neg: 'bathroom, toilet, sink, bathtub' },
  sc047: { add: '(male arms embracing her from behind:1.55), one hand pulling the curtain closed, floor-to-ceiling apartment window, evening city view' },
  sc051: { add: '(male arms embracing her from behind:1.55), sauce smear on her cheek, cooking apron, kitchen counter' },
  sc052: { add: '(school rooftop with chain-link fence:1.55), starry night sky, male giving her a cheek kiss, holding hands, rooftop bench', neg: 'beach, ocean, sand, picnic blanket' },
  sc059: { add: '(two empty coffee cups together on the kitchen table:1.55), oversized white button-up shirt, two shirt buttons undone' },
  sc064: { add: '(POV lap pillow:1.55), her head resting on viewer thighs, lying down, closed book resting on her chest' },
  sc065: { add: '(open book covering the lower half of her face:1.55), eyes peeking shyly over the book, library window' },
  sc080: { add: 'clean cinematic illustration, no written dialogue', neg: NO_TEXT },
  sc086: { add: '(single girl only:1.5), (one person only:1.5), empty background, no bystanders', neg: NO_DUPLICATE },
  sc088: { add: '(indoor art gallery:1.55), standing directly in front of a large framed painting, museum spotlights, polished gallery floor', neg: 'street, road, sidewalk, outdoors' },
  sc090: { add: '(crouching and drawing a name shape with one finger in fallen cherry petals:1.55), close view of hand tracing the petal-covered ground' },
  sc096: { add: '(two ice cream cones:1.55), holding one ice cream cone in each hand, plain oversized t-shirt without print', neg: NO_TEXT },
  sc102: { add: '(black tactical vest:1.55), (wrists bound behind a chair:1.5), concrete safehouse wall, thigh holster, torn and partly unzipped tactical gear', neg: 'ordinary office, business suit, unbound hands' },
  sc103: { add: '(POV lap straddle:1.55), thighs around viewer waist, viewer hands on her hips, close body contact' },
  sc105: { add: `${WITCH}, (sitting astride viewer lap:1.45), bedroom moonlight`, neg: 'generic witch dress, plain black dress, full-length gown, simple witch costume' },
  sc106: { add: '(black tactical vest:1.55), thigh holster, utility belts, pinned against a concrete safehouse wall, tense close contact', neg: 'hoodie, swimsuit, casual jacket' },
  sc107: { add: '(photography darkroom:1.55), red safelight, film developing trays, photo enlarger, workbench, sensor cable', neg: 'bedroom, bed, hotel room' },
  sc109: { add: '(single girl only:1.5), (one person only:1.5), empty background, no bystanders', neg: NO_DUPLICATE },
  sc110: { add: '(torn-open white office blouse:1.5), ripped black pantyhose, skirt lifted, sitting on office desk, POV male hand, intense intimate interaction', neg: 'fully dressed, intact clothes, ordinary office portrait' },
  sc116: { add: 'clean cinematic illustration, no written dialogue', neg: NO_TEXT },
  sc137: { add: '(unzipped evening gown still visibly worn:1.55), open-back formal gown, gown fabric wrapped around body and spread over bed', neg: 'pajamas, nightgown, lingerie only, nude without gown' },
  sc138: { add: '(one single woman reflected in one large framed bathroom mirror:1.55), back view in foreground, her face visible only inside mirror reflection', neg: `${NO_DUPLICATE}, two separate women, twin` },
  sc140: { add: 'clean cinematic illustration, no written dialogue', neg: NO_TEXT },
  sc142: { add: `${WITCH}, apron worn over witch costume, floating cooking utensils, purple magic sparks, levitating frying pan`, neg: 'plain apron only, ordinary cook, generic witch dress' },
  sc148: { replaceLead: '2girls, (Shiki Natsume:1.5), (black hair, long hair, yellow eyes, red hairclips, mole under eye:1.45), (Ayachi Nene:1.45), (white hair, very long low twintails, purple eyes, pink hair ribbons:1.4), Natsume and Nene together, clearly different faces, intimate two-shot', loraWeight: 0.58, neg: 'pink-haired stranger, wrong hair color, duplicate, cloned face, identical twins, extra girl, 3girls' },
  sc152: { add: `${WITCH}, costume straps being carefully loosened, bedroom`, neg: 'generic witch dress, plain black dress, full-length gown, simple witch costume' },
  sc164: { add: '(glowing magic circle under the classroom desk:1.55), witch sigil, floating spellbook, purple magic sparks, locked clubroom' },
  sc167: { add: '(wrists bound overhead:1.55), black tactical vest, utility straps, safehouse sofa, tense restrained pose', neg: 'unbound wrists, casual clothes' },
  sc168: { add: '(nude body wearing only a frilled cooking apron:1.55), apron clearly tied at the bare back, bar counter, cooking utensils', remove: ['towel_slip', 'towel slip'], neg: 'towel, bath towel, bathrobe, dress under apron' },
  sc175: { add: '(black oversized button-up shirt:1.55), unbuttoned black shirt, bare legs', neg: 'white shirt, pale shirt' },
  sc189: { add: 'clean cinematic illustration, no written dialogue', neg: NO_TEXT },
  sc197: { add: '(black evening gown visibly open and unzipped:1.55), formal gown with high slit, gown fabric spread across the bed', neg: 'pajamas, nightgown, casual sleepwear' },
  sc215: { add: '(plain unmarked antique book cover:1.55), closed old book without writing', neg: NO_TEXT },
  sc234: { add: `${WITCH}, ceremonial ribbon restraint, moonlit bedroom`, neg: 'generic witch dress, plain black dress, full-length gown, simple witch costume' },
  sc236: { add: '(single girl only:1.5), (one person only:1.5), empty background, no bystanders', neg: NO_DUPLICATE },
  sc240: { add: '(single girl only:1.5), (one person only:1.5), empty background, no bystanders', neg: NO_DUPLICATE },
  sc242: { add: '(single girl only:1.5), (one person only:1.5), holding a completely blank sheet of paper, empty background', neg: `${NO_DUPLICATE}, ${NO_TEXT}` },
  sc244: { add: '(black cat sleeping on her lap:1.55), Nene asleep alone on sofa, (one girl only:1.45)', neg: NO_DUPLICATE },
  sc251: { add: '(plain unmarked book cover:1.55), open book with blank cream pages, no printed writing', neg: NO_TEXT },
  sc254: { add: '(single girl only:1.5), (one person only:1.5), empty background, no bystanders', neg: NO_DUPLICATE },
};

function splitPrompt(prompt) {
  return prompt.split(',').map((part) => part.trim()).filter(Boolean);
}

function dedupe(parts) {
  const seen = new Set();
  return parts.filter((part) => {
    const key = part.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function removeTokens(prompt, removals = []) {
  const keys = new Set(removals.map((value) => value.toLowerCase().replace(/_/g, ' ').trim()));
  return splitPrompt(prompt).filter((part) => {
    const normalized = part.toLowerCase().replace(/_/g, ' ').trim();
    return !keys.has(normalized);
  }).join(', ');
}

function changeLoraWeights(prompt, weight) {
  return prompt.replace(/<lora:(ayachi_nene_v14|shiki_natsume_v14):[0-9.]+>/g, `<lora:$1:${weight}>`);
}

function applyFix(scene) {
  const fix = fixes[scene.id];
  if (!fix) return false;
  const original = scene.prompt;
  let prompt = removeTokens(original, fix.remove);
  if (fix.replaceLead) {
    const parts = splitPrompt(prompt);
    const loras = parts.filter((part) => part.startsWith('<lora:'));
    const identity = /^(1girl|2girls|solo|multiple_girls|ayachi_nene|shiki_natsume|white_hair|black_hair|very_long_hair|long_hair|low_twintails|purple_eyes|yellow_eyes|ahoge|hair_ribbon|hairclip|mole_under_eye)$/i;
    const nonIdentity = parts.filter((part) => !part.startsWith('<lora:') && !identity.test(part));
    prompt = [...splitPrompt(fix.replaceLead), ...nonIdentity, ...loras].join(', ');
  } else {
    prompt = `${fix.add}, ${prompt}`;
  }
  if (fix.loraWeight) prompt = changeLoraWeights(prompt, fix.loraWeight);
  scene.prompt = dedupe(splitPrompt(prompt)).join(', ');
  if (fix.neg) scene.negative = dedupe([...splitPrompt(scene.negative || ''), ...splitPrompt(fix.neg)]).join(', ');
  scene.auditRevision = 'round2-2026-07-22';
  return scene.prompt !== original;
}

function updateFile(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) return { found: [] };
  const found = [];
  for (const scene of data) {
    if (fixes[scene.id]) {
      found.push(scene.id);
      applyFix(scene);
    }
  }
  if (WRITE && found.length) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return { found };
}

const files = [AGGREGATE, ...fs.readdirSync(SHARD_DIR)
  .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
  .map((name) => path.join(SHARD_DIR, name))];
const allFound = new Set();
for (const file of files) {
  const { found } = updateFile(file);
  found.forEach((id) => allFound.add(id));
  if (found.length) console.log(`${WRITE ? 'updated' : 'would update'} ${path.relative(ROOT, file)}: ${found.length} scenes`);
}
const missing = Object.keys(fixes).filter((id) => !allFound.has(id));
console.log(`round-2 definitions: ${Object.keys(fixes).length}; located: ${allFound.size}; missing: ${missing.length}`);
if (missing.length) {
  console.error(`missing scene ids: ${missing.join(', ')}`);
  process.exitCode = 1;
}
