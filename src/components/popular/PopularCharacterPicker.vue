<script setup lang="ts">
import { popularPortraitSrc } from '@/utils/popularPortraitSource'
import { computed } from 'vue'
import type { PopularCharacter, PopularOutfit } from '@/utils/popularContent'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import CharacterDirectory from '@/components/library/CharacterDirectory.vue'

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

const searchProxy = computed({ get: () => props.search, set: value => emit('update:search', value) })
const directoryItems = computed(() => props.characters.map(character => ({ id: character.id, name: character.displayName, source: character.franchise, aliases: character.aliases, image: popularPortraitSrc(character.id) })))
function selectFromDirectory(id: string) { const character = props.characters.find(item => item.id === id); if (character) emit('select', character) }

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
    <CharacterDirectory :items="directoryItems" :selected-id="selectedCharacterId" v-model:search="searchProxy" @select="selectFromDirectory" />
    <div v-if="selectedCharacter" class="popular-outfits">
      <div class="popular-outfits-head">
        <ArchiveIcon name="wardrobe" class="outfits-head-icon" />
        <strong>{{ selectedCharacter.displayName }} · {{ selectedCharacter.originalName }}</strong>
        <span class="popular-badge">{{ selectedCharacter.recommendedEngine === 'krea2-turbo-fp8' ? '推荐 Krea 2' : '推荐 MiaoMiao v1.2' }}</span>
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
.popular-picker :deep(.character-directory) { position: static; max-height: 400px; border: 0; border-radius: 0; background: transparent; }

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
.popular-franchises {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 6px;
  margin-bottom: var(--s-2);
  padding-bottom: 2px;
  scrollbar-width: thin;
}
.franchise-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  white-space: nowrap;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border-strong);
  background: var(--glass-fill);
  color: inherit;
  font-size: var(--fs-label-sm);
  cursor: pointer;
  transition: border-color var(--motion-hover), color var(--motion-hover), background var(--motion-hover);
}
.franchise-chip.active {
  border-color: var(--pb-active);
  background: color-mix(in srgb, var(--mood-love) 14%, transparent);
  color: var(--pb-active-text);
}
.franchise-count {
  font-size: var(--fs-mono-xs);
  opacity: 0.6;
}
.popular-groups {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: var(--s-2);
  padding-right: 4px;
}
.popular-group {
  margin-bottom: var(--s-2);
}
.popular-group:last-child {
  margin-bottom: 0;
}
.popular-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  font-size: var(--fs-label-sm);
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
}
.popular-group-count {
  font-size: var(--fs-mono-xs);
  opacity: 0.5;
  font-weight: 500;
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
  transition: border-color var(--motion-hover) var(--ease-out), background var(--motion-hover) var(--ease-out), transform var(--motion-hover) var(--ease-out);
}
.popular-card:hover {
  border-color: color-mix(in srgb, var(--pb-active) 60%, transparent);
  background: color-mix(in srgb, var(--pb-active) 8%, var(--glass-fill));
}
.popular-card.active {
  border-color: var(--pb-active);
  background: color-mix(in srgb, var(--mood-love) 14%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--pb-active) 35%, transparent);
}
.popular-card-avatar {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: var(--r-md);
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--bg-surface-elevated, var(--hl-inset-04));
  border: 1px solid var(--border-soft);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  margin-bottom: var(--s-1);
  transition: transform var(--motion-hover) var(--ease-out), border-color var(--motion-hover) var(--ease-out), box-shadow var(--motion-hover) var(--ease-out);
}
.popular-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  display: block;
}
.popular-card:hover .popular-card-avatar {
  transform: scale(1.06);
  border-color: var(--pb-active);
  box-shadow: 0 4px 10px color-mix(in srgb, var(--pb-active) 30%, transparent);
}
.popular-card.active .popular-card-avatar {
  border-color: var(--pb-active);
  box-shadow: 0 0 0 1.5px var(--pb-active), 0 4px 12px color-mix(in srgb, var(--pb-active) 35%, transparent);
}
.popular-card-fallback {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}
.initial-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: var(--pb-active);
}
.initial-ring-dupe {
  animation: initial-ink 1.4s var(--ease-in-out) 1 both;
}
@keyframes initial-ink {
  from { opacity: 0.3; }
  to { opacity: 0.7; }
}
.initial-text {
  position: relative;
  z-index: var(--z-base);
  font-weight: 700;
  font-size: var(--fs-body);
  color: var(--pb-active);
}
.popular-card-name {
  font-size: var(--fs-label-sm);
  line-height: var(--lh-tight);
  text-align: center;
}
.popular-card-franchise {
  font-size: var(--fs-mono-xs);
  opacity: 0.55;
  text-align: center;
  line-height: var(--lh-tight);
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
