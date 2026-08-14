'use strict';

const fs = require('fs');
const path = require('path');

const scenesPath = path.resolve(__dirname, '../../data/scenes.json');
const scenes = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));

// 15 个黄金人工审计场景严格原样保留
const PRESERVED_IDS = new Set([
  'sc001', 'sc010', 'sc012', 'sc015', 'sc029', 'sc030', 'sc034',
  'sc037', 'sc050', 'sc053', 'sc056', 'sc075', 'sc141', 'sc166', 'sc280'
]);

function buildAnimaCaption(scene) {
  if (PRESERVED_IDS.has(scene.id) && scene.animaCaption) {
    return scene.animaCaption;
  }

  const tags = scene.tags || [];
  const location = scene.location || '';
  const time = scene.time || scene.timeOfDay || '';
  const _weather = scene.weather || '';
  const camera = scene.camera || '';
  const lighting = scene.lighting || '';
  const _emotion = scene.emotion || '';
  const story = scene.story || '';
  const title = scene.title || '';
  const text = `${title} ${story} ${location} ${tags.join(' ')}`;

  // 1. 视角与构图
  let viewPrefix = 'In a medium shot';
  if (/特写|close/i.test(camera) || tags.includes('close_up')) {
    viewPrefix = 'In a close-up framing';
  } else if (/全身|远景|wide/i.test(camera) || tags.includes('wide_shot') || tags.includes('full_body')) {
    viewPrefix = 'In a wide full-body view';
  } else if (/第一人称|pov/i.test(camera) || tags.includes('pov')) {
    viewPrefix = 'From a first-person POV';
  } else if (/仰视|low/i.test(camera) || tags.includes('low_angle')) {
    viewPrefix = 'From a dramatic low angle';
  } else if (/俯视|high/i.test(camera) || tags.includes('high_angle')) {
    viewPrefix = 'From an overhead view';
  } else if (/侧面|side/i.test(camera) || tags.includes('side_view')) {
    viewPrefix = 'In a side-view composition';
  }

  // 2. 地点与环境
  let placePhrase = 'in a quiet room';
  if (/教室/.test(text) || tags.includes('classroom')) {
    placePhrase = 'by the large windows of an empty classroom';
  } else if (/图书馆|书架/.test(text) || tags.includes('library')) {
    placePhrase = 'between tall wooden bookshelves in the tranquil library';
  } else if (/天台|屋顶/.test(text) || tags.includes('rooftop')) {
    placePhrase = 'beside the safety fence on the open school rooftop';
  } else if (/咖啡|女仆|店/.test(text) || tags.includes('cafe')) {
    placePhrase = 'inside the warm cafe with polished wooden tables';
  } else if (/樱花|公园|树下/.test(text) || tags.includes('park') || tags.includes('cherry_blossoms')) {
    placePhrase = 'under blooming cherry blossom trees in the park';
  } else if (/温泉|浴室|浴缸|澡堂/.test(text) || tags.includes('onsen') || tags.includes('bath')) {
    placePhrase = 'in the warm, steaming water of a quiet bath';
  } else if (/海滩|海边|沙滩|浪花/.test(text) || tags.includes('beach')) {
    placePhrase = 'along the sandy shoreline with gentle ocean waves';
  } else if (/神社|鸟居|结界/.test(text) || tags.includes('shrine')) {
    placePhrase = 'before the vermilion torii gate and stone lanterns at the shrine';
  } else if (/花火|烟火|祭典/.test(text) || tags.includes('fireworks') || tags.includes('festival')) {
    placePhrase = 'watching colorful festival fireworks burst across the night sky';
  } else if (/街道|街景|巷/.test(text) || tags.includes('street')) {
    placePhrase = 'along the quiet city street';
  } else if (/卧室|床|被窝|睡/.test(text) || tags.includes('bedroom') || tags.includes('bed')) {
    placePhrase = 'in a private bedroom on soft bedding';
  } else if (/雪|冬|雪夜/.test(text) || tags.includes('snow') || tags.includes('snowfall')) {
    placePhrase = 'in a serene snow-dusted winter setting';
  } else if (/实验室|研究室|监测/.test(text)) {
    placePhrase = 'inside the quiet research room surrounded by monitors';
  }

  // 3. 动作与手部道具
  let actionClause = 'she looks forward toward the viewer';
  if (tags.includes('holding_letter') || /信|短笺|便签/.test(text)) {
    actionClause = 'she holds a sealed letter with both hands';
  } else if (tags.includes('holding_umbrella') || /雨伞|撑伞|伞/.test(text)) {
    actionClause = 'she holds an open umbrella aloft with one hand';
  } else if (tags.includes('holding_gift') || /礼物|包装盒/.test(text)) {
    actionClause = 'she gently presents a wrapped gift box';
  } else if (tags.includes('holding_cup') || tags.includes('drinking_tea') || /茶|咖啡|杯子/.test(text)) {
    actionClause = 'she cradles a warm steaming cup with both hands';
  } else if (tags.includes('holding_book') || tags.includes('reading') || /翻看|书|魔导书/.test(text)) {
    actionClause = 'she turns the page of an open book';
  } else if (tags.includes('holding_hands') || /牵手|握住手|十指/.test(text)) {
    actionClause = 'she reaches forward and gently clasps the viewer\'s hand';
  } else if (/围裙|做饭|勺/.test(text)) {
    actionClause = 'she stands beside the kitchen counter';
  } else if (tags.includes('sleeping') || tags.includes('lying') || /躺|熟睡|倚靠/.test(text)) {
    actionClause = 'she rests comfortably against soft pillows';
  } else if (tags.includes('looking_back') || tags.includes('over_shoulder') || /回头|回望/.test(text)) {
    actionClause = 'she turns back over her shoulder';
  } else if (tags.includes('sitting') || /坐/.test(text)) {
    actionClause = 'she sits gracefully';
  } else if (tags.includes('walking') || /漫步|走/.test(text)) {
    actionClause = 'she strolls forward';
  } else if (tags.includes('standing') || /立于|站在/.test(text)) {
    actionClause = 'she stands poised';
  }

  // 4. 情绪与神态（避免 with 重叠）
  let emotionClause = '';
  if (/害羞|脸红|慌乱/i.test(text) || tags.includes('blush') || tags.includes('shy')) {
    emotionClause = 'with a gentle blush on her cheeks';
  } else if (/期待|欢欣/i.test(text) || tags.includes('expectant')) {
    emotionClause = 'with bright expectant eyes';
  } else if (/温柔|微笑/i.test(text) || tags.includes('smile') || tags.includes('gentle')) {
    emotionClause = 'with a soft, reassuring smile';
  } else if (/感动|眼泪|泪/i.test(text) || tags.includes('tears')) {
    emotionClause = 'with glistening, emotive eyes';
  } else if (/认真|专注/i.test(text) || tags.includes('serious')) {
    emotionClause = 'with a focused and calm expression';
  }

  const subjectClause = emotionClause ? `${actionClause} ${emotionClause}` : actionClause;

  // 5. 光照与氛围
  let lightPhrase = 'under soft ambient lighting';
  if (/窗光/.test(lighting) || tags.includes('window_light')) {
    lightPhrase = 'as clear window sunlight streams across the frame';
  } else if (/夕照|夕阳|黄昏|golden/i.test(lighting) || /夕|黄昏/.test(time) || tags.includes('golden_hour')) {
    lightPhrase = 'as warm golden-hour sunlight illuminates the scene';
  } else if (/逆光|backlit/i.test(lighting) || tags.includes('backlit')) {
    lightPhrase = 'with soft radiant backlighting tracing her silhouette';
  } else if (/月光|moon/i.test(lighting) || /夜|月/.test(time) || tags.includes('moonlight')) {
    lightPhrase = 'as cool silver moonlight bathes the surroundings';
  } else if (/夜灯|灯光|candle|lantern/i.test(lighting) || tags.includes('lantern_light')) {
    lightPhrase = 'as warm amber lantern light glows softly';
  } else if (/阴天|柔光|overcast/i.test(lighting) || tags.includes('overcast')) {
    lightPhrase = 'under diffused overcast daylight';
  }

  return `${viewPrefix} ${placePhrase}, ${subjectClause}, ${lightPhrase}.`;
}

let count = 0;
scenes.forEach(scene => {
  if (!PRESERVED_IDS.has(scene.id) || !scene.animaCaption) {
    scene.animaCaption = buildAnimaCaption(scene);
    count++;
  }
});

fs.writeFileSync(scenesPath, JSON.stringify(scenes, null, 2) + '\n', 'utf8');
console.log(`Refined and generated animaCaption for ${count} scenes in ${scenesPath}`);
