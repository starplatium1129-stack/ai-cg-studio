import { normalizeKey, tokenize } from './promptPolicy.ts'

/**
 * 反推词条合并器（2026-08-29，随机灵感/反推优化）。
 *
 * 职责：反推（interrogate）词条写入 manualTags 前的「不重复叠加」与
 * 「人物身份冲突」消解。纯函数，无 Vue/IO 依赖，可被 node:test 单测。
 *
 * 三重去重：manualTags（已有手动词条）∪ 身份行（charPrompt / identityTokens
 * + exactTokens + outfit tokens）∪ 场景行（scene.prompt / blueprint.promptTokens）。
 *
 * 身份冲突：反推词条命中「人物固有特征域」（发色/瞳色/发型/发长/主体数量），
 * 且当前身份行在该域已有取值但不含该词条 → 跳过并报告（以当前作画角色为准，
 * 图上人物 ≠ 当前角色时，特征词条会污染角色身份）。
 */

// ── 人物固有特征域（同域不同值 = 身份冲突） ────────────────────────────────

const HAIR_COLOR_RE = /(?:very_)?(?:black|white|blonde|brown|red|pink|blue|silver|purple|orange|green|grey|gray|auburn|platinum|multicolored|colored|gradient|starry|light_brown|dark_brown|light_blue|light_purple|dark_green|pale_pink|silver_white)_hair$/
const EYE_COLOR_RE = /(?:black|white|blonde|brown|red|pink|blue|silver|purple|orange|green|grey|gray|amber|golden|yellow|gold|aqua|teal|violet|crimson|scarlet|starry|star-shaped|heterochromia|pink|light_blue|light_purple|dark_red)_eyes$/
const HAIR_STYLE_RE = /(?:twintails|low_twintails|high_twintails|side_twintails|braid|braids|single_braid|twin_braids|ponytail|side_ponytail|hair_bun|side_bun|double_bun|ahoge|antenna_hair|parted_bangs|hime_cut|bob_cut|hair_down|haircut|short_ponytail)$/
const HAIR_LENGTH_RE = /(?:very_long|absurdly_long|long|short|medium)_hair$/
const SUBJECT_COUNT_RE = /^(?:1girl|2girls|multiple_girls|1boy|multiple_boys|solo|crowd)$/

interface IdentityDomain {
  name: string
  label: string
  test: (key: string) => boolean
}

const IDENTITY_DOMAINS: IdentityDomain[] = [
  { name: 'hairColor', label: '发色', test: key => HAIR_COLOR_RE.test(key) },
  { name: 'eyeColor', label: '瞳色', test: key => EYE_COLOR_RE.test(key) },
  { name: 'hairStyle', label: '发型', test: key => HAIR_STYLE_RE.test(key) },
  { name: 'hairLength', label: '发长', test: key => HAIR_LENGTH_RE.test(key) },
  { name: 'subjectCount', label: '主体数量', test: key => SUBJECT_COUNT_RE.test(key) },
]

// ── 马赛克/打码类词条：反推命中即自动过滤（2026-08-29 需求） ─────────────
// NSFW 素材常带官方打码/马赛克，反推出的打码词条会把这些视觉特征带进提示词，
// 导致新图也带码。uncensored（无码）是正向属性，不在过滤清单。
const CENSOR_TAGS = new Set([
  'censored',
  'mosaic_censoring',
  'bar_censor',
  'convenient_censoring',
  'pointless_censoring',
  'heart_censor',
  'hair_censor',
  'out_of_frame_censoring',
  'novelty_censor',
  'steam_censor',
  'blur_censor',
  'censored_nipples',
  'identity_censor',
  'tail_censor',
  'light_censor',
  'soap_censor',
  'blank_censor',
  'character_censor',
])

/** 命中马赛克/打码过滤清单的词条（归一后比较）。 */
export function isCensorTag(tag: string): boolean {
  const key = normalizeKey(tag)
  return key ? CENSOR_TAGS.has(key) : false
}

/** 词条命中的身份域（无则 null）。 */
export function identityDomainOf(tag: string): IdentityDomain | null {
  const key = normalizeKey(tag)
  return IDENTITY_DOMAINS.find(domain => domain.test(key)) ?? null
}

export interface InterrogateTagConflict {
  tag: string
  domain: string
  reason: string
}

export interface InterrogateMergeInput {
  /** 反推词条（建议传入已剥离角色名的 general tags）。 */
  tags: ReadonlyArray<string>
  /** 已有手动词条（store.manualTags）。 */
  manualTags: ReadonlySet<string>
  /** 身份行词条：studio 为 charPrompt tokens；popular 为 identityTokens +
   *  exactTokens + 当前 outfit tokens（调用方经 collectInterrogateContext 组装）。 */
  identityTokens: ReadonlyArray<string>
  /** 场景行词条：studio 为场景 prompt+tags；popular 为蓝图 promptTokens。 */
  sceneTokens?: ReadonlyArray<string>
}

export interface InterrogateMergeResult {
  /** 可写入 manualTags 的新词条（保持反推置信度顺序）。 */
  accepted: string[]
  /** 与手动/身份/场景重复而跳过的词条。 */
  duplicates: string[]
  /** 与当前角色身份域冲突而跳过的词条（含域与原因）。 */
  conflicts: InterrogateTagConflict[]
  /** 马赛克/打码类词条（自动过滤，不带进提示词）。 */
  filtered: string[]
}

function toKeySet(tokens: ReadonlyArray<string>): Set<string> {
  const set = new Set<string>()
  for (const token of tokens) {
    const key = normalizeKey(token)
    if (key) set.add(key)
  }
  return set
}

/** 三重去重 + 身份域冲突消解后的可叠加词条。 */
export function mergeInterrogatedTags(input: InterrogateMergeInput): InterrogateMergeResult {
  const manualKeys = input.manualTags
  const identityKeys = toKeySet(input.identityTokens)
  const sceneKeys = toKeySet(input.sceneTokens ?? [])

  // 身份行按域分组：域 → 身份行已占用的 key 集（含跨域词条归一后的匹配）
  const identityDomainKeys = new Map<string, Set<string>>()
  for (const key of identityKeys) {
    for (const domain of IDENTITY_DOMAINS) {
      if (domain.test(key)) {
        const bucket = identityDomainKeys.get(domain.name) ?? new Set<string>()
        bucket.add(key)
        identityDomainKeys.set(domain.name, bucket)
      }
    }
  }

  const accepted: string[] = []
  const duplicates: string[] = []
  const conflicts: InterrogateTagConflict[] = []
  const filtered: string[] = []

  for (const raw of input.tags) {
    const key = normalizeKey(raw)
    if (!key) continue
    // 马赛克/打码类词条自动过滤（不提示、不计数为重复）。
    if (CENSOR_TAGS.has(key)) {
      filtered.push(key)
      continue
    }
    if (manualKeys.has(key) || identityKeys.has(key) || sceneKeys.has(key)) {
      duplicates.push(key)
      continue
    }
    // 身份域冲突：词条属某身份域，且身份行在该域已有取值但不含此词条 → 跳过。
    const domain = IDENTITY_DOMAINS.find(item => item.test(key))
    if (domain) {
      const occupied = identityDomainKeys.get(domain.name)
      if (occupied && occupied.size && !occupied.has(key)) {
        conflicts.push({
          tag: key,
          domain: domain.label,
          reason: `${domain.label}与当前角色（${[...occupied].slice(0, 3).join('、')}）冲突`,
        })
        continue
      }
    }
    accepted.push(key)
  }

  return { accepted, duplicates, conflicts, filtered }
}

/**
 * 反推识别出的角色名（characterTags）与当前作画角色的冲突说明。
 * 命中当前角色触发词 → 无冲突返回 null；识别到其他角色 → 提示文案。
 */
export function characterConflictNote(
  characterTags: ReadonlyArray<string> | undefined,
  identityTokens: ReadonlyArray<string>,
): string | null {
  if (!characterTags || !characterTags.length) return null
  const identityKeys = toKeySet(identityTokens)
  const foreign = characterTags.filter(tag => !identityKeys.has(normalizeKey(tag)))
  if (!foreign.length) return null
  return `图中识别到其他角色：${foreign.slice(0, 3).join('、')}${foreign.length > 3 ? ' 等' : ''}，已按当前角色作画，角色名词条未叠加`
}

// ── 上下文采集（视图层参数组装，保持工具层与 store 解耦） ────────────────

export interface InterrogateContextParams {
  kind: 'studio' | 'popular'
  /** studio：pb.charPrompt（"1girl, solo, ayachi_nene, white_hair, …"）。 */
  charPrompt?: string
  /** studio：当前场景 prompt 与 tags。 */
  scenePrompt?: string
  sceneTags?: ReadonlyArray<string>
  /** popular：当前角色词条聚合。 */
  character?: {
    identityTokens: ReadonlyArray<string>
    exactTokens?: ReadonlyArray<string>
    outfitTokens?: ReadonlyArray<string>
  } | null
  /** popular：当前蓝图 promptTokens。 */
  blueprintTokens?: ReadonlyArray<string>
}

/** 采集反推合并所需的身份行与场景行词条。 */
export function collectInterrogateContext(params: InterrogateContextParams): {
  identityTokens: string[]
  sceneTokens: string[]
} {
  if (params.kind === 'popular') {
    const character = params.character
    return {
      identityTokens: [
        ...(character?.identityTokens ?? []),
        ...(character?.exactTokens ?? []),
        ...(character?.outfitTokens ?? []),
      ],
      sceneTokens: [...(params.blueprintTokens ?? [])],
    }
  }
  return {
    identityTokens: tokenize(String(params.charPrompt || '')),
    sceneTokens: [
      ...tokenize(String(params.scenePrompt || '')),
      ...(params.sceneTags ?? []),
    ],
  }
}
