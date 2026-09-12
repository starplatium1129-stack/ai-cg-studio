<template>
<DirectorDecisionsRail
        :emotion-summary="emotionSummary"
        :shot-summary="shotSummary"
        :lighting-summary="lightingSummary"
        :composition-summary="compositionSummary"
        :mood-summary="moodSummary"
      />
        <ArtistStylePicker
          v-if="pb.directorMode === 'pro'"
          :selected="pb.artistStyleIds"
          :engine="drawEngine"
          :curated-artist-styles="pb.currentCuratedArtistStyles"
          @update:selected="pb.setArtistStyleIds"
          @limit-reached="onArtistLimitReached"
        />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { PromptStyleBindings } from '@/composables/prompt/promptPanelBindings'
const DirectorDecisionsRail = defineAsyncComponent(() => import('@/components/director/DirectorDecisionsRail.vue'))
const ArtistStylePicker = defineAsyncComponent(() => import('@/components/ArtistStylePicker.vue'))

const props = defineProps<{ bindings: PromptStyleBindings }>()
const { pb, drawEngine, emotionSummary, shotSummary, lightingSummary, compositionSummary, moodSummary, onArtistLimitReached } = props.bindings
</script>
