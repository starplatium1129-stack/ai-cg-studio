<script setup lang="ts">
import { computed } from 'vue'
import type { PopularCharacter, PopularOutfit } from '@/utils/popularContent'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'

const props = defineProps<{
  characters: PopularCharacter[]
  selectedCharacterId: string
  selectedOutfitId: string
  search: string
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  select: [character: PopularCharacter]
  'select-outfit': [outfitId: string]
}>()

const keyword = computed(() => props.search.trim().toLowerCase())
const filteredCharacters = computed(() => {
  if (!keyword.value) return props.characters
  return props.characters.filter(character =>
    [character.displayName, character.originalName, character.id, character.franchise, ...character.aliases]
      .some(text => text.toLowerCase().includes(keyword.value)),
  )
})

const selectedCharacter = computed<PopularCharacter | null>(() =>
  props.characters.find(c => c.id === props.selectedCharacterId) ?? null,
)
const selectedOutfit = computed<PopularOutfit | null>(() => {
  const character = selectedCharacter.value
  if (!character) return null
  return character.outfits.find(o => o.id === props.selectedOutfitId) ?? null
})
</script>

<template>
  <div class="popular-picker">
    <div class="popular-search-wrap">
      <ArchiveIcon name="search" class="popular-search-icon" />
      <input v-model="props.search" class="popular-search" type="search"
        placeholder="搜索角色或作品，如 raiden / Saber / Re:Zero" aria-label="搜索热门角色" />
    </div>
    <div class="popular-grid" role="group" aria-label="热门角色">
      <button v-for="character in filteredCharacters" :key="character.id"
        type="button" class="popular-card"
        :class="{ active: character.id === props.selectedCharacterId }"
        :aria-pressed="character.id === props.selectedCharacterId"
        @click="emit('select', character)">
        <span class="popular-card-initial" aria-hidden="true">
          <svg class="initial-ring" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.7 C 17.4 2.4 21.6 6.7 21.3 12 C 21 17.3 17 21.5 11.9 21.3 C 6.8 21 2.7 17 2.9 12 C 3.1 7.1 6.9 3 12 2.7 Z" />
            <path class="initial-ring-dupe" d="M12 2.7 C 17.4 2.4 21.6 6.7 21.3 12 C 21 17.3 17 21.5 11.9 21.3 C 6.8 21 2.7 17 2.9 12 C 3.1 7.1 6.9 3 12 2.7 Z" opacity="0.55" stroke-width="1.1" transform="translate(0.55 0.45) rotate(1.2 12 12)" />
            <circle cx="21.3" cy="12" r="0.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="2.7" r="0.5" fill="currentColor" stroke="none" />
          </svg>
          <span class="initial-text">{{ character.displayName.charAt(0) }}</span>
        </span>
        <span class="popular-card-name">{{ character.displayName }}</span>
        <span class="popular-card-franchise">{{ character.franchise }}</span>
      </button>
    </div>
    <div v-if="selectedCharacter" class="popular-outfits">
      <div class="popular-outfits-head">
        <ArchiveIcon name="wardrobe" class="outfits-head-icon" />
        <strong>{{ selectedCharacter.displayName }} · {{ selectedCharacter.originalName }}</strong>
        <span class="popular-badge">{{ selectedCharacter.recommendedEngine === 'krea2-turbo-fp8' ? '推荐 Krea 2' : '推荐 Anima Aesthetic' }}</span>
        <span class="popular-nolora-badge">无需 LoRA</span>
      </div>
      <div class="outfit-chips" role="group" aria-label="官方服装">
        <button v-for="outfit in selectedCharacter.outfits" :key="outfit.id"
          type="button" class="outfit-chip"
          :class="{ active: selectedOutfit?.id === outfit.id }"
          :aria-pressed="selectedOutfit?.id === outfit.id"
          @click="emit('select-outfit', outfit.id)">
          {{ outfit.name }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.popular-picker {
  display: contents;
}
.popular-search-wrap {
  position: relative;
  margin-bottom: var(--s-2);
}
.popular-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  width: 14px;
  height: 14px;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
  opacity: 0.8;
}
.popular-search {
  width: 100%;
  box-sizing: border-box;
  padding: var(--s-2) var(--s-3) var(--s-2) 30px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-strong);
  background: var(--glass-fill);
  color: inherit;
  font-size: var(--fs-label-sm);
}
.popular-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
  margin-bottom: var(--s-2);
}
.popular-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--s-2) 6px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-soft);
  background: var(--glass-fill);
  color: inherit;
  cursor: pointer;
}
.popular-card.active {
  border-color: var(--pb-active);
  background: color-mix(in srgb, var(--mood-love) 14%, transparent);
}
.popular-card-initial {
  position: relative;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, color-mix(in srgb, var(--pb-active) 78%, white 8%), var(--pb-active-grad));
  color: var(--text-inverse);
  margin-bottom: var(--s-1);
}
.initial-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.85);
}
.initial-ring-dupe {
  animation: initial-ink 1.4s ease-in-out infinite alternate;
}
@keyframes initial-ink {
  from { opacity: 0.3; }
  to { opacity: 0.7; }
}
.initial-text {
  position: relative;
  z-index: 1;
  font-weight: 700;
  font-size: var(--fs-body);
}
.popular-card-name {
  font-size: var(--fs-label-sm);
  line-height: 1.2;
  text-align: center;
}
.popular-card-franchise {
  font-size: var(--fs-mono-xs);
  opacity: 0.55;
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.popular-outfits {
  border-top: 1px dashed var(--border-soft);
  padding-top: var(--s-2);
}
.popular-outfits-head {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
  margin-bottom: 6px;
  font-size: var(--fs-label-sm);
}
.outfits-head-icon {
  width: 14px;
  height: 14px;
  color: var(--pb-active);
  opacity: 0.9;
}
.popular-badge,
.popular-nolora-badge {
  font-size: var(--fs-mono-xs);
  padding: 2px var(--s-2);
  border-radius: var(--r-pill);
  border: 1px solid var(--border-strong);
}
.popular-badge {
  color: var(--pb-badge-blue);
  border-color: color-mix(in srgb, var(--info) 40%, transparent);
}
.popular-nolora-badge {
  color: var(--pb-badge-green);
  border-color: color-mix(in srgb, var(--success) 40%, transparent);
}
.outfit-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.outfit-chip {
  padding: var(--s-1) var(--s-3);
  border-radius: var(--r-pill);
  border: 1px solid var(--border-strong);
  background: var(--glass-fill);
  color: inherit;
  font-size: var(--fs-label-sm);
  cursor: pointer;
}
.outfit-chip.active {
  border-color: var(--pb-active);
  background: color-mix(in srgb, var(--mood-love) 16%, transparent);
  color: var(--pb-active-text);
}
</style>
