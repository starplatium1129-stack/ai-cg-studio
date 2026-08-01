<template>
  <article class="page showcase-page">
    <a @click.prevent="$router.push('/')" href="/" class="nav-back">← 回首页</a>
    <ArchivePageHero
      class="showcase-archive"
      chapter="05"
      section="Approved works"
      shape="atelier"
      label="审核样张档案的工作室粒子标记"
      caption="SHOWCASE 05 / 08"
    >
      <div class="showcase-copy">
        <div class="page-kicker">Approved Scene Gallery</div>
        <h1>定稿样张 · Verified Showcase</h1>
        <p>每一幅均为当前模型组合真实生成、经人工细致复核后收录的定稿样张。先观成片，再觅心动。</p>
        <div class="hero-actions">
          <button class="btn btn-ghost" type="button" :disabled="!entries.length" @click="openRandom">↻ 随机翻一张</button>
          <RouterLink class="btn btn-ghost" to="/scene-explorer">去灵感场景</RouterLink>
        </div>
        <div class="hero-stats">
          <div class="hero-stat"><strong>{{ stats.total }}</strong><span>审核通过样张</span></div>
          <div class="hero-stat"><strong>{{ stats.safe }}</strong><span>全年龄</span></div>
          <div class="hero-stat"><strong>{{ stats.r15 }}</strong><span>R15</span></div>
        </div>
      </div>
    </ArchivePageHero>

    <div class="toolbar-shell" aria-label="样张筛选" data-reveal>
      <div class="search-row">
        <div class="search-field">
          <input v-model="searchQuery" type="search" class="scene-search" id="showcaseSearch" placeholder="搜索场景、情绪、角色或关键词…" />
          <button class="scene-search-clear" type="button" aria-label="清空" @click="searchQuery=''">×</button>
        </div>
        <div class="filter-group">
          <button v-for="opt in SCOPE_OPTS" :key="opt.v" class="filter-pill" :class="{active:scope===opt.v}" type="button" @click="scope=opt.v">{{ opt.l }}</button>
        </div>
        <div class="filter-group">
          <button v-for="opt in CHAR_OPTS" :key="opt.v" class="filter-pill" :class="{active:charFilter===opt.v}" type="button" @click="charFilter=opt.v">{{ opt.l }}</button>
        </div>
        <div class="filter-group">
          <button v-for="opt in RATING_OPTS" :key="opt.v" class="filter-pill" :class="{active:ratingFilter===opt.v}" type="button" @click="ratingFilter=opt.v">{{ opt.l }}</button>
        </div>
        <span class="result-meta" id="resultMeta">
          显示 <strong>{{ paged.length }}</strong> / {{ filtered.length }} 个匹配样张 · R18 默认模糊
        </span>
      </div>
    </div>

    <ArchiveStatePanel
      v-if="unavailable"
      class="empty empty-block"
      kind="error"
      title="展示素材暂未连接"
      message="重新启动控制面板后会自动连接 AI/SceneShowcase 中最新的审核展示集。"
    >
      <RouterLink class="btn btn-primary" to="/scene-explorer">先逛灵感场景</RouterLink>
    </ArchiveStatePanel>

    <ArchiveStatePanel
      v-else-if="manifestLoading"
      class="empty empty-block"
      kind="empty"
      title="正在读取样张目录…"
      message="连接 AI/SceneShowcase 审核展示集。"
    >
      <span class="btn btn-ghost" aria-disabled="true">加载中</span>
    </ArchiveStatePanel>

    <ArchiveStatePanel
      v-else-if="!filtered.length"
      kind="empty"
      title="这批样张里没有你要的"
      message="换个关键词或筛选，我再帮你找找看。"
    >
      <button class="btn btn-ghost" type="button" @click="resetFilters">重置筛选</button>
    </ArchiveStatePanel>

    <div v-else class="showcase-grid stagger-container" data-reveal data-reveal-delay="1">
      <article
        v-for="entry in paged" :key="entry.id"
        class="sample" :class="{ 'sample-r18': entry.rating === 'R18' }"
        :data-rating="entry.rating"
      >
        <button class="sample-visual" type="button" :aria-label="'查看 ' + entry.title + ' 大图'" @click="openViewer(entry.id)">
          <img v-if="!brokenThumbs.has(entry.id)" class="sample-image" :class="{ 'sample-image-ready': loadedThumbs.has(entry.id) }" :src="thumbSrc(entry)" :alt="entry.title"
            loading="lazy" decoding="async" @load="markThumbLoaded(entry)" @error="markThumbError(entry)" />
          <span v-else class="sample-image-fallback" aria-hidden="true">✦</span>
          <span class="sample-shade"></span>
          <span class="sample-badges">
            <span v-if="featured.has(entry.id)" class="sample-badge">精选</span>
            <span v-else></span>
            <span class="sample-badge" :class="'rating-' + entry.rating">{{ ratingLabel(entry.rating) }}</span>
          </span>
          <span v-if="entry.rating === 'R18'" class="sample-sensitive">
            <strong>R18</strong><span>悬停或聚焦预览</span>
          </span>
          <span class="sample-caption">
            <span class="sample-kicker">
              <span>{{ entry.id }} · {{ charLabel(entry.char) }}</span>
              <span>✓ {{ entry.attempt }} 次通过</span>
            </span>
            <strong class="sample-title">{{ entry.title }}</strong>
          </span>
        </button>
      </article>
    </div>

    <div v-show="paged.length < filtered.length" class="load-wrap">
      <button class="btn btn-ghost load-more" type="button" @click="visibleCount += PAGE_SIZE">加载更多</button>
    </div>

    <!-- 查看器 dialog -->
    <Teleport to="body">
      <!-- 必须用 showModal() 打开（见 watch(currentEntry)）：
           设 open 属性只是非模态 dialog —— 没有 top layer、没有 ::backdrop、
           背景不 inert，Tab 能直接跑到下面的网格里 -->
      <dialog ref="dialogEl" class="showcase-viewer" aria-label="样张查看器" @click.self="closeViewer" @cancel.prevent="closeViewer">
        <div v-if="currentEntry" class="viewer-layout">
          <div class="viewer-art">
            <img v-if="!viewerImageFailed" :class="{ 'viewer-image-ready': viewerImageReady }" :src="imgSrc(currentEntry)" :alt="currentEntry.title"
              @load="viewerImageReady = true" @error="viewerImageFailed = true" />
            <div v-else class="viewer-image-fallback">图片暂时无法读取</div>
          </div>
          <div class="viewer-copy">
            <button class="viewer-close" type="button" id="viewerClose" aria-label="关闭大图" @click="closeViewer">×</button>
            <div class="viewer-kicker">Artwork</div>
            <h2>{{ currentEntry.title }}</h2>
            <div class="viewer-meta">
              <span>{{ currentEntry.id }}</span>
              <span>{{ charLabel(currentEntry.char) }}</span>
              <span>{{ ratingLabel(currentEntry.rating) }}</span>
              <span>{{ currentEntry.category }}</span>
              <span>✓ {{ currentEntry.attempt }} 次通过</span>
            </div>
            <div class="viewer-story">{{ currentEntry.story }}</div>
            <div class="viewer-actions">
              <RouterLink class="btn btn-primary" :to="'/prompt-builder?scene=' + encodeURIComponent(currentEntry.id) + '&step=4&generate=1'"><ArchiveIcon name="spark" /> 画这个场景</RouterLink>
              <button class="btn btn-ghost" type="button" @click="move(-1)">← 上一张</button>
              <button class="btn btn-ghost" type="button" @click="move(1)">下一张 →</button>
            </div>
          </div>
        </div>
      </dialog>
    </Teleport>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSceneStore } from '@/stores/sceneStore'
import ArchivePageHero from '@/components/visual/ArchivePageHero.vue'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import {
  parseShowcaseManifest,
  type ShowcaseCharacter,
  type ShowcaseEntry,
  type ShowcaseRating,
} from '@/utils/showcaseManifest'

const sceneStore = useSceneStore()
useScrollReveal()

const PAGE_SIZE = 24
const SCOPE_OPTS = [{ v:'all', l:'全部' }, { v:'featured', l:'精选' }] as const
const CHAR_OPTS  = [{ v:'all', l:'全部角色' }, { v:'nene', l:'宁宁' }, { v:'natsume', l:'夏目' }, { v:'triad', l:'双人' }] as const
const RATING_OPTS= [{ v:'all', l:'全部分级' }, { v:'All', l:'全年龄' }, { v:'R15', l:'R15' }, { v:'R18', l:'R18' }] as const
const LABELS: Record<string,string> = { nene:'绫地宁宁', natsume:'四季夏目', triad:'宁宁×夏目', All:'全年龄', R15:'R15', R18:'R18' }

const entries   = ref<ShowcaseEntry[]>([])
const featured  = ref(new Set<string>())
const stats     = ref({ total: '—', safe: '—', r15: '—' })
const unavailable = ref(false)
/** manifest 未返回前显示加载面板，避免闪现错误的"没有匹配样张"空状态 */
const manifestLoading = ref(true)
const searchQuery = ref('')
const scope       = ref<'all' | 'featured'>('all')
const charFilter  = ref<'all' | ShowcaseCharacter>('all')
const ratingFilter= ref<'all' | ShowcaseRating>('all')
const visibleCount= ref(PAGE_SIZE)
const currentId   = ref('')
const dialogEl    = ref<HTMLDialogElement | null>(null)
const brokenThumbs = ref(new Set<string>())
const loadedThumbs = ref(new Set<string>())
const viewerImageFailed = ref(false)
const viewerImageReady = ref(false)

function markThumbLoaded(entry: ShowcaseEntry) {
  if (!loadedThumbs.value.has(entry.id)) {
    loadedThumbs.value = new Set([...loadedThumbs.value, entry.id])
  }
}
const viewerVersion = ref(0)
const imgVersion = Date.now()
const manifestController = new AbortController()
let unmounted = false

// Reset visible count whenever filters change
watch([searchQuery, scope, charFilter, ratingFilter], () => { visibleCount.value = PAGE_SIZE })

function norm(s: string) { return String(s||'').trim().toLocaleLowerCase('zh-CN') }
function ratingLabel(v: string) { return LABELS[v] || v || '未分级' }
function charLabel(v: string) { return LABELS[v] || v || '角色' }
function thumbSrc(entry: ShowcaseEntry) { return `/scene-showcase/thumbs/${encodeURIComponent(entry.id)}.jpg?cv=${imgVersion}` }
function imgSrc(entry: ShowcaseEntry)   { return `/scene-showcase/images/${encodeURIComponent(entry.id)}.jpg?cv=${imgVersion}&v=${viewerVersion.value}` }
function markThumbError(entry: ShowcaseEntry) {
  brokenThumbs.value = new Set([...brokenThumbs.value, entry.id])
}

const filtered = computed(() => {
  const term = norm(searchQuery.value)
  return entries.value.filter(e => {
    if (scope.value === 'featured' && !featured.value.has(e.id)) return false
    if (charFilter.value !== 'all' && e.char !== charFilter.value) return false
    if (ratingFilter.value !== 'all' && e.rating !== ratingFilter.value) return false
    return !term || norm([e.id, e.title, e.story, e.category, charLabel(e.char), ratingLabel(e.rating)].join(' ')).includes(term)
  })
})
const paged = computed(() => filtered.value.slice(0, visibleCount.value))
const currentIdx = computed(() => filtered.value.findIndex(e => e.id === currentId.value))
const currentEntry = computed(() => filtered.value[currentIdx.value] ?? null)

function openViewer(id: string) { currentId.value = id }
function closeViewer() { currentId.value = '' }

/**
 * 真模态由浏览器负责：showModal() 给我们 top layer、inert 背景、
 * 原生焦点约束与 Escape，都是 :open 属性拿不到的。
 */
watch(currentEntry, (entry) => {
  const dialog = dialogEl.value
  if (!dialog) return
  if (entry && !dialog.open) {
    viewerImageFailed.value = false
    viewerImageReady.value = false
    viewerVersion.value = Date.now()
    dialog.showModal()
    document.body.classList.add('overlay-open')
  } else if (entry) {
    viewerImageFailed.value = false
    viewerImageReady.value = false
    viewerVersion.value = Date.now()
  } else if (!entry && dialog.open) {
    dialog.close()
    document.body.classList.remove('overlay-open')
  }
})
function move(step: number) {
  const arr = filtered.value
  if (!arr.length) return
  const next = (currentIdx.value + step + arr.length) % arr.length
  currentId.value = arr[next].id
}
function openRandom() {
  const safe = (ratingFilter.value === 'R18' ? filtered.value : filtered.value.filter(e => e.rating !== 'R18'))
  const src = safe.length ? safe : filtered.value
  if (!src.length) return
  currentId.value = src[Math.floor(Math.random() * src.length)].id
}
function resetFilters() { searchQuery.value = ''; scope.value = 'all'; charFilter.value = 'all'; ratingFilter.value = 'all' }

function onKey(e: KeyboardEvent) {
  if (!currentEntry.value) return
  if (e.key === 'ArrowLeft') move(-1)
  if (e.key === 'ArrowRight') move(1)
  // Escape 交给 <dialog> 原生处理（@cancel），这里不再重复
}

onMounted(async () => {
  unmounted = false
  document.addEventListener('keydown', onKey)
  manifestLoading.value = true
  try {
    // manifest 是样张目录（非 data/），仍单独取；curation 走共享 store
    const [manifest] = await Promise.all([
      fetch('/scene-showcase/manifest.json', { cache: 'no-cache', signal: manifestController.signal }).then(r => { if (!r.ok) throw new Error('showcase ' + r.status); return r.json() }),
      sceneStore.load().catch(() => {})
    ])
    if (unmounted) return
    manifestLoading.value = false
    const parsed = parseShowcaseManifest(manifest)
    const curation = sceneStore.curation
    entries.value = parsed.entries
    featured.value = new Set([...(curation.signatureSceneIds ?? []), ...(curation.curatedSceneIds ?? [])])
    stats.value = {
      total: String(parsed.sceneCount),
      safe: String(parsed.counts.All),
      r15: String(parsed.counts.R15)
    }
  } catch (err) {
    if (manifestController.signal.aborted) return
    console.warn('Showcase unavailable:', err)
    manifestLoading.value = false
    unavailable.value = true
  }
})
onUnmounted(() => {
  unmounted = true
  manifestController.abort()
  document.removeEventListener('keydown', onKey)
  if (dialogEl.value?.open) dialogEl.value.close()
  document.body.classList.remove('overlay-open')
})
</script>

<style scoped>
/* 空状态:替代原先的内联 padding/text-align/font-size */
.empty-block { padding:var(--s-8) 0; text-align:center; }
.empty-glyph { font-size:var(--fs-glyph); }
.showcase-archive { margin-bottom:var(--s-5); }
.showcase-copy h1 { font-size:clamp(1.6rem,3vw,2.8rem); font-weight:800; margin-bottom:var(--s-3); }
.showcase-copy p { color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.7; margin-bottom:var(--s-4); }
.hero-actions { display:flex; gap:var(--s-2); flex-wrap:wrap; margin-bottom:var(--s-4); }
.hero-stats { display:flex; gap:var(--s-3); flex-wrap:wrap; }
.hero-stat { min-width:100px; padding:var(--s-3) var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-md); background:var(--bg-deep); text-align:center; }
.hero-stat strong { display:block; font-size:var(--fs-title-xs); font-weight:800; color:var(--accent); }
.hero-stat span { font-size:var(--fs-label-xs); color:var(--text-muted); }

/* 唯一一层磨砂容器：不要再和内部 .search-row 各套一个圆角面 */
.toolbar-shell {
  position:sticky; top:70px; z-index:var(--z-sticky);
  margin-bottom:var(--s-5); padding:var(--s-3);
  border:1px solid color-mix(in srgb,var(--border-soft) 80%,transparent);
  border-left:3px solid var(--archive-blue); border-radius:var(--r-dossier);
  background:color-mix(in srgb,var(--bg-surface) 88%,transparent);
  box-shadow:var(--shadow-sm);
  -webkit-backdrop-filter:blur(22px) saturate(135%);
  backdrop-filter:blur(22px) saturate(135%);
}
.search-row { display:flex; align-items:center; gap:var(--s-2); flex-wrap:wrap; }
.search-field { position:relative; flex:1 1 240px; min-width:0; }
.scene-search { width:100%; padding:var(--s-2) 36px var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font-size:var(--fs-body-sm); outline:none; }
.scene-search:focus { border-color:var(--accent); }
.scene-search-clear { position:absolute; top:50%; right:8px; transform:translateY(-50%); width:24px; height:24px; border:0; background:transparent; color:var(--text-muted); cursor:pointer; font-size:var(--fs-body-lg); }
.filter-group { display:flex; gap:var(--s-1); flex-wrap:wrap; }
.filter-pill { padding:5px 12px; border:1px solid var(--border-soft); border-radius:var(--r-terminal); background:transparent; color:var(--text-secondary); cursor:pointer; font:500 var(--fs-label-sm) var(--font-sans); transition:border-color var(--t-fast),color var(--t-fast),background var(--t-fast),transform var(--t-fast) var(--ease-out); }
.filter-pill.active,.filter-pill:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-soft); }
.result-meta { margin-left:auto; color:var(--text-muted); font-size:var(--fs-label-sm); white-space:nowrap; }
:deep(.result-meta strong) { color:var(--accent); }

.showcase-grid { columns:4 260px; column-gap:var(--s-4); }
.sample { display:inline-block; width:100%; margin:0 0 var(--s-4); overflow:hidden; break-inside:avoid; position:relative; border:1px solid var(--border-soft); border-radius:var(--r-dossier); background:var(--bg-surface); box-shadow:var(--shadow-sm); transition:transform var(--t-fast),border-color var(--t-fast),box-shadow var(--t-fast); animation:showcaseSampleIn .48s var(--ease-out) both; }
.sample::before { content:""; position:absolute; z-index:var(--z-raised); top:-1px; left:var(--s-3); width:28px; height:1px; background:var(--archive-blue); opacity:.86; pointer-events:none; }
.sample:nth-child(2) { animation-delay:.04s; }
.sample:nth-child(3) { animation-delay:.08s; }
.sample:nth-child(4) { animation-delay:.12s; }
.sample:nth-child(5) { animation-delay:.16s; }
.sample:nth-child(6) { animation-delay:.2s; }
@keyframes showcaseSampleIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
.sample:hover { transform:translateY(-3px); border-color:color-mix(in srgb,var(--accent) 42%,var(--border-soft)); box-shadow:var(--shadow-md); }
.sample-visual { display:block; width:100%; padding:0; border:0; background:var(--art-mat); color:var(--on-art-primary); text-align:left; cursor:zoom-in; position:relative; overflow:hidden; }
.sample-visual:focus-visible { outline:3px solid var(--accent); outline-offset:-3px; }
.sample-image { width:100%; height:auto; display:block; background:var(--art-mat); opacity:0; filter:blur(7px); transition:opacity .3s var(--ease-out),filter .5s var(--ease-out),transform var(--t-slow) var(--ease-out); }
.sample-image-ready { opacity:1; filter:blur(0); }
.sample-image-fallback { display:grid; min-height:260px; place-items:center; color:var(--text-muted); font-size:var(--fs-glyph); }
/* R18 遮罩优先于渐进模糊：未悬停时始终是深模糊 */
.sample-r18 .sample-image,
.sample-r18 .sample-image,
.sample-r18 .sample-image.sample-image-ready { filter:blur(18px) saturate(.78); transform:scale(1.08); }
.sample:not(.sample-r18):hover .sample-image { transform:scale(1.018); }
.sample-shade { position:absolute; inset:38% 0 0; background:linear-gradient(to bottom,transparent,var(--art-scrim)); pointer-events:none; }
.sample-badges { position:absolute; inset:var(--s-3) var(--s-3) auto; display:flex; justify-content:space-between; gap:var(--s-2); pointer-events:none; }
.sample-badge { padding:var(--s-1) var(--s-2); border:1px solid var(--on-art-line); border-radius:var(--r-pill); background:var(--art-scrim); color:var(--on-art-primary); backdrop-filter:blur(12px); font-size:var(--fs-mono-sm); font-weight:700; }
.sample-badge.rating-R18 { background:color-mix(in srgb,var(--danger) 52%,var(--art-scrim)); }
.sample-caption { position:absolute; z-index:var(--z-base); inset:auto 0 0; display:block; padding:48px var(--s-3) var(--s-3); pointer-events:none; }
.sample-kicker { display:flex; justify-content:space-between; gap:var(--s-2); margin-bottom:var(--s-1); color:var(--on-art-secondary); font-size:var(--fs-mono-xs); }
.sample-title { display:block; color:var(--on-art-primary); font-size:var(--fs-body); line-height:1.35; text-shadow:0 2px 14px var(--art-backdrop); }
.sample-sensitive { position:absolute; z-index:var(--z-raised); inset:50% auto auto 50%; display:grid; justify-items:center; gap:2px; min-width:112px; padding:var(--s-3) var(--s-4); transform:translate(-50%,-50%); border:1px solid var(--on-art-line); border-radius:var(--r-pill); background:var(--art-scrim); color:var(--on-art-primary); box-shadow:var(--shadow-md); backdrop-filter:blur(12px); pointer-events:none; transition:opacity var(--t-base),transform var(--t-base); }
.sample-sensitive strong { font-size:var(--fs-label-sm); letter-spacing:.12em; }
.sample-sensitive span { color:var(--on-art-secondary); font-size:var(--fs-mono-xs); }
.sample-r18 .sample-image { filter:blur(18px) saturate(.78); transform:scale(1.08); }
.sample-r18 .sample-image.sample-image-ready { filter:blur(18px) saturate(.78); transform:scale(1.08); }
@media(hover:hover) {
  .sample-r18:hover .sample-image,
  .sample-r18:hover .sample-image.sample-image-ready { filter:blur(0) saturate(1); transform:scale(1.018); }
  .sample-r18:hover .sample-sensitive { opacity:0; transform:translate(-50%,-45%); }
}
.sample-r18:focus-within .sample-image,
.sample-r18:focus-within .sample-image.sample-image-ready { filter:blur(0) saturate(1); transform:scale(1.018); }
.sample-r18:focus-within .sample-sensitive { opacity:0; transform:translate(-50%,-45%); }
.load-wrap { display:flex; justify-content:center; margin:var(--s-6) 0; }
.load-more { min-width:190px; }

@media(max-width:1000px) { .showcase-grid { columns:3 230px; } }
@media(max-width:760px) {
  .search-row { flex-direction:column; align-items:stretch; }
  .toolbar-shell { position:relative; top:auto; }
  .showcase-grid { columns:2 150px; column-gap:var(--s-3); }
  .sample { margin-bottom:var(--s-3); border-radius:var(--r-dossier); }
}
@media(prefers-reduced-motion:reduce) { .sample,.sample-image,.sample-sensitive { transition:none; animation:none; } }
</style>

<style>
/* 非 scoped：查看器 Teleport 到 body，scoped 属性选择器命不中，
   之前就是因此丢样式导致文字压在图上。与作品册同一处理方式。 */
.showcase-viewer {
  position: fixed; inset: 0; z-index: var(--z-overlay);
  width: 100vw; height: 100vh; max-width: none; max-height: none;
  margin: 0; padding: clamp(12px, 2vw, 28px); border: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--art-backdrop);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
}
.showcase-viewer:not([open]) { display: none; }
.showcase-viewer .viewer-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, .65fr);
  width: min(1160px, 96vw);
  max-height: min(92vh, 900px);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--on-art-line) 42%, transparent);
  border-radius: var(--r-stage);
  /* 查看器永远处于暗色画布，不随浅色主题变亮 */
  background: color-mix(in srgb, var(--art-backdrop) 84%, var(--bg-deep));
  color: var(--on-art-primary);
  box-shadow: var(--shadow-lg);
}
.showcase-viewer .viewer-art {
  min-width: 0; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  padding: clamp(16px, 3vw, 40px);
  background: radial-gradient(120% 90% at 50% 12%, color-mix(in srgb, var(--accent-glow) 20%, transparent), transparent 60%), var(--art-backdrop);
}
.showcase-viewer .viewer-art img {
  display: block; max-width: 100%; max-height: min(88vh, 860px);
  width: auto; height: auto; object-fit: contain; border-radius: var(--r-lg);
  opacity: 0; transition: opacity .3s var(--ease-out);
}
.showcase-viewer .viewer-art img.viewer-image-ready { opacity: 1; }
.showcase-viewer .viewer-image-fallback { color:var(--on-art-secondary); font-size:var(--fs-body-sm); }
.showcase-viewer .viewer-copy {
  min-width: 0; overflow-y: auto;
  padding: clamp(20px, 3vw, 36px);
  border-left: 1px solid color-mix(in srgb, var(--on-art-line) 30%, transparent);
  background: transparent;
  color: var(--on-art-primary);
}
.showcase-viewer .viewer-copy .viewer-close { float: right; margin: -6px -6px var(--s-3) var(--s-3); border-color: color-mix(in srgb, var(--on-art-line) 55%, transparent); background: color-mix(in srgb, var(--art-scrim) 65%, transparent); color: var(--on-art-primary); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
.showcase-viewer .viewer-copy .viewer-close:hover { border-color: var(--on-art-line); color: var(--on-art-primary); background: color-mix(in srgb, var(--on-art-line) 14%, transparent); }
.showcase-viewer .viewer-copy .viewer-kicker { color: var(--on-art-secondary); }
.showcase-viewer .viewer-copy h2 {
  margin: var(--s-3) 0 var(--s-2);
  font-size: clamp(1.25rem, 2.4vw, 1.9rem); line-height: 1.25;
}
.showcase-viewer .viewer-meta { display: flex; gap: var(--s-2); flex-wrap: wrap; margin-bottom: var(--s-4); }
.showcase-viewer .viewer-meta span {
  padding: var(--s-1) var(--s-2); border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--on-art-line) 16%, transparent);
  color: var(--on-art-primary);
  font: 700 var(--fs-mono-sm) var(--font-mono);
}
.showcase-viewer .viewer-story {
  color: var(--on-art-secondary); font-size: var(--fs-body-sm);
  line-height: 1.8; margin-bottom: var(--s-5);
}
.showcase-viewer .viewer-actions { display: grid; gap: var(--s-2); }
.showcase-viewer .viewer-actions .btn { justify-content: center; }
/* 查看器永远处于暗色画布：按钮用 on-art 色系，避免浅色主题下对比不足 */
.showcase-viewer .btn-ghost {
  color: var(--on-art-secondary);
  border-color: color-mix(in srgb, var(--on-art-line) 62%, transparent);
}
.showcase-viewer .btn-ghost:hover {
  color: var(--on-art-primary);
  border-color: var(--on-art-line);
  background: color-mix(in srgb, var(--on-art-line) 12%, transparent);
}
body:has(.showcase-viewer[open]) { overflow: hidden; }

@media (max-width: 1000px) {
  .showcase-viewer .viewer-layout { grid-template-columns: minmax(0, 1fr) 320px; }
}
@media (max-width: 760px) {
  .showcase-viewer { padding: 0; }
  .showcase-viewer .viewer-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100vw; max-height: 100vh; border-radius: 0; border: 0;
  }
  .showcase-viewer .viewer-art { padding: var(--s-3); }
  .showcase-viewer .viewer-art img { max-height: 46vh; }
  .showcase-viewer .viewer-copy { border-left: 0; border-top: 1px solid var(--border-soft); }
}
</style>
