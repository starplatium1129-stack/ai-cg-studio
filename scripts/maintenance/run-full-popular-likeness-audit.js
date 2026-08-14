'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const popular = require('../../src/utils/popularContent.ts');
const charData = require('../../data/popular-characters.json');
const bpData = require('../../data/scene-blueprints.json');

const characters = popular.parsePopularCharacters(charData);
const blueprints = popular.parseSceneBlueprints(bpData);

const outDir = path.resolve(__dirname, '../../runtime/outputs/full_popular_likeness_audit');
fs.mkdirSync(outDir, { recursive: true });

function requestJson(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(dataStr ? { 'Content-Length': Buffer.byteLength(dataStr) } : {})
      }
    }, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          resolve({ status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

function fetchBinary(urlPath, destFile) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destFile);
    http.get(`http://127.0.0.1:3000${urlPath}`, res => {
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destFile)));
    }).on('error', reject);
  });
}

async function runJob(name, payload) {
  console.log(`[${name}] Submitting Anima Aesthetic job...`);
  const createRes = await requestJson('POST', '/api/anima/jobs', payload);
  if (!createRes.ok || !createRes.job) {
    console.error(`[${name}] Failed to create job:`, JSON.stringify(createRes));
    return null;
  }
  const jobId = createRes.job.id;
  const start = Date.now();
  while (Date.now() - start < 180000) {
    await new Promise(r => setTimeout(r, 1500));
    const statusRes = await requestJson('GET', `/api/anima/jobs/${jobId}`);
    const job = statusRes.job;
    if (!job) continue;
    process.stdout.write(`\r[${name}] Status: ${job.status}...`);
    if (job.status === 'succeeded') {
      console.log(`\n[${name}] Succeeded!`);
      const targetFile = path.join(outDir, `${name}.png`);
      await fetchBinary(job.resultUrl, targetFile);
      const stat = fs.statSync(targetFile);
      console.log(`[${name}] Saved to ${targetFile} (${Math.round(stat.size / 1024)} KB)`);
      return targetFile;
    } else if (job.status === 'failed') {
      console.error(`\n[${name}] Failed: ${job.error}`);
      return null;
    }
  }
  return null;
}

async function main() {
  const tests = [
    { charId: 'artoria_pendragon', bpId: 'artoria_moonlit_city', name: 'artoria_moonlit_city', seed: 1111 },
    { charId: 'tohsaka_rin', bpId: 'tohsaka_rin_mansion', name: 'tohsaka_rin_mansion', seed: 2222 },
    { charId: 'hatsune_miku', bpId: 'hatsune_miku_concert', name: 'hatsune_miku_concert', seed: 3333 },
    { charId: 'sakurajima_mai', bpId: 'sakurajima_mai_library', name: 'sakurajima_mai_library_v3', seed: 4444 }
  ];

  const generated = [];
  for (const t of tests) {
    const char = popular.findCharacter(characters, t.charId);
    const bp = blueprints.find(b => b.id === t.bpId);
    const plan = popular.buildPopularPromptPlan({
      character: char,
      outfit: char.outfits[0],
      blueprint: bp,
      engine: 'anima',
      profile: null,
      adultEnabled: true,
      artistTags: ['@shirai eishi', '@tiv']
    });

    const payload = {
      modelId: 'anima-aesthetic-v1.1',
      prompt: plan.prompt,
      negative: plan.negative || 'worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration, bad anatomy, bad hands, dark shadowed face',
      width: 832,
      height: 1216,
      steps: 30,
      cfg: 4.5,
      seed: t.seed
    };

    const file = await runJob(t.name, payload);
    if (file) generated.push(file);
  }

  console.log('\nAll popular characters generated. Saved to:', generated);
}

main().catch(console.error);
