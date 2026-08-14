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
  line-height: 1;
  flex-shrink: 0;
}
.toggle-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-slider {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
  background: var(--border-soft);
  border-radius: var(--r-pill);
  transition: background var(--t-fast), box-shadow var(--t-fast);
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
  transition: transform var(--t-fast), background var(--t-fast);
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
