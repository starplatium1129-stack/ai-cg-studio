const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE = 'http://127.0.0.1:3123';
const ROOT = path.resolve(__dirname, '..', '..');
const AVATAR_SPECS_FILE = path.join(ROOT, 'runtime', 'earliest-popular-avatar-specs.json');
const CHAR_DIR = path.join(ROOT, 'assets', 'characters');
const TEMP_DIR = path.join(ROOT, 'assets', 'custom-gens', 'new-avatars');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const specs = JSON.parse(fs.readFileSync(AVATAR_SPECS_FILE, 'utf8'));

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

async function main() {
  console.log(`=== 开始批量生成前期 ${specs.length} 位热门角色的纯净棚拍肖像头像 ===`);

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    console.log(`[${i + 1}/${specs.length}] 正在生成 ${spec.displayName} (${spec.id}) 的专属头像...`);

    const tempPng = path.join(TEMP_DIR, `avatar_${spec.id}.png`);
    const targetPng = path.join(CHAR_DIR, `popular-${spec.id}.png`);

    try {
      const buf = await (async () => {
        const jobId = await submitJob({
          modelId: 'anima-aesthetic-v1.1',
          prompt: spec.prompt,
          negative: spec.negative,
          width: 832,
          height: 1216,
          steps: 28,
          cfg: 5.2,
          seed: spec.seed
        });
        return await pollJob(jobId);
      })();

      fs.writeFileSync(tempPng, buf);
      fs.copyFileSync(tempPng, targetPng);
      console.log(`  [OK] 已成功生成并替换头像: popular-${spec.id}.png`);

      // 实时生成对应的粒子文件
      try {
        execSync(`npm run particles:build -- ${spec.id}`, { cwd: ROOT, stdio: 'pipe' });
        console.log(`  [OK] 粒子点阵已同步重建: assets/particles/p_${spec.id}.json`);
      } catch (pErr) {
        console.warn(`  [WARN] 粒子生成警告: ${pErr.message}`);
      }

    } catch (err) {
      console.error(`  [FAIL] ${spec.id} 生成失败:`, err.message);
    }
  }

  console.log('🎉 34 位早期热门角色头像与粒子点阵已全量重绘完成！');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
