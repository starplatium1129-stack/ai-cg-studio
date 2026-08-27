#!/usr/bin/env node
'use strict';

/**
 * render-all-new-characters.js
 * 
 * 批量渲染碧蓝档案全新角色及优化角色 4 视角参考资产库：
 * 1. 空崎日奈 (sorasaki_hina) - 优化精致黑色小恶魔角（非盘羊巨角）与完整紫黑荆棘光环 (24 张)
 * 2. 杏山和纱 (kyouyama_kazusa) - 纯正猫耳、无人类耳、折角粉红光环、圣三一校服/甜点部/舞台装/泳装/全裸 (20 张)
 * 3. 飞鸟马时 (asuma_toki) - 金发冰蓝瞳无表情、科技光环、战术女仆特工装/兔女郎/日常/泳装/全裸 (20 张)
 * 4. 调月莉音 (tsukatsuki_rio) - 黑发姬发式、猩红眼眸、深红几何光环、研讨会西装风衣/冬日大衣/礼服/泳装/全裸 (20 张)
 * 
 * 总计：84 张 832x1216 电影级竖版参考资产
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const GATEWAY_URL = process.env.GATEWAY_URL || process.env.BASE || 'http://127.0.0.1:3123';
const CONCURRENCY = 2; // 2 并发安全防显存峰值

const PERSPECTIVE_CONFIGS = {
  ref_01_face_closeup: {
    name: '面部特写',
    suffix: 'headroom, upper body portrait, expressive anime eyes, looking at viewer, soft cinematic key light, pristine anime aesthetic, highly detailed facial features',
    negSuffix: 'full body, legs, feet, hands, extra limbs, cropped halo, cut off halo, blurry face, lowres'
  },
  ref_02_half_medium: {
    name: '3/4半身定妆',
    suffix: 'headroom, upper body focus, medium shot, waist up, cowboy shot, 3/4 view angle, hands visible resting naturally near waist, detailed outfit layers, fabric folds, soft studio lighting',
    negSuffix: 'full body, legs, feet, shoes, boots, bad anatomy, bad hands, extra limbs, cropped shoulders, cropped halo, cut off halo, blurry'
  },
  ref_03_full_dynamic: {
    name: '正面全身立姿',
    suffix: 'full body standing, entire figure visible from head to toe, front view, facing camera, looking at viewer, complete head with floating halo, entire legs, full feet and shoes completely on the ground without cropping, clean studio floor shadow, balanced standing posture, full outfit details',
    negSuffix: 'back view, from behind, rear view, cropped head, cropped feet, cut off feet, out of frame, bad proportions, distorted legs, cropped halo'
  },
  ref_04_back_rear: {
    name: '45°侧后背影',
    suffix: '45 degree angle from behind, looking back over shoulder toward camera, back view focus, back of hair, hair flow, rear outfit details, cinematic rim lighting, dramatic backlight, edge glow',
    negSuffix: 'front view, facing camera, frontal face, bad anatomy, lowres'
  }
};

const CHARACTERS = [
  {
    id: 'sorasaki_hina',
    displayName: '空崎日奈',
    identityTokens: [
      'sorasaki_hina',
      '1girl',
      'solo',
      'horns',
      'small_black_horns',
      'curved_horns',
      'demon_horns',
      'halo',
      'detailed spiked purple halo completely floating above head with space at top',
      'bat_wings',
      'demon_wings',
      'black_wings',
      'very_long_silver_hair',
      'massive_hair',
      'fluffy_hair',
      'hair_down',
      'parted_bangs',
      'purple_eyes',
      'sleepy_eyes',
      'serious_expression',
      'petite',
      'flat_chest',
      'slender',
      'small_stature',
      'blush',
      'gehenna',
      'blue_archive'
    ],
    charNegative: 'ram horns, huge horns, giant horns, oversized horns, thick horns, antlers, branching horns, multiple horns, cropped halo, cut off halo, halo touching edge, high ponytail, ponytail, bun in uniform, human ears without horns, mature, tall, busty, huge breasts, adult woman proportions',
    outfits: [
      {
        id: 'gehenna_uniform',
        name: '风纪委员制服',
        tokens: [
          'military_uniform',
          'black_uniform',
          'black_coat',
          'coat_on_shoulders',
          'gold_epaulettes',
          'white_shirt',
          'black_necktie',
          'black_vest',
          'armband',
          'red_armband',
          'black_skirt',
          'pleated_skirt',
          'thighhighs',
          'over-knee_socks',
          'boots'
        ],
        prose: 'Gehenna Academy Disciplinary Committee military uniform with an oversized black trench coat with gold epaulettes draped over shoulders like a cape, white collared shirt, black necktie, black vest, red disciplinary armband, black pleated skirt, over-knee socks and lace-up boots'
      },
      {
        id: 'casual_black',
        name: '日常黑裙',
        tokens: [
          'dress',
          'black_dress',
          'red_ribbon',
          'ribbon_trim',
          'black_tights',
          'mary_janes',
          'refined',
          'casual'
        ],
        prose: 'a refined casual black gothic dress with red ribbon trim, dark stockings and Mary Jane shoes, quiet and delicate private look'
      },
      {
        id: 'combat_gear',
        name: '战术风纪装',
        tokens: [
          'tactical_gear',
          'black_jacket',
          'tactical_harness',
          'holster',
          'belt',
          'pouches',
          'fingerless_gloves',
          'combat_boots',
          'military'
        ],
        prose: 'tactical disciplinary combat gear with a fitted black tactical jacket, combat webbing harness, ammo pouches, holster belt, fingerless combat gloves, tactical combat boots'
      },
      {
        id: 'swimsuit',
        name: '夏日泳装 / 死库水',
        tokens: [
          'swimsuit',
          'two-piece_swimsuit',
          'navy_swimsuit',
          'frills',
          'swim_ring',
          'sandals',
          'summer',
          'beach'
        ],
        prose: 'summer swimsuit, dark navy blue two-piece swimsuit with white ruffled trim, swim ring with cute devil motif, sandals, relaxed seaside atmosphere'
      },
      {
        id: 'evening_dress',
        name: '晚礼服',
        tokens: [
          'evening_dress',
          'black_dress',
          'strapless_dress',
          'ruffles',
          'opera_gloves',
          'black_gloves',
          'pearl_necklace',
          'high_heels',
          'formal',
          'elegant'
        ],
        prose: 'an elegant strapless black evening ballgown with ruffled hem, long black opera gloves, black ribbon corsage in hair, pearl necklace, high heels, grand piano recital aesthetic'
      },
      {
        id: 'nsfw_nude',
        name: '私密全裸 / 纯粹形态',
        isNsfw: true,
        tokens: [
          'nude',
          'completely_naked',
          'uncensored',
          'breasts',
          'small_breasts',
          'nipples',
          'pink_nipples',
          'navel',
          'slender_waist',
          'bare_shoulders',
          'collarbone',
          'bare_legs',
          'bare_feet'
        ],
        prose: 'completely naked, full nudity, bare skin, natural petite female body, delicate small breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting'
      }
    ]
  },
  {
    id: 'kyouyama_kazusa',
    displayName: '杏山和纱',
    identityTokens: [
      'kyouyama_kazusa',
      '1girl',
      'solo',
      'black_hair',
      'short_hair',
      'bob_cut',
      'black_cat_ears',
      'animal_ears',
      'no_human_ears',
      'pink_eyes',
      'pointed_spiked_red_halo_with_cross_and_ring',
      'jagged_red_halo',
      'trinity',
      'blue_archive',
      'sweet_shy_expression',
      'blush'
    ],
    charNegative: 'human ears, four ears, two pairs of ears, circular concentric halo, text, badge, name tag, id card, plastic card, ram horns, huge horns, dog ears, animal snout, whiskers, cropped halo, cut off halo, long hair, bad anatomy, bad hands',
    outfits: [
      {
        id: 'trinity_uniform',
        name: '崔尼蒂校服',
        tokens: [
          'school_uniform',
          'dark_navy_blazer',
          'white_collared_shirt',
          'red_ribbon_tie',
          'plaid_skirt',
          'black_tights',
          'loafers',
          'trinity'
        ],
        prose: 'Trinity Comprehensive Academy school uniform with a dark navy blazer, white collared shirt, red ribbon necktie, pleated plaid skirt, black tights and dark loafers'
      },
      {
        id: 'sweets_apron',
        name: '甜点部围裙',
        tokens: [
          'apron',
          'white_apron',
          'pastry_chef',
          'sweets',
          'flour_dust',
          'whisk',
          'baking',
          'cooking'
        ],
        prose: 'a white sweets club baking apron worn over her Trinity uniform, dusting flour lightly on cheeks, holding a small dessert whisk, sweet bakery afterschool look'
      },
      {
        id: 'live_stage',
        name: '乐队舞台装',
        tokens: [
          'stage_outfit',
          'black_clothes',
          'silver_accessories',
          'chains',
          'fingerless_gloves',
          'bass_guitar',
          'bass_strap',
          'band_performance',
          'cool'
        ],
        prose: 'SugarRush band live stage outfit with a cool black asymmetrical stage jacket, silver chain accessories, fingerless leather gloves, bass guitar strapped across shoulder'
      },
      {
        id: 'swimsuit',
        name: '夏日泳装',
        tokens: [
          'swimsuit',
          'bikini',
          'black_bikini',
          'cat_ear_hood_coverup',
          'red_ribbon',
          'beach',
          'summer'
        ],
        prose: 'a cute sporty black bikini with delicate red ribbon accents, sheer black summer cover-up with cat ears on hood, casual beachside look'
      },
      {
        id: 'nsfw_nude',
        name: '私密全裸 / 纯粹形态',
        isNsfw: true,
        tokens: [
          'nude',
          'completely_naked',
          'uncensored',
          'breasts',
          'medium_breasts',
          'nipples',
          'pink_nipples',
          'navel',
          'slender_waist',
          'bare_shoulders',
          'collarbone',
          'bare_legs',
          'bare_feet'
        ],
        prose: 'completely naked, full nudity, bare skin, natural slender female body, cat ears on head, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting'
      }
    ]
  },
  {
    id: 'asuma_toki',
    displayName: '飞鸟马时',
    identityTokens: [
      'asuma_toki',
      '1girl',
      'solo',
      'blonde_hair',
      'champagne_blonde_hair',
      'very_long_hair',
      'sharp_ice_blue_eyes',
      'blue_eyes',
      'expressionless',
      'deadpan_gaze',
      'peace_sign',
      'v_sign',
      'perfect_hands',
      'tactical_headset_with_boom_mic',
      'blue_geometric_hud_halo',
      'millennium',
      'c&c',
      'blue_archive'
    ],
    charNegative: 'bad hands, extra fingers, fused fingers, distorted fingers, malformed hands, human ears, black hair, red eyes, cat ears, animal ears, cropped halo, cut off halo, lowres, blurry',
    outfits: [
      {
        id: 'candc_maid',
        name: 'C&C女仆特工装',
        tokens: [
          'high-cut_maid',
          'maid_battle_dress',
          'maid_apron',
          'maid_headdress',
          'tactical_harness',
          'blue_necktie',
          'tactical_holster',
          'thighhighs',
          'black_thighhighs',
          'tactical_boots'
        ],
        prose: 'Millennium C&C Zero Four high-cut tactical maid battle dress with white apron, tactical chest harness and straps, light blue necktie, tactical thigh holster, black thigh-high stockings and combat heels'
      },
      {
        id: 'bunny_suit',
        name: '兔女郎装',
        tokens: [
          'bunny_suit',
          'white_bunny_suit',
          'glossy_bodysuit',
          'bunny_ears',
          'white_bunny_ears',
          'collar',
          'bow_tie',
          'white_wrist_cuffs',
          'white_pantyhose',
          'high_heels'
        ],
        prose: 'an alluring glossy pure white high-cut bunny suit with matching white bunny ears, formal white collar and black bow tie, white sheer pantyhose, high heels, secret casino infiltration look'
      },
      {
        id: 'casual_maid',
        name: '日常便服',
        tokens: [
          'casual',
          'black_dress',
          'techwear_jacket',
          'headset',
          'sneakers',
          'stylish'
        ],
        prose: 'a sleek black techwear casual dress with an open lightweight utility windbreaker, tactical headset, white sneakers, relaxed off-duty agent vibe'
      },
      {
        id: 'swimsuit',
        name: '夏日泳装',
        tokens: [
          'swimsuit',
          'bikini',
          'white_bikini',
          'navy_bikini',
          'tactical_waist_belt',
          'headset',
          'summer',
          'beach'
        ],
        prose: 'a modern sporty white and navy blue two-piece bikini with a small tactical equipment pouch belt, waterproof headset, seaside operation look'
      },
      {
        id: 'nsfw_nude',
        name: '私密全裸 / 纯粹形态',
        isNsfw: true,
        tokens: [
          'nude',
          'completely_naked',
          'uncensored',
          'breasts',
          'medium_breasts',
          'nipples',
          'pink_nipples',
          'navel',
          'slender_toned_waist',
          'bare_shoulders',
          'collarbone',
          'bare_legs',
          'bare_feet'
        ],
        prose: 'completely naked, full nudity, bare skin, natural slender toned female body, delicate pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting'
      }
    ]
  },
  {
    id: 'tsukatsuki_rio',
    displayName: '调月莉音',
    identityTokens: [
      'tsukatsuki_rio',
      '1girl',
      'solo',
      'black_hair',
      'very_long_straight_hair',
      'hime_cut',
      'neat_bangs',
      'sharp_red_eyes',
      'red_eyes',
      'tall_slender_mature_elegance',
      'cool_beauty',
      'deep_red_diamond_matrix_halo',
      'black_leather_gloves',
      'millennium',
      'seminar',
      'blue_archive'
    ],
    charNegative: 'short hair, blonde hair, blue eyes, cute child, loli, animal ears, wings, cropped halo, cut off halo, bad anatomy, bad hands, lowres, blurry',
    outfits: [
      {
        id: 'seminar_uniform',
        name: '研讨会制服',
        tokens: [
          'school_uniform',
          'black_tailored_suit',
          'high_neck_sweater',
          'turtleneck',
          'white_collar',
          'red_necktie',
          'tie_clip',
          'millennium_gold_badge',
          'coat_on_shoulders',
          'black_coat',
          'red_coat_lining',
          'pencil_skirt',
          'black_pantyhose',
          'high_heels'
        ],
        prose: 'Millennium Seminar President tailored black executive suit with a white high collar, crimson necktie with silver tie clip, gold Millennium crest, oversized black trench coat with red lining draped over shoulders like a cape, black pencil skirt, sheer black tights and black high heels'
      },
      {
        id: 'winter_coat',
        name: '冬季大衣',
        tokens: [
          'winter_coat',
          'long_wool_coat',
          'black_coat',
          'tight_black_turtleneck',
          'turtleneck_sweater',
          'waist_belt',
          'leather_gloves',
          'winter_boots'
        ],
        prose: 'an elegant long tailored black winter cashmere wool coat over a form-fitting black turtleneck sweater, leather waist belt, black leather gloves, sleek knee-high winter leather boots'
      },
      {
        id: 'formal_dress',
        name: '正式礼服',
        tokens: [
          'evening_dress',
          'formal_dress',
          'black_dress',
          'high_slit_dress',
          'opera_gloves',
          'pearl_necklace',
          'high_heels',
          'commanding',
          'regal'
        ],
        prose: 'a commanding formal black velvet evening gown with a modest high neckline and side slit, long black satin opera gloves, delicate pearl necklace, black stiletto heels, presidential gala elegance'
      },
      {
        id: 'swimsuit',
        name: '夏日泳装',
        tokens: [
          'swimsuit',
          'one-piece_swimsuit',
          'high-cut_swimsuit',
          'black_swimsuit',
          'sheer_black_sarong',
          'sun_hat',
          'sunglasses',
          'resort'
        ],
        prose: 'a sophisticated high-cut black designer one-piece swimsuit with subtle red geometric trim, sheer black silk sarong wrap, large sun hat, executive luxury private resort atmosphere'
      },
      {
        id: 'nsfw_nude',
        name: '私密全裸 / 纯粹形态',
        isNsfw: true,
        tokens: [
          'nude',
          'completely_naked',
          'uncensored',
          'breasts',
          'large_breasts',
          'nipples',
          'pink_nipples',
          'navel',
          'slender_mature_waist',
          'bare_shoulders',
          'collarbone',
          'bare_legs',
          'bare_feet'
        ],
        prose: 'completely naked, full nudity, bare skin, natural tall mature female body, hime-cut black hair, sharp red eyes, large breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting'
      }
    ]
  }
];

function buildPrompt(char, outfit, persId) {
  const pConfig = PERSPECTIVE_CONFIGS[persId];
  const isNude = outfit.isNsfw || outfit.id === 'nsfw_nude';

  let charTokens = char.identityTokens.join(', ');
  if (isNude) {
    charTokens = charTokens.replace(/\b(coat_on_shoulders|military_uniform|boots|thighhighs|socks|dress|uniform|skirt|blazer|apron|gloves|black_leather_gloves)\b/gi, '');
  }

  const outfitTokens = outfit.tokens ? outfit.tokens.join(', ') : '';
  const outfitProse = outfit.prose || '';

  const promptParts = [
    isNude ? "nude, completely naked, uncensored, full body bare, natural skin" : "",
    charTokens,
    outfitTokens,
    outfitProse,
    pConfig.suffix,
    "@rella, masterpiece, best quality, pristine anime aesthetic, clean cinematic lighting"
  ].filter(Boolean);

  const negParts = [
    "bad anatomy, bad hands, extra limbs, extra arms, extra legs, poorly drawn face, poorly drawn hands, missing fingers, extra digits, cropped, split image, split screen, multiple views, comic panel, collaged, sketch, lowres, blurry, jpeg artifacts, watermark, signature",
    char.charNegative,
    isNude ? "clothes, clothing, shirt, pants, dress, kimono, robe, towel, underwear, bra, panties, panties_pull, swimsuit, bikini, skirt, socks, footwear, shoes, fabric covering" : "",
    pConfig.negSuffix
  ].filter(Boolean);

  return {
    prompt: promptParts.join(', '),
    negative: negParts.join(', ')
  };
}

function collectTasks() {
  const tasks = [];
  for (const char of CHARACTERS) {
    for (const outfit of char.outfits) {
      const targetDir = path.join(OUT_BASE, char.id, outfit.id);
      fs.mkdirSync(targetDir, { recursive: true });

      for (const [persId, persConfig] of Object.entries(PERSPECTIVE_CONFIGS)) {
        const targetPath = path.join(targetDir, `${persId}.png`);
        
        if (fs.existsSync(targetPath)) {
          const stat = fs.statSync(targetPath);
          const ageMinutes = (Date.now() - stat.mtimeMs) / (60 * 1000);
          if (ageMinutes < 15 && stat.size > 20000) {
            continue;
          }
        }

        tasks.push({
          charId: char.id,
          charName: char.displayName,
          outfitId: outfit.id,
          outfitName: outfit.name,
          persId,
          persName: persConfig.name,
          targetPath,
          seed: Math.floor(Math.random() * 1000000000) + 100000000
        });
      }
    }
  }
  return tasks;
}

async function renderImage(task) {
  const char = CHARACTERS.find(c => c.id === task.charId);
  const outfit = char.outfits.find(o => o.id === task.outfitId);
  const { prompt, negative } = buildPrompt(char, outfit, task.persId);

  const payload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt,
    negative,
    width: 832,
    height: 1216,
    steps: 28,
    cfg: 4.5,
    seed: task.seed
  };

  const submitRes = await fetch(`${GATEWAY_URL}/api/anima/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const submitJson = await submitRes.json();
  if (!submitRes.ok || !submitJson.ok || !submitJson.job?.id) {
    throw new Error(`提交失败: ${JSON.stringify(submitJson)}`);
  }

  const jobId = submitJson.job.id;
  const deadline = Date.now() + 10 * 60 * 1000;
  let jobState = null;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const queryRes = await fetch(`${GATEWAY_URL}/api/anima/jobs/${encodeURIComponent(jobId)}`);
    const queryJson = await queryRes.json();
    if (queryRes.ok && queryJson.ok && queryJson.job) {
      jobState = queryJson.job;
      if (jobState.status === 'succeeded' && jobState.resultUrl) break;
      if (jobState.status === 'failed' || jobState.status === 'cancelled') {
        throw new Error(`渲染失败: ${jobState.error || jobState.status}`);
      }
    }
  }

  if (!jobState?.resultUrl) {
    throw new Error('渲染超时未返回图片');
  }

  const imgRes = await fetch(`${GATEWAY_URL}${jobState.resultUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(task.targetPath, buffer);
}

async function main() {
  const tasks = collectTasks();
  console.log(`[Batch Reference Pipeline] 待渲染任务总数: ${tasks.length} 张`);

  let finishedCount = 0;
  let cursor = 0;

  function nextTask() {
    if (cursor >= tasks.length) return null;
    const idx = cursor++;
    return { task: tasks[idx], idx };
  }

  async function worker(workerId) {
    while (true) {
      const next = nextTask();
      if (!next) break;
      const { task, idx } = next;
      const prefix = `[Worker ${workerId}][${idx + 1}/${tasks.length}]`;
      console.log(`${prefix} 开始渲染: [${task.charName}] - [${task.outfitName}] - [${task.persName}]...`);

      let success = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await renderImage(task);
          success = true;
          finishedCount++;
          console.log(`${prefix} ✓ 成功完成并落盘: ${task.targetPath}`);
          break;
        } catch (err) {
          console.warn(`${prefix} ⚠️ 第 ${attempt} 次失败 (${err.message})，等待 3 秒重试...`);
          task.seed = Math.floor(Math.random() * 1000000000) + 100000000;
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!success) {
        console.error(`${prefix} ❌ 最终渲染失败: [${task.charName}] [${task.outfitName}] [${task.persName}]`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);
  console.log(`\n======================================================`);
  console.log(`[Batch Reference Pipeline] 全部渲染完成！成功: ${finishedCount}/${tasks.length}`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
