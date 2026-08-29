<template>
  <div class="random-inspiration" :class="{ open: menuOpen }">
    <button
      class="random-dice"
      type="button"
      :disabled="disabled"
      :title="disabled ? '热门角色模式与数据未就绪时不支持随机灵感' : '随机灵感：按当前角色随机组装一组风格层标签'"
      @click="onRoll"
    >
      <ArchiveIcon name="dice" class="random-dice-icon" aria-hidden="true" />
      <span>随机灵感</span>
    </button>
    <button
      class="random-menu-trigger"
      type="button"
      :disabled="disabled"
      aria-label="随机灵感选项"
      :aria-expanded="menuOpen"
      @click="menuOpen = !menuOpen"
    >
      <ArchiveIcon name="gear" class="random-menu-icon" aria-hidden="true" />
    </button>
    <div v-if="menuOpen" class="random-popover" role="dialog" aria-label="随机灵感选项">
      <div class="random-label">随机灵感选项</div>
      <label class="random-toggle">
        <input v-model="includeArtists" type="checkbox" />
        <span class="random-toggle-text">随机画师</span>
        <small class="random-toggle-hint">开启后骰子会混入白名单画师；默认不加，保留角色原生画风</small>
      </label>
      <button class="random-undo" type="button" :disabled="!canUndo" @click="onUndo">
        撤销上一组
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { usePromptBuilderStore } from '@/stores/promptBuilderStore'
import { useRandomInspiration } from '@/composables/useRandomInspiration'

const pb = usePromptBuilderStore()
const { includeArtists, roll, undo, hasUndo } = useRandomInspiration()

const menuOpen = ref(false)
const disabled = computed(() => pb.isPopular || !pb.dataReady)
const canUndo = computed(() => Boolean(hasUndo.value))

function onRoll() {
  menuOpen.value = false
  roll()
}

function onUndo() {
  menuOpen.value = false
  undo()
}
</script>

<style scoped>
.random-inspiration {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
}
.random-dice {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  padding: 0 var(--s-4);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font: 650 var(--fs-label-sm) var(--font-sans);
  transition: background var(--motion-hover), border-color var(--motion-hover), color var(--motion-hover), transform var(--motion-hover);
}
.random-dice:hover {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-soft));
  background: var(--bg-elevated);
  color: var(--accent);
}
.random-dice:active,
.random-menu-trigger:active {
  transform: scale(.95);
}
.random-dice:disabled,
.random-menu-trigger:disabled {
  opacity: .45;
  cursor: not-allowed;
  transform: none;
}
.random-dice-icon {
  display: inline-grid;
  place-items: center;
  font-size: var(--fs-body-lg);
  line-height: var(--lh-flush);
}
.random-menu-trigger {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-soft);
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--motion-hover), border-color var(--motion-hover), color var(--motion-hover), transform var(--motion-hover);
}
.random-menu-trigger:hover,
.random-inspiration.open .random-menu-trigger {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-soft));
  background: var(--bg-elevated);
  color: var(--accent);
}
.random-menu-icon {
  display: grid;
  place-items: center;
  font-size: var(--fs-body);
  line-height: var(--lh-flush);
}
.random-popover {
  position: absolute;
  z-index: var(--z-popover);
  top: calc(100% + 10px);
  right: 0;
  width: min(280px, calc(100vw - 32px));
  padding: var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-2xl);
  background: var(--bg-panel);
  box-shadow: var(--shadow-lg);
}
.random-label {
  margin: 2px 4px 8px;
  color: var(--text-muted);
  font: 700 var(--fs-mono-xs) var(--font-mono);
  letter-spacing: .1em;
  text-transform: uppercase;
}
.random-toggle {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px var(--s-2);
  align-items: center;
  padding: var(--s-2);
  border-radius: var(--r-md);
  cursor: pointer;
}
.random-toggle:hover {
  background: var(--bg-elevated);
}
.random-toggle input {
  grid-row: 1 / 3;
  accent-color: var(--accent);
}
.random-toggle-text {
  color: var(--text-primary);
  font: 500 var(--fs-label-sm) var(--font-sans);
}
.random-toggle-hint {
  color: var(--text-muted);
  font: var(--fs-caption) var(--font-sans);
  line-height: 1.5;
}
.random-undo {
  width: 100%;
  min-height: 36px;
  margin-top: var(--s-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font: 650 var(--fs-label-sm) var(--font-sans);
  transition: background var(--motion-hover), border-color var(--motion-hover), color var(--motion-hover);
}
.random-undo:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-soft));
  background: var(--bg-elevated);
  color: var(--accent);
}
.random-undo:disabled {
  opacity: .45;
  cursor: not-allowed;
}
</style>
