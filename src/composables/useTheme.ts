import { readonly, ref } from 'vue'
import { settingsRepository, THEME_SETTING, type Theme } from '@/storage/settingsRepository'

export function preferredTheme(): Theme { return settingsRepository.get(THEME_SETTING) || 'dark' }
const theme = ref<Theme>(preferredTheme())
let initialized = false
function applyTheme(value: Theme) {
  theme.value = value
  document.documentElement.dataset.theme = value
  document.documentElement.style.colorScheme = value
}
export function initializeTheme() {
  applyTheme(preferredTheme())
  if (initialized) return
  initialized = true
  window.addEventListener('storage', event => {
    if (event.key === THEME_SETTING.key || event.key === null) applyTheme(preferredTheme())
  })
}
export function setTheme(value: Theme) {
  settingsRepository.set(THEME_SETTING, value)
  applyTheme(value)
}
export function useTheme() {
  return { theme: readonly(theme), setTheme, toggleTheme: () => setTheme(theme.value === 'dark' ? 'light' : 'dark') }
}
