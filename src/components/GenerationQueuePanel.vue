<template>
  <div v-if="total" class="sd-queue advanced-decision">
    <div class="sd-queue-head">
      <span>出图队列 · {{ total }} 个{{ paused ? '（已暂停）' : '' }}</span>
      <span class="row-tight">
        <button v-if="paused" class="btn btn-ghost btn-sm" type="button" @click="emit('resume')">继续</button>
        <button v-else class="btn btn-ghost btn-sm" type="button" @click="emit('pause')">暂停</button>
        <button class="btn btn-ghost btn-sm" type="button" @click="emit('clear')">清空等待</button>
      </span>
    </div>
    <div class="sd-queue-list">
      <div v-if="activeJob" class="sd-queue-item sd-queue-item-active">
        <!-- 速度线：斜向细线持续流动，一眼看出"这条在跑" -->
        <span class="fx-speed-lines" aria-hidden="true"></span>
        <span class="sd-queue-index">生成中</span>
        <div class="sd-queue-copy">
          <div class="sd-queue-title">{{ activeJob.title }}</div>
          <div class="sd-queue-meta">{{ activeJob.size }} · seed {{ seedLabel(activeJob.seed) }}</div>
        </div>
        <span></span>
      </div>
      <!-- 出完一张的瞬间演出：集中线 + 拟声词。
           纯装饰（aria-hidden），不承载信息，删掉不影响可用性。 -->
      <div v-if="justFinished" class="sd-queue-burst" aria-hidden="true">
        <span class="fx-focus-lines is-bursting"></span>
        <span class="fx-onome is-popping">ドンッ</span>
      </div>
      <div v-for="(job, index) in queue" :key="job.id" class="sd-queue-item">
        <span class="sd-queue-index">{{ index + 1 }}</span>
        <div class="sd-queue-copy">
          <div class="sd-queue-title">{{ job.title }}</div>
          <div class="sd-queue-meta">{{ job.size }} · seed {{ seedLabel(job.seed) }}</div>
        </div>
        <button class="sd-queue-remove" type="button" aria-label="移出队列" @click="emit('remove', job.id)">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { SDQueueJob } from '@/composables/generation/useSDQueue'
import '@/assets/css/director/components/GenerationQueuePanel.css'

const props = defineProps<{
  total: number
  paused: boolean
  activeJob: Readonly<SDQueueJob> | null
  queue: ReadonlyArray<Readonly<SDQueueJob>>
}>()

const emit = defineEmits<{
  pause: []
  resume: []
  clear: []
  remove: [id: string]
}>()

function seedLabel(seed: number) {
  return seed < 0 ? '随机' : seed
}

// 出完一张的瞬间演出。只在「有任务在跑 → 没有任务在跑」这一次跃迁时触发，
// 队列里还有后续任务时也能看到，所以每张图出完都有一次正反馈。
// 用 activeJob 而不是 total 判定：total 归零时整个面板会 v-if 掉，
// 演出就渲染不出来了（最后一张反而看不到，不合逻辑）。
const justFinished = ref(false)
let finishTimer = 0
watch(
  () => props.activeJob,
  (now, prev) => {
    if (!prev || now) return
    justFinished.value = true
    window.clearTimeout(finishTimer)
    finishTimer = window.setTimeout(() => { justFinished.value = false }, 620)
  },
)
onBeforeUnmount(() => window.clearTimeout(finishTimer))
</script>
