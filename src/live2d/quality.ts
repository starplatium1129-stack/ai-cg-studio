export type Live2DQuality = 'original' | 'standard' | 'compact'
export { LIVE2D_QUALITY_KEY } from '@/utils/storageKeys'
export function normalizeLive2DQuality(value: unknown): Live2DQuality {
  return value === 'standard' || value === 'compact' ? value : 'original'
}
export function live2DTextureScale(quality: Live2DQuality): number {
  return quality === 'compact' ? 4 : quality === 'standard' ? 2 : 1
}
