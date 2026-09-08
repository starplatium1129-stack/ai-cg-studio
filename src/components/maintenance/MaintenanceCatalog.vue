<template>
  <section class="maintenance-catalog" :aria-label="`${label}维护工作台`">
    <div class="catalog-toolbar">
      <label class="catalog-search"><ArchiveIcon name="search" /><input v-model="search" type="search" :aria-label="`搜索管理${label}`" placeholder="搜索标题、ID、角色、故事或提示词" /></label>
      <button class="btn btn-primary btn-sm" type="button" :disabled="readonly" :title="readonly ? '桌面模式仅可查看和导出' : ''" @click="$emit('add')">新增{{ label }}</button>
    </div>
    <div class="catalog-filters">
      <label>角色<select v-model="character" :aria-label="`筛选${label}角色`"><option value="">全部角色</option><option v-for="[id, name] in characters" :key="id" :value="id">{{ name }}</option></select></label>
      <label>分类<select v-model="category" :aria-label="`筛选${label}分类`"><option value="">全部分类</option><option v-for="item in categories" :key="item">{{ item }}</option></select></label>
      <label>分级<select v-model="rating" :aria-label="`筛选${label}分级`"><option value="">全部分级</option><option value="All">全年龄 · All</option><option value="R15">R15</option><option value="R18">R18</option></select></label>
      <label>排序<select v-model="sort" :aria-label="`${label}排序`"><option value="id">按编号</option><option value="title">按标题</option><option value="character">按角色</option></select></label>
      <button v-if="hasFilters" class="btn btn-ghost btn-sm" type="button" @click="reset">清除筛选</button>
    </div>
    <div class="catalog-scope">
      <div class="catalog-quick" :aria-label="`${label}快速筛选`"><button type="button" :aria-pressed="focus === 'all'" @click="focus = 'all'">全部</button><button v-if="kind === 'scene'" type="button" :aria-pressed="focus === 'review'" @click="focus = 'review'">待审核</button><button type="button" :aria-pressed="focus === 'missing'" @click="focus = 'missing'">信息待补</button></div>
      <span role="status">找到 {{ filtered.length }} 条 / 共 {{ records.length }} 条</span>
    </div>
    <div class="catalog-workspace">
      <div class="catalog-browser">
        <ul v-if="paged.length" ref="listEl" class="catalog-list" :aria-label="`${label}记录`">
          <li v-for="item in paged" :key="item.id">
            <button type="button" class="catalog-record" :aria-pressed="selectedId === item.id" :tabindex="selectedId === item.id ? 0 : -1" @click="selectedId = item.id" @keydown="navigateRecords($event, item.id)">
              <span class="catalog-record-meta"><code>{{ item.id }}</code><span>{{ item.rating }}</span></span>
              <strong>{{ item.title || '未命名记录' }}</strong>
              <span class="catalog-record-character">{{ item.characterName }} · {{ item.category || '未分类' }}</span>
              <span class="catalog-record-excerpt">{{ item.adult && !local ? '该内容仅限本机查看' : (item.description || '尚未填写叙事内容') }}</span>
              <span v-if="item.tier !== 'normal' || missing(item)" class="catalog-record-hint">{{ tierNames[item.tier] || (missing(item) ? '信息待补' : '') }}</span>
            </button>
          </li>
        </ul>
        <ArchiveStatePanel v-else compact kind="filtered" title="没有匹配的记录" message="尝试缩短关键词，或清除部分筛选。"><button class="btn btn-ghost btn-sm" type="button" @click="reset">查看全部</button></ArchiveStatePanel>
        <nav class="catalog-pagination" aria-label="记录分页"><button class="btn btn-ghost btn-sm" type="button" :disabled="page <= 1" @click="page--">上一页</button><span>{{ page }} / {{ totalPages }}</span><button class="btn btn-ghost btn-sm" type="button" :disabled="page >= totalPages" @click="page++">下一页</button></nav>
      </div>
      <MaintenanceRecordDetail :record="selected" :kind="kind" :label="label" :readonly="readonly" @edit="$emit('edit', $event)" @duplicate="$emit('duplicate', $event)" @remove="$emit('remove', $event)" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref, toRef, watch } from 'vue'
import type { MaintenanceRecord } from '@/utils/maintenanceRecords'
import { useMaintenanceCatalog } from '@/composables/scene/useMaintenanceCatalog'
import { isLocalStudioHost } from '@/utils/runtimeEnvironment'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import MaintenanceRecordDetail from './MaintenanceRecordDetail.vue'
import '@/assets/css/maintenance-workspace.css'
const props = defineProps<{ records: MaintenanceRecord[]; kind: 'scene' | 'blueprint'; label: string; readonly: boolean }>()
defineEmits<{ add: []; edit: [id: string]; duplicate: [id: string]; remove: [id: string] }>()
const { search, character, category, rating, focus, sort, page, selectedId, categories, characters, filtered, paged, selected, totalPages, hasFilters, missing, reset } = useMaintenanceCatalog(toRef(props, 'records'))
const local = isLocalStudioHost()
const listEl = ref<HTMLElement | null>(null)
watch([page, search, character, category, rating, focus, sort], async () => {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = 0
})
const tierNames: Record<string, string> = { signature: '招牌场景', curated: '精选场景', review: '待审核' }
async function navigateRecords(event: KeyboardEvent, id: string) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const index = paged.value.findIndex(item => item.id === id)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? paged.value.length - 1 : Math.max(0, Math.min(paged.value.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
  selectedId.value = paged.value[next]?.id || ''
  const list = (event.currentTarget as HTMLElement).closest('ul')
  await nextTick()
  list?.querySelectorAll<HTMLButtonElement>('.catalog-record')[next]?.focus()
}
</script>
