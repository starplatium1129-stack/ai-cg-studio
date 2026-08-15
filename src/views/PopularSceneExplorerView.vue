<template>
  <article class="page" style="--page-max: 1100px;">
    <section class="pop-hero">
      <div class="pop-hero-copy">
        <div class="page-kicker">Popular scene library / 热门角色场景库</div>
        <h1 class="title">角色场景</h1>
        <p class="subtitle">18 位热门角色的全部场景蓝图，每一幕均已预设镜头、光线与叙事氛围；成人场景独立标注，可一键直达绘图页。</p>
      </div>
      <div class="pop-hero-stat" aria-label="场景统计">
        <strong>{{ totalScenes }}</strong><span>场景蓝图</span>
        <strong class="adult">{{ adultCount }}</strong><span>成人场景</span>
      </div>
    </section>

    <!-- 角色选择条 -->
    <div class="pop-char-strip" role="group" aria-label="选择热门角色">
      <button
        v-for="character in characters" :key="character.id" type="button"
        class="pop-char-btn" :class="{ active: selectedId === character.id }"
        :aria-pressed="selectedId === character.id"
        @click="selectCharacter(character.id)">
        <strong>{{ character.displayName }}</strong>
        <small>{{ character.franchise }}</small>
      </button>
    </div>

    <ArchiveStatePanel v-if="loading" kind="loading" title="正在读取角色场景" message="正在载入热门角色档案与场景蓝图。" />
    <ArchiveStatePanel v-else-if="loadError" kind="error" title="角色场景读取失败" :message="loadError">
      <button class="btn btn-primary" type="button" @click="init">重新读取</button>
    </ArchiveStatePanel>

    <template v-else>
      <!-- 工具栏：搜索 + 分类 + 成人开关 -->
      <div class="pop-toolbar">
        <div class="pop-toolbar-primary">
          <label class="sr-only" for="popularSceneSearch">搜索场景</label>
          <input v-model="query" type="search" id="popularSceneSearch" class="pop-search"
            placeholder="搜索场景标题、描述、地点或氛围（如：浴、黑丝、月光）" />
          <span class="pop-count" role="status">已显示 <strong>{{ filtered.length }}</strong> / {{ pool.length }} 个场景</span>
        </div>
        <div class="pop-cats" role="group" aria-label="场景分类">
          <button v-for="cat in categories" :key="cat.id" type="button" class="pop-cat"
            :class="{ active: category === cat.id }" :aria-pressed="category === cat.id"
            @click="category = cat.id">{{ cat.label }}<em>{{ cat.count }}</em></button>
        </div>
        <div class="pop-toolbar-meta">
          <ToggleSwitch v-model="showMature" class="mature-toggle"><span>显示成人内容 <em>({{ adultCount }})</em></span></ToggleSwitch>
        </div>
      </div>

      <div v-if="filtered.length === 0" class="pop-empty">
        <p>没有符合当前条件的场景，换个关键词或分类试试。</p>
        <button class="btn btn-ghost" type="button" @click="resetFilters">重置筛选</button>
      </div>

      <!-- 场景卡片网格 -->
      <div class="pop-grid">
        <article v-for="blueprint in filtered" :key="blueprint.id" class="pop-card"
          :class="{ adult: blueprint.adult }" :data-blueprint-id="blueprint.id">
          <!-- 样张缩略图：与灵感场景一致的真实样张预览；仅角色专属蓝图有样张 -->
          <RouterLink v-if="thumbSrc(blueprint)" class="pop-thumb" :to="drawUrl(blueprint)"
            :aria-label="`预览「${blueprint.title}」样张`">
            <span class="pop-thumb-skeleton" :class="{ visible: !thumbState[thumbSrc(blueprint)] && !thumbFailed[thumbSrc(blueprint)] }" aria-hidden="true"></span>
            <img :src="thumbSrc(blueprint)" alt="" loading="lazy" decoding="async"
              :class="{
                'pop-thumb-r18': sampleRatingOf(blueprint) === 'R18',
                'pop-thumb-missing': thumbFailed[thumbSrc(blueprint)],
                'pop-thumb-ready': thumbState[thumbSrc(blueprint)],
              }"
              @load="onThumbLoad(thumbSrc(blueprint))" @error="onThumbError(thumbSrc(blueprint))" />
            <span v-if="sampleRatingOf(blueprint) === 'R18'" class="pop-thumb-hint">R18 · 悬停预览</span>
          </RouterLink>
          <header class="pop-card-head">
            <h3>{{ blueprint.title }}</h3>
            <span v-if="sampleRatingOf(blueprint) !== 'All'" class="pop-rating" :class="'rating-' + sampleRatingOf(blueprint)">{{ sampleRatingOf(blueprint) }}</span>
          </header>
          <p class="pop-desc">{{ blueprint.description }}</p>
          <div class="pop-meta">
            <span>{{ blueprint.category }}</span>
            <span>{{ blueprint.location }}</span>
            <span>{{ timeLabel(blueprint.timeOfDay) }}</span>
            <span>{{ blueprint.recommendedSize.replace('x', '×') }}</span>
          </div>
          <div class="pop-decision">
            <span>镜头 <strong>{{ shotLabel(blueprint) }}</strong></span>
            <span>光线 <strong>{{ lightLabel(blueprint) }}</strong></span>
            <span>色调 <strong>{{ moodLabel(blueprint) }}</strong></span>
            <span v-if="blueprint.adult" class="pop-artist">画师 <strong>{{ artistLabel(blueprint) }}</strong></span>
          </div>
          <footer class="pop-card-actions">
            <RouterLink class="btn btn-primary pop-draw-action" :to="drawUrl(blueprint)">
              <ArchiveIcon name="spark" /> 开始绘制
            </RouterLink>
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
/** 本机默认展示成人内容（与灵感场景页一致）；非本机环境默认隐藏。 */
const showMature = ref(/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname))

const characters = computed<PopularCharacter[]>(() => sceneStore.popularCharacters)
const allBlueprints = computed<SceneBlueprint[]>(() => sceneStore.sceneBlueprints)

/** 当前角色的全部蓝图（资格按成熟开关收敛）。 */
const pool = computed<SceneBlueprint[]>(() => {
  const character = characters.value.find(item => item.id === selectedId.value) ?? null
  return allBlueprints.value.filter(bp =>
    bp.characterId === selectedId.value
    && (!bp.adult || (showMature.value && character?.adultEligibility === 'adult')),
  )
})

const totalScenes = computed(() => characters.value.length
  ? allBlueprints.value.length
  : 0)
const adultCount = computed(() => pool.value.filter(bp => bp.adult).length)

const categories = computed(() => {
  const counts = new Map<string, number>()
  counts.set('all', pool.value.length)
  for (const bp of pool.value) {
    const key = bp.adult ? '成人' : bp.category
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const order = ['全部', '现代日常', '温馨日常', '和风奇幻', '奇幻', '成人']
  return [...counts.entries()]
    .map(([label, count]) => ({ id: label === '全部' ? 'all' : label, label, count }))
    .sort((a, b) => {
      const ia = order.indexOf(a.label)
      const ib = order.indexOf(b.label)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return pool.value.filter(bp => {
    if (category.value !== 'all' && (bp.adult ? '成人' : bp.category) !== category.value) return false
    if (!q) return true
    return [bp.title, bp.description, bp.location, bp.promptProse, bp.category, bp.mood]
      .filter(Boolean)
      .some(text => String(text).toLowerCase().includes(q))
  })
})

const SHOT_LABELS: Record<string, string> = {
  close: '特写', medium: '半身', wide: '全景', pov: '第一人称',
  high: '俯视', low: '仰视', side: '侧面', turn: '回眸', over: '自拍', detail: '细节',
}
const LIGHT_LABELS: Record<string, string> = {
  golden: '黄金光', window: '窗光', back: '逆光', moon: '月光',
  lantern: '灯笼光', overcast: '阴天光',
}
const MOOD_LABELS: Record<string, string> = {
  warmth: '暖色', calm: '平静', tension: '张力', sad: '忧郁', joy: '欢快',
}

function decision(blueprint: SceneBlueprint) {
  return inferBlueprintDecisions(blueprint)
}
function shotLabel(blueprint: SceneBlueprint): string {
  const shot = decision(blueprint).shot
  return shot ? (SHOT_LABELS[shot] || shot) : '自动'
}
function lightLabel(blueprint: SceneBlueprint): string {
  const lighting = decision(blueprint).lighting
  return lighting ? (LIGHT_LABELS[lighting] || lighting) : '自动'
}
function moodLabel(blueprint: SceneBlueprint): string {
  const mood = decision(blueprint).colorMood
  return mood ? (MOOD_LABELS[mood] || mood) : '自动'
}
function artistLabel(blueprint: SceneBlueprint): string {
  return blueprint.adultArtistHint?.replace(/^@/, '') ?? ''
}
function timeLabel(value: string): string {
  return ({ morning: '清晨', afternoon: '午后', sunset: '黄昏', evening: '傍晚', night: '夜晚', late_night: '深夜', day: '白天', noon: '中午' } as Record<string, string>)[value] || value || ''
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

/** 样张视觉定级：缺省按成人蓝图推导（R18/All）；2026-08-15 起样张实际画面定级优先。 */
function sampleRatingOf(blueprint: SceneBlueprint): string {
  return blueprint.sampleRating || (blueprint.adult ? 'R18' : 'All')
}

/** 样张缩略图：与灵感场景一致，路径为展示库样张 `pc_<角色>_<蓝图>`；通用成人蓝图无样张。 */
const thumbState = ref<Record<string, boolean>>({})
const thumbFailed = ref<Record<string, boolean>>({})
function thumbSrc(blueprint: SceneBlueprint): string {
  if (!blueprint.characterId || !selectedId.value) return ''
  return `/scene-showcase/thumbs/pc_${selectedId.value}_${blueprint.id}.jpg`
}
function onThumbLoad(src: string) {
  thumbState.value = { ...thumbState.value, [src]: true }
}
function onThumbError(src: string) {
  thumbFailed.value = { ...thumbFailed.value, [src]: true }
}

async function init() {
  loading.value = true
  loadError.value = ''
  try {
    // 元数据（含热门角色 + 场景蓝图）随 core 加载一起就位，不拉全量宁宁/夏目分片。
    await sceneStore.ensureCore()
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

/* ---- 样张缩略图区（与灵感场景 SceneCard 视觉语言一致） ---- */
.pop-thumb {
  position: relative;
  display: block;
  aspect-ratio: 16/10;
  overflow: hidden;
  margin: calc(-1 * var(--s-4)) calc(-1 * var(--s-4)) var(--s-2);
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  background: linear-gradient(145deg, color-mix(in srgb, var(--bg-deep) 72%, var(--bg-elevated)), var(--bg-elevated));
  text-decoration: none;
}
.pop-thumb img {
  position: absolute; inset: 0; z-index: var(--z-sc-media, 0);
  width: 100%; height: 100%;
  object-fit: cover; object-position: center 22%;
  opacity: 0; filter: blur(6px);
  transition: opacity .28s var(--ease-out), filter .5s var(--ease-out), transform var(--t-base) var(--ease-out);
}
.pop-thumb img.pop-thumb-ready { opacity: 1; filter: blur(0); }
.pop-thumb img.pop-thumb-missing { display: none; }
.pop-thumb-skeleton {
  position: absolute; inset: 0; z-index: var(--z-sc-media, 0); opacity: 0;
  background: linear-gradient(105deg, var(--bg-deep) 18%, var(--bg-elevated) 42%, var(--bg-deep) 68%);
  background-size: 220% 100%;
  transition: opacity var(--t-fast);
}
.pop-thumb-skeleton.visible { opacity: 1; animation: archive-skeleton-shimmer 1.3s linear infinite; }
/* R18 样张默认模糊，悬停/聚焦揭示，与灵感场景一致。 */
.pop-thumb img.pop-thumb-r18,
.pop-thumb img.pop-thumb-r18.pop-thumb-ready { filter: blur(16px) saturate(.85); transform: scale(1.08); }
.pop-card:hover .pop-thumb img.pop-thumb-r18,
.pop-card:focus-within .pop-thumb img.pop-thumb-r18,
.pop-card:hover .pop-thumb img.pop-thumb-r18.pop-thumb-ready,
.pop-card:focus-within .pop-thumb img.pop-thumb-r18.pop-thumb-ready { filter: blur(0) saturate(1); transform: scale(1.08); }
.pop-thumb-hint {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--on-art-line); border-radius: var(--r-pill);
  background: var(--art-scrim); color: var(--on-art-primary);
  font: 700 var(--fs-mono-xs) var(--font-mono); letter-spacing: .08em;
  backdrop-filter: blur(10px); box-shadow: var(--shadow-sm);
  pointer-events: none; opacity: 1; transition: opacity var(--t-fast);
}
.pop-card:hover .pop-thumb-hint, .pop-card:focus-within .pop-thumb-hint { opacity: 0; }
@media (hover: hover) and (pointer: fine) {
  .pop-card:hover .pop-thumb img { transform: scale(1.03); }
  .pop-card:hover .pop-thumb img.pop-thumb-r18,
  .pop-card:hover .pop-thumb img.pop-thumb-r18.pop-thumb-ready { transform: scale(1.03); }
}
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
.pop-rating.rating-R15 {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border-soft));
  color: var(--accent);
}
.pop-rating.rating-All { display: none; }
.pop-desc { margin: 0; color: var(--text-secondary); font-size: var(--fs-label-sm); line-height: 1.55; }
.pop-meta { display: flex; flex-wrap: wrap; gap: var(--s-1); color: var(--text-muted); font-size: var(--fs-mono-xs); }
.pop-meta span + span::before { content: ' · '; margin-right: var(--s-1); color: var(--border-strong); }
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
.pop-decision span + span::before { content: ' · '; margin-right: var(--s-2); color: var(--border-strong); }
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
