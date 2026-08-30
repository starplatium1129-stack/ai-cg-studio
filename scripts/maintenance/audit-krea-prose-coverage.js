// Krea 2 提示词优化摸底审计 v3（2026-08-30 调研报告 §10.4 配套）
// v3：完全模拟 buildPopularPromptPlan → inferBlueprintDecisions 的真实推断语义
// （matchFirst 查 camera/lighting/mood/promptProse/sceneTags），统计 Krea 渲染时
// 镜头/光照决策缺失的蓝图 + promptProse 显式词兜底。只读审计。
'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '../..')

const CAMERA_TO_SHOT = {
  closeup: 'close', 'close-up': 'close', close_up: 'close', close: 'close',
  'medium shot': 'medium', half_body: 'medium', medium: 'medium',
  'wide shot': 'wide', wide_shot: 'wide', full_body: 'wide', wide: 'wide',
  pov: 'pov', 'high angle': 'high', from_above: 'high', 'low angle': 'low',
  from_below: 'low', 'side view': 'side', looking_back: 'turn', 'front view': 'turn',
}
const EXTRA_CAMERA_TO_SHOT = [
  [/dynamic action (?:shot|angle)|action shot/, 'wide'],
  [/full body/, 'wide'],
  [/couch level|low level/, 'low'],
  [/three quarter/, 'medium'],
  [/upper body/, 'medium'],
  [/intimate (?:dramatic )?angle|dramatic intimate angle/, 'medium'],
  [/back[_ ](?:view|shot)/, 'medium'],
]
const BLUEPRINT_ANGLE_RE = [
  [/low angle|from below/, 'low'],
  [/high angle|from above|overhead/, 'high'],
  [/\bpov\b|first-person|first person|主观/, 'pov'],
]
const LIGHTING_TO_ID = {
  golden: 'golden', 'golden hour': 'golden', sunset: 'golden', dusk: 'golden',
  morning: 'golden', sunlight: 'golden', autumn: 'golden', 余晖: 'golden',
  柴火: 'lantern', 炉火: 'lantern', spotlight: 'lantern',
  window: 'window', 'window light': 'window', backlight: 'back', backlit: 'back',
  'rim light': 'back', moonlight: 'moon', moon: 'moon', night: 'moon',
  lantern: 'lantern', candlelight: 'lantern', candle: 'lantern', lamp: 'lantern', overcast: 'overcast',
}
function matchFirst(text, table) {
  const lower = text.toLowerCase()
  const keys = Object.keys(table).sort((a, b) => b.length - a.length)
  for (const key of keys) { if (lower.includes(key)) return table[key] }
  return null
}
function blueprintAngleShot(cameraText) {
  const text = String(cameraText || '').toLowerCase()
  if (!text) return null
  for (const [re, id] of BLUEPRINT_ANGLE_RE) { if (re.test(text)) return id }
  return null
}
function inferShot(blueprint) {
  const hay = [blueprint.camera, blueprint.lighting, blueprint.mood, blueprint.promptProse, (blueprint.sceneTags || []).join(', ')].join(' ').toLowerCase()
  const angleShot = blueprintAngleShot(blueprint.camera)
  const cameraText = String(blueprint.camera || '').toLowerCase()
  let shot = angleShot ?? matchFirst(hay, CAMERA_TO_SHOT)
  if (!shot) shot = EXTRA_CAMERA_TO_SHOT.find(([pattern]) => pattern.test(cameraText))?.[1] ?? null
  return shot
}
function inferLighting(blueprint) {
  const hay = [blueprint.camera, blueprint.lighting, blueprint.mood, blueprint.promptProse, (blueprint.sceneTags || []).join(', ')].join(' ').toLowerCase()
  return matchFirst(hay, LIGHTING_TO_ID)
}

// promptProse 显式英文词兜底
const PROSE_LIGHT_RE = /(?:lighting|light|backlit|backlight|golden|sunlight|moonlight|lantern|window|rim light|overcast|glow|illuminated|candlelight|sunset|dusk|dawn|twilight|ray|beam|haze|mist|volumetric|fluorescent|neon|lamp|torch|firelight)/i
const PROSE_SHOT_RE = /(?:close[- ]?up|medium shot|wide shot|long shot|full[- ]?body|half[- ]?body|upper[- ]?body|waist[- ]?up|portrait|low angle|high angle|pov|over[- ]?shoulder|three[- ]?quarter|side view|profile|establishing|extreme close|dutch angle|selfie|framed|composition|symmetrical|vanishing perspective|eye level|dynamic angle|angle)/i

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scene-blueprints.json'), 'utf8'))
const bps = data.blueprints || []
const missing = { light: [], shot: [], both: [] }
for (const b of bps) {
  const prose = b.promptProse || ''
  const shot = inferShot(b)
  const lighting = inferLighting(b)
  const hasLight = lighting !== null || PROSE_LIGHT_RE.test(prose)
  const hasShot = shot !== null || PROSE_SHOT_RE.test(prose)
  if (!hasLight) missing.light.push(`${b.id} | ${b.title} | light=${b.lighting}`)
  if (!hasShot) missing.shot.push(`${b.id} | ${b.title} | camera=${b.camera} | mood=${b.mood}`)
  if (!hasLight && !hasShot) missing.both.push(`${b.id} | ${b.title}`)
}
console.log('═══ 真实渲染缺光照（推断+散文双无）═══')
console.log(`count: ${missing.light.length}/${bps.length}`)
console.log(missing.light.join('\n'))
console.log('\n═══ 真实渲染缺镜头（推断+散文双无）═══')
console.log(`count: ${missing.shot.length}/${bps.length}`)
console.log(missing.shot.join('\n'))
console.log('\n═══ 光照镜头双缺 ═══')
console.log(`count: ${missing.both.length}/${bps.length}`)
console.log(missing.both.join('\n'))
