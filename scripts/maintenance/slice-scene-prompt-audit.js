/**
 * slice-scene-prompt-audit.js
 *
 * 把两套场景数据切成若干“连续批次”的审阅文件，供并行子代理逐场景审阅
 * “故事 vs 提示词一致性”与“提示词内部冲突”。
 *
 * 输入（data/ 源文件）：
 *   - scene-blueprints.json       热门角色场景预设（437 条）
 *   - scenes-nene.json / scenes-natsume.json / scenes-shared.json  场景库（302 条）
 * 输出：
 *   - runtime/scene-prompt-audit/batches/<dataset>_<nn>.json
 *   - runtime/scene-prompt-audit/manifest.json
 *
 * 只读 data/，不改任何源数据。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const DATA = path.join(ROOT, 'data')
const OUT = path.join(ROOT, 'runtime', 'scene-prompt-audit', 'batches')
const MANIFEST = path.join(ROOT, 'runtime', 'scene-prompt-audit', 'manifest.json')

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 24)

function read(name) {
  const raw = fs.readFileSync(path.join(DATA, name), 'utf8')
  return JSON.parse(raw)
}

/** 场景库条目 → 紧凑审阅视图 */
function pickScene(s) {
  return {
    id: s.id,
    title: s.title,
    category: s.category,
    char: s.char,
    character: s.character,
    rating: s.rating,
    mature: s.mature,
    timeOfDay: s.timeOfDay,
    location: s.location,
    camera: s.camera,
    lighting: s.lighting,
    weather: s.weather,
    emotion: s.emotion,
    season: s.season,
    usage: s.usage,
    tags: s.tags,
    story: s.story,
    prompt: s.prompt,
    negative: s.negative,
    animaCaption: s.animaCaption,
  }
}

/** 热门角色场景预设条目 → 紧凑审阅视图 */
function pickBlueprint(b) {
  return {
    id: b.id,
    title: b.title,
    category: b.category,
    characterId: b.characterId,
    outfitId: b.outfitId,
    adult: b.adult,
    description: b.description,
    location: b.location,
    action: b.action,
    timeOfDay: b.timeOfDay,
    lighting: b.lighting,
    camera: b.camera,
    mood: b.mood,
    sceneTags: b.sceneTags,
    promptProse: b.promptProse,
    promptTokens: b.promptTokens,
    negativeTokens: b.negativeTokens,
    nsfwProse: b.nsfwProse,
    nsfwTokens: b.nsfwTokens,
    sampleRating: b.sampleRating,
  }
}

function sliceInto(list, batchSize) {
  const batches = []
  for (let i = 0; i < list.length; i += batchSize) {
    batches.push(list.slice(i, i + batchSize))
  }
  return batches
}

function writeBatch(dataset, index, scenes) {
  const file = path.join(OUT, `${dataset}_${String(index).padStart(2, '0')}.json`)
  fs.writeFileSync(file, JSON.stringify({ dataset, batchIndex: index, count: scenes.length, scenes }, null, 1))
  return file
}

function main() {
  fs.mkdirSync(OUT, { recursive: true })

  const blueprints = read('scene-blueprints.json').blueprints || []
  const nene = read('scenes-nene.json')
  const natsume = read('scenes-natsume.json')
  const shared = read('scenes-shared.json')

  const jobs = [
    { dataset: 'blueprints', list: blueprints.map(pickBlueprint) },
    { dataset: 'nene', list: nene.map(pickScene) },
    { dataset: 'natsume', list: natsume.map(pickScene) },
    { dataset: 'shared', list: shared.map(pickScene) },
  ]

  const manifest = { generatedAt: new Date().toISOString(), batchSize: BATCH_SIZE, batches: [] }
  let total = 0
  for (const job of jobs) {
    const chunks = sliceInto(job.list, BATCH_SIZE)
    chunks.forEach((chunk, i) => {
      const file = writeBatch(job.dataset, i + 1, chunk)
      manifest.batches.push({ dataset: job.dataset, batch: i + 1, file: path.relative(ROOT, file), count: chunk.length })
      total += chunk.length
    })
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
  console.log(`OK total=${total} batches=${manifest.batches.length}`)
  for (const b of manifest.batches) console.log(`  ${b.dataset}_${String(b.batch).padStart(2, '0')} (${b.count}) ${b.file}`)
}

main()
