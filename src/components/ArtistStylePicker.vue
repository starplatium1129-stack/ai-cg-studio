<template>
  <details class="artist-style-picker advanced-decision" data-testid="artist-style-picker">
    <summary>
      <span>画师风格 · Artist tags</span>
      <strong>{{ selectionSummary }}</strong>
    </summary>
    <div class="artist-style-body">
      <p>专家选项，最多混合 2 位。基础模式不会注入；“项目实测”已有成片依据，“待验证”需后续本机出图复核。</p>
      <label class="artist-style-search">
        <span>查找画师</span>
        <input v-model.trim="query" type="search" placeholder="名字或画面特征" autocomplete="off">
      </label>
      <div class="artist-style-grid">
        <button
          v-for="option in filteredOptions"
          :key="option.id"
          type="button"
          :data-artist-style-id="option.id"
          :class="{ selected: selected.includes(option.id) }"
          :aria-pressed="selected.includes(option.id)"
          :disabled="!selected.includes(option.id) && selected.length >= 2"
          @click="toggle(option.id)"
        >
          <span class="artist-style-name">
            <strong>{{ option.name }}</strong>
            <small class="artist-style-status" :class="option.verification">{{ verificationLabel(option.verification) }}</small>
          </span>
          <small>{{ option.description }}</small>
        </button>
      </div>
      <p v-if="!filteredOptions.length" class="artist-style-empty">没有匹配的画师。</p>
      <div v-if="modelTokens" class="artist-style-tokens">
        <span>{{ engineLabel }}</span>
        <code>{{ modelTokens }}</code>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ArtistStyleEngine, ArtistStyleVerification } from '@/config/artistStyles'
import { ARTIST_STYLE_OPTIONS } from '@/config/artistStyleCatalog'

const props = defineProps<{
  selected: string[]
  engine: ArtistStyleEngine
}>()
const emit = defineEmits<{ 'update:selected': [value: string[]] }>()

const query = ref('')
const selectedOptions = computed(() => ARTIST_STYLE_OPTIONS.filter(option => props.selected.includes(option.id)))
const filteredOptions = computed(() => {
  const needle = query.value.toLocaleLowerCase()
  if (!needle) return ARTIST_STYLE_OPTIONS
  return ARTIST_STYLE_OPTIONS.filter(option =>
    `${option.name} ${option.id} ${option.description}`.toLocaleLowerCase().includes(needle),
  )
})
const selectionSummary = computed(() => selectedOptions.value.length
  ? selectedOptions.value.map(option => option.name).join(' + ')
  : '未启用')
const engineLabel = computed(() => props.engine === 'sd' ? 'WAI / Illustrious' : props.engine === 'anima' ? 'Anima' : 'Krea 2')
const modelTokens = computed(() => props.engine === 'krea2'
  ? `with visual styling inspired by ${selectedOptions.value.map(option => option.name).join(' and ')}`
  : selectedOptions.value.map(option => props.engine === 'anima' ? option.animaTag : option.waiTag).join(', '))

function verificationLabel(verification: ArtistStyleVerification): string {
  if (verification === 'project') return '项目实测'
  if (verification === 'tag') return '待验证'
  return '已收录'
}

function toggle(id: string) {
  const validIds = new Set(ARTIST_STYLE_OPTIONS.map(option => option.id))
  const current = [...new Set(props.selected.filter(value => validIds.has(value)))].slice(0, 2)
  const next = current.includes(id)
    ? current.filter(value => value !== id)
    : [...current, id]
  emit('update:selected', next.slice(0, 2))
}
</script>

<style scoped>
.artist-style-picker {
  margin-bottom: var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  background: var(--bg-surface);
}
.artist-style-picker summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 700;
}
.artist-style-picker summary strong { color: var(--accent); font-size: var(--fs-label); text-align: right; }
.artist-style-body { padding: 0 var(--s-4) var(--s-4); }
.artist-style-body > p { margin: 0 0 var(--s-3); color: var(--text-muted); font-size: var(--fs-label); }
.artist-style-search { display: grid; gap: 5px; margin-bottom: var(--s-3); color: var(--text-muted); font-size: var(--fs-label-xs); }
.artist-style-search input {
  min-height: 36px;
  padding: 0 var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: var(--bg-deep);
  color: var(--text-primary);
}
.artist-style-search input:focus-visible { border-color: var(--accent); outline: 2px solid color-mix(in srgb, var(--accent) 25%, transparent); outline-offset: 1px; }
.artist-style-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s-2); }
.artist-style-grid button {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: var(--bg-deep);
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
}
.artist-style-grid button:hover:not(:disabled),
.artist-style-grid button.selected { border-color: var(--accent); color: var(--text-primary); }
.artist-style-grid button.selected { background: color-mix(in srgb, var(--accent) 10%, var(--bg-deep)); }
.artist-style-grid button:disabled { cursor: not-allowed; opacity: .42; }
.artist-style-name { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
.artist-style-grid strong { font-size: var(--fs-label); }
.artist-style-grid small { color: var(--text-muted); font-size: var(--fs-label-xs); line-height: 1.5; }
.artist-style-status { flex: 0 0 auto; padding: 1px 5px; border-radius: var(--r-pill); background: var(--glass-fill); }
.artist-style-status.project { color: var(--success); }
.artist-style-status.tag { color: var(--warning-text); }
.artist-style-empty { padding: var(--s-4) 0; text-align: center; }
.artist-style-tokens { display: flex; align-items: baseline; gap: var(--s-2); margin-top: var(--s-3); color: var(--text-muted); font-size: var(--fs-label-xs); }
.artist-style-tokens code { overflow-wrap: anywhere; color: var(--text-secondary); }
@media (max-width: 900px) {
  .artist-style-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 520px) {
  .artist-style-grid { grid-template-columns: 1fr; }
}
</style>
