#!/usr/bin/env node
'use strict';

/**
 * render-hina-mika-references.js
 * 
 * 专门针对空崎日奈（Sorasaki Hina）与圣园未花（Misono Mika）的全形态全视角参考图精准重渲染管道
 * 经过视觉模型严格审核对齐：
 * - 空崎日奈：完整尖刺光环留白、对称单对横向大螺纹黑盘角（无多余分叉）、背部蝠翼、巨量散发、娇小身形
 * - 圣园未花：明亮琥珀金星眸（带四角星芒瞳孔）、蓝紫宇宙星空内发、翅膀金色四角星饰与流苏、侧丸子头发饰
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const GATEWAY_URL = process.env.GATEWAY_URL || process.env.BASE || 'http://127.0.0.1:3123';
const CONCURRENCY = 2; // 2 并发稳定防显存尖峰

const PERSPECTIVE_CONFIGS = {
  ref_01_face_closeup: {
    name: '面部特写',
    suffix: 'headroom, head and shoulders portrait, looking at viewer, expressive anime eyes, soft cinematic key light, pristine anime aesthetic, highly detailed facial features',
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
    suffix: '45 degree angle from behind, looking back over shoulder toward camera, back view focus, back of hair, hair flow, rear outfit details, wings visible on back, cinematic rim lighting, dramatic backlight, edge glow',
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
      'single pair of large curved black ram horns',
      'segmented horns',
      'ribbed horns',
      'demon horns',
      'halo',
      'detailed spiked purple halo floating above head',
      'bat wings on back',
      'demon wings',
      'black wings',
      'very long silver hair',
      'massive hair',
      'fluffy hair',
      'hair down',
      'parted bangs',
      'purple eyes',
      'sleepy eyes',
      'serious_expression',
      'petite',
      'flat_chest',
      'slender',
      'small_stature',
      'blush',
      'gehenna',
      'blue_archive'
    ],
    charNegative: 'cropped halo, cut off halo, extra horns, multiple horns, branching horns, antlers, three horns, four horns, high ponytail, ponytail, bun in uniform, human ears without horns, mature, tall, busty, huge breasts, adult woman proportions',
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
    id: 'misono_mika',
    displayName: '圣园未花',
    identityTokens: [
      'misono_mika',
      '1girl',
      'solo',
      'bright_golden_eyes',
      'amber_eyes',
      'yellow_eyes',
      'star-shaped_pupils',
      'four-pointed_star_reflections_in_eyes',
      'pink_hair',
      'pastel_pink_hair',
      'very_long_hair',
      'multicolored_hair',
      'inner_hair_pastel_galaxy_gradient',
      'starry_hair',
      'side_bun',
      'hair_bun',
      'plant_hair_ornament',
      'hair_flower',
      'halo',
      'pink_star_halo',
      'angel_wings',
      'white_wings',
      'feathered_wings_with_gold_star_brooches',
      'gentle_smile',
      'blush',
      'trinity',
      'blue_archive'
    ],
    charNegative: 'purple eyes, violet eyes, blue eyes, lavender eyes, dark eyes, dark hair, monochrome hair, black hair, missing wings, missing halo, no halo, no wings, huge breasts, gigantic breasts, massive breasts, adult woman proportions',
    outfits: [
      {
        id: 'trinity_uniform',
        name: '崔尼蒂校服',
        tokens: [
          'school_uniform',
          'sleeveless_dress',
          'white_dress',
          'red_ribbon',
          'capelet',
          'shoulder_cape',
          'pleated_skirt',
          'white_tights',
          'pantyhose',
          'high_heels',
          'trinity',
          'tea_party'
        ],
        prose: 'Trinity tea party school uniform with a sleeveless white collared dress, royal red ribbon tie, white fur-trimmed shoulder capelet draped over shoulders, pleated skirt with red trim slit, white pantyhose tights and strap high heels'
      },
      {
        id: 'tea_party_dress',
        name: '茶话会礼装',
        tokens: [
          'ballgown',
          'white_dress',
          'sleeveless_dress',
          'golden_trim',
          'gold_embroidery',
          'white_gloves',
          'white_tights',
          'high_heels',
          'elegant',
          'regal'
        ],
        prose: 'an exquisite royal white tea party ballgown adorned with intricate golden filigree trim, white silk shawl, white evening gloves, white tights, golden high heels, regal Trinity princess elegance'
      },
      {
        id: 'casual_pink',
        name: '日常便服',
        tokens: [
          'casual',
          'pink_dress',
          'sundress',
          'white_cardigan',
          'knit_cardigan',
          'white_tights',
          'flats',
          'lace_trim'
        ],
        prose: 'a lovely pastel pink sleeveless sundress with delicate white lace trim, an ivory knitted cardigan loosely worn over shoulders, white flats, sweet gentle dating atmosphere'
      },
      {
        id: 'swimsuit',
        name: '夏日泳装',
        tokens: [
          'swimsuit',
          'bikini',
          'white_swimsuit',
          'pink_swimsuit',
          'frills',
          'pareo',
          'summer',
          'beach'
        ],
        prose: 'a charming white and soft pink frilled two-piece bikini with a sheer pastel pareo wrap, sun visor hat, tropical seaside resort atmosphere'
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
        prose: 'completely naked, full nudity, bare skin, natural female body, medium breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting'
      }
    ]
  }
];

function buildPrompt(char, outfit, persId) {
  const pConfig = PERSPECTIVE_CONFIGS[persId];
  const isNude = outfit.isNsfw || outfit.id === 'nsfw_nude';

  let charTokens = char.identityTokens.join(', ');
  if (isNude) {
    charTokens = charTokens.replace(/\b(coat_on_shoulders|military_uniform|boots|thighhighs|socks|dress|uniform|skirt)\b/gi, '');
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
  console.log(`[Hina & Mika Reference Pipeline] 待渲染任务总数: ${tasks.length} 张`);

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
  console.log(`[Hina & Mika Reference Pipeline] 渲染全部完成！成功: ${finishedCount}/${tasks.length}`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
