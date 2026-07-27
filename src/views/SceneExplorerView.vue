<template>
  <article class="page" style="--page-max: 1100px;">
    <div class="page-kicker">Scene discovery</div>
    <h1 class="title">灵感场景</h1>
    <p class="subtitle">宁宁的月光秘密，夏目的夜灯关心。这里整理了 <strong>{{ scenes.length }} 个精选场景</strong>，优先给你真正值得开画的瞬间。</p>

    <section class="curation-panel" aria-label="场景灵感精选">
      <div class="curation-intro">
        <span class="curation-kicker">Nene × Natsume</span>
        <h2>从角色的心情，走进场景</h2>
        <p>宁宁的柔软慌乱、夏目的克制关心，才是灵感场景真正的索引。</p>
      </div>
      <div class="mood-rails" aria-live="polite">
        <button v-for="rail in moodRails" :key="rail.title" type="button" class="mood-rail"
          :class="[rail.character === 'nene' || rail.character === 'natsume' ? rail.character : '']"
          @click="applyMoodRail(rail.query)">
          <span class="mood-icon">{{ rail.icon || '✦' }}</span>
          <strong>{{ rail.title }}</strong><small>{{ rail.subtitle }}</small>
        </button>
      </div>
    </section>

    <label class="sr-only" for="sceneSearch">搜索场景</label>
    <div class="scene-search-wrap">
      <input v-model="searchQuery" type="search" class="scene-search" id="sceneSearch"
        placeholder="🔍 试试：心动、安静、宁宁经典感、夏目经典感" />
      <button class="scene-search-clear" type="button" aria-label="清空" @click="searchQuery = ''">×</button>
    </div>
    <div class="search-intent" aria-live="polite" v-html="intentHtml"></div>

    <div class="scene-toolbar">
      <div>
        <div class="scene-filter-label">主题</div>
        <div class="scene-cats">
          <button v-for="d in THEME_DEFS" :key="d.id" type="button" class="scene-cat"
            :class="{ active: activeTheme === d.id }"
            :aria-pressed="activeTheme === d.id ? 'true' : 'false'"
            @click="activeTheme = d.id">{{ d.icon }} {{ d.label }} {{ themeCount(d.id) }}</button>
        </div>
      </div>
      <div class="scene-facet-grid">
        <label class="scene-filter-field">角色<select v-model="fChar"><option value="all">全部角色</option><option value="nene">🌸 宁宁</option><option value="natsume">🍂 夏目</option><option value="triad">🌸🍂 双人</option></select></label>
        <label class="scene-filter-field">季节<select v-model="fSeason"><option value="all">全部季节</option><option value="春">🌸 春</option><option value="夏">☀️ 夏</option><option value="秋">🍂 秋</option><option value="冬">❄️ 冬</option></select></label>
        <label class="scene-filter-field">时段<select v-model="fTime"><option value="all">全部时段</option><option value="morning">清晨</option><option value="afternoon">午后</option><option value="sunset">黄昏</option><option value="night">夜晚与深夜</option><option value="dawn">黎明</option></select></label>
      </div>
      <details class="scene-more-filters">
        <summary>更多筛选与排序</summary>
        <div class="scene-facet-grid">
          <label class="scene-filter-field">系列<select v-model="fSeries"><option value="all">全部系列</option><option value="after">After Story</option><option value="fanwork">同人</option><option value="active">Active Sync</option></select></label>
          <label class="scene-filter-field">分级<select v-model="fRating"><option value="all">全部分级</option><option value="All">全年龄</option><option value="R15">R15</option><option value="R18">R18</option></select></label>
          <label class="scene-filter-field">层级<select v-model="fTier"><option value="featured">招牌与精选</option><option value="signature">只看招牌</option><option value="curated">只看精选</option><option value="all">完整库</option></select></label>
          <label class="scene-filter-field">排序<select v-model="sortBy"><option value="smart">✨ 智能推荐</option><option value="curated">主理人精选</option><option value="favorite">我的收藏</option><option value="newest">最新加入</option><option value="title">名称A-Z</option></select></label>
        </div>
      </details>
      <div class="scene-filter-meta">
        <label class="mature-toggle"><input type="checkbox" v-model="showMature" @change="onMatureChange" /> 显示成人内容 <span>({{ matureCount }})</span></label>
        <span class="scene-count" role="status" aria-live="polite">显示 <strong>{{ Math.min(visible, filtered.length) }}</strong> / {{ filtered.length }} 个场景</span>
        <button class="scene-reset" type="button" @click="resetFilters">重置全部筛选</button>
      </div>
    </div>

    <div class="scene-grid">
      <div v-if="loading" class="sc-empty"><div class="ic">⏳</div><p>正在加载灵感场景…</p></div>
      <div v-else-if="paged.length === 0" class="sc-empty"><div class="ic">🌸</div><p>没有匹配的场景。<br/>试试切到其他分类或清除搜索。</p></div>
      <template v-else>
        <SceneCard v-for="s in paged" :key="s.id" :scene="s" mode="grid" :clickable="false" suppressTags
          :class="flashId === s.id ? 'scene-flash' : ''" :data-scene-id="s.id">
          <template #band>
            <span v-if="tier(s) === 'signature'" class="sc-tier signature">招牌</span>
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
              <RouterLink :to="'/prompt-builder?scene=' + encodeURIComponent(s2.id)" class="btn btn-primary">✦ 开始绘制</RouterLink>
            </div>
            <div class="ex-more">
              <div class="ex-decision">
                <span>镜头 <strong>{{ dv(s2).shot }}</strong></span>
                <span>光线 <strong>{{ dv(s2).lighting }}</strong></span>
                <span>色调 <strong>{{ dv(s2).color }}</strong></span>
              </div>
              <div class="ex-secondary">
                <a class="btn btn-ghost btn-sm" :href="'/prompt-builder?scene=' + encodeURIComponent(s2.id) + '&quick=1'">⚡ 直接出图</a>
                <button class="btn btn-ghost btn-sm" type="button" @click.stop="drawerScene = s2">📖 故事</button>
                <button class="btn btn-ghost btn-sm scene-fav" :class="{ saved: favs.has(s2.id) }"
                  type="button" @click.stop="toggleFav(s2.id)">{{ favs.has(s2.id) ? '♥ 已收' : '♡ 收藏' }}</button>
              </div>
            </div>
          </template>
        </SceneCard>
      </template>
    </div>
    <div v-show="visible < filtered.length" class="scene-load">
      <button class="btn btn-ghost" type="button" @click="visible += PAGE_SIZE">
        加载更多（剩余 {{ filtered.length - visible }}）
      </button>
    </div>
  </article>

  <Teleport to="body">
    <div v-show="drawerScene" class="story-drawer" :class="{ open: !!drawerScene }" @click.self="drawerScene = null">
      <div class="story-card" v-if="drawerScene">
        <h3>🌸 {{ drawerScene.title }}</h3>
        <div class="story-meta">{{ charName(drawerScene) }} · {{ seasonLabel(drawerScene.season) }} · {{ timeLabel(drawerScene.timeOfDay) }} · {{ drawerScene.emotion }}</div>
        <div class="story-body">{{ drawerScene.story || '' }}</div>
        <div class="story-actions">
          <a class="btn btn-primary" :href="'/prompt-builder?scene=' + encodeURIComponent(drawerScene.id) + '&quick=1'">⚡ 快速出图</a>
          <RouterLink class="btn btn-ghost" :to="'/prompt-builder?scene=' + encodeURIComponent(drawerScene.id) + '&step=4&generate=1'">🎬 调整后生成</RouterLink>
          <button class="btn btn-ghost" type="button" @click="drawerScene = null">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SceneCard from '@/components/SceneCard.vue'

import { tier as uxTier, matchesSearch as uxMatchesSearch, searchScore as uxSearchScore,
  isPersonalFavorite as uxIsFav, personalScore as uxPersonalScore,
  personalReason as uxPersonalReason, analyzeQuery as uxAnalyze,
  buildPreferenceProfile } from '@/utils/sceneUX'
import { kvInit, kvGet } from '@/composables/useKVStore'

const PAGE_SIZE = 24
const MATURE_KEY = 'aics_show_mature'
const FAV_KEY = 'aics_scene_favorites'
const HISTORY_KEY = 'aics_pb_history'
const LOCAL_OWNER = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)

const THEME_DEFS = [
  { id: 'all',      label: '全部', icon: '✦', categories: [] as string[] },
  { id: 'romance',  label: '恋爱', icon: '♡', categories: ['恋爱'] },
  { id: 'daily',    label: '日常', icon: '☕', categories: ['日常'] },
  { id: 'intimate', label: '亲密', icon: '🌙', categories: ['亲密','R15'] },
  { id: 'school',   label: '校园', icon: '🎓', categories: ['校园'] },
  { id: 'travel',   label: '旅行', icon: '🧳', categories: ['旅行'] },
  { id: 'festival', label: '节日', icon: '🎐', categories: ['祭典・节日'] },
  { id: 'story',    label: '剧情', icon: '🎬', categories: ['战斗','Active Sync'] },
  { id: 'fanwork',  label: '同人', icon: '✧', categories: ['同人'] },
]
const DEFAULT_RAILS = [
  { character:'nene',    icon:'🌙', title:'宁宁的月光秘密', subtitle:'图书馆 · 樱色 · 魔女', query:'nene library' },
  { character:'natsume', icon:'☕', title:'夏目的夜灯关心', subtitle:'咖啡馆 · 雨夜 · 琥珀', query:'natsume cafe'  },
  { character:'shared',  icon:'🌅', title:'夏日远行',       subtitle:'海风 · 黄昏 · 纪念',   query:'beach sunset' },
]

const route = useRoute()
const scenes = ref<any[]>([])
const curation = ref<any>({ curatedSceneIds:[], moodRails:[], signatureSceneIds:[], reviewSceneIds:[] })
const profile = ref<any>({ entries: 0 })
const loading = ref(true)
const flashId = ref('')
const drawerScene = ref<any>(null)
const favs = ref<Set<string>>(new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')))
const showMature = ref(localStorage.getItem(MATURE_KEY) == null ? LOCAL_OWNER : localStorage.getItem(MATURE_KEY) === '1')

const searchQuery = ref('')
const activeTheme = ref('all')
const fChar = ref('all'); const fSeason = ref('all'); const fTime = ref('all')
const fSeries = ref('all'); const fRating = ref('all'); const fTier = ref('featured')
const sortBy = ref('smart')
const visible = ref(PAGE_SIZE)

// --- derived ---
const moodRails = computed(() => curation.value.moodRails?.length ? curation.value.moodRails : DEFAULT_RAILS)
const matureCount = computed(() => scenes.value.filter(s => s.mature).length)

function primaryCat(s: any) { const c = s.category||'其他'; return c==='Active_Sync_Scenes'?'Active Sync':c.split('/')[0] }
function themeDef(id: string) { return THEME_DEFS.find(d=>d.id===id)||THEME_DEFS[0] }
function matchesTheme(s: any, id: string) { return id==='all'||themeDef(id).categories.includes(primaryCat(s)) }
function matchesSeries(s: any, v: string) {
  const c=s.category||''
  if(v==='after') return /After_Story/i.test(c)
  if(v==='fanwork') return /同人/.test(c)
  if(v==='active') return c==='Active_Sync_Scenes'
  return true
}
function matchesTime(s: any, v: string) {
  if(v==='all') return true
  if(v==='night') return ['night','late_night','evening'].includes(s.timeOfDay)
  return s.timeOfDay===v
}
function tier(s: any) { return uxTier(s, curation.value) }
function sigIds(): string[] { return curation.value.signatureSceneIds||[] }
function curIds(): string[] { return curation.value.curatedSceneIds||[] }
function cScore(s: any) {
  if(sigIds().includes(s.id)) return 20000-sigIds().indexOf(s.id)
  const f=curIds().indexOf(s.id); if(f>=0) return 10000-f
  const c=[s.story,s.emotion,s.camera,s.lighting,s.location].filter(Boolean).length
  return c*100+Math.min((s.story||'').length,500)+(s.rating==='All'?20:0)
}
function charName(s: any) {
  const c=s.char||''
  return c==='nene'||c==='ayachi_nene'?'宁宁':c==='natsume'||c==='shiki_natsume'?'夏目':c==='triad'?'双人':c
}
function seasonLabel(v: string) { return ({春:'🌸春',夏:'☀️夏',秋:'🍂秋',冬:'❄️冬'} as any)[v]||v||'' }
function timeLabel(v: string) {
  return ({morning:'清晨',afternoon:'午后',sunset:'黄昏',night:'夜晚',late_night:'深夜',dawn:'黎明',evening:'夜晚',all_day:'全天'} as any)[v]||v||''
}
function personalReason(s: any) {
  const r = uxPersonalReason(s, profile.value) || (curation.value.recommendationReasons||{})[s.id] || ''
  return /实机生成与直接视觉复核/.test(r) ? '' : r
}
function themeCount(id: string) {
  return scenes.value.filter(s=>(showMature.value||!s.mature)&&matchesTheme(s,id)).length
}
function dv(s: any) {
  const cm: any={半身中景:'半身',全身远景:'远景',全身中景:'全身',特写:'特写',特写镜头:'特写',面部特写:'特写',远景:'远景',中景:'半身',全身:'全身',半身:'半身'}
  const lm: any={窗光:'窗光',黄金时刻:'黄昏光',逆光:'逆光',月光:'月光',夜灯:'夜灯',霓虹:'霓虹',烛光:'烛光',阴天:'阴天光',夕阳光:'黄昏光',晨光:'晨光'}
  const ca=String(s.camera||'')
  const shot=cm[s.camera]||(/第一人称|主观/i.test(ca)?'第一人称':/俯视|俯瞰/.test(ca)?'俯视':/仰视|微仰/.test(ca)?'仰视':/侧面|侧方/.test(ca)?'侧面':/近景|特写/.test(ca)?'特写':/全身|远景/.test(ca)?'远景':'半身')
  const li=String(s.lighting||'')
  const lighting=lm[s.lighting]||(/夕阳|黄昏|黄金|落日/.test(li)?'黄昏光':/逆光|背光/.test(li)?'逆光':/月光|星光/.test(li)?'月光':/窗光|晨光|朝阳/.test(li)?'窗光':/阴天|雨天|漫射/.test(li)?'柔光':/灯|烛|暖光|霓虹/.test(li)?'夜灯':'自然光')
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
  const q = searchQuery.value.trim().toLowerCase()
  let r = scenes.value.filter(s => {
    if (!showMature.value && s.mature) return false
    if (!matchesTheme(s, activeTheme.value)) return false
    if (!matchesSeries(s, fSeries.value)) return false
    if (fChar.value !== 'all' && s.char !== fChar.value) return false
    if (fSeason.value !== 'all' && s.season !== fSeason.value) return false
    if (!matchesTime(s, fTime.value)) return false
    if (fRating.value !== 'all' && (s.rating||(s.mature?'R18':'All')) !== fRating.value) return false
    const t = tier(s)
    if (!q && fTier.value === 'featured' && t !== 'signature' && t !== 'curated') return false
    if (fTier.value !== 'all' && fTier.value !== 'featured' && t !== fTier.value) return false
    if (sortBy.value === 'favorite' && !favs.value.has(s.id) && !uxIsFav(s, profile.value)) return false
    return !q || uxMatchesSearch(s, q, curation.value, [primaryCat(s), timeLabel(s.timeOfDay)])
  })
  return r.sort((a,b) => {
    if (q) {
      const rel = uxSearchScore(b,q,curation.value,[primaryCat(b),timeLabel(b.timeOfDay)])-uxSearchScore(a,q,curation.value,[primaryCat(a),timeLabel(a.timeOfDay)])
      if (rel) return rel
    }
    if (sortBy.value==='newest') return String(b.id).localeCompare(String(a.id),undefined,{numeric:true})
    if (sortBy.value==='title') return String(a.title).localeCompare(String(b.title),'zh-CN')
    if (sortBy.value==='favorite') return uxPersonalScore(b,profile.value)-uxPersonalScore(a,profile.value)
    if (sortBy.value==='smart') return (uxPersonalScore(b,profile.value)*500+cScore(b))-(uxPersonalScore(a,profile.value)*500+cScore(a))
    return cScore(b)-cScore(a)
  })
})
const paged = computed(() => filtered.value.slice(0, visible.value))

const intentHtml = computed(() => {
  const q = searchQuery.value.trim()
  const a = uxAnalyze(q, curation.value)
  const exp = q && fTier.value==='featured' ? '已自动扩展至完整场景库。' : ''
  const understood = a.intents?.length ? `已理解为：<strong>${a.intents.join(' · ')}</strong>。` : (q?'正在搜索标题、故事、情绪、地点和视觉标签。':'可以直接描述想画的完整句子。')
  const personal = profile.value.entries ? ` 已结合本机${profile.value.entries}条创作记录排序。` : ' 完成作品评分后，推荐会逐渐贴近你的偏好。'
  return exp + understood + personal
})

watch([searchQuery, activeTheme, fChar, fSeason, fTime, fSeries, fRating, fTier, sortBy], () => { visible.value = PAGE_SIZE })

function toggleFav(id: string) {
  if (favs.value.has(id)) favs.value.delete(id); else favs.value.add(id)
  favs.value = new Set(favs.value)
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs.value]))
}
function applyMoodRail(q: string) { searchQuery.value = q; activeTheme.value = 'all'; nextTick(() => document.getElementById('sceneSearch')?.focus()) }
function resetFilters() {
  searchQuery.value=''; activeTheme.value='all'; fChar.value='all'; fSeason.value='all'
  fTime.value='all'; fSeries.value='all'; fRating.value='all'; fTier.value='featured'; sortBy.value='smart'
}
function onMatureChange() {
  if (showMature.value && !confirm('此区域包含成人向文字内容。请确认你已成年并希望继续查看。')) { showMature.value=false; return }
  localStorage.setItem(MATURE_KEY, showMature.value?'1':'0')
}
function onKey(e: KeyboardEvent) { if (e.key==='Escape') drawerScene.value=null }

async function init() {
  try {
    const [s, c] = await Promise.all([
      fetch('/data/scenes.json?v=9').then(r=>r.json()),
      fetch('/data/curation.json?v=3').then(r=>r.json()).catch(()=>({}))
    ])
    scenes.value = Array.isArray(s) ? s : []
    curation.value = c || curation.value
  } catch(e) { console.warn('scene load failed', e) }

  try {
    const fallback = () => { try { return buildPreferenceProfile(JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')) } catch { return buildPreferenceProfile([]) } }
    try {
      await kvInit()
      const h = await kvGet<any[]>(HISTORY_KEY)
      profile.value = Array.isArray(h) ? buildPreferenceProfile(h) : fallback()
    } catch { profile.value = fallback() }
  } catch {}

  loading.value = false

  const qp = new URLSearchParams(route.query as any)
  const focusId = qp.get('scene')
  const charParam = qp.get('character')
  if (['nene','natsume','triad'].includes(charParam||'')) fChar.value = charParam!
  if (focusId) {
    const pending = localStorage.getItem('aics_pending_scene')
    localStorage.removeItem('aics_pending_scene')
    if (pending) { try { const p=JSON.parse(pending); if(p.id===focusId) drawerScene.value=p } catch {} }
    else {
      await nextTick()
      const el = document.querySelector(`[data-scene-id="${focusId}"]`) as HTMLElement
      if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); flashId.value=focusId; setTimeout(()=>flashId.value='',2000) }
    }
  }
}

onMounted(() => { document.addEventListener('keydown', onKey); init() })
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.page { --page-max: 1100px; }
.subtitle { margin-bottom: var(--s-6); }

.curation-panel { display:grid; grid-template-columns:minmax(220px,.9fr) 2fr; gap:var(--s-4); margin:-10px 0 var(--s-5); padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:linear-gradient(120deg,var(--accent-soft),transparent 62%),var(--bg-surface); box-shadow:var(--shadow-sm); }
.curation-intro { display:flex; flex-direction:column; justify-content:center; }
.curation-kicker { display:flex; align-items:center; gap:8px; color:var(--text-muted); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.13em; text-transform:uppercase; }
.curation-intro h2 { margin:var(--s-1) 0 2px; font-size:var(--fs-title-xs); }
.curation-intro p { margin:0; color:var(--text-muted); font-size:var(--fs-label); line-height:1.6; }
.mood-rails { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s-2); }
.mood-rail { position:relative; overflow:hidden; min-height:96px; padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-lg); color:var(--text-primary); text-align:left; background:var(--bg-elevated); cursor:pointer; transition:transform var(--t-fast),border-color var(--t-fast); }
.mood-rail.nene { background:linear-gradient(135deg,color-mix(in srgb,var(--nene-violet) 20%,transparent),color-mix(in srgb,var(--accent) 8%,transparent)),var(--bg-elevated); }
.mood-rail.natsume { background:linear-gradient(135deg,color-mix(in srgb,var(--natsume-amber) 20%,transparent),color-mix(in srgb,var(--text-primary) 10%,transparent)),var(--bg-elevated); }
.mood-rail:hover { transform:translateY(-3px); border-color:var(--accent); box-shadow:var(--shadow-sm); }
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

.scene-toolbar { display:grid; gap:var(--s-3); margin-bottom:var(--s-5); }
.scene-filter-label { font-size:var(--fs-label-xs); color:var(--text-muted); font-weight:700; letter-spacing:.08em; text-transform:uppercase; margin-bottom:var(--s-2); }
.scene-cats { display:flex; flex-wrap:wrap; gap:var(--s-2); }
.scene-cat { appearance:none; padding:6px 16px; border:1px solid var(--border-soft); background:var(--bg-surface); color:var(--text-secondary); border-radius:var(--r-pill); cursor:pointer; font:500 var(--fs-body-sm) var(--font-sans); transition:border-color var(--t-fast),background var(--t-fast),color var(--t-fast); }
.scene-cat:hover { border-color:var(--accent); color:var(--accent); }
.scene-cat.active { background:var(--accent); color:var(--text-inverse); border-color:var(--accent); }
.scene-facet-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s-3); }
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
:deep(.sc-tier.signature) { color:var(--natsume-amber); border-color:var(--natsume-amber); }

@media (max-width:768px) {
  .scene-grid { grid-template-columns:minmax(0,1fr); }
  .ex-more { max-height:none; opacity:1; overflow:visible; }
  .ex-decision { display:none; }
  .scene-facet-grid { grid-template-columns:1fr 1fr; }
  .scene-more-filters .scene-facet-grid { grid-template-columns:1fr 1fr; }
  .curation-panel { grid-template-columns:1fr; }
  .mood-rails { display:flex; overflow-x:auto; padding-bottom:3px; }
  .mood-rail { flex:0 0 min(230px,82vw); }
  .scene-cats { flex-wrap:nowrap; overflow-x:auto; padding-bottom:4px; }
  .scene-cat { flex:none; }
}
@media (max-width:420px) { .scene-facet-grid { grid-template-columns:1fr; } }
</style>
