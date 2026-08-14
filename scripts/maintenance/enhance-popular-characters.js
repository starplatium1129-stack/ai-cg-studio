'use strict';

const fs = require('fs');
const path = require('path');

const popularPath = path.resolve(__dirname, '../../data/popular-characters.json');
const data = JSON.parse(fs.readFileSync(popularPath, 'utf8'));

// 为 18 位热门角色深度补充高精度身份特征 (identityTokens / exactTokens / identityProse / outfits)
const ENHANCEMENTS = {
  raiden_shogun: {
    identityProse: "Raiden Shogun from Genshin Impact, also known as Raiden Ei, the Electro Archon. A regal woman with very long purple braided hair in a single long braid, glowing purple eyes, and a distinct beauty mole beneath her right eye, wearing a golden hairpin with purple flower and tassel.",
    identityTokens: [
      'raiden_shogun', 'raiden_ei', '1girl', 'solo', 'long_purple_hair', 'braid', 'single_braid',
      'glowing_purple_eyes', 'bangs', 'mole_under_eye', 'mole_under_right_eye', 'golden_hairpin',
      'hair_flower', 'tassel', 'genshin_impact'
    ],
    outfits: [
      {
        id: 'shogun_robes',
        name: '将军神装',
        prose: "the Raiden Shogun's flowing purple Japanese robes, bare shoulders, thigh-highs and a long braid with gold trim, pauldron, black fingerless gloves, obi, and sash",
        tokens: [
          'japanese_clothes', 'kimono', 'purple_clothes', 'gold_trim', 'pauldron', 'black_fingerless_gloves',
          'obi', 'sash', 'bare_shoulders', 'black_thighhighs', 'detached_sleeves', 'long_sleeves'
        ],
        default: true
      },
      {
        id: 'modern_clothes',
        name: '现代便服',
        prose: "a refined modern purple dress and her signature long single braid",
        tokens: ['modern_clothing', 'dress', 'purple_dress', 'long_sleeves'],
        default: false
      }
    ]
  },
  sakurajima_mai: {
    identityProse: "Sakurajima Mai from Rascal Does Not Dream of Bunny Girl Senpai, an elegant actress with long straight black hair, soft purple-grey eyes, a delicate beauty mark, and her iconic white rabbit-shaped hair clip pinned on the side of her hair.",
    identityTokens: [
      'sakurajima_mai', '1girl', 'solo', 'long_black_hair', 'straight_hair', 'purple_eyes',
      'bangs', 'ahoge', 'rabbit_hair_ornament', 'hair_clip', 'beauty_mark'
    ],
    outfits: [
      {
        id: 'school_uniform',
        name: '峰原高校制服',
        prose: "the Minegahara High School uniform with a brown blazer, beige knit sweater vest, red necktie, white collared shirt, grey pleated skirt and black pantyhose",
        tokens: [
          'school_uniform', 'blazer', 'brown_blazer', 'sweater_vest', 'beige_vest', 'white_shirt',
          'collared_shirt', 'red_necktie', 'pleated_skirt', 'grey_skirt', 'black_pantyhose', 'loafers'
        ],
        default: true
      },
      {
        id: 'bunny_suit',
        name: '兔女郎装',
        prose: "her famous black satin bunny suit with bunny ears headband, white cuffs and collar, and black pantyhose",
        tokens: [
          'bunny_suit', 'bunny_ears', 'black_leotard', 'collar', 'cuffs', 'bowtie', 'black_pantyhose', 'high_heels'
        ],
        default: false
      }
    ]
  },
  frieren: {
    identityProse: "Frieren from Frieren: Beyond Journey's End, a centuries-old elf mage with very long white hair in low twin braids, violet eyes, pointed elven ears, gold earrings, carrying her wooden magical staff.",
    identityTokens: [
      'frieren', '1girl', 'solo', 'long_white_hair', 'very_long_hair', 'twin_braids', 'purple_eyes',
      'elf', 'pointy_ears', 'gold_earrings', 'holding_staff', 'staff_of_frieren'
    ],
    outfits: [
      {
        id: 'adventurer_robe',
        name: '法师长袍',
        prose: "her iconic white mage robe with deep hood, striped scarf, shoulder capelet, brown adventurer belt and black tights",
        tokens: [
          'robe', 'white_robe', 'striped_scarf', 'capelet', 'hood', 'belt', 'black_tights', 'boots'
        ],
        default: true
      }
    ]
  },
  tokisaki_kurumi: {
    identityProse: "Tokisaki Kurumi from Date A Live, a mysterious spirit girl with uneven long black twintails, heterochromia with a red right eye and a golden clockwork left eye.",
    identityTokens: [
      'tokisaki_kurumi', '1girl', 'solo', 'long_black_hair', 'uneven_twintails', 'heterochromia',
      'red_right_eye', 'clock_eye', 'yellow_left_eye', 'bangs', 'date_a_live'
    ],
    outfits: [
      {
        id: 'astral_dress',
        name: '神威灵装·三番',
        prose: "her signature crimson and black gothic lolita dress with black frills, high collar, hair ornament and black thigh-highs",
        tokens: [
          'gothic_lolita', 'black_dress', 'red_trim', 'frills', 'high_collar', 'black_thighhighs',
          'headdress', 'corset', 'long_dress'
        ],
        default: true
      }
    ]
  }
};

let enhanced = 0;
data.characters.forEach(char => {
  const enh = ENHANCEMENTS[char.id];
  if (enh) {
    if (enh.identityProse) char.identityProse = enh.identityProse;
    if (enh.identityTokens) char.identityTokens = enh.identityTokens;
    if (enh.outfits) {
      enh.outfits.forEach(o => {
        const target = char.outfits.find(existing => existing.id === o.id);
        if (target) {
          target.prose = o.prose;
          target.tokens = o.tokens;
        }
      });
    }
    enhanced++;
  }
});

fs.writeFileSync(popularPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Enhanced identity tokens & outfits for ${enhanced} characters in ${popularPath}`);
