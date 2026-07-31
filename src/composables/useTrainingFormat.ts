/**
 * 训练台 · 展示格式化纯函数（从 TrainingView.vue 拆出）。
 *
 * 所有权：状态/进度/日志的展示文案与数字格式化，无副作用。
 */

import type {
  TrainingCharacter,
  TrainingDataset,
  TrainingJobStatus,
  TrainingPlan,
} from '@/types/training'

export const CATEGORY_NAMES: Record<string, string> = {
  identity: '身份锚点',
  identity_anchors: '身份锚点',
  identity_safe: '安全身份样本',
  identity_r18: 'R18 身份样本',
  official: '官方素材',
  official_cg: '官方 CG',
  reference: '参考立绘',
  curated: '精选 CG',
  outfit_witch: '魔女服',
  witch_full_body: '魔女服全身立绘',
  witch_cg: '魔女服构图 CG',
  outfit_qipao: '旗袍服',
  qipao_safe: '官方旗袍',
  outfit_school: '校服',
  interaction: '互动样本',
  adult_solo: '成人单人',
  adult_interaction: '成人互动',
  validation: '验证保留',
}

export const STATUS_NAMES: Record<TrainingJobStatus, string> = {
  idle: '待开始',
  running: '训练中',
  stopping: '停止中',
  completed: '已完成',
  failed: '失败',
  stopped: '已停止',
}

export function characterName(character: TrainingCharacter): string {
  return character === 'nene' ? '绫地宁宁' : '四季夏目'
}

export function categoryEntries(categories: Record<string, number>): Array<[string, number]> {
  const order = Object.keys(CATEGORY_NAMES)
  return Object.entries(categories).sort(([a], [b]) => {
    const aIndex = order.indexOf(a)
    const bIndex = order.indexOf(b)
    return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex)
  })
}

export function categoryLabel(category: string): string {
  return CATEGORY_NAMES[category] ?? category.replaceAll('_', ' ')
}

export function isAdultCategory(category: string): boolean {
  return category.includes('adult') || category.includes('r18')
}

export function adultCount(categories: Record<string, number>): number {
  return Object.entries(categories)
    .filter(([category]) => isAdultCategory(category))
    .reduce((total, [, count]) => total + count, 0)
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`
}

export function formatPercent(percent: number): string {
  const safe = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
  return `${safe.toFixed(safe % 1 === 0 ? 0 : 1)}%`
}

export function formatLoss(loss: number): string {
  return Number.isFinite(loss) ? loss.toFixed(4) : '—'
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

export function trainSplitPercent(dataset: TrainingDataset | null): number {
  const train = dataset?.trainSamples ?? 0
  const evaluation = dataset?.evalSamples ?? 0
  const test = dataset?.testSamples ?? 0
  const total = train + evaluation + test
  return total ? Math.round((train / total) * 100) : 0
}

export function statusLabel(status: TrainingJobStatus): string {
  return STATUS_NAMES[status] ?? status
}

export function statusBadge(status: TrainingJobStatus): string {
  if (status === 'running') return 'badge-warning'
  if (status === 'completed') return 'badge-success'
  if (status === 'failed') return 'badge-danger'
  if (status === 'stopping' || status === 'stopped') return 'badge-info'
  return ''
}

export function planFor(plans: Record<TrainingCharacter, TrainingPlan>, character: TrainingCharacter): TrainingPlan {
  return plans[character]
}

export function datasetPreviewUrl(dataset: TrainingDataset | null): string {
  return dataset ? `/api/training/datasets/${encodeURIComponent(dataset.id)}/preview` : ''
}

export function adultPreviewUrl(dataset: TrainingDataset | null): string {
  return dataset ? `/api/training/datasets/${encodeURIComponent(dataset.id)}/adult-preview` : ''
}
