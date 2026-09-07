<template>
  <section class="material-drawer" aria-label="创作素材">
    <div class="material-heading"><span>创作素材</span><small>YOUR MATERIALS</small></div>
    <div class="material-switch" role="group" aria-label="素材分类">
      <button v-for="item in sections" :key="item.id" type="button"
        :aria-pressed="active === item.id" :aria-controls="`material-${item.id}`"
        @click="active = item.id">
        <ArchiveIcon :name="item.icon" /><span>{{ item.label }}</span>
      </button>
    </div>
    <!-- 保持素材组件挂载，切换分类不丢失输入、搜索或选中状态。 -->
    <div v-for="item in sections" v-show="active === item.id" :id="`material-${item.id}`"
      :key="item.id" class="material-content" :aria-label="item.label">
      <slot :name="item.id" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ArchiveIcon, { type ArchiveIconName } from '../visual/ArchiveIcon.vue'

const props = defineProps<{ expert: boolean }>()
const active = ref('character')
const sections = computed(() => {
  const items: Array<{ id: string; label: string; icon: ArchiveIconName }> = [
    { id: 'character', label: '角色', icon: 'character' },
    { id: 'scenes', label: '场景', icon: 'scene' },
    { id: 'story', label: '描述', icon: 'spark' },
  ]
  if (props.expert) items.push({ id: 'history', label: '历史', icon: 'gallery' })
  return items
})
watch(() => props.expert, value => {
  if (!value && active.value === 'history') active.value = 'character'
})
</script>

<style scoped>
.material-drawer { min-width: 0; border: 1px solid var(--border-soft); border-radius: var(--r-xl); background: var(--bg-surface); overflow: clip; }
.material-heading { display: flex; justify-content: space-between; align-items: center; padding: var(--s-4); color: var(--text-primary); font-size: var(--fs-body-sm); font-weight: 600; }
.material-heading small { color: var(--text-muted); font: 400 var(--fs-mono-xs) var(--font-mono); letter-spacing: .08em; }
.material-switch { display: flex; gap: var(--s-1); padding: 0 var(--s-3) var(--s-3); border-bottom: 1px solid var(--border-soft); }
.material-switch button { flex: 1; min-width: 0; min-height: 42px; display: flex; align-items: center; justify-content: center; gap: var(--s-1); border: 1px solid transparent; border-radius: var(--r-md); background: transparent; color: var(--text-secondary); font: 500 var(--fs-label-sm) var(--font-sans); cursor: pointer; }
.material-switch button[aria-pressed="true"] { background: var(--accent-soft); color: var(--accent); border-color: var(--border-soft); }
.material-switch button:hover { background: var(--bg-elevated); }
.material-switch button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.material-switch .archive-icon { width: 16px; height: 16px; }
.material-content { padding: var(--s-3); }
.material-content :deep(.panel) { border: 0; box-shadow: none; background: transparent; padding: var(--s-1); margin: 0; }
.material-content :deep(.panel::before), .material-content :deep(.panel::after) { display: none; }
</style>
