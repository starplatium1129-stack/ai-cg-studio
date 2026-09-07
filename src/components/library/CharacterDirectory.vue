<template>
  <aside class="character-directory" aria-label="角色目录">
    <div class="directory-tools">
      <label class="directory-heading" :for="inputId">选择角色 <span>{{ items.length }}</span></label>
      <input :id="inputId" v-model="query" type="search" aria-label="搜索角色或作品" placeholder="角色名、作品或别名…" @keydown.enter="results[0] && emit('select', results[0].id)" @keydown.down.prevent="focusFirst" />
      <select v-model="series" aria-label="筛选角色系列"><option value="">全部系列</option><option v-for="group in groups" :key="group.key" :value="group.key">{{ group.label }} · {{ group.count }}</option></select>
      <div class="directory-count"><span role="status">找到 {{ results.length }} 位角色</span><button v-if="query || series" type="button" @click="query = ''; series = ''">清除筛选</button></div>
    </div>
    <div ref="list" class="directory-list" role="group" aria-label="角色列表" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)">
      <button v-for="item in results" :key="item.id" type="button" class="directory-item" :data-character="item.id" :aria-pressed="selectedId === item.id" @click="emit('select', item.id)">
        <img v-if="item.image && !broken.has(item.id)" :src="item.image" alt="" width="48" height="60" loading="lazy" decoding="async" @error="broken = new Set(broken).add(item.id)" />
        <span v-else class="directory-placeholder" aria-hidden="true">{{ item.name.charAt(0) }}</span>
        <span class="directory-label"><strong>{{ item.name }}</strong><small :title="franchiseLabel(franchiseKey(item.source))">{{ franchiseLabel(franchiseKey(item.source)) }}</small></span>
        <span v-if="selectedId === item.id" class="directory-selected" aria-hidden="true"><ArchiveIcon name="success" /></span>
      </button>
      <div v-if="!results.length" class="directory-empty">没有匹配的角色。<br />试试其他名字，或清除筛选。</div>
    </div>
    <div class="directory-current"><span>当前：{{ selected?.name || '未选择' }}</span><button v-if="selected" type="button" @click="locateSelected">定位</button></div>
  </aside>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { franchiseKey, franchiseLabel } from '@/utils/franchiseLabel'
export interface DirectoryCharacter { id: string; name: string; source: string; image?: string; aliases?: string[] }
const props = defineProps<{ items: DirectoryCharacter[]; selectedId: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const inputId = useId()
const query = defineModel<string>('search', { default: '' })
const series = ref('')
const list = ref<HTMLElement | null>(null)
const broken = ref(new Set<string>())
const selected = computed(() => props.items.find(item => item.id === props.selectedId))
watch(() => props.selectedId, async () => { await nextTick(); list.value?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' }) }, { immediate: true })
const groups = computed(() => {
  const counts = new Map<string, number>()
  for (const item of props.items) { const key = franchiseKey(item.source); counts.set(key, (counts.get(key) || 0) + 1) }
  return [...counts].map(([key, count]) => ({ key, count, label: franchiseLabel(key) })).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
})
const indexed = computed(() => props.items.map(item => ({ item, key: franchiseKey(item.source), text: [item.id, item.name, item.source, franchiseLabel(franchiseKey(item.source)), ...(item.aliases || [])].join(' ').toLocaleLowerCase() })))
const results = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return indexed.value.filter(row => (!series.value || row.key === series.value) && (!term || row.text.includes(term))).map(row => row.item)
    .sort((a, b) => Number(b.name.toLocaleLowerCase() === term) - Number(a.name.toLocaleLowerCase() === term))
})
function focusFirst() { list.value?.querySelector<HTMLButtonElement>('button')?.focus() }
function move(step: number) {
  const buttons = [...(list.value?.querySelectorAll<HTMLButtonElement>('button') || [])]
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  buttons[(index + step + buttons.length) % buttons.length]?.focus()
}
async function locateSelected() {
  query.value = ''; series.value = ''; await nextTick()
  const button = list.value?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
  button?.scrollIntoView({ block: 'nearest' }); button?.focus({ preventScroll: true })
}
</script>
<style scoped>
.character-directory { position: sticky; top: 82px; display: flex; flex-direction: column; max-height: max(360px, calc(100dvh - 280px)); border: 1px solid var(--border-soft); border-radius: var(--r-xl); background: var(--bg-surface); overflow: hidden; }
.directory-tools { padding: var(--s-4); display: grid; gap: var(--s-3); flex-shrink: 0; }
.directory-heading { display: flex; justify-content: space-between; font-size: var(--fs-body-sm); font-weight: 600; }
.directory-heading span, .directory-count { color: var(--text-muted); font-size: var(--fs-label-xs); }
.directory-tools input, .directory-tools select { min-width: 0; width: 100%; min-height: 40px; padding: var(--s-2) var(--s-3); color: var(--text-primary); background: var(--bg-deep); border: 1px solid var(--border-soft); border-radius: var(--r-md); font: inherit; font-size: var(--fs-label); }
.directory-count, .directory-current { display: flex; justify-content: space-between; align-items: center; gap: var(--s-2); }
.directory-count button, .directory-current button { padding: 0; border: 0; background: transparent; color: var(--accent); cursor: pointer; font: inherit; }
.directory-list { min-height: 120px; overflow-y: auto; overscroll-behavior: contain; padding: 0 var(--s-2) var(--s-2); scrollbar-width: thin; }
.directory-item { width: 100%; display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2); margin-bottom: var(--s-1); text-align: left; background: transparent; border: 1px solid transparent; border-radius: var(--r-md); color: var(--text-primary); cursor: pointer; transition: transform var(--motion-hover); }
.directory-item:hover { background: var(--bg-hover); }
.directory-item[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); }
.directory-item:active { transform: scale(.985); }
.directory-item img, .directory-placeholder { width: 48px; height: 60px; flex-shrink: 0; border-radius: var(--r-sm); object-fit: cover; object-position: center 20%; background: var(--bg-elevated); }
.directory-placeholder { display: grid; place-items: center; color: var(--accent); }
.directory-label { min-width: 0; display: grid; gap: var(--s-1); }
.directory-label strong { font-size: var(--fs-body-sm); font-weight: 600; }
.directory-label small { font-size: var(--fs-label-xs); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.directory-selected { margin-left: auto; color: var(--accent); }
.directory-current { padding: var(--s-3) var(--s-4); border-top: 1px solid var(--border-soft); font-size: var(--fs-label-xs); color: var(--text-secondary); flex-shrink: 0; }
.directory-empty { padding: var(--s-5) var(--s-3); color: var(--text-muted); font-size: var(--fs-label); }
@media (max-width: 900px) { .character-directory { position: static; max-height: 360px; } }
@media (prefers-reduced-motion: reduce) { .directory-item { transition: none; } }
</style>
