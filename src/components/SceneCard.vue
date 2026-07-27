<template>
  <div
    class="sc"
    :class="[`sc-${mode}`, { 'sc-static': !clickable }]"
    :data-rating="contentRating"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="clickable && emit('pick', scene)"
    @keydown.enter.prevent="clickable && emit('pick', scene)"
    @keydown.space.prevent="clickable && emit('pick', scene)"
  >
    <div class="sc-band" :style="{ background: BAND_FALLBACK }">
      <img
        v-if="thumbId"
        class="sc-thumb"
        :class="{ 'sc-thumb-r18': contentRating === 'R18', 'sc-thumb-missing': thumbFailed }"
        :src="thumbSrc"
        alt=""
        loading="lazy"
        decoding="async"
        @error="thumbFailed = true"
      />
      <span v-if="thumbId" class="sc-id">{{ thumbId.toUpperCase() }}</span>
      <span v-if="contentRating === 'R18'" class="sc-badge sc-rating r18">R18</span>
      <span v-else-if="contentRating === 'R15'" class="sc-badge sc-rating r15">R15</span>
      <span v-if="mode === 'grid'" class="sc-cat">{{ scene.category || '场景' }}</span>
      <slot name="band" :scene="scene" />
    </div>

    <div class="sc-body">
      <div class="sc-title">{{ scene.title || '未命名' }}</div>
      <div v-if="mode !== 'strip'" class="sc-story">{{ scene.story || '' }}</div>
      <div v-if="!suppressTags" class="sc-tags">
        <span v-for="t in tags" :key="t" class="sc-tag">{{ t }}</span>
      </div>
      <div class="sc-meta">
        <span class="sc-meta-l">
          <span v-if="rating > 0" class="sc-stars">
            <span v-for="i in 5" :key="i" :class="{ on: i <= Math.round(rating) }">★</span>
          </span>
        </span>
        <span class="sc-meta-r">{{ metaText }}</span>
      </div>
      <slot name="body" :scene="scene" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  scene: any
  mode?: 'grid' | 'strip' | 'recent'
  clickable?: boolean
  suppressTags?: boolean
  rating?: number
  meta?: string
  imgVersion?: string | number
}>(), {
  mode: 'grid',
  clickable: undefined,
  suppressTags: false,
  rating: 0,
})

const emit = defineEmits<{ pick: [scene: any] }>()

const BAND_FALLBACK = 'linear-gradient(145deg, color-mix(in srgb, var(--bg-deep) 72%, var(--bg-elevated)), var(--bg-elevated))'
const TAG_BLOCKLIST = ['official_cg', 'visual_audited']

const thumbFailed = ref(false)

const clickable = computed(() =>
  props.clickable === true || (props.clickable !== false && props.mode !== 'strip')
)
const contentRating = computed(() => props.scene.rating || (props.scene.mature ? 'R18' : 'All'))
const thumbId = computed(() => String(props.scene.id || '').toLowerCase().replace(/[^a-z0-9_-]/g, ''))
const thumbSrc = computed(() => {
  const v = props.imgVersion ?? (window as any).AICS_THUMB_VERSION ?? ''
  return `/scene-showcase/thumbs/${thumbId.value}.jpg${v ? '?v=' + encodeURIComponent(String(v)) : ''}`
})
const tags = computed(() => {
  const limit = props.mode === 'strip' ? 2 : 3
  const list = (props.scene.tags || []).filter((t: string) => !TAG_BLOCKLIST.includes(t)).slice(0, limit)
  if (props.scene.emotion && list.length < limit) list.push(props.scene.emotion)
  return list
})
const metaText = computed(() =>
  props.meta ?? [props.scene.season || '', props.scene.weather || ''].filter(Boolean).join(' · ')
)
</script>
