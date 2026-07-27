<template>
  <nav class="nav">
    <div class="nav-inner">
      <div
        class="nav-brand"
        role="link"
        tabindex="0"
        @click="goHome"
        @keydown.enter.prevent="goHome"
        @keydown.space.prevent="goHome"
      >
        <img class="nav-logo" src="/assets/logo.svg" alt="绫季绘境" />
      </div>

      <div ref="linksEl" class="nav-links" :class="{ open: menuOpen }">
        <!-- 主导航 -->
        <RouterLink
          v-for="item in primaryNav"
          :key="item.id"
          :to="item.to"
          :class="{ active: activeId === item.id }"
          @click="closeMenu"
        >
          {{ item.icon }} {{ item.label }}
        </RouterLink>

        <!-- 更多 -->
        <details class="nav-more" :data-active="secondaryActive || undefined" ref="moreEl">
          <summary aria-label="打开更多页面">更多<span class="nav-more-chevron">⌄</span></summary>
          <div class="nav-more-menu">
            <RouterLink
              v-for="item in secondaryNav"
              :key="item.id"
              :to="item.to"
              :class="{ active: activeId === item.id }"
              @click="closeMenu"
            >
              {{ item.icon }}<span>{{ item.label }}</span>
            </RouterLink>
          </div>
        </details>

        <!-- 主题切换 -->
        <AppThemeToggle />
      </div>

      <!-- 移动端汉堡 -->
      <button
        type="button"
        class="nav-menu-toggle"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        :aria-label="menuOpen ? '关闭导航菜单' : '打开导航菜单'"
        @click="toggleMenu"
      >{{ menuOpen ? '✕' : '☰' }}</button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppThemeToggle from './AppThemeToggle.vue'

const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)
const linksEl = ref<HTMLElement | null>(null)
const moreEl = ref<HTMLDetailsElement | null>(null)

const primaryNav = [
  { id: 'scene',    label: '灵感场景', to: '/scene-explorer', icon: '🌸' },
  { id: 'director', label: '开始绘制', to: '/prompt-builder',  icon: '✦' },
  { id: 'chat',     label: '角色房间', to: '/chat',            icon: '☕' },
  { id: 'showcase', label: '效果样张', to: '/showcase',         icon: '🖼' },
  { id: 'gallery',  label: '作品册',   to: '/gallery',          icon: '🎞' },
]
const secondaryNav = [
  { id: 'character', label: '角色档案', to: '/character',     icon: '👤' },
  { id: 'style',     label: '画风',     to: '/style',          icon: '🎨' },
  { id: 'lora',      label: '模型',     to: '/lora',           icon: '🧪' },
  { id: 'manager',   label: '场景管理', to: '/scene-manager',  icon: '🎬' },
]

const activeId = computed(() => {
  const p = route.path.replace(/^\//, '')
  if (!p) return 'home'
  const all = [...primaryNav, ...secondaryNav]
  const match = all.find(n => n.to.replace(/^\//, '') === p || p.startsWith(n.to.replace(/^\//, '')))
  return match?.id ?? ''
})

const secondaryActive = computed(() => secondaryNav.some(n => n.id === activeId.value))

function goHome() { router.push('/') }
function closeMenu() { menuOpen.value = false }
function toggleMenu() { menuOpen.value = !menuOpen.value }

function onDocClick(e: MouseEvent) {
  if (moreEl.value?.open && !moreEl.value.contains(e.target as Node)) {
    moreEl.value.open = false
  }
}
function onDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKey)
})
</script>

<style scoped>
/* logo.svg 是 236×48 的完整字标（图形 + 绫季绘境），
   只能按高度缩放，不能塞进方框裁切，也不要再叠一份文字。 */
.nav-logo {
  display: block;
  height: 32px;
  width: auto;
  max-width: 190px;
}
.nav-brand { gap: var(--s-2); }
@media (max-width: 480px) {
  .nav-logo { height: 28px; max-width: 150px; }
}
</style>
