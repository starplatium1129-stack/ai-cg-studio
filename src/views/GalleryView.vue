<template>
  <main id="main" class="gallery-shell">
    <header class="gallery-intro">
      <div>
        <div class="gallery-kicker">Private collection</div>
        <h1 class="gallery-title">作品册</h1>
        <p class="gallery-subtitle">原比例安静欣赏。先看画面，参数只在你点开时出现。</p>
      </div>
      <div class="gallery-count">{{ countLabel }}</div>
    </header>

    <div class="gallery-toolbar sticky-toolbar" aria-label="作品筛选">
      <button class="gallery-filter" :class="{ active: favoriteOnly }" type="button" @click="favoriteOnly = !favoriteOnly">
        ♥ 收藏 {{ favoriteCount }}
      </button>
      <select v-model="projectFilter" class="gallery-project" aria-label="按项目筛选">
        <option value="">全部项目</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.title }}</option>
      </select>
      <span class="gallery-toolbar-note">点作品进入沉浸观画</span>
    </div>

    <section aria-live="polite">
      <div v-if="!visible.length" class="empty-state">
        <div class="empty-state-icon">✦</div>
        <h2>展墙还在等第一幅作品</h2>
        <p>完成绘制后，原图会按自己的横竖比例进这里。作品只存在这台电脑，参数不挡画面。</p>
        <RouterLink class="btn btn-primary" to="/prompt-builder">开始绘制</RouterLink>
      </div>
      <div v-else class="gallery-wall">
        <template v-for="group in groups" :key="group.key">
          <div class="gallery-section">{{ group.key }}</div>
          <article
            v-for="item in group.items"
            :key="item.id"
            class="artwork"
            :style="{ '--art-ratio': ratioOf(item) }"
          >
            <button
              class="artwork-button"
              type="button"
              :aria-label="`欣赏作品：${sceneTitle(item.scene)}`"
              @click="openViewer(indexOf(item))"
            >
              <div class="artwork-media" :style="{ aspectRatio: String(ratioOf(item)) }">
                <img
                  v-if="cardUrls[item.id]"
                  class="artwork-image"
                  :src="cardUrls[item.id]"
                  :alt="sceneTitle(item.scene)"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                />
                <div v-else class="artwork-placeholder">✦</div>
                <div class="artwork-caption">
                  <span>
                    <span class="artwork-name">{{ sceneTitle(item.scene) }}</span>
                    <span class="artwork-date">{{ formatDate(item.timestamp) }}</span>
                  </span>
                  <span class="artwork-mark">{{ item.favorite ? '♥' : '＋' }}</span>
                </div>
              </div>
            </button>
          </article>
        </template>
      </div>
    </section>
  </main>

  <!-- 沉浸查看器 -->
  <Teleport to="body">
    <div
      v-show="viewerIndex >= 0"
      class="art-viewer"
      :class="{ open: viewerIndex >= 0, 'info-open': infoOpen }"
      role="dialog"
      aria-modal="true"
      :aria-hidden="viewerIndex >= 0 ? 'false' : 'true'"
      aria-label="作品观赏模式"
      ref="viewerEl"
    >
      <section class="viewer-stage" @click.self="infoOpen = false">
        <button class="viewer-close viewer-close-on-art" type="button" aria-label="关闭" @click="closeViewer" ref="closeBtn">×</button>
        <button class="viewer-nav viewer-prev" type="button" aria-label="上一幅" :disabled="viewerIndex <= 0" @click="step(-1)">‹</button>
        <img v-if="viewerUrl" class="viewer-image" :src="viewerUrl" :alt="current ? sceneTitle(current.scene) : ''" decoding="async" />
        <div v-else class="viewer-fallback">✦</div>
        <button class="viewer-nav viewer-next" type="button" aria-label="下一幅" :disabled="viewerIndex >= visible.length - 1" @click="step(1)">›</button>
        <button class="viewer-info-toggle" type="button" aria-label="作品信息" @click="infoOpen = !infoOpen">i</button>
        <div class="viewer-position">{{ viewerIndex + 1 }} / {{ visible.length }}</div>
      </section>

      <aside class="viewer-info" v-if="current">
        <div class="viewer-kicker">Artwork {{ viewerIndex + 1 }}</div>
        <h2 class="viewer-title">{{ sceneTitle(current.scene) }}</h2>
        <div class="viewer-meta">
          {{ characterName(current.character) }} · {{ formatDate(current.timestamp) }} · v{{ current.version || 1 }}
        </div>
        <div class="viewer-story viewer-story-on-art">{{ current.story || '这幅作品还没有附加文字。' }}</div>
        <div class="viewer-facts">
          <div class="viewer-fact" v-for="f in facts" :key="f.label">
            <small>{{ f.label }}</small>
            <strong :title="f.value || '—'">{{ f.value || '—' }}</strong>
          </div>
        </div>
        <details class="viewer-details">
          <summary>创作参数与 Prompt</summary>
          <div class="viewer-prompt">{{ current.prompt || '未保存 Prompt' }}</div>
        </details>
        <div class="viewer-actions">
          <RouterLink class="btn btn-primary" :to="`/prompt-builder?scene=${encodeURIComponent(current.scene || '')}&regen=${encodeURIComponent(current.id || '')}`">重新生成</RouterLink>
          <RouterLink class="btn btn-ghost" :to="`/prompt-builder?scene=${encodeURIComponent(current.scene || '')}&variant=${encodeURIComponent(current.id || '')}`">生成变体</RouterLink>
          <button class="btn btn-ghost" type="button" @click="copyPrompt">复制 Prompt</button>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'

declare const AICKVStore: any
declare const AICGImageStore: any
declare const AICStorageHealth: any

const HISTORY_KEY = 'aics_pb_history'
const PROJECT_KEY = 'aics_projects'

const history = ref<any[]>([])
const projects = ref<any[]>([])
const scenes = ref<any[]>([])
const loras = ref<any[]>([])
const favoriteOnly = ref(false)
const projectFilter = ref('')
const viewerIndex = ref(-1)
const infoOpen = ref(false)
const viewerUrl = ref('')
const cardUrls = reactive<Record<string, string>>({})
const closeBtn = ref<HTMLElement | null>(null)
const viewerEl = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null
const objectUrls = new Set<string>()

/* ---------- 派生数据 ---------- */
const visible = computed(() => {
  let source = favoriteOnly.value ? history.value.filter(i => i.favorite) : history.value.slice()
  if (projectFilter.value) {
    const p = projects.value.find(x => x.id === projectFilter.value)
    if (p) source = source.filter(i => Array.isArray(p.history_ids) && p.history_ids.includes(i.id))
  }
  return source
})
const favoriteCount = computed(() => history.value.filter(i => i.favorite).length)
const countLabel = computed(() => `${visible.value.length} 幅作品`)
const current = computed(() => visible.value[viewerIndex.value] || null)

const groups = computed(() => {
  const order = ['今天', '本周', '更早']
  const buckets: Record<string, any[]> = {}
  visible.value.forEach(item => {
    const key = dayGroup(item.timestamp)
    ;(buckets[key] = buckets[key] || []).push(item)
  })
  return order.filter(k => buckets[k]?.length).map(k => ({ key: k, items: buckets[k] }))
})

const facts = computed(() => {
  if (!current.value) return []
  const i = current.value
  const rating = i.rating || {}
  const scores = ['face', 'expression', 'composition', 'hands', 'atmosphere']
    .map(k => Number(rating[k]) || 0).filter(Boolean)
  const avg = scores.length
    ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1) + ' / 5'
    : '未评分'
  return [
    { label: '尺寸', value: i.size },
    { label: '评分', value: avg },
    { label: 'LoRA', value: loraName(i.lora) },
    { label: '模型', value: modelName(i.checkpoint) },
    { label: 'Seed', value: i.seed },
    { label: 'Sampler', value: i.sampler },
  ]
})

/* ---------- 工具函数 ---------- */
function sceneFor(id: string) { return scenes.value.find(s => s.id === id) }
function sceneTitle(id: string) { return sceneFor(id)?.title ?? (id || '未命名作品') }
function loraName(id: string) {
  if (!id) return '—'
  const item = loras.value.find(l => l.id === id || (l.name && (l.name === id || String(id).startsWith(l.name))))
  return item ? item.name : id
}
function modelName(value: string) {
  if (!value) return 'WebUI 当前模型'
  const name = String(value).split(/[\\/]/).pop()!.replace(/\s*\[[a-f0-9]+\]\s*$/i, '')
  return name.length > 42 ? name.slice(0, 39) + '…' : name
}
function characterName(v: string) {
  return v === 'nene' ? '绫地宁宁' : v === 'natsume' ? '四季夏目'
    : v === 'triad' || v === 'both' ? '宁宁与夏目' : v || '—'
}
function formatDate(ts: number) {
  const d = new Date(ts)
  return Number.isFinite(d.getTime())
    ? d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '时间未记录'
}
function dayGroup(ts: number) {
  const date = new Date(ts)
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = (start.getTime() - date.getTime()) / 86400000
  return diff < 1 ? '今天' : diff < 7 ? '本周' : '更早'
}
function ratioOf(item: any) {
  let w = Number(item.width || item.image_width || item.actual?.width)
  let h = Number(item.height || item.image_height || item.actual?.height)
  if (!(w > 0 && h > 0)) {
    const m = String(item.size || '').match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i)
    if (m) { w = Number(m[1]); h = Number(m[2]) }
  }
  const r = w > 0 && h > 0 ? w / h : 3 / 4
  return Math.max(0.36, Math.min(2.8, r))
}
function indexOf(item: any) { return visible.value.indexOf(item) }
function safeImageUrl(v: string) {
  if (typeof v !== 'string' || !v.trim()) return ''
  try {
    const url = new URL(v.trim(), location.href)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch { return '' }
}
function trackUrl(url: string) { objectUrls.add(url); return url }
function revokeAll() {
  objectUrls.forEach(u => URL.revokeObjectURL(u))
  objectUrls.clear()
}

/* ---------- 图片加载 ---------- */
async function hydrateCards() {
  for (const item of visible.value) {
    if (cardUrls[item.id]) continue
    const fallback = safeImageUrl(item.image_url)
    try {
      const blob = item.image_id ? await AICGImageStore.get(item.image_id) : null
      if (blob) cardUrls[item.id] = trackUrl(URL.createObjectURL(blob))
      else if (fallback) cardUrls[item.id] = fallback
      else if (item.image_data && String(item.image_data).startsWith('data:image/')) cardUrls[item.id] = item.image_data
    } catch {
      if (fallback) cardUrls[item.id] = fallback
    }
  }
}

async function hydrateViewer(item: any, seq: number) {
  viewerUrl.value = ''
  const fallback = safeImageUrl(item.image_url)
  try {
    const blob = item.image_id ? await AICGImageStore.get(item.image_id) : null
    if (seq !== viewerIndex.value) return
    if (blob) viewerUrl.value = trackUrl(URL.createObjectURL(blob))
    else if (fallback) viewerUrl.value = fallback
    else if (item.image_data && String(item.image_data).startsWith('data:image/')) viewerUrl.value = item.image_data
  } catch { viewerUrl.value = '' }
}

/* ---------- Viewer 控制 ---------- */
function openViewer(index: number) {
  if (!visible.value[index]) return
  if (viewerIndex.value < 0) returnFocus = document.activeElement as HTMLElement
  viewerIndex.value = index
  infoOpen.value = false
  document.body.classList.add('viewer-open')
  hydrateViewer(visible.value[index], index)
  nextTick(() => closeBtn.value?.focus({ preventScroll: true }))
}
function closeViewer() {
  viewerIndex.value = -1
  infoOpen.value = false
  viewerUrl.value = ''
  document.body.classList.remove('viewer-open')
  returnFocus?.focus?.({ preventScroll: true })
  returnFocus = null
}
function step(delta: number) {
  const next = viewerIndex.value + delta
  if (next >= 0 && next < visible.value.length) openViewer(next)
}
function copyPrompt() {
  if (current.value?.prompt) navigator.clipboard.writeText(current.value.prompt)
}

/* ---------- 键盘 ---------- */
function onKeydown(e: KeyboardEvent) {
  if (viewerIndex.value < 0) return
  if (e.key === 'Escape') return closeViewer()
  if (e.key === 'ArrowLeft') return step(-1)
  if (e.key === 'ArrowRight') return step(1)
  if (e.key.toLowerCase() === 'i') { infoOpen.value = !infoOpen.value; return }
  if (e.key === 'Tab') {
    const root = viewerEl.value
    if (!root) return
    const focusable = Array.from(root.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null || el === document.activeElement)
    if (!focusable.length) { e.preventDefault(); return }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    else if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus() }
  }
}

/* ---------- 初始化 ---------- */
onMounted(async () => {
  document.addEventListener('keydown', onKeydown)
  try {
    await AICKVStore.init()
    let historyRaw = await AICKVStore.get(HISTORY_KEY)
    let projectRaw = await AICKVStore.get(PROJECT_KEY)
    if (!historyRaw) {
      try { historyRaw = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null') } catch {}
      if (Array.isArray(historyRaw) && historyRaw.length) {
        await AICKVStore.set(HISTORY_KEY, historyRaw); localStorage.removeItem(HISTORY_KEY)
      }
    }
    if (!projectRaw) {
      try { projectRaw = JSON.parse(localStorage.getItem(PROJECT_KEY) || 'null') } catch {}
      if (Array.isArray(projectRaw) && projectRaw.length) {
        await AICKVStore.set(PROJECT_KEY, projectRaw); localStorage.removeItem(PROJECT_KEY)
      }
    }
    history.value = Array.isArray(historyRaw) ? historyRaw.filter((item: any) => {
      if (!(item && typeof item === 'object')) return false
      if (typeof AICStorageHealth !== 'undefined') return AICStorageHealth.validateHistoryEntry(item).ok
      return true
    }) : []
    projects.value = Array.isArray(projectRaw) ? projectRaw : []
  } catch (e) { console.warn('gallery storage init failed', e) }

  await Promise.all([
    fetch('/data/scenes.json?v=9').then(r => r.json()).then(d => { scenes.value = d }).catch(() => {}),
    fetch('/data/loras.json?v=6').then(r => r.json()).then(d => { loras.value = d }).catch(() => {}),
  ])
  await hydrateCards()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('viewer-open')
  revokeAll()
})

watch(visible, () => { hydrateCards() })
</script>

<style scoped>
.gallery-shell { width:min(1880px,100%); margin:0 auto; padding:clamp(24px,4vw,64px) clamp(14px,3vw,48px) var(--s-8); }
.gallery-intro { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:var(--s-5); margin:0 auto clamp(24px,4vw,48px); max-width:1500px; }
.gallery-title { margin:0; color:var(--text-primary); font-family:var(--font-display); font-size:clamp(2rem,4vw,4.4rem); font-weight:760; letter-spacing:-.045em; line-height:.98; }
.gallery-subtitle { max-width:660px; margin:var(--s-3) 0 0; color:var(--text-secondary); font-size:clamp(.86rem,1.2vw,1rem); line-height:1.8; }
.gallery-count { color:var(--text-muted); font:650 var(--fs-label-xs) var(--font-mono); letter-spacing:.08em; white-space:nowrap; }

.gallery-toolbar { max-width:1500px; margin:0 auto clamp(24px,3vw,38px); display:flex; align-items:center; gap:var(--s-2); }
.gallery-filter { min-height:36px; padding:0 15px; border:1px solid transparent; border-radius:var(--r-pill); background:transparent; color:var(--text-secondary); font:650 var(--fs-label-sm) var(--font-sans); cursor:pointer; transition:border-color var(--t-fast),background var(--t-fast),color var(--t-fast); }
.gallery-filter:hover,.gallery-filter.active { border-color:color-mix(in srgb,var(--accent) 34%,var(--border-soft)); background:var(--accent-soft); color:var(--accent); }
.gallery-project { min-height:36px; min-width:140px; padding:0 34px 0 13px; border:1px solid transparent; border-radius:var(--r-pill); background:transparent; color:var(--text-secondary); font:650 var(--fs-label-sm) var(--font-sans); cursor:pointer; outline:none; }
.gallery-project:focus { border-color:var(--accent); }
.gallery-toolbar-note { margin-left:auto; padding-right:var(--s-3); color:var(--text-muted); font-size:var(--fs-mono-sm); white-space:nowrap; }

.gallery-wall { max-width:1500px; margin:0 auto; columns:4 260px; column-gap:clamp(12px,1.6vw,24px); }
.artwork { position:relative; break-inside:avoid; margin:0 0 clamp(12px,1.6vw,24px); overflow:hidden; border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent); border-radius:clamp(10px,1.2vw,18px); background:var(--art-mat); box-shadow:var(--shadow-sm); transition:transform var(--t-base),box-shadow var(--t-base),border-color var(--t-base); }
.artwork:hover { transform:translateY(-3px); border-color:color-mix(in srgb,var(--accent) 38%,var(--border-soft)); box-shadow:var(--shadow-md); }
.artwork-button { display:block; width:100%; padding:0; border:0; background:transparent; color:inherit; cursor:zoom-in; }
.artwork-button:focus-visible { outline:3px solid var(--accent); outline-offset:-3px; }
.artwork-media { position:relative; width:100%; aspect-ratio:var(--art-ratio,3/4); overflow:hidden; background:linear-gradient(135deg,color-mix(in srgb,var(--art-mat) 88%,#fff),var(--art-mat)); }
.artwork-image { display:block; width:100%; height:100%; object-fit:contain; background:var(--art-mat); }
.artwork-placeholder { position:absolute; inset:0; display:grid; place-items:center; color:var(--on-art-secondary); font-size:var(--fs-glyph); }
.artwork-caption { position:absolute; inset:auto 0 0; display:flex; align-items:flex-end; justify-content:space-between; gap:var(--s-3); padding:40px var(--s-3) var(--s-3); color:var(--on-art-primary); background:linear-gradient(transparent,var(--art-scrim)); opacity:0; transform:translateY(8px); transition:opacity var(--t-fast) var(--ease-out),transform var(--t-fast) var(--ease-out); text-align:left; pointer-events:none; }
.artwork:hover .artwork-caption,.artwork-button:focus-visible .artwork-caption { opacity:1; transform:none; }
.artwork-name { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--fs-label-sm); font-weight:700; }
.artwork-date { display:block; margin-top:2px; color:var(--on-art-secondary); font-size:var(--fs-mono-xs); }
.artwork-mark { flex:0 0 auto; font-size:var(--fs-label-sm); }

.gallery-section { column-span:all; display:flex; align-items:center; gap:var(--s-3); margin:var(--s-3) 0 var(--s-4); color:var(--text-muted); font:700 var(--fs-mono-xs) var(--font-mono); letter-spacing:.13em; text-transform:uppercase; }
.gallery-section::after { content:""; height:1px; flex:1; background:var(--border-soft); }

@media (max-width:900px) { .gallery-intro { grid-template-columns:1fr; } .gallery-count { display:none; } }
@media (max-width:600px) {
  .gallery-shell { padding:var(--s-5) var(--s-3) var(--s-8); }
  .gallery-wall { columns:2 135px; column-gap:var(--s-3); }
  .artwork { margin-bottom:var(--s-3); border-radius:var(--r-md); }
  .artwork-caption { opacity:1; transform:none; padding:34px var(--s-2) var(--s-2); }
  .artwork-name { font-size:var(--fs-mono-sm); }
  .artwork-date { display:none; }
}
@media (prefers-reduced-motion:reduce) { .artwork,.artwork-caption { transition:none !important; } }
</style>

<style>
/* 非 scoped：Teleport 到 body 的查看器 */
.art-viewer { position:fixed; inset:0; z-index:var(--z-overlay); display:none; grid-template-columns:minmax(0,1fr) minmax(290px,360px); background:var(--art-backdrop); color:var(--on-art-primary); }
.art-viewer.open { display:grid; }
.viewer-stage { position:relative; min-width:0; display:grid; place-items:center; padding:clamp(46px,5vw,76px) clamp(48px,6vw,92px); overflow:hidden; }
.viewer-image { display:block; max-width:100%; max-height:calc(100vh - 92px); width:auto; height:auto; object-fit:contain; filter:drop-shadow(0 24px 56px var(--art-backdrop)); }
.viewer-fallback { color:var(--on-art-secondary); font-size:var(--fs-glyph-lg); }
.art-viewer .viewer-close { position:absolute; z-index:var(--z-raised); top:18px; left:18px; }
.viewer-nav,.viewer-info-toggle { position:absolute; z-index:var(--z-raised); display:grid; place-items:center; border:1px solid var(--on-art-line); background:var(--art-scrim); color:var(--on-art-primary); cursor:pointer; -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); transition:background var(--t-fast),transform var(--t-fast); }
.viewer-info-toggle { top:18px; right:18px; width:40px; height:40px; border-radius:50%; display:none; }
.viewer-nav { top:50%; width:44px; height:64px; border-radius:var(--r-pill); transform:translateY(-50%); font-size:var(--fs-title); }
.viewer-nav:hover,.viewer-info-toggle:hover { background:color-mix(in srgb,var(--accent) 58%,var(--art-scrim)); }
.viewer-prev { left:var(--s-4); }
.viewer-next { right:var(--s-4); }
.viewer-nav:disabled { opacity:.24; cursor:default; }
.viewer-position { position:absolute; left:50%; bottom:18px; transform:translateX(-50%); color:var(--on-art-secondary); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.12em; }
.viewer-info { min-width:0; overflow-y:auto; padding:56px var(--s-5) var(--s-6); border-left:1px solid var(--on-art-line); background:var(--art-scrim); }
.viewer-title { margin:var(--s-3) 0 var(--s-1); color:var(--on-art-primary); font-size:var(--fs-title); line-height:1.25; }
.viewer-meta { color:var(--on-art-secondary); font-size:var(--fs-label-xs); line-height:1.6; }
.viewer-facts { display:grid; grid-template-columns:1fr 1fr; gap:var(--s-2); margin-bottom:var(--s-5); }
.viewer-fact { min-width:0; padding:var(--s-2); border:1px solid var(--on-art-line); border-radius:var(--r-md); background:var(--on-art-fill); }
.viewer-fact small,.viewer-fact strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.viewer-fact small { color:var(--on-art-secondary); font-size:var(--fs-mono-xs); text-transform:uppercase; letter-spacing:.08em; }
.viewer-fact strong { margin-top:var(--s-1); color:var(--on-art-primary); font-size:var(--fs-label-xs); }
.viewer-details { margin:0 0 var(--s-5); border-top:1px solid var(--on-art-line); }
.viewer-details summary { padding:var(--s-3) 0; color:var(--on-art-secondary); font-size:var(--fs-label-xs); cursor:pointer; }
.viewer-prompt { max-height:220px; overflow:auto; padding:var(--s-3); border-radius:var(--r-md); background:var(--art-backdrop); color:var(--on-art-secondary); font:400 var(--fs-mono-sm)/1.65 var(--font-mono); white-space:pre-wrap; word-break:break-word; }
body.viewer-open { overflow:hidden; }
@media (max-width:900px) {
  .art-viewer { grid-template-columns:1fr; }
  .viewer-stage { padding:60px 42px 78px; }
  .viewer-info { position:absolute; inset:0 0 0 auto; width:min(86vw,360px); transform:translateX(100%); transition:transform var(--t-fast) var(--ease-out); z-index:var(--z-raised); }
  .art-viewer.info-open .viewer-info { transform:none; }
  .viewer-info-toggle { display:grid; }
}
@media (max-width:600px) {
  .viewer-stage { padding:58px 38px 76px; }
  .viewer-nav { width:36px; height:56px; }
  .viewer-prev { left:var(--s-2); }
  .viewer-next { right:var(--s-2); }
}
@media (prefers-reduced-motion:reduce) { .art-viewer,.viewer-info { transition:none !important; } }
</style>
