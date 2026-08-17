'use strict';

/**
 * scripts/maintenance/make-short-film.js — 项目链路 AI 短片制作工具
 *
 * 阶段（--stage）：
 *   refs      用 Anima 出角色参考图（@rella 风格）并上传为受控文件
 *   script    故事梗概 → AI 全自动分镜脚本（/api/video-ai/script）
 *   generate  批量提交分镜（references + T2VA + 对白 + 尾帧衔接）→ 拼接成片
 *
 * 用法：
 *   node make-short-film.js --stage refs
 *   node make-short-film.js --stage script
 *   node make-short-film.js --stage generate
 */

const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:3123';
const OUT_DIR = path.join(__dirname, '..', '..', 'runtime', 'short-film');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── 角色参考卡（宁宁 + 夏目，@rella 风格）──────────────────────────────
const CHARACTERS = {
  nene: {
    loraId: 'L_NENE_V21_ANIMA',
    identity: 'a girl with long white hair in low twintails, purple eyes, gentle and soft expression',
  },
  natsume: {
    loraId: 'L_NAT_V21_ANIMA',
    identity: 'a girl with very long black hair, golden yellow eyes, two red hairclips, calm and elegant',
  },
};

// 每个角色 3 张参考图：脸特写 / 半身 / 全身氛围
// face 特写必须显式排除伤痕/血迹/瑕疵——2026-08-17 曾因特写 prompt 缺少
// clean-face 约束，Anima 画出血刀疤版 face 卡，Ref2VA 把角色全部锚坏。
const REF_SHOTS = [
  { label: 'face', prompt: 'face close-up portrait, looking at viewer, detailed beautiful eyes, soft gentle smile, clean skin, no scars, no blood, no blemishes, long hair clearly visible', size: [832, 1216] },
  { label: 'half', prompt: 'upper body portrait, natural standing pose, clear outfit and hairstyle', size: [832, 1216] },
  { label: 'full', prompt: 'full body shot, standing in a night city street with soft bokeh lights, dreamy atmosphere', size: [1216, 832] },
];

async function poll(base, pathname, isDone, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(base + pathname, { cache: 'no-store' });
    const data = await res.json();
    if (isDone(data)) return data;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(label + ' 超时');
}

async function stageRefs() {
  const statePath = path.join(OUT_DIR, 'refs.json');
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { cards: {} };
  for (const [charId, char] of Object.entries(CHARACTERS)) {
    state.cards[charId] = state.cards[charId] || [];
    for (const shot of REF_SHOTS) {
      const existing = state.cards[charId].find(item => item.label === shot.label);
      if (existing) { console.log(`[refs] ${charId}/${shot.label} 已有 ${existing.name}`); continue; }
      const prompt = `${char.identity}, ${shot.prompt}, @rella, dreamy night glow, cinematic lighting, masterpiece`;
      console.log(`[refs] 出图 ${charId}/${shot.label} ...`);
      const res = await fetch(BASE + '/api/anima/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          negative: '',
          modelId: 'anima-aesthetic-v1.1',
          loraId: char.loraId,
          loraStrength: 1,
          character: charId,
          width: shot.size[0],
          height: shot.size[1],
          steps: 30,
          cfg: 4.5,
        }),
      });
      const body = await res.json();
      if (res.status !== 202 || !body.job?.id) throw new Error('Anima 提交失败: ' + JSON.stringify(body).slice(0, 300));
      const job = await poll(BASE, '/api/anima/jobs/' + body.job.id,
        d => d.job && d.job.status === 'succeeded', 600_000, '参考图出图');
      const imgRes = await fetch(BASE + job.job.resultUrl, { cache: 'no-store' });
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const uploadRes = await fetch(BASE + '/api/video/images', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: buffer.toString('base64'), kind: 'reference' }),
      });
      const upload = await uploadRes.json();
      if (uploadRes.status !== 200 || !upload.name) throw new Error('参考图上传失败');
      fs.writeFileSync(path.join(OUT_DIR, `${charId}_${shot.label}.png`), buffer);
      state.cards[charId].push({ label: shot.label, name: upload.name });
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      console.log(`[refs] ${charId}/${shot.label} -> ${upload.name}`);
    }
  }
  console.log('[refs] 参考卡完成：');
  for (const [charId, items] of Object.entries(state.cards)) {
    console.log(`  ${charId}: ${items.map(i => i.name).join(', ')}`);
  }
}

async function stageScript() {
  const statePath = path.join(OUT_DIR, 'refs.json');
  const refs = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const story = process.env.STORY || '深夜的咖啡店即将打烊，宁宁擦拭着最后一个杯子。门铃响起，夏目走进来，点了一杯她常喝的咖啡。两人聊起多年前的往事，宁宁把一封旧信推到夏目面前。夏目读完抬起头，眼眶微红，轻声说了一句谢谢。窗外下起雨，两人相视而笑。';
  const scriptPath = path.join(OUT_DIR, 'script.json');
  if (fs.existsSync(scriptPath)) {
    console.log('[script] 已有脚本，跳过（删除 script.json 重生成）');
    return;
  }
  console.log('[script] AI 生成分镜脚本...');
  const res = await fetch(BASE + '/api/video-ai/script', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      story,
      shotCount: 10,
      characterLabels: ['nene（white twintails girl）', 'natsume（black hair golden eyes girl）'],
    }),
  });
  const body = await res.json();
  if (res.status !== 200 || !body.shots?.length) throw new Error('脚本失败: ' + JSON.stringify(body).slice(0, 400));
  fs.writeFileSync(scriptPath, JSON.stringify({ story, shots: body.shots }, null, 2));
  console.log(`[script] 生成 ${body.shots.length} 镜：`);
  body.shots.forEach((shot, i) => {
    console.log(`  ${i + 1}. [${shot.shotSize || '-'}/${shot.camera}/${shot.motion}/${shot.duration}s] ${shot.prompt.slice(0, 80)}${shot.dialogue ? ' | 台词：' + shot.dialogue : ''}`);
  });
}

async function stageGenerate() {
  const refsPath = path.join(OUT_DIR, 'refs.json');
  const scriptPath = path.join(OUT_DIR, 'script.json');
  const refs = JSON.parse(fs.readFileSync(refsPath, 'utf8'));
  const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
  const neneRefs = refs.cards.nene || [];
  const natsumeRefs = refs.cards.natsume || [];
  // 每角色只取 1 张 face 主卡作 Ref2VA 参考：<Picture N> 标签与参考图槽位严格
  // 1:1 对齐（宁宁→<Picture 1>、夏目→<Picture 2>）。此前传 3+3 张时 prompt 只
  // 引用 <Picture 1>/<Picture 2>，两个标签都指向宁宁的图，夏目被锚成白发
  // （2026-08-17 实锤：双角色镜头全错位）。
  const faceName = (items) => {
    const face = items.find((i) => i.label === 'face');
    return (face || items[0]).name;
  };
  const castRefs = (cast) => {
    if (cast === '1') return [faceName(neneRefs)];
    if (cast === '2') return [faceName(natsumeRefs)];
    if (cast === '12') return [faceName(neneRefs), faceName(natsumeRefs)];
    return undefined;
  };

  // 每镜手动指定出场角色（按脚本内容推断）
  const casts = process.env.CASTS
    ? process.env.CASTS.split(',')
    : script.shots.map((shot, i) => {
        // 简单启发式：提到两个名字 → 12；黑发/夏目 → 2；默认 → 1
        const p = shot.prompt.toLowerCase();
        if (p.includes('picture 1') && p.includes('picture 2')) return '12';
        if (p.includes('black hair') || p.includes('picture 2')) return '2';
        return '1';
      });

  // 场景一致性锚（2026-08-17 用户反馈：切换画面背景漂移大——"看得出是
  // 咖啡厅但每次都是不同咖啡厅"）。带参考卡的镜头因身份正确性跳过了尾帧
  // 衔接，零场景锚定、各镜独立采样；这里给每镜 prompt 附加同一句场景定场
  // 句收敛布景漂移。外景锚只用于第 1 镜（店外），其余统一用内景锚。
  const SCENE_ANCHOR_OUT = '深夜街道同一家小咖啡店外观：玻璃门透出暖黄灯光，招牌微亮，安静的夜街。';
  const SCENE_ANCHOR_IN = '这仍是同一家深夜咖啡馆内部：木质吧台、意式咖啡机、玻璃陈列架、圆形挂钟、暖黄吊灯、临街窗户。';

  const shots = script.shots.map((shot, i) => {
    const references = castRefs(casts[i]);
    const anchor = i === 0 ? SCENE_ANCHOR_OUT : SCENE_ANCHOR_IN;
    return {
      prompt: shot.prompt + ' ' + anchor,
      dialogue: shot.dialogue || undefined,
      shotSize: shot.shotSize || undefined,
      camera: shot.camera,
      motion: shot.motion,
      duration: shot.duration,
      references,
    };
  });

  console.log('[generate] 提交批量分镜（' + shots.length + ' 镜，尾帧衔接 + 参考卡 + T2VA）...');
  const res = await fetch(BASE + '/api/video/batches', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      modelId: 'minimax-h3',
      aspectRatio: 'landscape',
      quality: 'standard',
      steps: 4,
      linkLastFrame: true,
      shots,
    }),
  });
  const body = await res.json();
  if (res.status !== 202 || !body.batch?.id) throw new Error('批量提交失败: ' + JSON.stringify(body).slice(0, 400));
  const batchId = body.batch.id;
  console.log('[generate] batch id: ' + batchId);

  const deadline = Date.now() + 60 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    const state = await (await fetch(BASE + '/api/video/batches/' + batchId, { cache: 'no-store' })).json();
    const b = state.batch;
    const done = b.progress.succeeded + b.progress.failed;
    console.log(`[generate] ${b.status}: ${done}/${b.progress.total} 完成（成功 ${b.progress.succeeded} 失败 ${b.progress.failed}）`);
    if (b.status === 'done' || b.status === 'paused') break;
  }
  const finalState = await (await fetch(BASE + '/api/video/batches/' + batchId, { cache: 'no-store' })).json();
  const b = finalState.batch;
  if (b.progress.failed) {
    b.shots.forEach((s, i) => {
      if (s.status === 'failed') console.log(`  ✗ 镜头 ${i + 1} 失败: ${s.error}`);
    });
  }
  if (b.progress.succeeded >= 2) {
    console.log('[generate] 拼接成片...');
    const concat = await (await fetch(BASE + '/api/video/batches/' + batchId + '/concat', { method: 'POST' })).json();
    if (concat.batch?.concatUrl) {
      console.log('[generate] 成片: ' + BASE + concat.batch.concatUrl);
      fs.writeFileSync(path.join(OUT_DIR, 'film-url.txt'), BASE + concat.batch.concatUrl);
    }
  }
}

const stage = process.argv[2] === '--stage' ? process.argv[3] : (process.argv[2] || 'refs');
(async () => {
  if (stage === 'refs') await stageRefs();
  else if (stage === 'script') await stageScript();
  else if (stage === 'generate') await stageGenerate();
  else throw new Error('未知阶段: ' + stage);
  console.log('[done] stage=' + stage);
})().catch(err => {
  console.error('[fail]', err.message);
  process.exitCode = 1;
});
