'use strict';

const fs = require('fs');
const path = require('path');

const popularPath = path.resolve(__dirname, '../../data/popular-characters.json');
const data = JSON.parse(fs.readFileSync(popularPath, 'utf8'));

// 18 位热门角色的高精度视觉 DNA 升级
const UPDATES = {
  // 1. 雷电将军
  raiden_shogun: {
    identityProse: "Raiden Shogun from Genshin Impact, also known as Raiden Ei, the Electro Archon, a serene and regal woman with long lavender hair in a braid, glowing violet eyes, and a calm expressionless gaze, wearing the Raiden Shogun's flowing purple Japanese robes, bare shoulders, thigh-highs and a long braid",
    identityTokens: [
      'raiden_shogun', 'raiden_ei', '1girl', 'solo', 'long_purple_hair', 'braid', 'single_braid',
      'glowing_purple_eyes', 'bangs', 'mole_under_eye', 'mole_under_right_eye', 'golden_hairpin',
      'hair_flower', 'tassel', 'genshin_impact'
    ],
    exactTokens: ['raiden_shogun'],
  },

  // 2. 樱岛麻衣
  sakurajima_mai: {
    identityProse: "Sakurajima Mai from Rascal Does Not Dream of Bunny Girl Senpai, an elegant actress with long black hair, soft brown eyes and a composed, slightly distant air",
    identityTokens: [
      'sakurajima_mai', '1girl', 'solo', 'long_black_hair', 'straight_hair', 'purple_eyes', 'brown_eyes',
      'bangs', 'ahoge', 'rabbit_hair_ornament', 'hair_clip', 'beauty_mark'
    ],
    exactTokens: ['sakurajima_mai'],
  },

  // 3. 时崎狂三
  tokisaki_kurumi: {
    identityProse: "Tokisaki Kurumi from Date A Live, a mysterious girl with long dark hair in side twintails, two-tone red and gold eyes, and a pale elegant face, often dressed in black and crimson gothic attire",
    identityTokens: [
      'tokisaki_kurumi', '1girl', 'solo', 'long_black_hair', 'uneven_twintails', 'heterochromia',
      'red_right_eye', 'clock_eye', 'yellow_left_eye', 'bangs', 'gothic_hair_ornament', 'date_a_live'
    ],
    exactTokens: ['tokisaki_kurumi'],
  },

  // 4. 芙莉莲
  frieren: {
    identityProse: "Frieren from Frieren: Beyond Journey's End, a centuries-old elf mage with very long white hair in low twin braids, violet eyes and pointed ears, carrying an old-fashioned staff and a calm, wistful expression",
    identityTokens: [
      'frieren', '1girl', 'solo', 'long_white_hair', 'very_long_hair', 'twin_braids', 'purple_eyes',
      'elf', 'pointy_ears', 'gold_earrings', 'holding_staff', 'staff_of_frieren'
    ],
    exactTokens: ['frieren'],
  },

  // 5. 阿尔托莉雅 (Saber)
  artoria_pendragon: {
    identityProse: "Saber, Artoria Pendragon from Fate/stay night, a regal knight with blonde hair tied in an intricate braided bun, an ahoge, and clear emerald-green eyes, carrying Excalibur with an earnest, dignified bearing",
    identityTokens: [
      'artoria_pendragon', 'saber_(fate)', '1girl', 'solo', 'blonde_hair', 'braided_bun',
      'hair_bun', 'blue_hair_ribbon', 'ahoge', 'green_eyes', 'holding_sword', 'fate/stay_night'
    ],
    exactTokens: ['artoria_pendragon'],
  },

  // 6. 初音未来
  hatsune_miku: {
    identityProse: "Hatsune Miku, the VOCALOID virtual singer, a cheerful girl with iconic long teal twin-tails, bright turquoise eyes, black square hair ribbons, red 01 shoulder tattoo, and a vibrant stage presence",
    identityTokens: [
      'hatsune_miku', '1girl', 'solo', 'very_long_hair', 'twintails', 'teal_hair', 'teal_eyes',
      'black_hairband', 'hair_ribbon', '01_shoulder_tattoo', 'headset', 'vocaloid'
    ],
    exactTokens: ['hatsune_miku'],
  },

  // 7. 楪祈
  yuzuriha_inori: {
    identityProse: "Yuzuriha Inori from Guilty Crown, a delicate singer with long pink and orange-gradient twin-tails, bright crimson eyes, red hair clips, and a fragile, ethereal presence",
    identityTokens: [
      'yuzuriha_inori', '1girl', 'solo', 'gradient_hair', 'pink_hair', 'orange_hair', 'twintails',
      'red_eyes', 'red_hair_clips', 'hair_ornament', 'ahoge', 'guilty_crown'
    ],
    exactTokens: ['yuzuriha_inori'],
  },

  // 8. 雪之下雪乃
  yukinoshita_yukino: {
    identityProse: "Yukinoshita Yukino from Oregairu, a sharp and elegant young woman with long straight black hair, cool blue eyes, an ahoge, and neat red hair ribbons on her side locks",
    identityTokens: [
      'yukinoshita_yukino', '1girl', 'solo', 'long_black_hair', 'straight_hair', 'blue_eyes',
      'ahoge', 'red_hair_ribbons', 'side_locks', 'beauty_mark', 'oregairu'
    ],
    exactTokens: ['yukinoshita_yukino'],
  },

  // 9. 伊蕾娜
  elaina: {
    identityProse: "Elaina from Wandering Witch: The Journey of Elaina, an inquisitive traveling witch with very long ash-gray hair, violet eyes, a black witch hat with gold buckle, carrying her wooden broom with a confident smile",
    identityTokens: [
      'elaina_(majo_no_tabitabi)', '1girl', 'solo', 'long_grey_hair', 'ash_hair', 'purple_eyes',
      'witch_hat', 'gold_buckle', 'holding_broom', 'wooden_broom', 'majo_no_tabitabi'
    ],
    exactTokens: ['elaina'],
  },

  // 10. 御坂美琴
  misaka_mikoto: {
    identityProse: "Misaka Mikoto from A Certain Scientific Railgun, an energetic Tokiwadai student with short chestnut brown hair, warm brown eyes, white flower hair clip, and crackling blue-white electrical sparks",
    identityTokens: [
      'misaka_mikoto', '1girl', 'solo', 'short_brown_hair', 'brown_eyes', 'hair_clip',
      'flower_hair_clip', 'sparks', 'electricity', 'toaru_kagaku_no_railgun'
    ],
    exactTokens: ['misaka_mikoto'],
  },

  // 11. 玛奇玛
  makima: {
    identityProse: "Makima from Chainsaw Man, a calm Public Safety leader with long salmon-pink hair braided into a low loose braid, golden concentric-ring eyes, and an unreadable, magnetic smile",
    identityTokens: [
      'makima_(chainsaw_man)', '1girl', 'solo', 'pink_hair', 'single_braid', 'long_braid',
      'yellow_eyes', 'ringed_eyes', 'concentric_circles', 'chainsaw_man'
    ],
    exactTokens: ['makima'],
  },

  // 12. 远坂凛
  tohsaka_rin: {
    identityProse: "Tohsaka Rin from Fate/stay night, a proud and brilliant mage with long dark-brown hair in twin-tails tied with large black ribbons, clear aqua-blue eyes, and a confident, spirited expression",
    identityTokens: [
      'tohsaka_rin', '1girl', 'solo', 'long_brown_hair', 'twintails', 'black_hair_ribbons',
      'blue_eyes', 'ahoge', 'fate/stay_night'
    ],
    exactTokens: ['tohsaka_rin'],
  },

  // 13. 雷姆
  rem_rezero: {
    identityProse: "Rem from Re:Zero, a devoted demon maid with short sky-blue hair parted over her right eye, one visible bright blue eye, a pink flower hair clip and white lace ribbon, and gentle features",
    identityTokens: [
      'rem_(re_zero)', '1girl', 'solo', 'short_blue_hair', 'blue_hair', 'hair_over_one_eye',
      'blue_eyes', 'flower_hair_clip', 'hair_ribbon', 'maid_headdress', 're:zero'
    ],
    exactTokens: ['rem_(re_zero)'],
  },

  // 14. 爱蜜莉雅
  emilia_rezero: {
    identityProse: "Emilia from Re:Zero, a gentle half-elf with long silver hair, pointed elven ears, purple-blue eyes with snowflake pupils, wearing a white flower hairpin and purple hair ribbons",
    identityTokens: [
      'emilia_(re_zero)', '1girl', 'solo', 'long_silver_hair', 'white_hair', 'purple_eyes',
      'elf', 'pointy_ears', 'hair_flower', 'purple_hair_ribbon', 're:zero'
    ],
    exactTokens: ['emilia_(re_zero)'],
  },

  // 15. 洛琪希
  roxy_migurdia: {
    identityProse: "Roxy Migurdia from Mushoku Tensei, a Migurd magic teacher with long pale-blue hair tied into twin braids, blue eyes, a mole on her left collarbone, carrying a curved wooden staff",
    identityTokens: [
      'roxy_migurdia', '1girl', 'solo', 'long_blue_hair', 'twin_braids', 'blue_eyes',
      'mole_on_collarbone', 'holding_staff', 'wooden_staff', 'mushoku_tensei'
    ],
    exactTokens: ['roxy_migurdia'],
  },

  // 16. 伊莉雅
  illyasviel_von_einzbern: {
    identityProse: "Illyasviel von Einzbern from Fate/stay night, a petite homunculus girl with long snowy-white hair, bright ruby-red eyes, fine features, carrying an air of playful innocence and profound magic power",
    identityTokens: [
      'illyasviel_von_einzbern', '1girl', 'solo', 'long_white_hair', 'straight_hair',
      'red_eyes', 'ruby_eyes', 'fate/stay_night'
    ],
    exactTokens: ['illyasviel_von_einzbern'],
  },

  // 17. 喜多川海梦
  kitagawa_marin: {
    identityProse: "Kitagawa Marin from My Dress-Up Darling, a glamorous and bubbly high school gyaru with long blonde hair with pink dip-dyed tips, bright dark-pink contact lenses, long painted nails and silver ear piercings",
    identityTokens: [
      'kitagawa_marin', '1girl', 'solo', 'long_blonde_hair', 'gradient_hair', 'pink_hair_tips',
      'pink_eyes', 'earrings', 'piercing', 'painted_nails', 'sono_bisque_doll_wa_koi_wo_suru'
    ],
    exactTokens: ['kitagawa_marin'],
  },

  // 18. 木更
  kisara_engage_kiss: {
    identityProse: "Kisara from Engage Kiss, an A-class demon girl with very long pastel-pink hair, vibrant crimson eyes, an ahoge, center-parted bangs, a black hair ribbon, and an adhesive bandage on her right thigh",
    identityTokens: [
      'kisara_(engage_kiss)', '1girl', 'solo', 'long_pink_hair', 'very_long_hair', 'red_eyes',
      'crimson_eyes', 'ahoge', 'black_hair_ribbon', 'thigh_bandage', 'engage_kiss'
    ],
    exactTokens: ['kisara_(engage_kiss)'],
  }
};

let count = 0;
data.characters.forEach(char => {
  const upd = UPDATES[char.id];
  if (upd) {
    if (upd.identityProse) char.identityProse = upd.identityProse;
    if (upd.identityTokens) char.identityTokens = upd.identityTokens;
    if (upd.exactTokens) char.exactTokens = upd.exactTokens;
    count++;
  }
});

fs.writeFileSync(popularPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Successfully upgraded ${count} / ${data.characters.length} characters in ${popularPath}`);
