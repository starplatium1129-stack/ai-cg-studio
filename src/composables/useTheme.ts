import { ref, watch } from 'vue'

const STORAGE_KEY = 'aics_theme'
type Theme = 'dark' | 'light'

const theme = ref<Theme>(
  (() => {
    try { return (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark' } catch { return 'dark' }
  })()
)

watch(theme, (val) => {
  document.documentElement.setAttribute('data-theme', val)
  try { localStorage.setItem(STORAGE_KEY, val) } catch {}
})

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }
  return { theme, toggle }
}
