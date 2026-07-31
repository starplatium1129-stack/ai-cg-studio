<template>
  <nav class="nav">
    <div class="nav-inner">
      <!-- 用真 RouterLink:role="link" 的 div 没有 href,没有右键菜单、
           中键新标签页,而 Space 激活链接也不是标准行为 -->
      <RouterLink to="/" class="nav-brand">
        <img class="nav-logo" src="/assets/logo.svg" alt="绫季绘境" />
      </RouterLink>

      <div ref="linksEl" class="nav-links" :class="{ open: menuOpen }">
        <!-- 主导航。aria-current 让读屏也能知道当前页,不只靠 class 上色 -->
        <RouterLink
          v-for="item in primaryNav"
          :key="item.id"
          :to="item.to"
          :class="{ active: activeId === item.id }"
          :aria-current="activeId === item.id ? 'page' : undefined"
          @click="closeMenu"
        >
          <ArchiveIcon :name="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>

        <!-- 更多 -->
        <details class="nav-more" :data-active="secondaryActive || undefined" ref="moreEl">
          <!-- 不加 aria-label:它会盖掉可见文字"更多",违反 SC 2.5.3 Label in Name -->
          <summary>更多<span class="nav-more-chevron" aria-hidden="true">⌄</span></summary>
          <div class="nav-more-menu">
            <RouterLink
              v-for="item in secondaryNav"
              :key="item.id"
              :to="item.to"
              :class="{ active: activeId === item.id }"
              :aria-current="activeId === item.id ? 'page' : undefined"
              @click="closeMenu"
            >
              <ArchiveIcon :name="item.icon" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </div>
        </details>

        <!-- 主题切换 -->
        <AppSoundToggle />
        <AppThemeToggle />
      </div>

      <!-- 移动端汉堡 -->
      <button
        type="button"
        class="nav-menu-toggle"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        :aria-label="menuOpen ? '关闭导航菜单' : '打开导航菜单'"
        @click="toggleMenu"
      ><ArchiveIcon :name="menuOpen ? 'close' : 'menu'" /></button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import AppThemeToggle from './AppThemeToggle.vue'
import AppSoundToggle from './AppSoundToggle.vue'
import ArchiveIcon, { type ArchiveIconName } from './visual/ArchiveIcon.vue'

const route = useRoute()
const menuOpen = ref(false)
const linksEl = ref<HTMLElement | null>(null)
const moreEl = ref<HTMLDetailsElement | null>(null)

interface NavItem {
  id: string
  label: string
  to: string
  icon: ArchiveIconName
}

const primaryNav: NavItem[] = [
  { id: 'scene',    label: '灵感场景', to: '/scene-explorer', icon: 'scene' },
  { id: 'director', label: '开始绘制', to: '/prompt-builder', icon: 'spark' },
  { id: 'chat',     label: '角色房间', to: '/chat',           icon: 'chat' },
  { id: 'showcase', label: '效果样张', to: '/showcase',       icon: 'image' },
  { id: 'gallery',  label: '作品册',   to: '/gallery',        icon: 'gallery' },
]
const secondaryNav: NavItem[] = [
  { id: 'character', label: '角色档案', to: '/character',    icon: 'character' },
  { id: 'style',     label: '画风',     to: '/style',        icon: 'palette' },
  { id: 'scenario',  label: '剧本模式', to: '/scenario',     icon: 'scene' },
  { id: 'color-script', label: '色调脚本', to: '/color-script', icon: 'palette' },
  { id: 'lora',      label: '模型',     to: '/lora',         icon: 'model' },
  { id: 'training',  label: '训练台',   to: '/training',     icon: 'training' },
  { id: 'manager',   label: '场景管理', to: '/scene-manager', icon: 'manager' },
]

const activeId = computed(() => {
  const p = route.path.replace(/^\//, '')
  if (!p) return 'home'
  const all = [...primaryNav, ...secondaryNav]
  const match = all.find(n => n.to.replace(/^\//, '') === p || p.startsWith(n.to.replace(/^\//, '')))
  return match?.id ?? ''
})

const secondaryActive = computed(() => secondaryNav.some(n => n.id === activeId.value))

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
