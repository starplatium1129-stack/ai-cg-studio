/**
 * 网关 API 的响应契约。
 *
 * 修的是审计 C-7：`ControlView.vue` 把 `/api/status` 整体当 `any`，
 * `SceneManagerView.vue` 把整个领域模型声明为 `any[]` —— 于是字段拼错、
 * 后端改名、可选字段忘判空，全都要等运行时才炸，而它们恰好都在破坏性
 * 操作路径上（改 host、启停服务、写回 data/scenes）。
 *
 * 与 `types/*.ts`（运行时 TS 用）分开放：`tsconfig.app.json` 只 include `src/`，
 * Bundler 解析下 SPA 取不到仓库根的 `types/`。两边的字段含义须保持一致。
 */

// ── 统一错误信封（server/http-envelope.js）────────────────────────────────
export interface ApiFailure {
  ok: false
  error: string
  /** 技术细节，可直接展示给本机用户 */
  detail?: string
  /** 机器可判别，如 QUEUE_FULL / RATE_LIMITED */
  code?: string
  retryAfterSeconds?: number
}

export type ApiResult<T> = ({ ok: true } & T) | ApiFailure

export function isFailure(value: unknown): value is ApiFailure {
  return Boolean(value && typeof value === 'object' && (value as ApiFailure).ok === false)
}

// ── 控制面板 ───────────────────────────────────────────────────────────────
export type TunnelStatus = 'active' | 'waiting' | 'disabled'

export interface ControlOperationView {
  id: string
  kind: string
  label: string
  status: 'running' | 'completed' | 'failed'
  stageIndex: number
  stages: string[]
  message: string
  startedAt: number
  finishedAt: number
  error: string
}

export interface VoiceProfileView {
  refAudioPath?: string
  promptText?: string
  promptLang?: string
  textLang?: string
  gptWeightsPath?: string
  sovitsWeightsPath?: string
  [key: string]: unknown
}

/** GET /api/status —— 探测失败时是 200 + ok:false + degraded:true，不是 500 */
export interface ControlStatus {
  ok: boolean
  running: boolean
  /** 探测失败时为 true，字段仍然齐全但全是保守值 */
  degraded?: boolean
  error?: string
  sdOnline: boolean
  ttsOnline: boolean
  ollamaOnline: boolean
  ollamaModels: string[]
  ollamaVram: number
  webuiManaged: boolean
  modeBusy: boolean
  operation: ControlOperationView | null
  sdHost: string
  ttsHost: string
  ollamaHost: string
  localLink: string
  shareLinkAvailable: boolean
  tunnelStatus: TunnelStatus
  tunnelAvailable: boolean
  uptime: number
  autoStartVoice?: boolean
  voices: Partial<Record<'nene' | 'natsume', VoiceProfileView>>
  scripts: { voiceStart: boolean; voiceStop: boolean; webui: boolean }
}

/** GET /api/logs */
export interface ControlLogs {
  logs?: string[]
  operation?: ControlOperationView | null
}

/** POST /api/service/* 与 /api/mode 的成功响应 */
export interface ControlActionResult {
  ok: true
  pending?: boolean
  operation?: ControlOperationView | null
  message?: string
}

// ── 场景管理领域模型 ────────────────────────────────────────────────────────
export type SceneRating = 'All' | 'R15' | 'R18'
export type SceneCharacter = 'nene' | 'natsume' | 'triad' | 'both' | string
export type CurationTier = 'normal' | 'review' | 'curated' | 'signature'

/**
 * 场景编辑器的字段集。
 *
 * 索引签名保留：`data/scenes/*.json` 里还有一批只被维护脚本读的字段
 * （sourceAudit、attempt 之类），编辑器要能原样读写回去而不丢字段 ——
 * 保存是全量覆盖写，丢字段等于静默删数据。
 */
export interface SceneDraft {
  id: string
  title: string
  category: string
  char: SceneCharacter
  lora: string
  emotion: string
  season: string
  time: string
  timeOfDay: string
  rating: SceneRating
  character?: string[]
  mature?: boolean
  location: string
  weather: string
  camera: string
  lighting: string
  tags: string[]
  usage: string[]
  story: string
  storyJa: string
  prompt: string
  negative: string
  [key: string]: unknown
}

export interface TagRecord {
  id: string
  en: string
  cn: string
  cat: string
  weight: number
  [key: string]: unknown
}

export interface CurationData {
  curatedSceneIds?: string[]
  signatureSceneIds?: string[]
  reviewSceneIds?: string[]
  recommendationReasons?: Record<string, string>
  [key: string]: unknown
}

/** POST /api/maintenance/scenes */
export interface SceneSaveResult {
  ok: boolean
  count?: number
  tagCount?: number
  backup?: string
  message?: string
  error?: string
  rolledBack?: boolean
  dataIntegrity?: 'restored' | 'INCONSISTENT'
  recovery?: string
}

/** POST /api/maintenance/run */
export interface MaintenanceRunResult {
  ok: boolean
  task?: string
  label?: string
  output?: string
  exitCode?: number
  error?: string
}
