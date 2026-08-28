<template>
  <label class="toggle-switch" :class="{ 'is-disabled': disabled }">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="label || undefined"
      @change="onChange"
    />
    <span class="toggle-slider" aria-hidden="true"></span>
    <slot />
  </label>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  disabled?: boolean
  /** 无文本时的无障碍标签 */
  label?: string
}>(), { disabled: false, label: '' })

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'change', value: boolean): void
}>()

function onChange(event: Event) {
  const value = (event.target as HTMLInputElement).checked
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<style scoped>
.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: inherit;
  font-size: inherit;
  line-height: var(--lh-flush);
  flex-shrink: 0;
}
.toggle-switch input {
  /* 透明但铺满整个开关：保持原生 input 可点/可聚焦（Playwright check() 可达、
     触屏命中区更大），视觉仍由 .toggle-slider 呈现。width/height 0 会让
     自动化与辅助技术判定元素不可交互。 */
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.toggle-slider {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
  background: var(--border-soft);
  border-radius: var(--r-pill);
  transition: background var(--motion-hover), box-shadow var(--motion-hover);
}
.toggle-slider::before {
  content: "";
  position: absolute;
  height: 13px;
  width: 13px;
  left: 2.5px;
  bottom: 2.5px;
  background: var(--text-primary);
  border-radius: 50%;
  transition: transform var(--motion-hover), background var(--motion-hover);
}
.toggle-switch input:checked + .toggle-slider {
  background: var(--accent);
}
.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(14px);
}
.toggle-switch input:focus-visible + .toggle-slider {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.toggle-switch.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
