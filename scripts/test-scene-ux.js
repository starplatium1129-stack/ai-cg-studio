const assert = require('assert');
const path = require('path');
const { readJson } = require('./scene-store');
const sceneUx = require('../tools/scene-ux');

const root = path.resolve(__dirname, '..');
const scenes = readJson(path.join(root, 'data', 'scenes.json'));
const curation = readJson(path.join(root, 'data', 'curation.json'));

assert(scenes.length > 0, 'scene data must not be empty');
assert(curation.signatureSceneIds.length > 0, 'signature scenes must be configured');

const sorted = [...scenes].sort((left, right) => sceneUx.priority(right, curation) - sceneUx.priority(left, curation));
assert.strictEqual(sceneUx.tier(sorted[0], curation), 'signature', 'signature scenes must sort first');
assert.deepStrictEqual(sorted.slice(0, curation.signatureSceneIds.length).map((scene) => scene.id), curation.signatureSceneIds,
  'signature scenes must preserve the curator-defined order');

for (const intent of Object.keys(curation.searchAliases || {})) {
  const matches = scenes.filter((scene) => sceneUx.matchesSearch(scene, intent, curation));
  assert(matches.length > 0, 'semantic intent must return scenes: ' + intent);
}

const neneMatches = scenes.filter((scene) => sceneUx.matchesSearch(scene, '宁宁经典感', curation));
assert(neneMatches.every((scene) => scene.char === 'nene' || scene.char === 'triad'), 'Nene intent must not return Natsume-only scenes');
const natsumeMatches = scenes.filter((scene) => sceneUx.matchesSearch(scene, '夏目经典感', curation));
assert(natsumeMatches.every((scene) => scene.char === 'natsume' || scene.char === 'triad'), 'Natsume intent must not return Nene-only scenes');

const sentence = '我想画一个安静的夏目雨夜';
const sentenceAnalysis = sceneUx.analyzeQuery(sentence, curation);
assert.deepStrictEqual(sentenceAnalysis.residualTerms, [], 'natural-language filler must not become a required search term');
assert(sentenceAnalysis.intents.includes('安静') && sentenceAnalysis.intents.includes('夏目经典感') && sentenceAnalysis.intents.includes('雨天'),
  'natural-language search must recognize mood, character, and weather intents');
const sentenceMatches = scenes.filter((scene) => sceneUx.matchesSearch(scene, sentence, curation));
assert(sentenceMatches.length > 0, 'natural-language sentence must return scenes');
assert(sentenceMatches.every((scene) => scene.char === 'natsume' || scene.char === 'triad'), 'natural-language character intent must be respected');
assert(!sceneUx.analyzeQuery('夏目', curation).intents.includes('夏日'), 'single-character aliases must not match inside longer names');

const rankConfig = { searchAliases:{ '雨夜':['雨夜','rainy_night'] } };
const titleMatch = { id:'title', title:'雨夜告白', story:'两个人终于说出心意', char:'natsume', tags:[] };
const storyMatch = { id:'story', title:'迟来的约定', story:'故事发生在雨夜', char:'natsume', tags:[] };
assert(sceneUx.searchScore(titleMatch, '雨夜', rankConfig) > sceneUx.searchScore(storyMatch, '雨夜', rankConfig),
  'title matches must rank above story-only matches');

const preferenceNow = Date.UTC(2026, 6, 22);
const highRating = { face:5, expression:5, composition:5, hands:5, atmosphere:5 };
const lowRating = { face:1, expression:1, composition:1, hands:1, atmosphere:1 };
const profile = sceneUx.buildPreferenceProfile([
  { scene:'sc002', character:'nene', timestamp:preferenceNow - 1000, favorite:true, rating:highRating },
  { scene:'sc002', character:'nene', timestamp:preferenceNow - 2000, favorite:false, rating:highRating },
  { scene:'sc046', character:'natsume', timestamp:preferenceNow - 3000, favorite:false, rating:lowRating }
], preferenceNow);
const preferredScene = scenes.find((scene) => scene.id === 'sc002');
const weakScene = scenes.find((scene) => scene.id === 'sc046');
assert(sceneUx.personalScore(preferredScene, profile) > sceneUx.personalScore(weakScene, profile), 'high-rated favorites must receive a stronger personal score');
assert(sceneUx.isPersonalFavorite(preferredScene, profile), 'history favorites must be available to scene filters');
assert(sceneUx.personalReason(preferredScene, profile).includes('收藏'), 'personal recommendation must explain why a scene is promoted');

const sceneStory = { id:'story-bound', story:'宁宁在雨后的站台回头微笑' };
assert(sceneUx.isSceneBoundStory(sceneStory, '宁宁在雨后的站台回头微笑', ''),
  'an unchanged scene story must be recognized as scene-bound');
assert(sceneUx.isSceneBoundStory(sceneStory, '  宁宁在雨后的站台回头微笑  ', sceneStory.story),
  'scene-bound comparison must ignore surrounding whitespace');
assert(!sceneUx.isSceneBoundStory(sceneStory, '我想画夏目在海边看日落', sceneStory.story),
  'a free-form story must not be removed when an incompatible scene is cleared');

const historyTagScene = { id:'history-tags', tags:['school_uniform', 'classroom', 'window_light'] };
assert.deepStrictEqual(sceneUx.restoreHistoryManualTags({}, historyTagScene, true), historyTagScene.tags,
  'legacy history must restore compatible scene tags so the scene template remains complete');
assert.deepStrictEqual(sceneUx.restoreHistoryManualTags({ manual_tags:[] }, historyTagScene, true), [],
  'an explicit empty manual tag snapshot must not fall back to scene defaults');
assert.deepStrictEqual(
  sceneUx.restoreHistoryManualTags({ manual_tags:['school_uniform', 'custom_hand_pose', 'CLASSROOM'] }, historyTagScene, false),
  ['custom_hand_pose'],
  'incompatible history must remove built-in scene tags while preserving genuine manual additions'
);
assert.strictEqual(sceneUx.restoreHistoryStory({ story:sceneStory.story }, sceneStory, false), '',
  'an incompatible history scene must not restore story text still bound to that scene');
assert.strictEqual(sceneUx.restoreHistoryStory({ story:'我想画夏目在海边看日落' }, sceneStory, false), '我想画夏目在海边看日落',
  'an incompatible history scene must preserve a free-form story');
assert.strictEqual(sceneUx.restoreHistoryStory({ story:sceneStory.story }, sceneStory, true), sceneStory.story,
  'a compatible history scene must retain its original story');

const memory = new Map();
const storage = { getItem:(key) => memory.has(key) ? memory.get(key) : null, setItem:(key, value) => memory.set(key, value) };
sceneUx.rememberRecent(scenes[0], storage);
sceneUx.rememberRecent(scenes[1], storage);
sceneUx.rememberRecent(scenes[0], storage);
const recent = sceneUx.readRecent(storage);
assert.strictEqual(recent.length, 2, 'recent scenes must be deduplicated');
assert.strictEqual(recent[0].id, scenes[0].id, 'most recent scene must be first');

console.log('Scene UX tests passed: tiers, sentence search, relevance, preferences, and recent scenes');
