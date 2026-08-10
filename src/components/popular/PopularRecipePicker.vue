<script setup lang="ts">
import type { KreaStyleRecipe } from '@/config/kreaStyleRecipes'

const props = defineProps<{
  recipes: readonly KreaStyleRecipe[]
  selectedId: string | null
  summary: string
}>()

const emit = defineEmits<{
  select: [id: string | null]
}>()
</script>

<template>
  <div class="recipe-picker">
    <div class="recipe-list" role="group" aria-label="Krea 风格配方">
      <button type="button" class="recipe-opt"
        :class="{ selected: props.selectedId === null }"
        :aria-pressed="props.selectedId === null"
        @click="emit('select', null)">自动</button>
      <button v-for="recipe in props.recipes" :key="recipe.id"
        type="button" class="recipe-opt"
        :class="{ selected: props.selectedId === recipe.id, adult: recipe.adult }"
        :aria-pressed="props.selectedId === recipe.id"
        @click="emit('select', recipe.id)">
        {{ recipe.name }}<span v-if="recipe.adult" class="scene-rating-tag">R18</span>
      </button>
    </div>
    <p class="popular-tags-note">风格短语按官方散文段结构放在 Prompt 最前；「自动」按场景+引擎推荐。成人配方仅对成年角色可见。</p>
  </div>
</template>

<style scoped>
.recipe-picker {
  display: contents;
}
.recipe-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.recipe-opt {
  padding: var(--s-1) var(--s-3);
  border-radius: var(--r-pill);
  border: 1px solid var(--border-strong);
  background: var(--glass-fill);
  color: inherit;
  font-size: var(--fs-label-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.recipe-opt.selected {
  border-color: var(--pb-active);
  background: color-mix(in srgb, var(--mood-love) 16%, transparent);
  color: var(--pb-active-text);
}
.recipe-opt.adult {
  border-color: color-mix(in srgb, var(--danger) 40%, transparent);
}
.popular-tags-note {
  font-size: var(--fs-mono-sm);
  opacity: 0.6;
  margin: var(--s-2) 0;
}
</style>
