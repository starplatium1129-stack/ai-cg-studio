import type { SettingDefinition } from './settingsRepository'
import { DESKTOP_LAST_PAGE_KEY, DESKTOP_START_PAGE_KEY } from '@/utils/storageKeys'

export const desktopPages = [
  { value: '/', label: '绘境首页' },
  { value: '/prompt-builder', label: '绘图工作台' },
  { value: '/gallery', label: '我的作品' },
  { value: '/video-studio', label: '视频工作台' },
] as const
export type DesktopPage = typeof desktopPages[number]['value']
export type DesktopStartPage = DesktopPage | 'last'
export function isDesktopPage(value: unknown): value is DesktopPage {
  return desktopPages.some(page => page.value === value)
}
export const DESKTOP_START_PAGE_SETTING: SettingDefinition<DesktopStartPage> = {
  key: DESKTOP_START_PAGE_KEY,
  parse: raw => raw === 'last' || isDesktopPage(raw) ? raw : null,
  serialize: value => value,
}
export const DESKTOP_LAST_PAGE_SETTING: SettingDefinition<DesktopPage> = {
  key: DESKTOP_LAST_PAGE_KEY,
  parse: raw => isDesktopPage(raw) ? raw : null,
  serialize: value => value,
}
