<template>
  <article class="gallery-shell gallery-page">
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
            :class="{ 'artwork-pending': pendingDeleteId === item.id }"
            :style="{ '--art-ratio': ratioOf(item) }"
          >
            <!-- 删除按钮必须是 .artwork-button 的兄弟节点：button 不能嵌 button -->
            <div class="artwork-tools">
              <template v-if="pendingDeleteId === item.id">
                <button class="artwork-tool danger" type="button" :disabled="deleting"
                  @click="confirmDelete(item)">{{ deleting ? '删除中…' : '确认删除' }}</button>
                <button class="artwork-tool" type="button" :disabled="deleting"
                  @click="pendingDeleteId = null">取消</button>
              </template>
              <button v-else class="artwork-tool" type="button"
                :aria-label="`删除作品：${sceneTitle(item.scene)}`"
                @click="pendingDeleteId = item.id">删除</button>
            </div>
            <button
              class="artwork-button"
              type="button"
              :aria-label="`欣赏作品：${sceneTitle(item.scene)}`"
              @click="openViewer(indexOf(item))"
            >
              <div class="artwork-media" :style="{ '--art-ratio': String(ratioOf(item)) }">
                <img
                  v-if="cardUrls[item.id]"
                  class="artwork-image"
                  :src="cardUrls[item.id]"
                  :alt="sceneTitle(item.scene)"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  @load="measure(item.id, $event)"
                />
                <div v-else class="artwork-placeholder">✦</div>
                <div class="artwork-caption">
                  <span>
                    <span class="artwork-name">{{ sceneTitle(item.scene) }}</span>
                    <span class="artwork-date">{{ formatDate(stamp(item)) }}</span>
                  </span>
                  <span class="artwork-mark">{{ item.favorite ? '♥' : '＋' }}</span>
                </div>
              </div>
            </button>
          </article>
        </template>
      </div>
    </section>
  </article>

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
          {{ characterName(current.character) }} · {{ formatDate(stamp(current)) }} · v{{ current.version || 1 }}
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
          <button v-if="pendingDeleteId !== current.id" class="btn btn-ghost btn-danger" type="button"
            @click="pendingDeleteId = current.id">删除这幅</button>
          <template v-else>
            <button class="btn btn-danger" type="button" :disabled="deleting"
              @click="confirmDelete(current)">{{ deleting ? '删除中…' : '确认删除（不可撤销）' }}</button>
            <button class="btn btn-ghost" type="button" :disabled="deleting"
              @click="pendingDeleteId = null">取消</button>
          </template>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { kvInit, kvGet, kvSet } from '@/composables/useKVStore'
import { imgGet, imgDelete } from '@/composables/useImageStore'
import { useSceneStore } from '@/stores/sceneStore'
import { useFocusTrap } from '@/composables/useFocusTrap'

const sceneStore = useSceneStore()

const HISTORY_KEY = 'aics_pb_history'
// 必须与 useBackup.ts 的 PROJECT_KEY 一致。曾经这里写 'aics_projects'，
// 而备份/恢复读写 'aics_pb_projects' → 两边各操作一套数据且会永久分叉。
const PROJECT_KEY = 'aics_pb_projects'
/** 旧键，仅用于一次性迁移 */
const LEGACY_PROJECT_KEY = 'aics_projects'

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
/** 图片实际比例，键为历史条目 id；元数据不可信时以此为准 */
const measuredRatios = reactive<Record<string, number>>({})
/** 待确认删除的条目 id：删除不可撤销，所以要点两次 */
const pendingDeleteId = ref<string | number | null>(null)
const deleting = ref(false)
const closeBtn = ref<HTMLElement | null>(null)
const viewerEl = ref<HTMLElement | null>(null)
const objectUrls = new Set<string>()
/** 查看器当前显示的 blob URL，翻页时要主动释放 */
let viewerObjectUrl = ''

/* ---------- 派生数据 ---------- */
const visible = computed(() => {
  let source = favoriteOnly.value ? history.value.filter(i => i.favorite) : history.value.slice()
  if (projectFilter.value) {
    const p = projects.value.find(x => x.id === projectFilter.value)
    if (p) source = source.filter(i => Array.isArray(p.history_ids) && p.history_ids.includes(i.id))
  }
  // 历史是按生成顺序 append 的，展墙必须自己排：最新在前。
  // 之前直接用了存储顺序，所以作品册永远是最旧的排在最上面。
  return source.sort((a, b) => stamp(b) - stamp(a))
})
const favoriteCount = computed(() => history.value.filter(i => i.favorite).length)
const countLabel = computed(() => `${visible.value.length} 幅作品`)
const current = computed(() => visible.value[viewerIndex.value] || null)

const groups = computed(() => {
  const order = ['今天', '本周', '更早']
  const buckets: Record<string, any[]> = {}
  visible.value.forEach(item => {
    const key = dayGroup(stamp(item))
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
/** 时间戳兜底：老记录可能把 timestamp 存成字符串，或干脆没有 */
function stamp(item: any): number {
  const t = new Date(item?.timestamp).getTime()
  if (Number.isFinite(t)) return t
  const fromId = Number(item?.id)
  return Number.isFinite(fromId) ? fromId : 0
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
function clampRatio(r: number) { return Math.max(0.36, Math.min(2.8, r)) }

/**
 * 画框比例。
 *
 * `size` 记的是保存快照那一刻下拉框里的值，不是这张图真实的像素尺寸——
 * 中途切场景把尺寸改成横图再保存，竖图就会套上横构图的框，画面被压在
 * 中间、两侧留黑。所以真实尺寸（naturalWidth/Height，见 measure()）优先，
 * 只有还没解码出来时才退回元数据。
 */
function ratioOf(item: any) {
  const measured = measuredRatios[item.id]
  if (measured) return clampRatio(measured)
  let w = Number(item.width || item.image_width || item.actual?.width)
  let h = Number(item.height || item.image_height || item.actual?.height)
  if (!(w > 0 && h > 0)) {
    const m = String(item.size || '').match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i)
    if (m) { w = Number(m[1]); h = Number(m[2]) }
  }
  return clampRatio(w > 0 && h > 0 ? w / h : 3 / 4)
}

/** 图片解码完成后用真实像素纠正画框 */
function measure(id: string | number, e: Event) {
  const img = e.target as HTMLImageElement
  if (!img.naturalWidth || !img.naturalHeight) return
  const r = img.naturalWidth / img.naturalHeight
  if (Math.abs((measuredRatios[id] ?? 0) - r) > 0.001) measuredRatios[id] = r
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
      const blob = item.image_id ? await imgGet(item.image_id) : null
      if (blob) cardUrls[item.id] = trackUrl(URL.createObjectURL(blob))
      else if (fallback) cardUrls[item.id] = fallback
      else if (item.image_data && String(item.image_data).startsWith('data:image/')) cardUrls[item.id] = item.image_data
    } catch {
      if (fallback) cardUrls[item.id] = fallback
    }
  }
}

async function hydrateViewer(item: any, seq: number) {
  // 上一张查看器大图用完就释放：卡片缩略图有 cardUrls 去重，
  // 而查看器每翻一张都新建一个 blob URL，不放就攒到卸载才清。
  releaseViewerUrl()
  viewerUrl.value = ''
  const fallback = safeImageUrl(item.image_url)
  try {
    const blob = item.image_id ? await imgGet(item.image_id) : null
    if (seq !== viewerIndex.value) return
    if (blob) {
      viewerObjectUrl = URL.createObjectURL(blob)
      objectUrls.add(viewerObjectUrl)
      viewerUrl.value = viewerObjectUrl
    }
    else if (fallback) viewerUrl.value = fallback
    else if (item.image_data && String(item.image_data).startsWith('data:image/')) viewerUrl.value = item.image_data
  } catch { viewerUrl.value = '' }
}

/** 查看器当前大图的 blob URL；卡片缩略图不走这里 */
function releaseViewerUrl() {
  if (!viewerObjectUrl) return
  // 缩略图可能复用同一个 URL，只释放没被 cardUrls 引用的
  const stillUsed = Object.values(cardUrls).includes(viewerObjectUrl)
  if (!stillUsed) {
    URL.revokeObjectURL(viewerObjectUrl)
    objectUrls.delete(viewerObjectUrl)
  }
  viewerObjectUrl = ''
}

/* ---------- Viewer 控制 ---------- */
function openViewer(index: number) {
  if (!visible.value[index]) return
  viewerIndex.value = index
  infoOpen.value = false
  hydrateViewer(visible.value[index], index)
}
function closeViewer() {
  viewerIndex.value = -1
  infoOpen.value = false
  releaseViewerUrl()
  viewerUrl.value = ''
}

// 焦点存取、Tab 陷阱、Escape、滚动锁统一由 useFocusTrap 负责。
// 这里原本是全项目唯一做对的那份实现，已抽成 composable 给其余弹层复用。
useFocusTrap(viewerEl, () => viewerIndex.value >= 0, {
  onEscape: closeViewer,
  initialFocus: closeBtn,
})
function step(delta: number) {
  const next = viewerIndex.value + delta
  if (next >= 0 && next < visible.value.length) openViewer(next)
}
/* ---------- 删除 ---------- */
/**
 * 从作品册移除一幅：历史条目 + IndexedDB 里的原图一起删，
 * 否则图片会变成没人引用的孤儿，继续占着配额。
 */
async function confirmDelete(item: any) {
  if (deleting.value) return
  deleting.value = true
  try {
    const wasOpen = viewerIndex.value >= 0
    const removedIndex = visible.value.indexOf(item)

    history.value = history.value.filter(h => h.id !== item.id)
    await kvSet(HISTORY_KEY, history.value)
    if (item.image_id) await imgDelete(item.image_id).catch(() => {})

    // 释放这张卡自己的 object URL，并清掉派生缓存
    const url = cardUrls[item.id]
    if (url && url.startsWith('blob:')) { URL.revokeObjectURL(url); objectUrls.delete(url) }
    delete cardUrls[item.id]
    delete measuredRatios[item.id]
    pendingDeleteId.value = null

    // 查看器开着就顺移到下一幅，删到空则关闭
    if (wasOpen) {
      if (!visible.value.length) closeViewer()
      else openViewer(Math.min(Math.max(removedIndex, 0), visible.value.length - 1))
    }
  } catch (e) {
    console.warn('delete artwork failed', e)
  } finally {
    deleting.value = false
  }
}

function copyPrompt() {
  if (current.value?.prompt) navigator.clipboard.writeText(current.value.prompt)
}

/* ---------- 键盘 ---------- */
function onKeydown(e: KeyboardEvent) {
  if (viewerIndex.value < 0) return
  // Escape 与 Tab 陷阱由 useFocusTrap 处理
  if (e.key === 'ArrowLeft') return step(-1)
  if (e.key === 'ArrowRight') return step(1)
  if (e.key.toLowerCase() === 'i') { infoOpen.value = !infoOpen.value; return }
}

/* ---------- 初始化 ---------- */
onMounted(async () => {
  document.addEventListener('keydown', onKeydown)
  try {
    await kvInit()
    let historyRaw = await kvGet<any[]>(HISTORY_KEY)
    let projectRaw = await kvGet<any[]>(PROJECT_KEY)
    if (!historyRaw) {
      try { historyRaw = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null') } catch {}
      if (Array.isArray(historyRaw) && historyRaw.length) {
        await kvSet(HISTORY_KEY, historyRaw); localStorage.removeItem(HISTORY_KEY)
      }
    }
    if (!projectRaw) {
      try { projectRaw = JSON.parse(localStorage.getItem(PROJECT_KEY) || 'null') } catch {}
      if (Array.isArray(projectRaw) && projectRaw.length) {
        await kvSet(PROJECT_KEY, projectRaw); localStorage.removeItem(PROJECT_KEY)
      }
    }
    // 一次性迁移：把旧键 'aics_projects' 下的项目搬到统一键，避免用户之前建的项目凭空消失
    if (!projectRaw) {
      let legacy: any = await kvGet(LEGACY_PROJECT_KEY).catch(() => null)
      if (!legacy) {
        try { legacy = JSON.parse(localStorage.getItem(LEGACY_PROJECT_KEY) || 'null') } catch {}
      }
      if (Array.isArray(legacy) && legacy.length) {
        projectRaw = legacy
        await kvSet(PROJECT_KEY, legacy)
        localStorage.removeItem(LEGACY_PROJECT_KEY)
      }
    }
    history.value = Array.isArray(historyRaw) ? historyRaw.filter((item: any) => item && typeof item === 'object') : []
    projects.value = Array.isArray(projectRaw) ? projectRaw : []
  } catch (e) { console.warn('gallery storage init failed', e) }

  try {
    await sceneStore.load()
    scenes.value = sceneStore.scenes as any[]
    loras.value = sceneStore.loras as any[]
  } catch (e) { console.warn('gallery data load failed', e) }
  await hydrateCards()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
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
