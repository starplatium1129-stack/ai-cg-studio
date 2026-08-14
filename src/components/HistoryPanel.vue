<template>
  <section class="history-wrap" aria-label="作品历史">
    <div class="panel-title">历史 · History</div>
    <div v-if="!items.length" class="history-empty">还没有保存的作品。生成后点“保存快照”，我会把每一张都好好收着。</div>
    <div v-else class="history-list compact-history-list">
      <article v-for="item in items" :key="item.id" class="history-item">
        <div class="history-thumb">
          <img v-if="thumbs[item.id]" :src="thumbs[item.id]" alt="历史作品缩略图" loading="lazy">
          <img v-else class="history-placeholder" :src="placeholderUrl" alt="" aria-hidden="true">
          <span class="history-thumb-badge">v{{ item.version || 1 }}</span>
        </div>
        <div class="history-main">
          <div class="history-card-title">{{ item.sceneTitle || item.story || '未命名作品' }}</div>
          <p class="history-text">{{ item.prompt }}</p>
          <div class="history-meta">
            <span v-if="item.engine === 'anima' && item.preview" class="history-preview-badge">实验预览</span>
            <span v-if="item.engine === 'anima' || item.engine === 'krea2'" class="history-engine">{{ engineSummary(item) }}</span>
            <span class="primary">seed {{ item.seed ?? -1 }}</span>
            <span class="sep">·</span>
            <span>{{ item.size || '未记录尺寸' }}</span>
          </div>
          <div class="history-side">
            <span v-if="item.favorite" class="history-rating favorite">
              <ArchiveIcon name="love" />
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
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import type { HistoryEntry } from '@/stores/promptBuilderStore'
import { useSceneStore } from '@/stores/sceneStore'

// 与 config/characters.ts 共用 Express 服务的同一份立绘 URL，避免 Vite 打包副本
const placeholderUrl = '/assets/characters/nene-official.webp'
const sceneStore = useSceneStore()

const props = defineProps<{ history: HistoryEntry[] }>()
defineEmits<{
  resume: [entry: HistoryEntry]
  duplicate: [entry: HistoryEntry]
  delete: [entry: HistoryEntry]
}>()

const thumbs = reactive<Record<number, string>>({})
const objectUrls = new Map<number, string>()
const items = computed(() => props.history.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 12))

function engineSummary(item: HistoryEntry): string {
  const engineName = item.engine === 'krea2' ? 'Krea 2' : 'Anima'
  if (item.subject === 'popular' || item.characterId) {
    const popChar = sceneStore.popularCharacters.find(c => c.id === (item.characterId || item.character))
    return `${engineName} · ${popChar?.displayName || '热门角色'}`
  }
  const charLabel = item.character === 'natsume' ? '夏目' : item.character === 'triad' ? '宁宁与夏目' : '宁宁'
  return `${engineName} · ${charLabel}`
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
