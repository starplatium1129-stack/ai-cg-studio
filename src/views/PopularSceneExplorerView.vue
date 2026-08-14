<template>
  <article class="page" style="--page-max: 1100px;">
    <section class="pop-hero">
      <div class="pop-hero-copy">
        <div class="page-kicker">Popular scene library / 鐑棬瑙掕壊鍦烘櫙搴?/div>
        <h1 class="title">瑙掕壊鍦烘櫙</h1>
        <p class="subtitle">18 浣嶇儹闂ㄨ鑹茬殑鍏ㄩ儴鍦烘櫙钃濆浘锛屾瘡涓€骞曞潎宸查璁鹃暅澶淬€佸厜绾夸笌鍙欎簨姘涘洿锛涙垚浜哄満鏅嫭绔嬫爣娉紝鍙竴閿洿杈剧粯鍥鹃〉銆?/p>
      </div>
      <div class="pop-hero-stat" aria-label="鍦烘櫙缁熻">
        <strong>{{ totalScenes }}</strong><span>鍦烘櫙钃濆浘</span>
        <strong class="adult">{{ adultCount }}</strong><span>鎴愪汉鍦烘櫙</span>
      </div>
    </section>

    <!-- 瑙掕壊閫夋嫨鏉?-->
    <div class="pop-char-strip" role="group" aria-label="閫夋嫨鐑棬瑙掕壊">
      <button
        v-for="character in characters" :key="character.id" type="button"
        class="pop-char-btn" :class="{ active: selectedId === character.id }"
        :aria-pressed="selectedId === character.id"
        @click="selectCharacter(character.id)">
        <strong>{{ character.displayName }}</strong>
        <small>{{ character.franchise }}</small>
      </button>
    </div>

    <ArchiveStatePanel v-if="loading" kind="loading" title="姝ｅ湪璇诲彇瑙掕壊鍦烘櫙" message="姝ｅ湪杞藉叆鐑棬瑙掕壊妗ｆ涓庡満鏅摑鍥俱€? />
    <ArchiveStatePanel v-else-if="loadError" kind="error" title="瑙掕壊鍦烘櫙璇诲彇澶辫触" :message="loadError">
      <button class="btn btn-primary" type="button" @click="init">閲嶆柊璇诲彇</button>
    </ArchiveStatePanel>

    <template v-else>
      <!-- 宸ュ叿鏍忥細鎼滅储 + 鍒嗙被 + 鎴愪汉寮€鍏?-->
      <div class="pop-toolbar">
        <div class="pop-toolbar-primary">
          <label class="sr-only" for="popularSceneSearch">鎼滅储鍦烘櫙</label>
          <input v-model="query" type="search" id="popularSceneSearch" class="pop-search"
            placeholder="鎼滅储鍦烘櫙鏍囬銆佹弿杩般€佸湴鐐规垨姘涘洿锛堝锛氭荡銆侀粦涓濄€佹湀鍏夛級" />
          <span class="pop-count" role="status">宸叉樉绀?<strong>{{ filtered.length }}</strong> / {{ pool.length }} 涓満鏅?/span>
        </div>
        <div class="pop-cats" role="group" aria-label="鍦烘櫙鍒嗙被">
          <button v-for="cat in categories" :key="cat.id" type="button" class="pop-cat"
            :class="{ active: category === cat.id }" :aria-pressed="category === cat.id"
            @click="category = cat.id">{{ cat.label }}<em>{{ cat.count }}</em></button>
        </div>
        <div class="pop-toolbar-meta">
          <ToggleSwitch v-model="showMature" class="mature-toggle"><span>鏄剧ず鎴愪汉鍐呭 <em>({{ adultCount }})</em></span></ToggleSwitch>
        </div>
      </div>

      <div v-if="filtered.length === 0" class="pop-empty">
        <p>娌℃湁绗﹀悎褰撳墠鏉′欢鐨勫満鏅紝鎹釜鍏抽敭璇嶆垨鍒嗙被璇曡瘯銆?/p>
        <button class="btn btn-ghost" type="button" @click="resetFilters">閲嶇疆绛涢€?/button>
      </div>

      <!-- 鍦烘櫙鍗＄墖缃戞牸 -->
      <div class="pop-grid">
        <article v-for="blueprint in filtered" :key="blueprint.id" class="pop-card"
          :class="{ adult: blueprint.adult }" :data-blueprint-id="blueprint.id">
          <header class="pop-card-head">
            <h3>{{ blueprint.title }}</h3>
            <span v-if="blueprint.adult" class="pop-rating">R18</span>
          </header>
          <p class="pop-desc">{{ blueprint.description }}</p>
          <div class="pop-meta">
            <span>{{ blueprint.category }}</span>
            <span>{{ blueprint.location }}</span>
            <span>{{ timeLabel(blueprint.timeOfDay) }}</span>
            <span>{{ blueprint.recommendedSize.replace('x', '脳') }}</span>
          </div>
          <div class="pop-decision">
            <span>闀滃ご <strong>{{ shotLabel(blueprint) }}</strong></span>
            <span>鍏夌嚎 <strong>{{ lightLabel(blueprint) }}</strong></span>
            <span>鑹茶皟 <strong>{{ moodLabel(blueprint) }}</strong></span>
            <span v-if="blueprint.adult" class="pop-artist">鐢诲笀 <strong>{{ artistLabel(blueprint) }}</strong></span>
          </div>
          <footer class="pop-card-actions">
            <RouterLink class="btn btn-primary pop-draw-action" :to="drawUrl(blueprint)">
              <ArchiveIcon name="spark" /> 寮€濮嬬粯鍒?            </RouterLink>
          </footer>
        </article>
      </div>
    </template>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSceneStore } from '@/stores/sceneStore'
import {
  inferBlueprintDecisions,
  type PopularCharacter,
  type SceneBlueprint,
} from '@/utils/popularContent'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import ToggleSwitch from '@/components/visual/ToggleSwitch.vue'

const route = useRoute()
const sceneStore = useSceneStore()

const loading = ref(true)
const loadError = ref('')
const query = ref('')
const selectedId = ref('')
const category = ref('all')
/** 鏈満榛樿灞曠ず鎴愪汉鍐呭锛堜笌鐏垫劅鍦烘櫙椤典竴鑷达級锛涢潪鏈満鐜榛樿闅愯棌銆?*/
const showMature = ref(/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname))

const characters = computed<PopularCharacter[]>(() => sceneStore.popularCharacters)
const allBlueprints = computed<SceneBlueprint[]>(() => sceneStore.sceneBlueprints)

/** 褰撳墠瑙掕壊鐨勫叏閮ㄨ摑鍥撅紙瑙掕壊涓撳睘 + 閫氱敤鎴愪汉钃濆浘锛岃祫鏍兼寜鎴愮啛寮€鍏虫敹鏁涳級銆?*/
const pool = computed<SceneBlueprint[]>(() => {
  const character = characters.value.find(item => item.id === selectedId.value) ?? null
  return allBlueprints.value.filter(bp =>
    (bp.characterId === selectedId.value || !bp.characterId)
    && (!bp.adult || (showMature.value && character?.adultEligibility === 'adult')),
  )
})

const totalScenes = computed(() => characters.value.length
  ? allBlueprints.value.filter(bp => bp.characterId || true).length
  : 0)
const adultCount = computed(() => pool.value.filter(bp => bp.adult).length)

const categories = computed(() => {
  const counts = new Map<string, number>()
  counts.set('all', pool.value.length)
  for (const bp of pool.value) {
    const key = bp.adult ? '鎴愪汉' : bp.category
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const order = ['鍏ㄩ儴', '鐜颁唬鏃ュ父', '娓╅Θ鏃ュ父', '鍜岄濂囧够', '濂囧够', '鎴愪汉']
  return [...counts.entries()]
    .map(([label, count]) => ({ id: label === '鍏ㄩ儴' ? 'all' : label, label, count }))
    .sort((a, b) => {
      const ia = order.indexOf(a.label)
      const ib = order.indexOf(b.label)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return pool.value.filter(bp => {
    if (category.value !== 'all' && (bp.adult ? '鎴愪汉' : bp.category) !== category.value) return false
    if (!q) return true
    return [bp.title, bp.description, bp.location, bp.promptProse, bp.category, bp.mood]
      .filter(Boolean)
      .some(text => String(text).toLowerCase().includes(q))
  })
})

const SHOT_LABELS: Record<string, string> = {
  close: '鐗瑰啓', medium: '鍗婅韩', wide: '鍏ㄦ櫙', pov: '绗竴浜虹О',
  high: '淇', low: '浠拌', side: '渚ч潰', turn: '鍥炵湼', over: '鑷媿', detail: '缁嗚妭',
}
const LIGHT_LABELS: Record<string, string> = {
  golden: '榛勯噾鍏?, window: '绐楀厜', back: '閫嗗厜', moon: '鏈堝厜',
  lantern: '鐏鍏?, overcast: '闃村ぉ鍏?,
}
const MOOD_LABELS: Record<string, string> = {
  warmth: '鏆栬壊', calm: '骞抽潤', tension: '寮犲姏', sad: '蹇ч儊', joy: '娆㈠揩',
}

function decision(blueprint: SceneBlueprint) {
  return inferBlueprintDecisions(blueprint)
}
function shotLabel(blueprint: SceneBlueprint): string {
  const shot = decision(blueprint).shot
  return shot ? (SHOT_LABELS[shot] || shot) : '鑷姩'
}
function lightLabel(blueprint: SceneBlueprint): string {
  const lighting = decision(blueprint).lighting
  return lighting ? (LIGHT_LABELS[lighting] || lighting) : '鑷姩'
}
function moodLabel(blueprint: SceneBlueprint): string {
  const mood = decision(blueprint).colorMood
  return mood ? (MOOD_LABELS[mood] || mood) : '鑷姩'
}
function artistLabel(blueprint: SceneBlueprint): string {
  return blueprint.adultArtistHint?.replace(/^@/, '') ?? ''
}
function timeLabel(value: string): string {
  return ({ morning: '娓呮櫒', afternoon: '鍗堝悗', sunset: '榛勬槒', evening: '鍌嶆櫄', night: '澶滄櫄', late_night: '娣卞', day: '鐧藉ぉ', noon: '涓崍' } as Record<string, string>)[value] || value || ''
}

function selectCharacter(id: string) {
  selectedId.value = id
  category.value = 'all'
}
function drawUrl(blueprint: SceneBlueprint): string {
  return `/prompt-builder?popular=${encodeURIComponent(selectedId.value)}&blueprint=${encodeURIComponent(blueprint.id)}`
}
function resetFilters() {
  query.value = ''
  category.value = 'all'
}

async function init() {
  loading.value = true
  loadError.value = ''
  try {
    // 鍏冩暟鎹紙鍚儹闂ㄨ鑹?+ 鍦烘櫙钃濆浘锛夐殢 core 鍔犺浇涓€璧峰氨浣嶏紝涓嶆媺鍏ㄩ噺瀹佸畞/澶忕洰鍒嗙墖銆?    await sceneStore.ensureCore()
    if (sceneStore.error) throw new Error(sceneStore.error)
    const charParam = typeof route.query.character === 'string' ? route.query.character : ''
    const fallback = characters.value[0]?.id ?? ''
    selectedId.value = characters.value.some(c => c.id === charParam) ? charParam : fallback
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => { void init() })
</script>

<style scoped>
.page { --page-max: 1100px; }
.title { margin-bottom: var(--s-3); }

.pop-hero {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-5);
  margin-bottom: var(--s-4);
  padding: var(--s-5);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-xl);
  background:
    radial-gradient(24rem 16rem at 88% 12%, var(--rella-glow-cyan), transparent 62%),
    radial-gradient(20rem 14rem at 8% 88%, var(--rella-glow-violet), transparent 60%),
    linear-gradient(145deg, var(--glass-highlight), transparent 28%),
    linear-gradient(160deg, color-mix(in srgb, var(--rella-night-soft) 60%, transparent), transparent 72%),
    var(--bg-surface);
  box-shadow: var(--shadow-glass-sm);
}
.pop-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: var(--z-below);
  pointer-events: none;
  border-radius: inherit;
  background:
    radial-gradient(1.5px 1.5px at 18% 26%, color-mix(in srgb, var(--rella-star) 55%, transparent), transparent 100%),
    radial-gradient(1px 1px at 74% 34%, color-mix(in srgb, var(--rella-cyan) 60%, transparent), transparent 100%),
    radial-gradient(2px 2px at 92% 68%, color-mix(in srgb, var(--rella-violet) 55%, transparent), transparent 100%),
    radial-gradient(1px 1px at 36% 82%, color-mix(in srgb, var(--rella-star) 50%, transparent), transparent 100%);
}
.pop-hero-copy, .pop-hero-stat { position: relative; z-index: var(--z-base); }
.pop-hero-copy { max-width: 42rem; }
.pop-hero-copy .subtitle { color: var(--text-secondary); line-height: 1.7; margin: 0; }
.pop-hero-stat {
  display: grid;
  grid-template-columns: auto auto;
  gap: 2px var(--s-3);
  align-items: baseline;
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  font: 650 var(--fs-mono-xs) var(--font-mono);
  color: var(--text-muted);
  letter-spacing: .08em;
  text-transform: uppercase;
}
.pop-hero-stat strong { font-size: var(--fs-title-sm); color: var(--accent); line-height: 1; }
.pop-hero-stat strong.adult { color: var(--danger-text); }
.pop-hero-stat span { grid-column: 2; }

.pop-char-strip {
  display: flex;
  gap: var(--s-2);
  overflow-x: auto;
  padding: var(--s-1) 0 var(--s-3);
  scrollbar-width: thin;
}
.pop-char-btn {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 128px;
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--t-fast), background var(--t-fast), color var(--t-fast), transform var(--t-fast);
}
.pop-char-btn strong { font-size: var(--fs-label); color: var(--text-primary); }
.pop-char-btn small { font-size: var(--fs-mono-xs); opacity: .6; }
.pop-char-btn:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border-soft)); }
.pop-char-btn.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--mood-love) 16%, transparent);
  color: var(--accent);
}
.pop-char-btn.active strong { color: var(--accent); }

.pop-toolbar {
  display: grid;
  gap: var(--s-3);
  margin-bottom: var(--s-4);
  padding: var(--s-3);
  border: 1px solid color-mix(in srgb, var(--archive-cyan) 18%, var(--border-soft));
  border-radius: var(--r-dossier);
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
  box-shadow: var(--shadow-glass-sm);
  -webkit-backdrop-filter: blur(20px) saturate(130%);
  backdrop-filter: blur(20px) saturate(130%);
}
.pop-toolbar-primary { display: flex; align-items: center; gap: var(--s-3); flex-wrap: wrap; }
.pop-search {
  flex: 1 1 280px;
  min-width: 0;
  padding: var(--s-3) var(--s-4);
  background: var(--bg-deep);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  color: var(--text-primary);
  font-size: var(--fs-body);
  outline: none;
}
.pop-search:focus { border-color: var(--accent); }
.pop-search::placeholder { color: var(--text-muted); }
.pop-count { color: var(--text-muted); font: 600 var(--fs-mono-sm) var(--font-mono); white-space: nowrap; }
.pop-count strong { color: var(--accent); }
.pop-cats { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.pop-cat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-pill);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font: 650 var(--fs-label-sm) var(--font-sans);
  cursor: pointer;
}
.pop-cat em { font-style: normal; opacity: .55; font: 700 var(--fs-mono-xs) var(--font-mono); }
.pop-cat:hover, .pop-cat.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.pop-toolbar-meta { display: flex; justify-content: flex-end; }
.mature-toggle { display: inline-flex; align-items: center; gap: var(--s-2); color: var(--text-secondary); cursor: pointer; font-size: var(--fs-body-sm); }
.mature-toggle em { font-style: normal; opacity: .6; }

.pop-empty {
  padding: var(--s-6);
  border: 1px dashed var(--border-strong);
  border-radius: var(--r-xl);
  text-align: center;
  color: var(--text-muted);
}

.pop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--s-4);
}
.pop-card {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: var(--s-4);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  transition: transform var(--t-fast) var(--ease-out), border-color var(--t-fast), box-shadow var(--t-fast);
}
.pop-card:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: var(--shadow-sm); }
.pop-card.adult { border-color: color-mix(in srgb, var(--danger-text) 45%, var(--border-soft)); }
.pop-card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
.pop-card-head h3 { margin: 0; font-size: var(--fs-title-xs); }
.pop-rating {
  flex: 0 0 auto;
  padding: 1px var(--s-2);
  border: 1px solid var(--danger-text);
  border-radius: var(--r-pill);
  color: var(--danger-text);
  font: 800 var(--fs-mono-sm) var(--font-mono);
}
.pop-desc { margin: 0; color: var(--text-secondary); font-size: var(--fs-label-sm); line-height: 1.55; }
.pop-meta { display: flex; flex-wrap: wrap; gap: var(--s-1); color: var(--text-muted); font-size: var(--fs-mono-xs); }
.pop-meta span + span::before { content: '路'; margin-right: var(--s-1); color: var(--border-strong); }
.pop-decision {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: var(--bg-deep);
  color: var(--text-muted);
  font-size: var(--fs-mono-sm);
}
.pop-decision strong { color: var(--text-primary); font-weight: 650; }
.pop-decision span + span::before { content: '路'; margin-right: var(--s-2); color: var(--border-strong); }
.pop-artist strong { color: var(--accent); }
.pop-card-actions { margin-top: auto; }
.pop-draw-action {
  width: 100%;
  justify-content: center;
  border-color: color-mix(in srgb, var(--accent) 44%, var(--border-soft));
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: none;
}
.pop-draw-action:hover, .pop-draw-action:focus-visible {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--text-inverse);
  box-shadow: var(--glow-sm);
}

@media (max-width: 768px) {
  .pop-hero { flex-direction: column; align-items: flex-start; }
  .pop-grid { grid-template-columns: minmax(0, 1fr); }
  .pop-char-btn { min-width: 108px; }
}
</style>
