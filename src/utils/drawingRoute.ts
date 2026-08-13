export type ManagedDrawEngine = 'sd' | 'anima' | 'krea2'
export type ManagedPromptFormat = 'danbooru' | 'anima-tags' | 'natural-language'
export type StudioCharacter = 'nene' | 'natsume' | 'triad'

export interface DrawingRouteInput {
  subjectKind: 'studio' | 'popular'
  character: StudioCharacter
  recommendedModelId?: string | null
}

export interface DrawingRouteRecommendation {
  id: 'studio-single' | 'studio-dual' | 'popular-anima' | 'popular-krea'
  engine: ManagedDrawEngine
  modelId: string
  loraId: string
  generationCharacter: 'nene' | 'nene_b' | 'natsume' | null
  promptFormat: ManagedPromptFormat
  title: string
  summary: string
  reasons: readonly string[]
  experimental: boolean
}

const STUDIO_LORA = Object.freeze({
  nene: Object.freeze({
    loraId: 'L_NENE_V20B_ANIMA',
    generationCharacter: 'nene_b' as const,
    label: '宁宁 V20B',
  }),
  natsume: Object.freeze({
    loraId: 'L_NAT_V20_ANIMA',
    generationCharacter: 'natsume' as const,
    label: '夏目 V20',
  }),
})

/**
 * 场景模式只表达创作意图，技术路线由这里统一决定。
 * 新增 ComfyUI 工作流时应注册成新的受控路线，不把节点或 Prompt 语法暴露给用户。
 */
export function recommendDrawingRoute(input: DrawingRouteInput): DrawingRouteRecommendation {
  if (input.subjectKind === 'popular') {
    if (input.recommendedModelId === 'krea2-turbo-fp8') {
      return {
        id: 'popular-krea',
        engine: 'krea2',
        modelId: 'krea2-turbo-fp8',
        loraId: '',
        generationCharacter: null,
        promptFormat: 'natural-language',
        title: '热门角色自然语言路线',
        summary: 'Krea 2 · 自然语言构图 · 无角色 LoRA',
        reasons: [
          '按角色资料使用推荐底模',
          '系统自动把场景整理为自然语言画面描述',
        ],
        experimental: true,
      }
    }
    return {
      id: 'popular-anima',
      engine: 'anima',
      modelId: 'anima-aesthetic-v1.1',
      loraId: '',
      generationCharacter: null,
      promptFormat: 'anima-tags',
      title: '热门角色通用高质路线',
      summary: 'Anima Aesthetic · 模型原生标签 · 无角色 LoRA',
      reasons: [
        '热门角色不混入宁宁或夏目的 LoRA',
        '身份、服装和场景蓝图由系统组合',
      ],
      experimental: false,
    }
  }

  if (input.character === 'triad') {
    return {
      id: 'studio-dual',
      engine: 'sd',
      modelId: 'waiIllustriousSDXL_v170',
      loraId: '',
      generationCharacter: null,
      promptFormat: 'danbooru',
      title: '双人稳定路线',
      summary: 'WAI v17 · Danbooru 标签 · 宁宁/夏目双 LoRA',
      reasons: [
        '双角色身份需要同时加载两套 LoRA',
        '沿用已经验证的双人构图与负面词策略',
      ],
      experimental: false,
    }
  }

  const studio = STUDIO_LORA[input.character]
  return {
    id: 'studio-single',
    engine: 'anima',
    modelId: 'anima-base-v1.0',
    loraId: studio.loraId,
    generationCharacter: studio.generationCharacter,
    promptFormat: 'anima-tags',
    title: '角色高质量路线',
    summary: `Anima Base · ${studio.label} · 模型原生标签`,
    reasons: [
      '优先使用当前角色已验证的高质量 LoRA',
      '底模、Prompt 结构和稳定参数自动保持一致',
    ],
    experimental: false,
  }
}

export function promptFormatLabel(format: ManagedPromptFormat): string {
  if (format === 'danbooru') return 'Danbooru 标签'
  if (format === 'natural-language') return '自然语言画面描述'
  return 'Anima 模型原生标签'
}
