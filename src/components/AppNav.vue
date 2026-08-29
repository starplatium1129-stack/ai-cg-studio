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

        <!-- 归档 · 分组下拉：发现/美学/工坊，5 项主导航之外全部收口 -->
        <details class="nav-more" :data-active="secondaryActive || undefined" ref="moreEl">
          <!-- 不加 aria-label:它会盖掉可见文字"归档",违反 SC 2.5.3 Label in Name -->
          <summary>归档<span class="nav-more-chevron" aria-hidden="true">⌄</span></summary>
          <div class="nav-more-menu">
            <template v-for="group in archiveGroups" :key="group.heading">
              <div class="nav-more-group-label">{{ group.heading }}</div>
              <RouterLink
                v-for="item in group.items"
                :key="item.id"
                :to="item.to"
                :class="{ active: activeId === item.id }"
                :aria-current="activeId === item.id ? 'page' : undefined"
                @click="closeMenu"
              >
                <ArchiveIcon :name="item.icon" />
                <span>{{ item.label }}</span>
              </RouterLink>
            </template>
          </div>
        </details>

        <!-- 主题已锁定深色（2026-08-28 审计 · 方案 A），切换按钮移除 -->
        <AppSoundToggle />
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
  { id: 'scene',    label: '灵感',   to: '/scene-explorer', icon: 'scene' },
  { id: 'director', label: '绘制',   to: '/prompt-builder', icon: 'spark' },
  { id: 'video',    label: '视频',   to: '/video-studio',   icon: 'play' },
  { id: 'chat',     label: '房间',   to: '/chat',           icon: 'chat' },
  { id: 'gallery',  label: '作品册', to: '/gallery',        icon: 'gallery' },
]
const archiveGroups: Array<{ heading: string; items: NavItem[] }> = [
  {
    heading: '发现',
    items: [
      { id: 'popular-scenes', label: '角色场景', to: '/popular-scenes', icon: 'star' },
      { id: 'showcase', label: '效果样张', to: '/showcase',       icon: 'image' },
      { id: 'character', label: '角色档案', to: '/character',    icon: 'character' },
    ],
  },
  {
    heading: '美学',
    items: [
      { id: 'style',     label: '画风',     to: '/style',        icon: 'palette' },
      { id: 'scenario',  label: '剧本',     to: '/scenario',     icon: 'scene' },
      { id: 'color-script', label: '色调脚本', to: '/color-script', icon: 'palette' },
    ],
  },
  {
    heading: '工坊',
    items: [
      { id: 'lora',      label: '模型',     to: '/lora',         icon: 'model' },
      { id: 'manager',   label: '场景管理', to: '/scene-manager', icon: 'manager' },
      { id: 'control',   label: '控制面板', to: '/control',       icon: 'gear' },
    ],
  },
]
const secondaryNav: NavItem[] = archiveGroups.flatMap(g => g.items)

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
