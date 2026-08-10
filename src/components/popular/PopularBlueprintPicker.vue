<script setup lang="ts">
import type { SceneBlueprint } from '@/utils/popularContent'

const props = defineProps<{
  pool: SceneBlueprint[]
  categories: string[]
  recommended: SceneBlueprint[]
  filtered: SceneBlueprint[]
  category: string
  showAll: boolean
  dataReady: boolean
  selectedBlueprintId: string
}>()

const emit = defineEmits<{
  'update:category': [value: string]
  'update:showAll': [value: boolean]
  select: [blueprint: SceneBlueprint]
  rotate: []
  toggle: []
}>()
</script>

<template>
  <div class="blueprint-picker">
    <div class="blueprint-cats" role="group" aria-label="蓝图分类">
      <button v-for="category in ['all', ...props.categories]" :key="category"
        type="button" class="blueprint-cat-btn" :class="{ active: props.category === category }"
        :aria-pressed="props.category === category"
        @click="emit('update:category', category)">{{ category === 'all' ? '全部' : category }}</button>
    </div>
    <div class="blueprint-reco-head">
      <span v-if="!props.showAll" class="blueprint-reco-note" role="status">推荐 {{ props.recommended.length }} 个场景</span>
      <span v-else class="blueprint-reco-note" role="status">{{ props.filtered.length }} 个可选场景</span>
      <button type="button" class="blueprint-reco-btn" @click="emit('toggle')">
        {{ props.showAll ? '收起 · 只看推荐' : '查看全部' }}
      </button>
      <button v-if="!props.showAll" type="button" class="blueprint-reco-btn" @click="emit('rotate')">换一批</button>
    </div>
    <div v-if="!props.dataReady" class="scene-loading">正在加载热门角色场景…</div>
    <div v-else-if="!props.filtered.length" class="scene-empty">没有符合条件的场景建议</div>
    <div v-else class="blueprint-list">
      <button v-for="blueprint in (props.showAll ? props.filtered : props.recommended)"
        :key="blueprint.id" type="button" class="blueprint-card"
        :class="{ active: props.selectedBlueprintId === blueprint.id }"
        :data-adult="blueprint.adult ? 'true' : 'false'"
        :aria-pressed="props.selectedBlueprintId === blueprint.id"
        @click="emit('select', blueprint)">
        <span class="blueprint-title">{{ blueprint.title }}<span v-if="blueprint.adult" class="scene-rating-tag">R18</span></span>
        <span class="blueprint-desc">{{ blueprint.description }}</span>
        <span class="blueprint-meta">
          <span>{{ blueprint.category }}</span>
          <span>{{ blueprint.location }}</span>
          <span>{{ blueprint.recommendedSize.replace('x', '×') }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.blueprint-picker {
  display: contents;
}
.blueprint-cats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: var(--s-1) 0 var(--s-2);
}
.blueprint-cat-btn {
  padding: 3px var(--s-3);
  border-radius: var(--r-pill);
  border: 1px solid var(--border-strong);
  background: var(--glass-fill);
  color: inherit;
  font-size: var(--fs-mono-sm);
  cursor: pointer;
}
.blueprint-cat-btn.active {
  border-color: var(--pb-active);
  background: color-mix(in srgb, var(--mood-love) 16%, transparent);
}
.blueprint-reco-head {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
  margin-bottom: var(--s-2);
}
.blueprint-reco-note {
  font-size: var(--fs-mono-sm);
  opacity: 0.6;
}
.blueprint-reco-btn {
  padding: 3px var(--s-3);
  border-radius: var(--r-sm);
  border: 1px solid var(--border-strong);
  background: var(--glass-fill);
  color: inherit;
  font-size: var(--fs-mono-sm);
  cursor: pointer;
}
.blueprint-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.blueprint-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  padding: var(--s-2) var(--s-3);
  border-radius: var(--r-md);
  border: 1px solid var(--border-soft);
  background: var(--glass-fill);
  color: inherit;
  cursor: pointer;
}
.blueprint-card.active {
  border-color: var(--pb-active);
  background: color-mix(in srgb, var(--mood-love) 12%, transparent);
}
.blueprint-title {
  font-size: var(--fs-label);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.blueprint-desc {
  font-size: var(--fs-mono-sm);
  opacity: 0.7;
  line-height: 1.4;
}
.blueprint-meta {
  display: flex;
  gap: var(--s-2);
  flex-wrap: wrap;
  font-size: var(--fs-mono-xs);
  opacity: 0.5;
}
</style>
