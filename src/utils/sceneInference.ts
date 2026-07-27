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

export function sceneComposition(_scene: any): string | null {
  // 默认给三分法，避免空白
  return 'rule3'
}

export function sceneRecommendedSize(scene: { tags?: string[] }): string {
  const tags = (scene.tags || []).map(t => String(t).toLowerCase())
  if (tags.some(t => ['vertical', 'portrait', '手机', '竖图'].some(k => t.includes(k)))) return '768x1344'
  if (tags.some(t => ['wide', 'landscape', '横图', 'panorama'].some(k => t.includes(k)))) return '1344x768'
  if (tags.some(t => t.includes('square') || t.includes('方图'))) return '896x896'
  return '832x1216'
}