<template>
  <main class="page">
    <a @click.prevent="$router.push('/')" href="/" class="nav-back">← 回首页</a>
    <section class="showcase-hero">
      <div class="showcase-copy">
        <div class="page-kicker">Approved Scene Gallery</div>
        <h1>场景，实际能画成什么样</h1>
        <p>不是概念图，是当前角色模型真实生成、逐张审核后留下的样张。先看成片，再挑想画的故事。</p>
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
    </section>

    <div class="sticky-toolbar toolbar-shell">
      <div class="search-row">
        <div style="position:relative;flex:1">
          <input v-model="searchQuery" type="search" class="scene-search" id="showcaseSearch" placeholder="🔍 搜索场景名、情绪、角色…" />
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

    <div v-if="unavailable" class="empty" style="padding:var(--s-8) 0;text-align:center">
      <span style="font-size:var(--fs-glyph)">🖼</span>
      <h2>展示素材暂未连接</h2>
      <p>重新启动控制面板后会自动连接 AI/SceneShowcase 中最新的审核展示集。</p>
      <RouterLink class="btn btn-primary" to="/scene-explorer">先逛灵感场景</RouterLink>
    </div>

    <div v-else-if="!filtered.length" class="empty-state">
      <div class="empty-state-icon">✦</div>
      <h2>没有找到匹配样张</h2>
      <p>试试更短的关键词，或者切回"全部角色 / 全部分级"。</p>
      <button class="btn btn-ghost" type="button" @click="resetFilters">重置筛选</button>
    </div>

    <div v-else class="showcase-grid">
      <article
        v-for="entry in paged" :key="entry.id"
        class="sample" :class="{ 'sample-r18': entry.rating === 'R18' }"
        :data-rating="entry.rating"
      >
        <button class="sample-visual" type="button" :aria-label="'查看 ' + entry.title + ' 大图'" @click="openViewer(entry.id)">
          <img class="sample-image" :src="thumbSrc(entry)" :alt="entry.title" loading="lazy" decoding="async" />
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
      <dialog ref="dialogEl" class="viewer" :open="!!currentEntry" aria-label="样张查看器" @click.self="closeViewer">
        <div v-if="currentEntry" class="viewer-layout">
          <div class="viewer-art">
            <img :src="imgSrc(currentEntry)" :alt="currentEntry.title" />
          </div>
          <div class="viewer-copy">
            <button class="viewer-close" type="button" id="viewerClose" @click="closeViewer">×</button>
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
              <RouterLink class="btn btn-primary" :to="'/prompt-builder?scene=' + encodeURIComponent(currentEntry.id) + '&step=4&generate=1'">✦ 画这个场景</RouterLink>
              <button class="btn btn-ghost" type="button" @click="move(-1)">← 上一张</button>
              <button class="btn btn-ghost" type="button" @click="move(1)">下一张 →</button>
            </div>
          </div>
        </div>
      </dialog>
    </Teleport>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const PAGE_SIZE = 24
const SCOPE_OPTS = [{ v:'all', l:'全部' }, { v:'featured', l:'精选' }]
const CHAR_OPTS  = [{ v:'all', l:'全部角色' }, { v:'nene', l:'宁宁' }, { v:'natsume', l:'夏目' }, { v:'triad', l:'双人' }]
const RATING_OPTS= [{ v:'all', l:'全部分级' }, { v:'All', l:'全年龄' }, { v:'R15', l:'R15' }, { v:'R18', l:'R18' }]
const LABELS: Record<string,string> = { nene:'绫地宁宁', natsume:'四季夏目', triad:'宁宁×夏目', All:'全年龄', R15:'R15', R18:'R18' }

const entries   = ref<any[]>([])
const featured  = ref(new Set<string>())
const stats     = ref({ total: '—', safe: '—', r15: '—' })
const unavailable = ref(false)
const searchQuery = ref('')
const scope       = ref('all')
const charFilter  = ref('all')
const ratingFilter= ref('all')
const visibleCount= ref(PAGE_SIZE)
const currentId   = ref('')
const dialogEl    = ref<HTMLDialogElement | null>(null)
let imgVersion    = Date.now()

// Reset visible count on any filter change
watch([searchQuery, scope, charFilter, ratingFilter], () => { visibleCount.value = PAGE_SIZE })

function norm(s: string) { return String(s||'').trim().toLocaleLowerCase('zh-CN') }
function ratingLabel(v: string) { return LABELS[v] || v || '未分级' }
function charLabel(v: string) { return LABELS[v] || v || '角色' }
function thumbSrc(e: any) { return `/scene-showcase/thumbs/${encodeURIComponent(e.id)}.jpg?cv=${imgVersion}` }
function imgSrc(e: any)   { return `/scene-showcase/images/${encodeURIComponent(e.id)}.jpg?cv=${imgVersion}&t=${Date.now()}` }

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
  if (e.key === 'Escape') closeViewer()
}

onMounted(async () => {
  document.addEventListener('keydown', onKey)
  try {
    const [manifest, curation] = await Promise.all([
      fetch('/scene-showcase/manifest.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('showcase ' + r.status); return r.json() }),
      fetch('/data/curation.json?v=2').then(r => r.ok ? r.json() : {}).catch(() => ({}))
    ])
    if (!manifest || !Array.isArray(manifest.entries)) throw new Error('invalid manifest')
    entries.value = manifest.entries.slice().sort((a: any, b: any) => Number(a.id.slice(2)) - Number(b.id.slice(2)))
    featured.value = new Set([...(curation.signatureSceneIds || []), ...(curation.curatedSceneIds || [])])
    stats.value = {
      total: String(manifest.sceneCount || entries.value.length),
      safe: String(manifest.counts?.All || entries.value.filter((e: any) => e.rating === 'All').length),
      r15: String(manifest.counts?.R15 || entries.value.filter((e: any) => e.rating === 'R15').length)
    }
  } catch (err) {
    console.warn('Showcase unavailable:', err)
    unavailable.value = true
  }
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.showcase-hero { padding:var(--s-8) var(--s-6) var(--s-5); border-radius:var(--r-xl); background:linear-gradient(135deg,var(--accent-soft),transparent 62%),var(--bg-surface); border:1px solid var(--border-soft); margin-bottom:var(--s-5); }
.showcase-copy h1 { font-size:clamp(1.6rem,3vw,2.8rem); font-weight:800; margin-bottom:var(--s-3); }
.showcase-copy p { color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.7; margin-bottom:var(--s-4); }
.hero-actions { display:flex; gap:var(--s-2); flex-wrap:wrap; margin-bottom:var(--s-4); }
.hero-stats { display:flex; gap:var(--s-3); flex-wrap:wrap; }
.hero-stat { min-width:100px; padding:var(--s-3) var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--bg-deep); text-align:center; }
.hero-stat strong { display:block; font-size:var(--fs-title-xs); font-weight:800; color:var(--accent); }
.hero-stat span { font-size:var(--fs-label-xs); color:var(--text-muted); }

.toolbar-shell { margin-bottom:var(--s-5); }
.search-row { display:flex; align-items:center; gap:var(--s-2); flex-wrap:wrap; padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--bg-surface); }
.scene-search { width:100%; padding:var(--s-2) 36px var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font-size:var(--fs-body-sm); outline:none; }
.scene-search:focus { border-color:var(--accent); }
.scene-search-clear { position:absolute; top:50%; right:8px; transform:translateY(-50%); width:24px; height:24px; border:0; background:transparent; color:var(--text-muted); cursor:pointer; font-size:var(--fs-body-lg); }
.filter-group { display:flex; gap:var(--s-1); flex-wrap:wrap; }
.filter-pill { padding:5px 12px; border:1px solid var(--border-soft); border-radius:var(--r-pill); background:transparent; color:var(--text-secondary); cursor:pointer; font:500 var(--fs-label-sm) var(--font-sans); transition:all var(--t-fast); }
.filter-pill.active,.filter-pill:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-soft); }
.result-meta { margin-left:auto; color:var(--text-muted); font-size:var(--fs-label-sm); white-space:nowrap; }
:deep(.result-meta strong) { color:var(--accent); }

.showcase-grid { columns:4 260px; column-gap:var(--s-4); }
.sample { display:inline-block; width:100%; margin:0 0 var(--s-4); overflow:hidden; break-inside:avoid; border:1px solid var(--border-soft); border-radius:var(--r-2xl); background:var(--bg-surface); box-shadow:var(--shadow-sm); transition:transform var(--t-fast),border-color var(--t-fast),box-shadow var(--t-fast); }
.sample:hover { transform:translateY(-3px); border-color:color-mix(in srgb,var(--accent) 42%,var(--border-soft)); box-shadow:var(--shadow-md); }
.sample-visual { display:block; width:100%; padding:0; border:0; background:var(--art-mat); color:var(--on-art-primary); text-align:left; cursor:zoom-in; position:relative; overflow:hidden; }
.sample-visual:focus-visible { outline:3px solid var(--accent); outline-offset:-3px; }
.sample-image { width:100%; height:auto; display:block; background:var(--art-mat); transition:filter var(--t-slow) var(--ease-out),transform var(--t-slow) var(--ease-out); }
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
@media(hover:hover) {
  .sample-r18:hover .sample-image { filter:blur(0) saturate(1); transform:scale(1.018); }
  .sample-r18:hover .sample-sensitive { opacity:0; transform:translate(-50%,-45%); }
}
.sample-r18:focus-within .sample-image { filter:blur(0) saturate(1); transform:scale(1.018); }
.sample-r18:focus-within .sample-sensitive { opacity:0; transform:translate(-50%,-45%); }
.load-wrap { display:flex; justify-content:center; margin:var(--s-6) 0; }
.load-more { min-width:190px; }

/* viewer dialog */
.viewer { width:min(1160px,94vw); max-width:none; max-height:92vh; padding:0; overflow:hidden; border:1px solid var(--glass-edge); border-radius:var(--r-stage); background:var(--bg-elevated); color:var(--text-primary); box-shadow:var(--shadow-lg); }
.viewer::backdrop { background:var(--art-backdrop); backdrop-filter:blur(10px); }
.viewer-layout { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(310px,.65fr); min-height:min(760px,88vh); }
.viewer-art { display:flex; align-items:center; justify-content:center; padding:var(--s-4); background:var(--art-mat); }
.viewer-art img { display:block; max-width:100%; max-height:calc(88vh - 36px); object-fit:contain; border-radius:var(--r-lg); }
.viewer-copy { overflow:auto; padding:clamp(24px,4vw,42px); }
.viewer-copy .viewer-close { float:right; margin:-8px -8px var(--s-3) var(--s-3); }
.viewer-copy h2 { margin:var(--s-3) 0 var(--s-2); font-size:clamp(1.35rem,3vw,2.1rem); }
.viewer-meta { display:flex; gap:var(--s-2); flex-wrap:wrap; margin-bottom:var(--s-4); }
.viewer-meta span { padding:var(--s-1) var(--s-2); border-radius:var(--r-pill); background:var(--accent-soft); color:var(--accent); font-size:var(--fs-mono-sm); font-weight:700; }
.viewer-story { color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.7; margin-bottom:var(--s-4); }
.viewer-actions { display:grid; gap:var(--s-2); }
.viewer-actions .btn { justify-content:center; }

@media(max-width:1000px) { .showcase-grid { columns:3 230px; } .viewer-layout { grid-template-columns:1fr 340px; } }
@media(max-width:760px) { .search-row { flex-direction:column; align-items:stretch; } .showcase-grid { columns:2 150px; column-gap:var(--s-3); } .viewer { overflow:auto; } .viewer-layout { display:block; } .viewer-art { min-height:45vh; } }
@media(prefers-reduced-motion:reduce) { .sample,.sample-image,.sample-sensitive { transition:none; } }
</style>
