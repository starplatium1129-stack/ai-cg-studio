import type { SceneBlueprint } from './popularContent.ts'

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rotateBlueprints(list: SceneBlueprint[], key: string, cursor: number): SceneBlueprint[] {
  const rng = mulberry32(hashString(`${key}#${cursor}`))
  const shuffled = [...list]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled
}

function sameIds(left: SceneBlueprint[], right: string[] | null): boolean {
  if (!right || !right.length) return false
  if (left.length !== right.length) return false
  return left.every((blueprint, index) => blueprint.id === right[index])
}

/**
 * 「换一批」的确定性轮换：seed = 角色 + 服装 + cursor，连续 cursor 给出不同
 * 排列；当前推荐与前一批相同或数量不足时自动前进，避免立即重复。
 */
export function recommendBlueprints(
  list: SceneBlueprint[],
  key: string,
  cursor: number,
  previousIds: string[] | null,
  count = 3,
  characterId?: string | null,
): SceneBlueprint[] {
  // 角色感知：传入 characterId 时只从该角色的原型场景中轮转；缺省保持全量行为。
  const pool = characterId
    ? list.filter(blueprint => blueprint.characterId === characterId)
    : list
  if (pool.length === 0) return []
  // 2026-08-16 审计：候选数 ≤ 每批数量时此前直接 return pool，绕过轮换——
  // 「换一批」永远返回同一排列（同批重复）。改为仍做确定性轮换，只改变顺序；
  // 此场景集合恒同，防重循环最多重试一次足矣。
  const maxAttempts = pool.length <= count ? 1 : 8
  let attempt = cursor
  let picked = rotateBlueprints(pool, key, attempt).slice(0, count)
  while (sameIds(picked, previousIds) && attempt < cursor + maxAttempts) {
    attempt += 1
    picked = rotateBlueprints(pool, key, attempt).slice(0, count)
  }
  return picked
}

