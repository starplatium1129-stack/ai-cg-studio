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
      <div v-if="activeJob" class="sd-queue-item">
        <span class="sd-queue-index">生成中</span>
        <div class="sd-queue-copy">
          <div class="sd-queue-title">{{ activeJob.title }}</div>
          <div class="sd-queue-meta">{{ activeJob.size }} · seed {{ seedLabel(activeJob.seed) }}</div>
        </div>
        <span></span>
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
import type { SDQueueJob } from '@/composables/useSDQueue'

defineProps<{
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
</script>
