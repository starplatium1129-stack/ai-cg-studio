'use strict';

const fs = require('fs');
const path = require('path');

const popularPath = path.resolve(__dirname, '../../data/popular-characters.json');
const blueprintPath = path.resolve(__dirname, '../../data/scene-blueprints.json');

const charData = JSON.parse(fs.readFileSync(popularPath, 'utf8'));
const bpData = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

// 18 位热门角色的官方动画名厂 / 权威美学锚点
const STUDIO_AESTHETICS = {
  raiden_shogun: { studio: 'genshin impact, official anime art, miHoYo style' },
  sakurajima_mai: { studio: 'cloverworks, official anime screencap, anime coloring' },
  tokisaki_kurumi: { studio: 'tsunako, official anime screencap, anime coloring' },
  frieren: { studio: 'madhouse, official anime screencap, anime coloring' },
  artoria_pendragon: { studio: 'ufotable, type-moon, cinematic anime screenshot, emiya-san chi no kyou no gohan' },
  hatsune_miku: { studio: 'rella, official vocaloid art, vibrant concert lighting' },
  yuzuriha_inori: { studio: 'production i.g, redjuice, official anime screencap' },
  yukinoshita_yukino: { studio: 'feel. (studio), official anime screencap, anime coloring' },
  elaina: { studio: 'c2c, official anime screencap, anime coloring' },
  misaka_mikoto: { studio: 'j.c.staff, official anime screencap, anime coloring' },
  makima: { studio: 'mappa, official anime screencap, anime coloring' },
  tohsaka_rin: { studio: 'ufotable, type-moon, cinematic anime screenshot' },
  rem_rezero: { studio: 'white fox, official anime screencap, anime coloring' },
  emilia_rezero: { studio: 'white fox, official anime screencap, anime coloring' },
  roxy_migurdia: { studio: 'studio bind, official anime screencap, anime coloring' },
  illyasviel_von_einzbern: { studio: 'silver link, ufotable, official anime screencap' },
  kitagawa_marin: { studio: 'cloverworks, official anime screencap, anime coloring' },
  kisara_engage_kiss: { studio: 'a-1 pictures, tsunako, official anime screencap' }
};

// 注入动画官方美学到 popular-characters
charData.characters.forEach(char => {
  const meta = STUDIO_AESTHETICS[char.id];
  if (meta) {
    char.animeStudio = meta.studio;
  }
});

// 优化 75 个场景蓝图，确保提示词包含镜头机位与经典光影层级
bpData.blueprints.forEach(bp => {
  // 确保 promptTokens 中包含清晰的景深与体积光
  const tokens = new Set(bp.promptTokens || []);
  tokens.add('volumetric_lighting');
  tokens.add('depth_of_field');
  tokens.add('clean_face');
  bp.promptTokens = Array.from(tokens);
});

fs.writeFileSync(popularPath, JSON.stringify(charData, null, 2) + '\n', 'utf8');
fs.writeFileSync(blueprintPath, JSON.stringify(bpData, null, 2) + '\n', 'utf8');

console.log('Successfully updated popular characters and scene blueprints with anime studio aesthetics.');
