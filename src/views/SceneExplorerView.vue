<template>
  <article class="page" style="--page-max: 1100px;">
    <section class="scene-atlas" aria-labelledby="sceneAtlasTitle">
      <div class="scene-atlas-copy">
        <div class="scene-atlas-register" aria-label="场景档案章节">
          <span class="archive-kicker">SCENE ARCHIVE</span>
          <strong>{{ activeThemeIndex }}</strong>
          <span>{{ activeThemeLabel }}</span>
        </div>
        <div class="page-kicker">Scene discovery / 场景探寻</div>
        <h1 id="sceneAtlasTitle" class="title">灵感场景</h1>
        <p class="subtitle">精选契合人设的高光瞬间，每一幕均悉数预设镜头与叙事光影。其余 <strong>{{ scenes.length }} 个场景</strong>已完整收录于工坊档案。</p>
        <div class="curation-intro">
          <span class="curation-kicker">Nene × Natsume</span>
          <h2>从角色的心情，走进场景</h2>
          <p>选择下面的主题，点云会从一段情绪重新组成下一幅场景标记。</p>
        </div>
      </div>
      <SemanticParticleField
        class="scene-atlas-particles"
        :shape="activeParticleShape"
        :label="particleLabel"
        :caption="particleCaption"
      />
      <div class="mood-rails" aria-live="polite">
        <button v-for="rail in moodRails" :key="rail.title" type="button" class="mood-rail"
          :class="[rail.character === 'nene' || rail.character === 'natsume' ? rail.character : '']"
          @click="applyMoodRail(rail.query)">
          <span class="mood-icon"><ArchiveIcon :name="railIconName(rail.icon)" /></span>
          <strong>{{ rail.title }}</strong><small>{{ rail.subtitle }}</small>
        </button>
      </div>
    </section>

    <!-- 单层 sticky 工具条：搜索 + 主题 + 折叠精细筛选，
         原来搜索/主题/facet/成人开关是四条横栏，要跨 4 个条才看到场景卡 -->
    <div class="scene-toolbar sticky-toolbar">
      <div class="toolbar-primary">
        <label class="sr-only" for="sceneSearch">搜索场景</label>
        <div class="scene-search-wrap">
          <input v-model="searchQuery" type="search" class="scene-search" id="sceneSearch"
            placeholder="搜索场景、镜头、时段或关键词（如：雨夜、围围巾、夏目经典感）" />
          <button v-if="searchQuery" class="scene-search-clear" type="button" aria-label="清空" @click="searchQuery = ''">×</button>
        </div>
        <span class="scene-count" role="status" aria-live="polite">
          已显示 <strong>{{ Math.min(visible, filtered.length) }}</strong>
          <span aria-hidden="true">·</span>
          {{ tierLabel }} {{ filtered.length }}
        </span>
        <button
          class="filter-toggle" type="button"
          :class="{ active: filtersOpen || activeFacetCount > 0 }"
          :aria-expanded="filtersOpen ? 'true' : 'false'"
          @click="filtersOpen = !filtersOpen"
        >
          筛选<span v-if="activeFacetCount" class="facet-badge">{{ activeFacetCount }}</span>
        </button>
      </div>

      <div class="scene-personal-nav" aria-label="我的场景视图">
        <span class="scene-personal-label">我的场景</span>
        <button type="button" :class="{ active: fTier === 'personal' && !showHidden }"
          @click="showPersonalScenes">常用 {{ usedCount }}</button>
        <button type="button" :class="{ active: sortBy === 'favorite' && !showHidden }"
          @click="showFavoriteScenes">收藏 {{ favoriteCount }}</button>
        <button type="button" :class="{ active: showHidden }"
          @click="showHiddenScenes">已隐藏 {{ hiddenCount }}</button>
        <button type="button" :class="{ active: fTier === 'all' && sortBy === 'smart' && !showHidden }"
          @click="showAllScenes">完整库 {{ availableCount }}</button>
      </div>

      <div class="scene-cats">
        <button v-for="d in THEME_DEFS" :key="d.id" type="button" class="scene-cat"
          :class="{ active: activeTheme === d.id }"
          :aria-pressed="activeTheme === d.id ? 'true' : 'false'"
          @click="activeTheme = d.id"><ArchiveIcon :name="d.iconName" /> {{ d.label }} {{ themeCount(d.id) }}</button>
      </div>

      <div v-if="intentHtml" class="search-intent" aria-live="polite" v-html="intentHtml"></div>

      <!-- 精细筛选默认收起 -->
      <div v-show="filtersOpen" class="scene-facet-panel">
        <div class="scene-facet-grid">
          <label class="scene-filter-field">角色<select v-model="fChar"><option value="all">全部角色</option><option value="nene">宁宁</option><option value="natsume">夏目</option><option value="triad">双人</option></select></label>
          <label class="scene-filter-field">季节<select v-model="fSeason"><option value="all">全部季节</option><option value="春">春</option><option value="夏">夏</option><option value="秋">秋</option><option value="冬">冬</option></select></label>
          <label class="scene-filter-field">时段<select v-model="fTime"><option value="all">全部时段</option><option value="morning">清晨</option><option value="afternoon">午后</option><option value="sunset">黄昏</option><option value="night">夜晚与深夜</option><option value="dawn">黎明</option></select></label>
          <label class="scene-filter-field">系列<select v-model="fSeries"><option value="all">全部系列</option><option value="after">After Story</option><option value="fanwork">同人</option><option value="active">Active Sync</option></select></label>
          <label class="scene-filter-field">分级<select v-model="fRating"><option value="all">全部分级</option><option value="All">全年龄</option><option value="R15">R15</option><option value="R18">R18</option></select></label>
          <label class="scene-filter-field">层级<select v-model="fTier"><option value="personal">我的常用</option><option value="core">人设核心</option><option value="featured">招牌与精选</option><option value="signature">只看招牌</option><option value="curated">只看精选</option><option value="all">完整库</option></select></label>
          <label class="scene-filter-field">排序<select v-model="sortBy"><option value="smart">智能推荐</option><option value="used">最近常用</option><option value="curated">主理人精选</option><option value="favorite">我的收藏</option><option value="newest">最新加入</option><option value="title">名称A-Z</option></select></label>
        </div>
        <div class="scene-filter-meta">
          <label class="mature-toggle"><input type="checkbox" v-model="showMature" @change="onMatureChange" /> 显示成人内容 <span>({{ matureCount }})</span></label>
          <label class="mature-toggle"><input type="checkbox" v-model="showHidden" /> 管理已隐藏 <span>({{ hiddenCount }})</span></label>
          <button class="scene-reset" type="button" @click="resetFilters">重置全部筛选</button>
        </div>
      </div>
    </div>

    <ArchiveStatePanel
      v-if="loading"
      kind="loading"
      title="正在读取场景档案"
      message="正在载入角色场景、策展层级和本机偏好。"
    />
    <ArchiveStatePanel
      v-else-if="loadError"
      kind="error"
      title="场景档案读取失败"
      :message="loadError"
    >
      <button class="btn btn-primary" type="button" @click="init">重新读取</button>
    </ArchiveStatePanel>
    <ArchiveStatePanel
      v-else-if="scenes.length === 0"
      kind="empty"
      title="场景档案目前为空"
      message="本地场景数据已读取，但还没有可浏览的场景记录。"
    />
    <ArchiveStatePanel
      v-else-if="paged.length === 0"
      kind="filtered"
      title="没有符合当前条件的场景"
      message="换个关键词或重置筛选，我再帮你翻翻完整档案。"
    >
      <button class="btn btn-primary" type="button" @click="resetFilters">重置筛选</button>
    </ArchiveStatePanel>
    <div v-else class="scene-grid stagger-container">
      <SceneCard v-for="s in paged" :key="s.id" :scene="s" mode="grid" :clickable="false" suppressTags
          class="stagger-item"
          :class="flashId === s.id ? 'scene-flash' : ''" :data-scene-id="s.id">
          <template #band>
            <span v-if="usageFor(s)" class="sc-tier personal">常用 {{ usageFor(s)?.uses }}</span>
            <span v-if="isCore(s)" class="sc-tier signature">人设核心</span>
            <span v-else-if="tier(s) === 'signature'" class="sc-tier signature">招牌</span>
            <span v-else-if="tier(s) === 'curated'" class="sc-tier curated">精选</span>
          </template>
          <template #body="{ scene: s2 }">
            <div class="ex-scene-line">
              <span><strong>{{ charName(s2) }}</strong></span>
              <span>{{ s2.emotion || '情绪待定' }}</span>
              <span>{{ [seasonLabel(s2.season), timeLabel(s2.timeOfDay)].filter(Boolean).join(' · ') || '时间不限' }}</span>
            </div>
            <div v-if="personalReason(s2)" class="ex-curation">{{ personalReason(s2) }}</div>
            <div class="ex-actions">
              <RouterLink :to="'/prompt-builder?scene=' + encodeURIComponent(s2.id)" class="btn btn-primary"><ArchiveIcon name="spark" /> 开始绘制</RouterLink>
              <button class="btn btn-ghost scene-hide-action" type="button" @click.stop="toggleHidden(s2.id)">
                {{ hiddenIds.has(s2.id) ? '↩ 恢复' : '隐藏' }}
              </button>
            </div>
            <div class="ex-more">
              <div class="ex-decision">
                <span>镜头 <strong>{{ dv(s2).shot }}</strong></span>
                <span>光线 <strong>{{ dv(s2).lighting }}</strong></span>
                <span>色调 <strong>{{ dv(s2).color }}</strong></span>
              </div>
              <div class="ex-secondary">
                <a class="btn btn-ghost btn-sm" :href="quickCreateUrl(s2.id)"><ArchiveIcon name="lightning" /> 直接出图</a>
                <button class="btn btn-ghost btn-sm" type="button" @click.stop="drawerScene = s2"><ArchiveIcon name="book" /> 故事</button>
                <button class="btn btn-ghost btn-sm scene-fav" :class="{ saved: favs.has(s2.id) }"
                  type="button" @click.stop="toggleFav(s2.id)"><ArchiveIcon :name="favs.has(s2.id) ? 'love' : 'star'" /> {{ favs.has(s2.id) ? '已收' : '收藏' }}</button>
              </div>
            </div>
          </template>
      </SceneCard>
    </div>
    <div v-show="!loading && !loadError && visible < filtered.length" class="scene-load">
      <button class="btn btn-ghost" type="button" @click="visible += PAGE_SIZE">
        加载更多（剩余 {{ filtered.length - visible }}）
      </button>
    </div>
  </article>

  <Teleport to="body">
    <div v-show="drawerScene" ref="drawerEl" class="story-drawer" role="dialog" aria-modal="true" aria-label="场景故事"
      :class="{ open: !!drawerScene }" @click.self="drawerScene = null">
      <div class="story-card" v-if="drawerScene">
        <h3><ArchiveIcon name="cherry" /> {{ drawerScene.title }}</h3>
        <div class="story-meta">{{ charName(drawerScene) }} · {{ seasonLabel(drawerScene.season) }} · {{ timeLabel(drawerScene.timeOfDay) }} · {{ drawerScene.emotion }}</div>
        <div class="story-body">{{ drawerScene.story || '' }}</div>
        <div class="story-actions">
          <a class="btn btn-primary" :href="quickCreateUrl(drawerScene.id)"><ArchiveIcon name="lightning" /> 快速出图</a>
          <RouterLink class="btn btn-ghost" :to="'/prompt-builder?scene=' + encodeURIComponent(drawerScene.id) + '&step=4&generate=1'"><ArchiveIcon name="clap" /> 调整后生成</RouterLink>
          <button class="btn btn-ghost" type="button" @click="drawerScene = null">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import SceneCard from '@/components/SceneCard.vue'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import SemanticParticleField from '@/components/visual/SemanticParticleField.vue'
import type { ParticleShapeId } from '@/utils/particleShapes'

import { tier as uxTier, matchesSearch as uxMatchesSearch, searchScore as uxSearchScore,
  isPersonalFavorite as uxIsFav, personalScore as uxPersonalScore,
  personalReason as uxPersonalReason, analyzeQuery as uxAnalyze,
  buildPreferenceProfile, isPersonaCore, readHiddenScenes, writeHiddenScenes,
  readSceneUsage, sceneUsageScore, type SceneUsageRecord, type PreferenceProfile,
  type SceneUXConfig } from '@/utils/sceneUX'
import { kvInit, kvGet } from '@/composables/useKVStore'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useSceneStore, type Scene, type CurationData } from '@/stores/sceneStore'
import { quickCreateUrl } from '@/utils/quickCreate'
import ArchiveIcon, { type ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'

interface ExplorerScene extends Scene {
  title?: string
  category?: string
  story?: string
  char?: string
  emotion?: string
  season?: string
  timeOfDay?: string
  rating?: string
  mature?: boolean
  camera?: string
  lighting?: string
  location?: string
  weather?: string
  tags?: string[]
}

interface ExplorerCuration extends CurationData, SceneUXConfig {
  moodRails?: Array<{ character: string; icon?: string; title: string; subtitle: string; query: string }>
  recommendationReasons?: Record<string, string>
}

const PAGE_SIZE = 24
const MATURE_KEY = 'aics_show_mature'
const FAV_KEY = 'aics_scene_favorites'
const HISTORY_KEY = 'aics_pb_history'
const LOCAL_OWNER = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)

const THEME_DEFS: Array<{ id: string; label: string; iconName: ArchiveIconName; categories: string[] }> = [
  { id: 'all',      label: '全部', iconName: 'spark',     categories: [] as string[] },
  { id: 'romance',  label: '恋爱', iconName: 'love',      categories: ['恋爱'] },
  { id: 'daily',    label: '日常', iconName: 'coffee',    categories: ['日常'] },
  { id: 'intimate', label: '亲密', iconName: 'moonlight', categories: ['亲密','R15'] },
  { id: 'school',   label: '校园', iconName: 'cap',       categories: ['校园'] },
  { id: 'travel',   label: '旅行', iconName: 'plane',     categories: ['旅行'] },
  { id: 'festival', label: '节日', iconName: 'flower',    categories: ['祭典・节日'] },
  { id: 'story',    label: '剧情', iconName: 'clap',      categories: ['战斗','Active Sync'] },
  { id: 'fanwork',  label: '同人', iconName: 'spark',     categories: ['同人'] },
]
const PARTICLE_SHAPES: Record<string, ParticleShapeId> = {
  all: 'atelier',
  romance: 'heart',
  daily: 'cup',
  intimate: 'moon',
  school: 'book',
  travel: 'mountain',
  festival: 'lantern',
  story: 'frame',
  fanwork: 'spark',
}
const DEFAULT_RAILS = [
  { character:'nene',    icon:'🌙', title:'宁宁的月光秘密', subtitle:'图书馆 · 樱色 · 魔女', query:'nene library' },
  { character:'natsume', icon:'☕', title:'夏目的夜灯关心', subtitle:'咖啡馆 · 雨夜 · 琥珀', query:'natsume cafe'  },
  { character:'shared',  icon:'🌅', title:'夏日远行',       subtitle:'海风 · 黄昏 · 纪念',   query:'beach sunset' },
]

/** curation.json 的 moodRails 仍是 emoji；渲染时映射到手绘图标，避免改数据升版本 */
function railIconName(icon: string | undefined): ArchiveIconName {
  switch (icon) {
    case '🌙': return 'moonlight'
    case '☕': return 'coffee'
    case '🌅': case '🌄': return 'goldenhour'
    case '🌸': return 'cherry'
    case '🍂': return 'autumnleaf'
    case '💕': case '❤': return 'love'
    case '📖': return 'book'
    case '🎬': return 'clap'
    case '✿': return 'flower'
    default: return 'spark'
  }
}

const route = useRoute()
const sceneStore = useSceneStore()
const scenes = ref<ExplorerScene[]>([])
const curation = ref<ExplorerCuration>({ curatedSceneIds:[], moodRails:[], signatureSceneIds:[], reviewSceneIds:[] })
const profile = ref<PreferenceProfile>(buildPreferenceProfile([]))
const loading = ref(true)
const loadError = ref('')
const flashId = ref('')
const drawerScene = ref<ExplorerScene | null>(null)
const drawerEl = ref<HTMLElement | null>(null)
useFocusTrap(drawerEl, () => drawerScene.value !== null, { onEscape: () => { drawerScene.value = null } })
function readFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAV_KEY) || '[]')
    return new Set<string>(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
}
const favs = ref(readFavorites())
const hiddenIds = ref(readHiddenScenes())
const localUsage = ref(readSceneUsage())
const showHidden = ref(false)
const showMature = ref(localStorage.getItem(MATURE_KEY) == null ? LOCAL_OWNER : localStorage.getItem(MATURE_KEY) === '1')

const searchQuery = ref('')
/** 首帧数据就绪标记：避免初始化时赋初值触发数据 watch 重复加载 */
let dataReady = false
/**
 * 输入框绑 searchQuery（打字要立刻回显），过滤/排序读 debouncedQuery。
 * 全 src/ 之前没有任何 debounce，297 条的过滤+排序每次击键都全量重跑。
 * VueUse watchDebounced 替代手写 timer；清空立刻生效（debounceFilter 首个参数）。
 */
const debouncedQuery = ref('')
watchDebounced(searchQuery, (value) => {
  debouncedQuery.value = value
}, { debounce: 150, maxWait: 0, immediate: true })
const activeTheme = ref('all')
const activeParticleShape = computed<ParticleShapeId>(() => PARTICLE_SHAPES[activeTheme.value] || 'atelier')
const activeThemeDefinition = computed(() => themeDef(activeTheme.value))
const activeThemeLabel = computed(() => activeThemeDefinition.value.label)
const activeThemeIndex = computed(() => String(Math.max(1, THEME_DEFS.findIndex(item => item.id === activeTheme.value) + 1)).padStart(2, '0'))
const particleLabel = computed(() => `${activeThemeLabel.value}场景的粒子轮廓，切换主题时重新组合`)
const particleCaption = computed(() => `ARCHIVE ${activeThemeIndex.value} / ${String(THEME_DEFS.length).padStart(2, '0')}`)
const fChar = ref('all'); const fSeason = ref('all'); const fTime = ref('all')
const fSeries = ref('all'); const fRating = ref('all')
const defaultTier = Object.keys(localUsage.value).length || favs.value.size ? 'personal' : 'core'
const fTier = ref(defaultTier)
const sortBy = ref('smart')
const visible = ref(PAGE_SIZE)
const filtersOpen = ref(false)

/** 已生效的精细筛选数量，收起时也能看出「有筛选在起作用」 */
const activeFacetCount = computed(() => {
  let n = 0
  if (fChar.value !== 'all') n++
  if (fSeason.value !== 'all') n++
  if (fTime.value !== 'all') n++
  if (fSeries.value !== 'all') n++
  if (fRating.value !== 'all') n++
  if (fTier.value !== defaultTier) n++
  if (sortBy.value !== 'smart') n++
  if (showHidden.value) n++
  // 本机默认展示成人内容是产品默认值，不应让工具条一进入就显示「筛选 1」。
  // 只有用户偏离当前访问环境的默认值时，才把它计为主动筛选。
  if (showMature.value !== LOCAL_OWNER) n++
  return n
})

// --- derived ---
const moodRails = computed(() => curation.value.moodRails?.length ? curation.value.moodRails : DEFAULT_RAILS)
const matureCount = computed(() => scenes.value.filter(s => s.mature).length)
const hiddenCount = computed(() => hiddenIds.value.size)
const usedCount = computed(() => Object.keys(localUsage.value).length)
const favoriteCount = computed(() => scenes.value.filter(s => favs.value.has(s.id) || uxIsFav(s, profile.value)).length)
const availableCount = computed(() => scenes.value.filter(s => !hiddenIds.value.has(s.id) && (showMature.value || !s.mature)).length)
const tierLabel = computed(() => {
  if (showHidden.value) return '已隐藏'
  return ({ personal: '我的常用', core: '人设核心', featured: '精选', signature: '招牌', curated: '精选', all: '全库' } as Record<string, string>)[fTier.value] || '场景'
})

function primaryCat(s: ExplorerScene) { const c = s.category||'其他'; return c==='Active_Sync_Scenes'?'Active Sync':c.split('/')[0] }
function themeDef(id: string) { return THEME_DEFS.find(d=>d.id===id)||THEME_DEFS[0] }
function matchesTheme(s: ExplorerScene, id: string) { return id==='all'||themeDef(id).categories.includes(primaryCat(s)) }
function matchesSeries(s: ExplorerScene, v: string) {
  const c=s.category||''
  if(v==='after') return /After_Story/i.test(c)
  if(v==='fanwork') return /同人/.test(c)
  if(v==='active') return c==='Active_Sync_Scenes'
  return true
}
function matchesTime(s: ExplorerScene, v: string) {
  if(v==='all') return true
  if(v==='night') return ['night','late_night','evening'].includes(s.timeOfDay || '')
  return s.timeOfDay===v
}
function tier(s: ExplorerScene) { return uxTier(s, curation.value) }
function isCore(s: ExplorerScene) { return isPersonaCore(s, curation.value) }
function sigIds(): string[] { return curation.value.signatureSceneIds||[] }
function curIds(): string[] { return curation.value.curatedSceneIds||[] }
function coreIds(): string[] { return curation.value.personaCoreSceneIds||curation.value.signatureSceneIds||[] }
function cScore(s: ExplorerScene) {
  if(coreIds().includes(s.id)) return 30000-coreIds().indexOf(s.id)
  if(sigIds().includes(s.id)) return 20000-sigIds().indexOf(s.id)
  const f=curIds().indexOf(s.id); if(f>=0) return 10000-f
  const c=[s.story,s.emotion,s.camera,s.lighting,s.location].filter(Boolean).length
  return c*100+Math.min((s.story||'').length,500)+(s.rating==='All'?20:0)
}
function charName(s: ExplorerScene) {
  const c=s.char||''
  return c==='nene'||c==='ayachi_nene'?'宁宁':c==='natsume'||c==='shiki_natsume'?'夏目':c==='triad'?'双人':c
}
function seasonLabel(v?: string) { return ({春:'春',夏:'夏',秋:'秋',冬:'冬'} as Record<string, string>)[v || '']||v||'' }
function timeLabel(v?: string) {
  return ({morning:'清晨',afternoon:'午后',sunset:'黄昏',night:'夜晚',late_night:'深夜',dawn:'黎明',evening:'夜晚',all_day:'全天'} as Record<string, string>)[v || '']||v||''
}
function personalReason(s: ExplorerScene) {
  const usage = usageFor(s)
  const localReason = usage
    ? `你选用过 ${usage.uses} 次${usage.lastUsed ? ` · 最近 ${relativeUsedAt(usage.lastUsed)}` : ''}`
    : ''
  const r = localReason || uxPersonalReason(s, profile.value) || (curation.value.recommendationReasons||{})[s.id] || ''
  return /实机生成与直接视觉复核/.test(r) ? '' : r
}
function usageFor(s: ExplorerScene): SceneUsageRecord | undefined { return localUsage.value[s.id] }
function isPersonalScene(s: ExplorerScene) {
  return Boolean(usageFor(s) || favs.value.has(s.id) || uxIsFav(s, profile.value))
}
function relativeUsedAt(timestamp: number) {
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000))
  return days === 0 ? '今天' : days === 1 ? '昨天' : days < 30 ? `${days} 天前` : '较早'
}
function themeCount(id: string) {
  return scenes.value.filter(s=>(showMature.value||!s.mature)&&!hiddenIds.value.has(s.id)&&matchesTheme(s,id)).length
}
function dv(s: ExplorerScene) {
  const cm: Record<string, string>={半身中景:'半身',全身远景:'远景',全身中景:'全身',特写:'特写',特写镜头:'特写',面部特写:'特写',远景:'远景',中景:'半身',全身:'全身',半身:'半身'}
  const lm: Record<string, string>={窗光:'窗光',黄金时刻:'黄昏光',逆光:'逆光',月光:'月光',夜灯:'夜灯',霓虹:'霓虹',烛光:'烛光',阴天:'阴天光',夕阳光:'黄昏光',晨光:'晨光'}
  const ca=String(s.camera||'')
  const shot=cm[s.camera || '']||(/第一人称|主观/i.test(ca)?'第一人称':/俯视|俯瞰/.test(ca)?'俯视':/仰视|微仰/.test(ca)?'仰视':/侧面|侧方/.test(ca)?'侧面':/近景|特写/.test(ca)?'特写':/全身|远景/.test(ca)?'远景':'半身')
  const li=String(s.lighting||'')
  const lighting=lm[s.lighting || '']||(/夕阳|黄昏|黄金|落日/.test(li)?'黄昏光':/逆光|背光/.test(li)?'逆光':/月光|星光/.test(li)?'月光':/窗光|晨光|朝阳/.test(li)?'窗光':/阴天|雨天|漫射/.test(li)?'柔光':/灯|烛|暖光|霓虹/.test(li)?'夜灯':'自然光')
  const t=(s.tags||[]).join(',').toLowerCase(); const em=(s.emotion||'').toLowerCase()
  let color='自然'
  if(/sunset|dusk|golden|黄昏|夕阳|浪漫/.test(t)||/love|shy|恋爱|害羞/.test(em)) color='暖橙'
  else if(/night|月|夜|星空|moon/.test(t)) color='冷蓝'
  else if(/spring|cherry|花|樱花|春/.test(t)) color='粉嫩'
  else if(/autumn|red_leaves|秋/.test(t)) color='琥珀'
  else if(/rain|雨|cloudy/.test(t)) color='灰蓝'
  else if(/winter|snow|雪|冬/.test(t)) color='冷白'
  return {shot,lighting,color}
}

const filtered = computed(() => {
  // 用 debounce 后的值：直接读 searchQuery 会让下面的过滤+排序在每次击键时重跑
  const q = debouncedQuery.value.trim().toLowerCase()
  let r = scenes.value.filter(s => {
    if (showHidden.value ? !hiddenIds.value.has(s.id) : hiddenIds.value.has(s.id)) return false
    if (!showMature.value && s.mature) return false
    if (!matchesTheme(s, activeTheme.value)) return false
    if (!matchesSeries(s, fSeries.value)) return false
    if (fChar.value !== 'all' && s.char !== fChar.value) return false
    if (fSeason.value !== 'all' && s.season !== fSeason.value) return false
    if (!matchesTime(s, fTime.value)) return false
    if (fRating.value !== 'all' && (s.rating||(s.mature?'R18':'All')) !== fRating.value) return false
    const t = tier(s)
    if (!showHidden.value) {
      if (!q && fTier.value === 'personal' && !isPersonalScene(s)) return false
      if (!q && fTier.value === 'core' && !isCore(s)) return false
      if (!q && fTier.value === 'featured' && t !== 'signature' && t !== 'curated') return false
      if (fTier.value !== 'all' && fTier.value !== 'personal' && fTier.value !== 'featured' && fTier.value !== 'core' && t !== fTier.value) return false
    }
    if (sortBy.value === 'favorite' && !favs.value.has(s.id) && !uxIsFav(s, profile.value)) return false
    return !q || uxMatchesSearch(s, q, curation.value, [primaryCat(s), timeLabel(s.timeOfDay)])
  })
  // 相关度先算一遍存 Map:原先在比较器里每次比较都调 uxSearchScore 两次,
  // 297 条 ≈ 每次重算 4900 次评分,每次还带字符串归一化
  const relevance = new Map<string, number>()
  if (q) {
    for (const s of r) {
      relevance.set(s.id, uxSearchScore(s, q, curation.value, [primaryCat(s), timeLabel(s.timeOfDay)]))
    }
  }
  return r.sort((a,b) => {
    if (q) {
      const rel = (relevance.get(b.id) ?? 0) - (relevance.get(a.id) ?? 0)
      if (rel) return rel
    }
    if (sortBy.value==='newest') return String(b.id).localeCompare(String(a.id),undefined,{numeric:true})
    if (sortBy.value==='title') return String(a.title).localeCompare(String(b.title),'zh-CN')
    if (sortBy.value==='used') return sceneUsageScore(usageFor(b))-sceneUsageScore(usageFor(a))
    if (sortBy.value==='favorite') {
      const favoriteScore = (s: ExplorerScene) => (favs.value.has(s.id) ? 100000 : 0)
        + uxPersonalScore(s, profile.value) * 500
        + sceneUsageScore(usageFor(s))
      return favoriteScore(b) - favoriteScore(a)
    }
    if (sortBy.value==='smart') {
      return (sceneUsageScore(usageFor(b))*400+uxPersonalScore(b,profile.value)*500+cScore(b))
        -(sceneUsageScore(usageFor(a))*400+uxPersonalScore(a,profile.value)*500+cScore(a))
    }
    return cScore(b)-cScore(a)
  })
})
const paged = computed(() => filtered.value.slice(0, visible.value))

function escapeHtml(value: unknown): string {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const intentHtml = computed(() => {
  const q = debouncedQuery.value.trim()
  const a = uxAnalyze(q, curation.value)
  const exp = q && ['personal','core','featured'].includes(fTier.value) ? '已自动扩展至完整场景库。' : ''
  // intents 可能包含用户原始输入（alias 未命中时 push normalized），
  // 拼进 v-html 前必须转义，否则搜索结果里直接注入 HTML。
  const understood = a.intents?.length
    ? `已理解为：<strong>${escapeHtml(a.intents.join(' · '))}</strong>。`
    : (q ? '正在搜索标题、故事、情绪、地点和视觉标签。' : '可以直接描述想画的完整句子。')
  const personal = profile.value.entries ? ` 已结合本机${profile.value.entries}条创作记录排序。` : ' 完成作品评分后，推荐会逐渐贴近你的偏好。'
  return exp + understood + personal
})

watch([debouncedQuery, activeTheme, fChar, fSeason, fTime, fSeries, fRating, fTier, sortBy, showHidden], () => { visible.value = PAGE_SIZE })

function toggleFav(id: string) {
  if (favs.value.has(id)) favs.value.delete(id); else favs.value.add(id)
  favs.value = new Set(favs.value)
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs.value]))
}
function toggleHidden(id: string) {
  if (hiddenIds.value.has(id)) hiddenIds.value.delete(id)
  else hiddenIds.value.add(id)
  hiddenIds.value = new Set(hiddenIds.value)
  writeHiddenScenes(hiddenIds.value)
}
function showPersonalScenes() {
  showHidden.value = false; fTier.value = 'personal'; sortBy.value = 'used'; filtersOpen.value = false
}
function showFavoriteScenes() {
  showHidden.value = false; fTier.value = 'all'; sortBy.value = 'favorite'; filtersOpen.value = false
}
function showHiddenScenes() {
  showHidden.value = true; fTier.value = 'all'; sortBy.value = 'smart'; filtersOpen.value = false
}
function showAllScenes() {
  showHidden.value = false; fTier.value = 'all'; sortBy.value = 'smart'; filtersOpen.value = false
}
function applyMoodRail(q: string) { searchQuery.value = q; activeTheme.value = 'all'; nextTick(() => document.getElementById('sceneSearch')?.focus()) }
function resetFilters() {
  searchQuery.value=''; activeTheme.value='all'; fChar.value='all'; fSeason.value='all'
  fTime.value='all'; fSeries.value='all'; fRating.value='all'; fTier.value=defaultTier; sortBy.value='smart'; showHidden.value=false
}
function onMatureChange() {
  if (showMature.value && !confirm('此区域包含成人向文字内容。请确认你已成年并希望继续查看。')) { showMature.value=false; return }
  localStorage.setItem(MATURE_KEY, showMature.value?'1':'0')
}

async function init() {
  dataReady = false
  loading.value = true
  loadError.value = ''
  try {
    // 场景库按需拉取：默认只载入"人设核心"子集（index + shared + core），
    // 切到具体角色时只拉对应分片，切到全库/精选等才拉完整三片。
    const charParam = typeof route.query.character === 'string' ? route.query.character : null
    if (['nene', 'natsume', 'triad'].includes(charParam || '')) fChar.value = charParam!
    const personalDefault = Object.keys(localUsage.value).length || favs.value.size
    if (charParam && ['nene', 'natsume', 'triad'].includes(charParam)) {
      await sceneStore.loadCharacter(charParam)
    } else if (personalDefault) {
      await sceneStore.load()
    } else {
      await sceneStore.ensureCore()
    }
    if (sceneStore.error) throw new Error(sceneStore.error)
    scenes.value = sceneStore.scenes as ExplorerScene[]
    curation.value = sceneStore.curation || curation.value
  } catch(e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }

  try {
    const fallback = () => { try { return buildPreferenceProfile(JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')) } catch { return buildPreferenceProfile([]) } }
    try {
      await kvInit()
      const h = await kvGet<unknown[]>(HISTORY_KEY)
      profile.value = Array.isArray(h) ? buildPreferenceProfile(h) : fallback()
    } catch { profile.value = fallback() }
  } catch {}

  loading.value = false

  const focusId = typeof route.query.scene === 'string' ? route.query.scene : null
  dataReady = true
  if (focusId) {
    await nextTick()
    const el = document.querySelector(`[data-scene-id="${focusId}"]`) as HTMLElement
    if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); flashId.value=focusId; setTimeout(()=>flashId.value='',2000) }
  }
}

watch([fChar, fTier], async () => {
  if (!dataReady) return
  loading.value = true
  try {
    if (fChar.value !== 'all') {
      await sceneStore.ensureCharacter(fChar.value)
    } else if (fTier.value === 'core') {
      await sceneStore.ensureCore()
    } else {
      await sceneStore.load()
    }
    if (sceneStore.error) throw new Error(sceneStore.error)
    scenes.value = sceneStore.scenes as ExplorerScene[]
    curation.value = sceneStore.curation || curation.value
    loadError.value = ''
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

onMounted(() => { init() })
</script>

<style scoped>
.page { --page-max: 1100px; }
.subtitle { margin-bottom:0; }

.scene-atlas { position:relative; overflow:hidden; display:grid; grid-template-columns:minmax(0,.9fr) minmax(340px,1.1fr); gap:var(--s-5); margin-bottom:var(--s-5); padding:var(--s-5); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:linear-gradient(120deg,var(--archive-blue-soft),transparent 58%),linear-gradient(145deg,var(--glass-highlight),transparent 28%),var(--bg-surface); box-shadow:var(--shadow-glass-sm); }
.scene-atlas::before { content:"SCENE"; position:absolute; left:-.04em; bottom:-.22em; color:color-mix(in srgb,var(--text-primary) 4%,transparent); font:800 clamp(4rem,10vw,8rem) var(--font-mono); letter-spacing:-.08em; pointer-events:none; }
.scene-atlas-copy { position:relative; z-index:var(--z-raised); display:flex; flex-direction:column; justify-content:center; min-width:0; }
.scene-atlas-register { display:grid; grid-template-columns:auto auto 1fr; align-items:center; gap:var(--s-3); margin-bottom:var(--s-5); color:var(--text-muted); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.12em; text-transform:uppercase; }
.scene-atlas-register strong { color:var(--archive-blue); font-size:var(--fs-title); line-height:1; }
.scene-atlas-register span:last-child { justify-self:end; color:var(--text-secondary); }
.scene-atlas .title { max-width:8ch; margin-bottom:var(--s-3); font-size:clamp(2.6rem,4.4vw,4.05rem); line-height:.98; letter-spacing:-.06em; }
.scene-atlas .subtitle { max-width:38rem; color:var(--text-secondary); line-height:1.7; }
.scene-atlas-particles { min-height:330px; border-left:1px solid var(--border-soft); }
.curation-intro { display:flex; flex-direction:column; justify-content:center; }
.curation-intro { margin-top:var(--s-5); padding-top:var(--s-4); border-top:1px solid var(--border-soft); }
.curation-kicker { display:flex; align-items:center; gap:var(--s-2); color:var(--archive-blue); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.13em; text-transform:uppercase; }
.curation-intro h2 { margin:var(--s-1) 0 var(--s-1); font-size:var(--fs-title-xs); }
.curation-intro p { margin:0; color:var(--text-muted); font-size:var(--fs-label); line-height:1.6; }
.mood-rails { position:relative; z-index:var(--z-raised); grid-column:1 / -1; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s-2); padding-top:var(--s-4); border-top:1px solid var(--border-soft); }
.mood-rail { position:relative; overflow:hidden; min-height:96px; padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-lg); color:var(--text-primary); text-align:left; background:var(--bg-elevated); cursor:pointer; box-shadow:inset 0 1px 0 var(--glass-highlight); transition:transform var(--t-fast) var(--ease-out),border-color var(--t-fast),box-shadow var(--t-fast); }
.mood-rail.nene { background:linear-gradient(135deg,color-mix(in srgb,var(--nene-violet) 20%,transparent),color-mix(in srgb,var(--accent) 8%,transparent)),var(--bg-elevated); }
.mood-rail.natsume { background:linear-gradient(135deg,color-mix(in srgb,var(--natsume-amber) 20%,transparent),color-mix(in srgb,var(--text-primary) 10%,transparent)),var(--bg-elevated); }
.mood-rail:hover { border-color:var(--accent); box-shadow:var(--shadow-sm); }
.mood-rail:active { transform:translateY(0) scale(.97); }
@media (hover: hover) and (pointer: fine) {
  .mood-rail:hover { transform:translateY(-3px); }
}
.mood-icon { display:block; font-size:var(--fs-title-sm); margin-bottom:var(--s-1); }
.mood-rail strong { display:block; font-size:var(--fs-body-sm); }
.mood-rail small { color:var(--text-muted); font-size:var(--fs-mono-sm); }

.scene-search-wrap { position:relative; margin-bottom:var(--s-4); }
.scene-search { width:100%; padding:var(--s-3) 42px var(--s-3) var(--s-4); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-lg); color:var(--text-primary); font-size:var(--fs-body); outline:none; transition:border-color var(--t-fast); }
.scene-search:focus { border-color:var(--accent); }
.scene-search::placeholder { color:var(--text-muted); }
.scene-search-clear { position:absolute; top:50%; right:9px; transform:translateY(-50%); width:28px; height:28px; border:0; border-radius:50%; background:transparent; color:var(--text-muted); cursor:pointer; font-size:var(--fs-body-lg); }
.scene-search-clear:hover { color:var(--accent); background:var(--accent-soft); }
.search-intent { min-height:22px; margin:-10px var(--s-1) var(--s-3); color:var(--text-muted); font-size:var(--fs-label-sm); }
:deep(.search-intent strong) { color:var(--accent); }

.scene-toolbar {
  position:relative; display:grid; gap:var(--s-3); margin-bottom:var(--s-5);
  padding:var(--s-3);
  border:1px solid color-mix(in srgb,var(--archive-cyan) 18%,var(--border-soft));
  border-radius:var(--r-dossier);
  background:color-mix(in srgb,var(--bg-surface) 88%,transparent);
  box-shadow:var(--shadow-glass-sm);
  -webkit-backdrop-filter:blur(20px) saturate(130%);
  backdrop-filter:blur(20px) saturate(130%);
}
.scene-toolbar::before { content:''; position:absolute; top:-1px; left:var(--s-4); width:42px; height:var(--line-hairline); background:var(--archive-cyan); }
.toolbar-primary { display:flex; align-items:center; gap:var(--s-2); flex-wrap:wrap; }
.toolbar-primary .scene-search-wrap { flex:1 1 260px; min-width:0; margin:0; }
.toolbar-primary .scene-count { color:var(--text-muted); font:600 var(--fs-mono-sm) var(--font-mono); white-space:nowrap; }
.toolbar-primary .scene-count strong { color:var(--accent); }
.scene-personal-nav {
  display:flex; align-items:center; gap:var(--s-2); overflow-x:auto;
  padding-bottom:2px; scrollbar-width:thin;
}
.scene-personal-label {
  flex:0 0 auto; margin-right:2px; color:var(--text-muted);
  font:700 var(--fs-mono-xs) var(--font-mono); letter-spacing:.08em; text-transform:uppercase;
}
.scene-personal-nav button {
  flex:0 0 auto; min-height:34px; padding:0 13px;
  border:1px solid var(--border-soft); border-radius:var(--r-terminal);
  background:var(--bg-elevated); color:var(--text-secondary);
  font:650 var(--fs-label-sm) var(--font-sans); cursor:pointer;
  transition:border-color var(--t-fast),background var(--t-fast),color var(--t-fast);
}
.scene-personal-nav button:hover {
  border-color:color-mix(in srgb,var(--accent) 45%,var(--border-soft)); color:var(--accent);
}
.scene-personal-nav button.active {
  border-color:var(--accent); background:var(--accent-soft); color:var(--accent);
}
.filter-toggle {
  display:inline-flex; align-items:center; gap:6px; min-height:36px; padding:0 14px;
  border:1px solid var(--border-soft); border-radius:var(--r-terminal);
  background:transparent; color:var(--text-secondary);
  font:650 var(--fs-label-sm) var(--font-sans); cursor:pointer;
  transition:border-color var(--t-fast),background var(--t-fast),color var(--t-fast);
}
.filter-toggle:hover, .filter-toggle.active {
  border-color:color-mix(in srgb,var(--accent) 40%,var(--border-soft));
  background:var(--accent-soft); color:var(--accent);
}
.facet-badge {
  display:inline-grid; place-items:center; min-width:18px; height:18px; padding:0 5px;
  border-radius:var(--r-pill); background:var(--accent); color:var(--text-inverse);
  font:700 var(--fs-mono-xs) var(--font-mono);
}
.scene-facet-panel {
  display:grid; gap:var(--s-3); padding:var(--s-3);
  border:var(--line-hairline) solid var(--border-soft);
  border-radius:var(--r-terminal);
  background:color-mix(in srgb,var(--bg-deep) 54%,transparent);
  animation:facetIn .22s var(--ease-out) both;
}
@keyframes facetIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion:reduce) { .scene-facet-panel { animation:none; } }
.scene-filter-label { font-size:var(--fs-label-xs); color:var(--text-muted); font-weight:700; letter-spacing:.08em; text-transform:uppercase; margin-bottom:var(--s-2); }
.scene-cats { display:flex; flex-wrap:wrap; gap:0; border-bottom:var(--line-hairline) solid var(--border-soft); }
.scene-cat { appearance:none; position:relative; padding:7px 15px; border:0; background:transparent; color:var(--text-secondary); cursor:pointer; font:500 var(--fs-body-sm) var(--font-sans); transition:background var(--t-fast),color var(--t-fast); }
.scene-cat:hover { border-color:var(--accent); color:var(--accent); }
.scene-cat.active { background:color-mix(in srgb,var(--archive-blue-soft) 78%,transparent); color:var(--archive-cyan); }
.scene-cat.active::after { content:''; position:absolute; right:15px; bottom:calc(0px - var(--line-hairline)); left:15px; height:2px; background:var(--archive-cyan); }
/* 合并后一个面板里有 7 个字段，4 列更紧凑 */
.scene-facet-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--s-3); }
.scene-filter-field { display:grid; gap:var(--s-1); color:var(--text-muted); font-size:var(--fs-label-xs); font-weight:600; }
.scene-filter-field select { width:100%; padding:8px 10px; background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font:500 var(--fs-label) var(--font-sans); outline:none; }
.scene-filter-field select:focus { border-color:var(--accent); }
.scene-more-filters { border:1px solid var(--border-soft); border-radius:var(--r-md); background:var(--bg-surface); overflow:hidden; }
.scene-more-filters summary { list-style:none; display:flex; align-items:center; justify-content:space-between; gap:var(--s-3); padding:var(--s-3); color:var(--text-secondary); cursor:pointer; font-size:var(--fs-label); font-weight:650; }
.scene-more-filters summary::-webkit-details-marker { display:none; }
.scene-more-filters summary:hover { color:var(--text-primary); background:var(--accent-soft); }
.scene-more-filters summary::after { content:'＋'; color:var(--text-muted); }
.scene-more-filters[open] summary::after { content:'−'; }
.scene-more-filters .scene-facet-grid { padding:0 var(--s-3) var(--s-3); grid-template-columns:repeat(4,minmax(0,1fr)); }
.scene-filter-meta { display:flex; align-items:center; justify-content:space-between; gap:var(--s-3); flex-wrap:wrap; padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-md); background:var(--bg-surface); }
.mature-toggle { display:inline-flex; align-items:center; gap:var(--s-2); color:var(--text-secondary); cursor:pointer; font-size:var(--fs-body-sm); }
.mature-toggle input { accent-color:var(--accent); width:17px; height:17px; }
.scene-count { color:var(--text-secondary); font-size:var(--fs-label); }
:deep(.scene-count strong) { color:var(--accent); }
.scene-reset { border:0; background:transparent; color:var(--text-muted); cursor:pointer; font:600 var(--fs-label-sm) var(--font-sans); }
.scene-reset:hover { color:var(--accent); }

.scene-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:var(--s-4); }
.scene-load { display:flex; justify-content:center; margin-top:var(--s-5); }
.scene-fav.saved { color:var(--accent); border-color:var(--accent); background:var(--accent-soft); }
.scene-flash { outline:3px solid var(--accent); outline-offset:var(--s-1); }

.ex-scene-line { display:flex; align-items:center; flex-wrap:wrap; gap:var(--s-1); margin:0 0 var(--s-2); color:var(--text-muted); font-size:var(--fs-mono-sm); }
.ex-scene-line strong { color:var(--accent); font-weight:750; }
.ex-scene-line span+span::before { content:'·'; margin-right:var(--s-1); color:var(--border-strong); }
.ex-curation { margin:0 0 var(--s-2); color:var(--text-secondary); font-size:var(--fs-label-sm); line-height:1.55; }
.ex-actions { display:flex; gap:var(--s-2); margin-top:var(--s-1); }
.ex-actions .btn { flex:1; justify-content:center; font-weight:700; }
.ex-actions .scene-hide-action { flex:0 0 auto; font-weight:600; }
.ex-more { display:grid; gap:var(--s-2); margin-top:var(--s-2); max-height:0; opacity:0; overflow:hidden; transition:max-height var(--t-base) var(--ease-out),opacity var(--t-fast); }
:deep(.sc:hover) .ex-more, :deep(.sc:focus-within) .ex-more { max-height:160px; opacity:1; }
.ex-decision { display:flex; align-items:center; flex-wrap:wrap; gap:var(--s-2); padding:var(--s-2) var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-md); background:var(--bg-deep); color:var(--text-secondary); font-size:var(--fs-mono-sm); }
.ex-decision::before { content:'镜头'; color:var(--text-muted); font:750 var(--fs-mono-xs) var(--font-mono); letter-spacing:.08em; }
.ex-decision span+span::before { content:'·'; margin-right:var(--s-1); color:var(--border-strong); }
.ex-decision strong { color:var(--text-primary); font-weight:650; }
.ex-secondary { display:flex; gap:var(--s-1); flex-wrap:wrap; }
.ex-secondary .btn { flex:1; justify-content:center; min-width:0; }

.story-drawer { position:fixed; inset:0; z-index:var(--z-overlay); display:none; align-items:center; justify-content:center; padding:var(--s-4); background:var(--art-backdrop); backdrop-filter:blur(6px); }
.story-drawer.open { display:flex; }
.story-card { width:100%; max-width:480px; padding:var(--s-5); border:1px solid var(--accent); border-radius:var(--r-xl); background:var(--bg-elevated); box-shadow:var(--shadow-lg); }
.story-card h3 { margin-bottom:var(--s-2); color:var(--text-primary); font-size:var(--fs-title-sm); font-weight:800; }
.story-meta { margin-bottom:var(--s-3); color:var(--text-muted); font-size:var(--fs-label-sm); }
.story-body { margin-bottom:var(--s-4); color:var(--text-secondary); font-size:var(--fs-body); line-height:1.7; }
.story-actions { display:flex; gap:var(--s-2); }
.story-actions .btn { flex:1; }

:deep(.sc-tier) { flex:0 0 auto; padding:1px var(--s-2); border:1px solid var(--accent); border-radius:var(--r-pill); color:var(--accent); font-size:var(--fs-mono-sm); font-weight:800; }
:deep(.sc-tier.personal) { color:var(--success); border-color:color-mix(in srgb,var(--success) 70%,var(--border-soft)); }
:deep(.sc-tier.signature) { color:var(--natsume-amber); border-color:var(--natsume-amber); }

@media (max-width:768px) {
  .scene-grid { grid-template-columns:minmax(0,1fr); }
  .ex-more { max-height:none; opacity:1; overflow:visible; }
  .ex-decision { display:none; }
  .scene-facet-grid { grid-template-columns:1fr 1fr; }
  .scene-more-filters .scene-facet-grid { grid-template-columns:1fr 1fr; }
  .scene-atlas { grid-template-columns:minmax(0,1fr); padding:var(--s-4); }
  .scene-atlas .title { max-width:none; }
  .scene-atlas-particles { min-height:250px; border-left:0; border-top:1px solid var(--border-soft); }
  .mood-rails { display:flex; overflow-x:auto; padding-bottom:3px; }
  .mood-rail { flex:0 0 min(230px,82vw); }
  .scene-cats { flex-wrap:nowrap; overflow-x:auto; padding-bottom:4px; }
  .scene-cat { flex:none; }
}
@media (max-width:420px) {
  .scene-facet-grid { grid-template-columns:1fr; }
  .scene-atlas-register { grid-template-columns:auto auto; }
  .scene-atlas-register span:last-child { display:none; }
}
@media (prefers-reduced-transparency:reduce) {
  .scene-atlas { background:var(--bg-surface); }
}
</style>
