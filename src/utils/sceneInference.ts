// 场景智能推断：从迁移前 pb_sceneinfer.js + pb_composition.js 移植
// 选场景时自动预填光照/镜头/构图/色彩情调/推荐尺寸

const SCENE_LIGHT_HINT: Record<string, string[]> = {
  golden: ['夕阳', '黄昏', '落日', '魔法时刻', 'golden hour', '夕陽 Golden Hour'],
  window: ['窗', '窗边', '窗光', 'window light'],
  back: ['逆光', '背光', 'backlight'],
  moon: ['月', '月光', '夜', 'moonlight'],
  lantern: ['灯', '灯笼', '灯笼光'],
  overcast: ['阴天', '多云', 'overcast'],
}

const CAMERA_TO_SHOT_BY_TAG: Record<string, string> = {
  closeup: 'close', 'close-up': 'close', close_up: 'close', 'medium_shot': 'medium', half_body: 'medium', bust: 'medium',
  wide_shot: 'wide', full_body: 'wide', pov: 'pov', high_angle: 'high', from_above: 'high', from_below: 'low',
  side_view: 'side', looking_back: 'turn', turn_back: 'turn', selfie: 'over', macro: 'detail',
}

const MOOD_BY_KEYWORD: Record<string, string[]> = {
  joy: ['快乐', '开心', '笑', '阳光'],
  love: ['恋爱', '喜欢', '心动', '吻', '约'],
  calm: ['平静', '安静', '睡', '午后'],
  sad: ['忧伤', '哭', '泪', '离别'],
  tension: ['神秘', '夜', '魔法', '梦境'],
  warmth: ['温馨', '暖', '家', '围巾', '火锅'],
}

export function sceneLighting(scene: { tags?: string[]; lighting?: string }): string | null {
  const tags = (scene.tags || []).map(t => String(t).toLowerCase())
  for (const [id, hints] of Object.entries(SCENE_LIGHT_HINT)) {
    if (hints.some(h => tags.includes(h.toLowerCase()))) return id
  }
  if (scene.lighting) {
    const lit = String(scene.lighting).toLowerCase()
    for (const [id, hints] of Object.entries(SCENE_LIGHT_HINT)) {
      if (hints.some(h => lit.includes(h.toLowerCase()))) return id
    }
  }
  return null
}

export function sceneShot(scene: { tags?: string[]; camera?: string }): string | null {
  const tags = (scene.tags || []).map(t => String(t).toLowerCase())
  for (const t of tags) {
    for (const [shotId, keys] of Object.entries(CAMERA_TO_SHOT_BY_TAG)) {
      if (t.includes(keys)) return shotId
    }
  }
  if (scene.camera) {
    const cam = String(scene.camera).toLowerCase()
    for (const [shotId, key] of Object.entries(CAMERA_TO_SHOT_BY_TAG)) {
      if (cam.replace(/\s+/g, '_').includes(key)) return shotId
    }
  }
  return null
}

export function sceneColorMood(scene: { tags?: string[]; story?: string }): string | null {
  const hay = ((scene.tags || []).concat(scene.story ? [scene.story] : [])).join(' ').toLowerCase()
  for (const [id, keys] of Object.entries(MOOD_BY_KEYWORD)) {
    if (keys.some(k => hay.includes(k.toLowerCase()))) return id
  }
  return null
}

export function sceneComposition(_scene: unknown): string | null {
  // 默认给三分法，避免空白
  return 'rule3'
}

/**
 * 画幅标签只认整个标签，不做子串匹配。
 * 原来用 includes('wide') 判横图，把镜头标签 wide_shot（广角/远景，说的是
 * 取景范围，不是画幅）也算成横图 —— 全库 50 个场景带 wide_shot，选中它们
 * 就会被悄悄改成 1344×768。真正表示横幅的标签是 landscape（26 个官方 CG 横幅）。
 */
const PORTRAIT_TAGS = new Set(['vertical', 'portrait', '竖图', '手机壁纸', '手机'])
const LANDSCAPE_TAGS = new Set(['landscape', 'wide', 'widescreen', 'panorama', '横图', '横幅'])
const SQUARE_TAGS = new Set(['square', '方图'])

export function sceneRecommendedSize(scene: { tags?: string[] }): string {
  const tags = (scene.tags || []).map(t => String(t).trim().toLowerCase())
  if (tags.some(t => PORTRAIT_TAGS.has(t))) return '768x1344'
  if (tags.some(t => LANDSCAPE_TAGS.has(t))) return '1344x768'
  if (tags.some(t => SQUARE_TAGS.has(t))) return '896x896'
  return '832x1216'
}
