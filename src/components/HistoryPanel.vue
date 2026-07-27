<template>
  <section class="history-wrap" aria-label="作品历史">
    <div class="panel-title">历史 · History</div>
    <div v-if="!items.length" class="history-empty">还没有保存的作品。生成图片后点“保存快照”，这里会显示缩略图、seed 与版本记录。</div>
    <div v-else class="history-list compact-history-list">
      <article v-for="item in items" :key="item.id" class="history-item">
        <div class="history-thumb">
          <img v-if="thumbs[item.id]" :src="thumbs[item.id]" alt="历史作品缩略图" loading="lazy">
          <img v-else class="history-placeholder" src="/assets/characters/nene-official.webp" alt="" aria-hidden="true">
          <span class="history-thumb-badge">v{{ item.version || 1 }}</span>
        </div>
        <div class="history-main">
          <div class="history-card-title">{{ item.sceneTitle || item.story || '未命名作品' }}</div>
          <p class="history-text">{{ item.prompt }}</p>
          <div class="history-meta">
            <span class="primary">seed {{ item.seed ?? -1 }}</span>
            <span class="sep">·</span>
            <span>{{ item.size || '未记录尺寸' }}</span>
          </div>
          <div class="history-side">
            <span class="history-rating" :class="{ rated: averageRating(item) > 0 }">
              <span :class="item.favorite ? 'favorite' : 'star'">{{ item.favorite ? '♥' : '★' }}</span>
              {{ averageRating(item) ? averageRating(item).toFixed(1) : '未评分' }}
            </span>
            <div class="history-actions" aria-label="历史操作">
              <button class="history-action primary" type="button" @click="$emit('resume', item)">继续</button>
              <button class="history-action" type="button" @click="$emit('duplicate', item)">复制</button>
              <button class="history-action delete" type="button" aria-label="删除历史" @click="$emit('delete', item)">×</button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { imgGet } from '@/composables/useImageStore'
import type { HistoryEntry } from '@/stores/promptBuilderStore'

const props = defineProps<{ history: HistoryEntry[] }>()
defineEmits<{
  resume: [entry: HistoryEntry]
  duplicate: [entry: HistoryEntry]
  delete: [entry: HistoryEntry]
}>()

const thumbs = reactive<Record<number, string>>({})
const objectUrls = new Map<number, string>()
const items = computed(() => props.history.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 12))

function averageRating(item: HistoryEntry): number {
  const values = Object.values(item.rating || {}).map(Number).filter(n => Number.isFinite(n) && n > 0)
  if (!values.length) return 0
  return values.reduce((sum, n) => sum + n, 0) / values.length
}

async function ensureThumb(item: HistoryEntry) {
  if (!item.image_id || thumbs[item.id] || objectUrls.has(item.id)) return
  try {
    const blob = await imgGet(item.image_id)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    objectUrls.set(item.id, url)
    thumbs[item.id] = url
  } catch (e) {
    console.warn('history thumb load failed', e)
  }
}

watch(items, next => { next.forEach(item => ensureThumb(item)) }, { immediate: true })

onBeforeUnmount(() => {
  objectUrls.forEach(url => URL.revokeObjectURL(url))
  objectUrls.clear()
})
</script>
