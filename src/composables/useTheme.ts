import { ref, watch } from 'vue'

const STORAGE_KEY = 'aics_theme'
type Theme = 'dark' | 'light'

/**
 * 首次访问时跟随系统偏好。
 * 以前无条件默认 dark，`prefers-color-scheme` 全站 0 命中 ——
 * 系统是浅色的用户第一眼就是深色，且没有任何提示。
 */
export function preferredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch { /* 隐私模式忽略 */ }
  try {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch { /* 老浏览器忽略 */ }
  return 'dark'
}

const theme = ref<Theme>(preferredTheme())

watch(theme, (val) => {
  document.documentElement.setAttribute('data-theme', val)
  try { localStorage.setItem(STORAGE_KEY, val) } catch {}
})

// 用户没显式选过主题时，跟随系统实时切换
try {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (event) => {
    let hasExplicitChoice = false
    try { hasExplicitChoice = !!localStorage.getItem(STORAGE_KEY) } catch {}
    if (hasExplicitChoice) return
    theme.value = event.matches ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme.value)
  })
} catch { /* 老浏览器忽略 */ }

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }
  return { theme, toggle }
}
