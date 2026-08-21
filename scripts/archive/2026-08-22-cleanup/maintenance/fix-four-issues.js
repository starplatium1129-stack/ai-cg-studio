const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE = 'http://127.0.0.1:3123';
const ROOT = path.resolve(__dirname, '..', '..');
const SHOWCASE_DIR = path.resolve('E:/code/2/lora/AI/SceneShowcase/2026-08-15_v23');
const MANIFEST_FILE = path.join(SHOWCASE_DIR, 'manifest.json');
const REF_DIR = path.join(ROOT, 'assets', 'character-references');
const TEMP_DIR = path.join(ROOT, 'assets', 'custom-gens', 'fix-four-issues');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

async function submitJob(payload) {
  const res = await fetch(`${BASE}/api/anima/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || 'submit error');
  return data.job.id;
}

async function pollJob(jobId) {
  while (true) {
    const res = await fetch(`${BASE}/api/anima/jobs/${jobId}`);
    const data = await res.json();
    if (data.job.status === 'succeeded' || data.job.status === 'completed') {
      const imgUrl = data.job.resultUrl || data.job.outputs[0];
      const fullUrl = imgUrl.startsWith('http') ? imgUrl : `${BASE}${imgUrl}`;
      const imgRes = await fetch(fullUrl);
      return Buffer.from(await imgRes.arrayBuffer());
    }
    if (data.job.status === 'failed') throw new Error(data.job.error);
    await new Promise(r => setTimeout(r, 1200));
  }
}

function convertShowcase(srcPng, dstBig, dstThumb) {
  const cmd = `python scripts/maintenance/convert-showcase-image.py "${srcPng}" "${dstBig}" "${dstThumb}"`;
  execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
}

async function main() {
  console.log('=== 1. 重新生成黑贞德独立的【私密镜前·双重倒影】样张 ===');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  const entryId = 'pc_jeanne_alter_jalter_r18_hotel_mirror_back_curves';
  const tempPng = path.join(TEMP_DIR, `${entryId}.png`);

  console.log(`正在生成黑贞德镜像样张...`);
  const jalterPrompt = '@rella, 1girl, solo, jeanne_d\'arc_alter_(fate), jalter, short_platinum_blonde_hair, yellow_eyes, flushed_cheeks, kneeling on hotel bed in front of large full-length mirror, looking back over shoulder with sultry tsundere smirk, complete reflection in mirror showing naked back curves and hourglass figure, translucent black sheer silk negligee loosely hanging off shoulders, parted thighs, luxury suite hotel night view through window, soft warm bedside lamp, masterpiece, best quality';
  const jalterNeg = 'shoes, leather boots, standing, heavy clothes, bad anatomy, bad hands, lowres, blurry';

  const jalterSeed = 7182931;
  const buf = await (async () => {
    const jobId = await submitJob({
      modelId: 'anima-aesthetic-v1.1',
      prompt: jalterPrompt,
      negative: jalterNeg,
      width: 832,
      height: 1216,
      steps: 28,
      cfg: 5.2,
      seed: jalterSeed
    });
    return await pollJob(jobId);
  })();

  fs.writeFileSync(tempPng, buf);
  const dstBig = path.join(SHOWCASE_DIR, 'images', `${entryId}.jpg`);
  const dstThumb = path.join(SHOWCASE_DIR, 'thumbs', `${entryId}.jpg`);
  convertShowcase(tempPng, dstBig, dstThumb);

  const mIdx = manifest.entries.findIndex(e => e.id === entryId);
  if (mIdx >= 0) {
    manifest.entries[mIdx].meta.seed = jalterSeed;
    manifest.entries[mIdx].prompt = jalterPrompt;
    manifest.entries[mIdx].provenance.generatedAt = new Date().toISOString();
  }
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('  [OK] 黑贞德镜像独立样张已生成并写入 Showcase！');

  console.log('\n=== 2. 重新生成深森白夜多套服装的 4 视角参考图 ===');
  const byakuyaOutfits = [
    {
      id: 'magical_girl_dress',
      name: '魔法少女战服',
      desc: 'wearing her magical girl combat dress with ruffled frilled white and pink skirt, glowing magical accessories, detached puffy sleeves',
      neg: 'sailor uniform, apron, jersey, sweater, naked'
    },
    {
      id: 'poor_school_uniform',
      name: '褪色旧水手服',
      desc: 'wearing a faded old navy and white sailor school uniform, frayed navy sailor collar with small red neckerchief, pleated navy skirt',
      neg: 'magical girl dress, apron, jersey, fancy dress, naked'
    },
    {
      id: 'part_time_maid_apron',
      name: '打工女仆围裙装',
      desc: 'wearing a cute black work dress with white frilled maid apron, white headband, bow on chest, working part-time',
      neg: 'magical girl dress, sailor uniform, jersey, naked'
    },
    {
      id: 'tattered_oversized_jersey',
      name: '破旧宽大运动服',
      desc: 'wearing an oversized baggy blue and white tracksuit jersey, zipper pulled down, slouchy homewear style, cute casual',
      neg: 'magical girl dress, sailor uniform, apron, maid dress, naked'
    },
    {
      id: 'nsfw_nude',
      name: '私密全裸 / 纯粹形态',
      desc: 'completely naked, full body bare, natural slender skin, delicate collarbone and flat chest, no clothes',
      neg: 'clothes, dress, uniform, skirt, socks, sleeves, fabric, apron, jersey'
    }
  ];

  for (const outfit of byakuyaOutfits) {
    console.log(`--- 生成深森白夜 [${outfit.name}] (${outfit.id}) ---`);
    const outDir = path.join(REF_DIR, 'mimori_byakuya', outfit.id);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const angles = [
      { id: 'ref_01_face_closeup', angleDesc: 'close-up portrait, 85mm f/1.4 lens, focus on face and expression' },
      { id: 'ref_02_half_medium', angleDesc: 'medium shot, upper body, 50mm lens, showcasing upper outfit' },
      { id: 'ref_03_full_dynamic', angleDesc: 'full body, full shot, 35mm lens, standing pose showing complete outfit and legs' },
      { id: 'ref_04_back_rear', angleDesc: 'from behind, rear three-quarter view, looking back over shoulder, 85mm edge lighting' }
    ];

    for (const a of angles) {
      const fileName = `mimori_byakuya_${outfit.id}_${a.id}.png`;
      const filePath = path.join(outDir, fileName);
      console.log(`  渲染: ${fileName}...`);

      const prompt = `@rella, 1girl, solo, silver_white_hair, platinum_hair, straight_hair, bangs, twin_horn_buns, spiral_buns, sidelocks, round blue eyes, deadpan cute stoic expression, ${outfit.desc}, ${a.angleDesc}, pristine anime aesthetic, masterpiece, best quality`;
      const negative = `black hair, dark hair, blonde hair, twintails, ${outfit.neg}, bad anatomy, bad hands, lowres, blurry`;

      const seed = 5500000 + Math.floor(Math.random() * 500000);
      const buf = await (async () => {
        const jobId = await submitJob({
          modelId: 'anima-aesthetic-v1.1',
          prompt,
          negative,
          width: 832,
          height: 1216,
          steps: 28,
          cfg: 5.2,
          seed
        });
        return await pollJob(jobId);
      })();

      fs.writeFileSync(filePath, buf);
      console.log(`    [OK] 已保存: ${fileName}`);
    }
  }

  console.log('\n=== 3. 重新生成菲伦的 4 视角参考图（严格锁定菲伦特征：紫发、单马尾发髻、大发量丰满肉肉脸，彻底剥离芙莉莲白发双马尾精灵耳） ===');
  const fernOutfits = [
    {
      id: 'journey_robe',
      name: '经典魔法使黑白长袍',
      desc: 'wearing her signature long black coat robe over a high-collar white dress, carrying wooden magic staff',
      neg: 'white hair, silver hair, twintails, green hair, elf ears, pointy ears, naked'
    },
    {
      id: 'winter_coat',
      name: '冬季厚风衣围巾装',
      desc: 'wearing a thick warm winter coat with large knitted muffler scarf wrapped around neck, cute winter outfit',
      neg: 'white hair, silver hair, twintails, elf ears, naked'
    },
    {
      id: 'town_casual',
      name: '城镇甜品约会便服',
      desc: 'wearing a neat beige knit cardigan, long brown skirt, holding sweet dessert fork, lovely soft date outfit',
      neg: 'white hair, silver hair, twintails, elf ears, naked'
    },
    {
      id: 'nsfw_nude',
      name: '私密全裸 / 丰满纯粹形态',
      desc: 'completely naked, full body bare, large natural soft breasts, plush voluptuous curves, gentle blush, no clothes',
      neg: 'clothes, dress, robe, coat, scarf, fabric, white hair, twintails, elf ears'
    }
  ];

  for (const outfit of fernOutfits) {
    console.log(`--- 生成菲伦 [${outfit.name}] (${outfit.id}) ---`);
    const outDir = path.join(REF_DIR, 'fern_frieren', outfit.id);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const angles = [
      { id: 'ref_01_face_closeup', angleDesc: 'close-up portrait, 85mm f/1.4 lens, focus on round cute chubby face, pouty expression' },
      { id: 'ref_02_half_medium', angleDesc: 'medium shot, upper body, 50mm lens, soft bust and upper outfit' },
      { id: 'ref_03_full_dynamic', angleDesc: 'full body, full shot, 35mm lens, standing pose, complete outfit and tall plush silhouette' },
      { id: 'ref_04_back_rear', angleDesc: 'from behind, rear three-quarter view, looking back over shoulder, long dark purple hair flowing, 85mm edge lighting' }
    ];

    for (const a of angles) {
      const fileName = `fern_frieren_${outfit.id}_${a.id}.png`;
      const filePath = path.join(outDir, fileName);
      console.log(`  渲染: ${fileName}...`);

      const prompt = `@rella, 1girl, solo, fern_(frieren), long_dark_purple_hair, purple_hair, straight_bangs, half-updo ponytail bun, purple_eyes, round_pouty_face, chubby_cheeks, voluptuous_soft_body, large_breasts, ${outfit.desc}, ${a.angleDesc}, pristine anime aesthetic, masterpiece, best quality`;
      const negative = `(frieren:1.4), (white_hair:1.4), (silver_hair:1.4), (twintails:1.4), (elf_ears:1.4), (pointy_ears:1.4), (flat_chest:1.4), ${outfit.neg}, bad anatomy, bad hands, lowres, blurry`;

      const seed = 6300000 + Math.floor(Math.random() * 500000);
      const buf = await (async () => {
        const jobId = await submitJob({
          modelId: 'anima-aesthetic-v1.1',
          prompt,
          negative,
          width: 832,
          height: 1216,
          steps: 28,
          cfg: 5.2,
          seed
        });
        return await pollJob(jobId);
      })();

      fs.writeFileSync(filePath, buf);
      console.log(`    [OK] 已保存: ${fileName}`);
    }
  }

  console.log('\n🎉 黑贞德独立样张、深森白夜多服装参考图、菲伦 100% 独立参考图全量生成完毕！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
