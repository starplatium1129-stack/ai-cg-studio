import { ref, watch } from 'vue'
import { settingsRepository, THEME_SETTING, type Theme } from '../storage/settingsRepository.ts'

/**
 * 首次访问时跟随系统偏好。
 * 以前无条件默认 dark，`prefers-color-scheme` 全站 0 命中 ——
 * 系统是浅色的用户第一眼就是深色，且没有任何提示。
 */
export function preferredTheme(): Theme {
  const stored = settingsRepository.get(THEME_SETTING)
  if (stored) return stored
  try {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch { /* 老浏览器忽略 */ }
  return 'dark'
}

const theme = ref<Theme>(preferredTheme())
let persistThemeChange = true

watch(theme, (val) => {
  document.documentElement.setAttribute('data-theme', val)
  if (!persistThemeChange) {
    persistThemeChange = true
    return
  }
  settingsRepository.set(THEME_SETTING, val)
})

// 用户没显式选过主题时，跟随系统实时切换
try {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (event) => {
    if (settingsRepository.get(THEME_SETTING) !== null) return
    const nextTheme = event.matches ? 'light' : 'dark'
    if (theme.value === nextTheme) return
    persistThemeChange = false
    theme.value = nextTheme
  })
} catch { /* 老浏览器忽略 */ }

export function useTheme() {
  function toggle() {
    // 切换瞬间挂过渡类，让背景/文字/边框平滑变色而非瞬切。
    // 时长略长于 CSS 过渡（.24s），确保动画完成后再摘除。
    const root = document.documentElement
    root.classList.add('theme-fade')
    persistThemeChange = true
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    window.setTimeout(() => root.classList.remove('theme-fade'), 300)
  }
  return { theme, toggle }
}
