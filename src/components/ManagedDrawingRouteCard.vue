<template>
  <section class="managed-route-card" :class="{ experimental: route.experimental }" aria-live="polite">
    <div class="managed-route-main">
      <div class="managed-route-copy">
        <span class="managed-route-kicker">{{ expert ? '系统推荐路线' : '系统自动选择' }}</span>
        <strong>{{ route.title }}</strong>
        <span>{{ route.summary }}</span>
      </div>
      <button v-if="expert" class="managed-route-apply" type="button"
        :disabled="busy" @click="$emit('apply')">
        采用推荐路线
      </button>
    </div>
    <div class="managed-route-facts">
      <span>{{ promptFormatLabel(route.promptFormat) }}</span>
      <span>{{ route.experimental ? '实验路线' : '稳定路线' }}</span>
      <span>{{ route.engine === 'sd' ? '双角色工作流' : '托管高质量工作流' }}</span>
    </div>
    <ul class="managed-route-reasons">
      <li v-for="reason in route.reasons" :key="reason">{{ reason }}</li>
    </ul>
    <div v-if="recipes.length" class="successful-recipes">
      <span>最近成功成片</span>
      <button v-for="recipe in recipes" :key="recipe.id" type="button"
        :disabled="busy" @click="$emit('reuse', recipe.id)">
        {{ recipe.label }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { HistoryEntry } from '@/stores/promptBuilderStore'
import type { DrawSubject } from '@/utils/popularContent'
import {
  promptFormatLabel,
  type DrawingRouteRecommendation,
} from '@/utils/drawingRoute'

const props = defineProps<{
  route: DrawingRouteRecommendation
  history: readonly HistoryEntry[]
  subject: DrawSubject
  expert: boolean
  busy: boolean
}>()

defineEmits<{
  apply: []
  reuse: [id: number]
}>()

const recipes = computed(() => [...props.history]
  .reverse()
  .filter(entry => {
    if (!entry.image_id) return false
    if (props.subject.kind === 'popular') {
      return entry.subject === 'popular'
        && entry.characterId === props.subject.characterId
        && entry.engine === props.route.engine
    }
    const character = props.route.engine === 'sd'
      ? 'triad'
      : props.route.generationCharacter === 'natsume' ? 'natsume' : 'nene'
    if (entry.subject === 'popular' || entry.character !== character) return false
    if (props.route.engine === 'sd') return entry.engine == null || entry.engine === 'sd'
    return entry.engine === 'anima' && entry.loraId === props.route.loraId
  })
  .slice(0, 3)
  .map(entry => {
    const title = entry.sceneTitle || (entry.story ? entry.story.slice(0, 12) : '自由创作')
    const engine = entry.engine === 'krea2' ? 'Krea' : entry.engine === 'anima' ? 'Anima' : 'WAI'
    return { id: entry.id, label: `${title} · ${engine}` }
  }))
</script>
