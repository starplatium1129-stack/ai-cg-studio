<template>
  <details class="monitor advanced-decision prompt-health-panel" id="promptMonitor">
    <summary class="panel-title prompt-health-summary">
      <span>Prompt 实时预览</span>
      <span v-if="modelName" class="monitor-profile">{{ modelName }}</span>
      <span class="token-counter" :class="report.level">
        <span class="bar"><i :style="{ '--progress': progress + '%' }"></i></span>
        <span class="num">{{ report.positiveCount }}</span>
        <span class="muted">正向</span>
        <span class="prompt-health">{{ report.label }}</span>
      </span>
    </summary>

    <div class="prompt-health-body">
      <div class="preview-output">{{ prompt || '选择场景或调整画面选项，提示词会在这里实时生成。' }}</div>

      <div class="token-row">
        <span class="token-counter" :class="report.level">
          <span class="num">{{ report.positiveCount }}</span>
          <span class="muted">正向 /</span>
          <span class="neg-num">{{ report.negativeCount }}</span>
          <span class="muted">负向</span>
        </span>
        <span v-if="loraText" class="lora-hint">LoRA {{ loraText }}</span>
      </div>

      <ul v-if="warnings.length" class="prompt-health-warnings" aria-label="Prompt 优化建议">
        <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
      </ul>
      <p v-else class="prompt-health-ok">结构正常，没有检测到明显冲突。</p>

      <div class="preview-actions">
        <button class="btn btn-primary" type="button" @click="emit('copy')">复制</button>
        <button class="btn btn-ghost" type="button" @click="emit('save')">保存</button>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PromptReport } from '@/utils/promptPolicy'

const props = defineProps<{
  prompt: string
  modelName?: string
  report: PromptReport
  artViolations: string[]
  loraText?: string
}>()

const emit = defineEmits<{
  copy: []
  save: []
}>()

const progress = computed(() => Math.min(100, Math.round(props.report.positiveCount / 72 * 100)))
const warnings = computed(() => {
  const result = [...props.report.warnings]
  if (props.artViolations.length && !result.some(item => item.startsWith('违反美术规范'))) {
    result.push(`违反美术规范：${props.artViolations.join(', ')}`)
  }
  return [...new Set(result)]
})
</script>
