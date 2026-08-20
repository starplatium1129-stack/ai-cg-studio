<template>
  <article class="gallery-shell gallery-page" ref="shellEl">
    <ArchivePageHero
      class="gallery-intro"
      chapter="06"
      section="Private archive"
      shape="frame"
      label="私人作品档案的画框粒子标记"
      caption="COLLECTION 06 / 08"
      compact
    >
      <div>
        <div class="gallery-kicker">Private collection</div>
        <h1 class="gallery-title">作品册</h1>
        <p class="gallery-subtitle">以纯净的原始比例安静欣赏。沉浸于画面，参数仅在需要时优雅呈现。</p>
      </div>
      <template #meta><div class="gallery-count">{{ countLabel }}</div></template>
    </ArchivePageHero>

    <div class="gallery-toolbar sticky-toolbar" aria-label="作品筛选" data-reveal>
      <button class="gallery-filter" :class="{ active: favoriteOnly }" type="button" :aria-pressed="favoriteOnly" @click="favoriteOnly = !favoriteOnly">
        <ArchiveIcon name="love" /> 收藏 {{ favoriteCount }}
      </button>
      <select v-model="projectFilter" class="gallery-project" aria-label="按项目筛选">
        <option value="">全部项目</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.title }}</option>
      </select>
      <span class="gallery-toolbar-note">点作品进入沉浸观画</span>
    </div>

    <section aria-live="polite" data-reveal data-reveal-delay="1">
      <ArchiveStatePanel
        v-if="galleryLoading"
        class="gallery-loading-wall"
        kind="loading"
        title="正在读取本地作品档案"
        message="先建立展墙结构，再逐张解码原图。"
      />
      <ArchiveStatePanel
        v-else-if="galleryError"
        kind="error"
        title="本地作品档案读取失败"
        :message="galleryError"
      >
        <button class="btn btn-primary" type="button" @click="loadGalleryStorage">重新读取</button>
      </ArchiveStatePanel>
      <ArchiveStatePanel
        v-else-if="!history.length"
        kind="empty"
        title="展墙还在等你的第一幅作品"
        message="画好之后，它会按自己的横竖比例住进来。作品只存在这台电脑，参数不挡画面。"
      >
        <RouterLink class="btn btn-primary" to="/prompt-builder">开始绘制</RouterLink>
      </ArchiveStatePanel>
      <ArchiveStatePanel
        v-else-if="!visible.length"
        kind="filtered"
        title="当前筛选下没有作品"
        message="作品仍在本地档案中，重置收藏或项目筛选即可重新显示。"
      >
        <button class="btn btn-primary" type="button" @click="resetGalleryFilters">重置筛选</button>
      </ArchiveStatePanel>
      <div v-else class="gallery-wall stagger-container">
        <template v-for="group in groups" :key="group.key">
          <div class="gallery-section">{{ group.key }}</div>
          <article
            v-for="item in group.items"
            :key="item.id"
            class="artwork"
            :class="{ 'artwork-pending': pendingDeleteId === item.id }"
            :data-card-id="String(item.id)"
            :style="{ '--art-ratio': ratioOf(item) }"
          >
            <!-- 快捷工具条 -->
            <div class="artwork-tools">
              <template v-if="pendingDeleteId === item.id">
                <button class="artwork-tool danger" type="button" :disabled="deleting"
                  @click="confirmDelete(item)">{{ deleting ? '删除中…' : '确认删除' }}</button>
                <button class="artwork-tool" type="button" :disabled="deleting"
                  @click="pendingDeleteId = null">取消</button>
              </template>
              <template v-else>
                <RouterLink class="artwork-tool" :to="`/prompt-builder?remix=${encodeURIComponent(item.id || '')}`" title="以此作品配方回填创作台">Remix</RouterLink>
                <button class="artwork-tool" type="button"
                  :aria-label="`删除作品：${sceneTitle(item.scene, item)}`"
                  @click="pendingDeleteId = item.id">删除</button>
              </template>
            </div>
            <button
              class="artwork-button"
              type="button"
              :aria-label="`欣赏作品：${sceneTitle(item.scene, item)}`"
              @click="openViewer(indexOf(item))"
            >
              <div class="artwork-media" :style="{ '--art-ratio': String(ratioOf(item)) }">
                <img
                  v-if="cardUrls[item.id] || thumbUrls[item.id]"
                  class="artwork-image"
                  :src="cardUrls[item.id] || thumbUrls[item.id]"
                  :alt="sceneTitle(item.scene, item)"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  @load="measure(item, $event)"
                />
                <div v-else-if="missingImageIds.has(item.id)" class="artwork-placeholder"><ArchiveIcon name="image" /></div>
                <div v-else class="artwork-skeleton" aria-hidden="true"></div>
                <div class="artwork-caption">
                  <span>
                    <span class="artwork-name">{{ sceneTitle(item.scene, item) }}</span>
                    <span class="artwork-date">{{ formatDate(stamp(item)) }}</span>
                  </span>
                  <span class="artwork-mark"><ArchiveIcon v-if="item.favorite" name="love" /><span v-else aria-hidden="true">＋</span></span>
                </div>
              </div>
            </button>
          </article>
        </template>
      </div>
    </section>

    <!-- 沉浸查看器（Teleport 渲染到 body；放在根元素内保持单根，
         否则多根组件不会继承 AppLayout 注入的 route-view class） -->
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
        <template v-if="compareMode && hasComparableImage && viewerUrl">
          <div class="viewer-compare-host">
            <ImageCompareSlider
              :before-src="parentImageUrl || thumbUrls[current!.id]"
              :after-src="viewerUrl"
              :before-label="parentImageUrl ? '父版本 (原图)' : '缩略预览'"
              after-label="当前原片"
            />
          </div>
        </template>
        <img v-else-if="viewerUrl" class="viewer-image" :src="viewerUrl" :alt="current ? sceneTitle(current.scene, current) : ''" decoding="async" />
        <div v-else class="viewer-fallback"><ArchiveIcon name="image" /></div>
        <button class="viewer-nav viewer-next" type="button" aria-label="下一幅" :disabled="viewerIndex >= visible.length - 1" @click="step(1)">›</button>
        <button v-if="hasComparableImage && viewerUrl" class="viewer-compare-toggle" :class="{ active: compareMode }" type="button" :title="compareMode ? '退出对比' : '开启对比滑块'" @click="compareMode = !compareMode">
          <ArchiveIcon name="spark" /> 对比
        </button>
        <button class="viewer-info-toggle" type="button" aria-label="作品信息" @click="infoOpen = !infoOpen">i</button>
        <div class="viewer-position">{{ viewerIndex + 1 }} / {{ visible.length }}</div>
      </section>

      <aside class="viewer-info" v-if="current">
        <div class="viewer-kicker">Artwork {{ viewerIndex + 1 }}</div>
        <h2 class="viewer-title">{{ sceneTitle(current.scene, current) }}</h2>
        <div class="viewer-meta">
          {{ characterName(current.character, current) }} · {{ formatDate(stamp(current)) }} · v{{ current.version || 1 }}
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
          <RouterLink class="btn btn-primary" :to="`/prompt-builder?remix=${encodeURIComponent(current.id || '')}`"><ArchiveIcon name="spark" /> Remix 配方</RouterLink>
          <RouterLink class="btn btn-ghost" :to="`/prompt-builder?regen=${encodeURIComponent(current.id || '')}`">原参重跑</RouterLink>
          <button class="btn btn-ghost" type="button" @click="downloadCurrent">下载原图</button>
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
  </article>

</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { kvInit, kvGet, kvSet } from '@/composables/useKVStore'
import { imgGet } from '@/composables/useImageStore'
import { artworkRepository } from '@/storage/artworkRepository'
import { useSceneStore } from '@/stores/sceneStore'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useToast } from '@/composables/useToast'
import ArchivePageHero from '@/components/visual/ArchivePageHero.vue'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import ImageCompareSlider from '@/components/visual/ImageCompareSlider.vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { jpegThumbDataUrl, thumbKey } from '@/utils/imageThumb'
import type { Scene, LoraMeta } from '@/stores/sceneStore'
import { artworkTimestamp, parseArtworkRecords, type ArtworkRecord } from '@/types/artwork'
import { formatA1111Parameters, injectPngMetadata } from '@/utils/pngMetadata'

const sceneStore = useSceneStore()
useScrollReveal()
const { show: showToast } = useToast()

const HISTORY_KEY = 'aics_pb_history'
// 必须与 useBackup.ts 的 PROJECT_KEY 一致。曾经这里写 'aics_projects'，
// 而备份/恢复读写 'aics_pb_projects' → 两边各操作一套数据且会永久分叉。
const PROJECT_KEY = 'aics_pb_projects'
/** 旧键，仅用于一次性迁移 */
const LEGACY_PROJECT_KEY = 'aics_projects'

interface GalleryProject {
  id: string
  title: string
  history_ids: Array<string | number>
}

const history = ref<ArtworkRecord[]>([])
const projects = ref<GalleryProject[]>([])
const scenes = ref<Scene[]>([])
const loras = ref<LoraMeta[]>([])
const favoriteOnly = ref(false)
const projectFilter = ref('')
const galleryLoading = ref(true)
const galleryError = ref('')
const viewerIndex = ref(-1)
const infoOpen = ref(false)
const compareMode = ref(false)
const viewerUrl = ref('')
const cardUrls = reactive<Record<string, string>>({})
/** 缩略图缓存（KV dataURL），比 HD blob 快读先显示 */
const thumbUrls = reactive<Record<string, string>>({})
const missingImageIds = ref(new Set<string | number>())
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
let viewerLoadToken = 0
let unmounted = false

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
  const buckets: Record<string, ArtworkRecord[]> = {}
  visible.value.forEach(item => {
    const key = dayGroup(stamp(item))
    ;(buckets[key] = buckets[key] || []).push(item)
  })
  return order.filter(k => buckets[k]?.length).map(k => ({ key: k, items: buckets[k] }))
})

const parentArtwork = computed(() => {
  const pId = current.value?.parent_id
  if (!pId) return null
  return history.value.find(h => String(h.id) === String(pId)) || null
})

const parentImageUrl = computed(() => {
  if (!parentArtwork.value) return ''
  const pId = parentArtwork.value.id
  return cardUrls[pId] || thumbUrls[pId] || ''
})

const hasComparableImage = computed(() => {
  if (!current.value) return false
  return Boolean(parentImageUrl.value || thumbUrls[current.value.id])
})

function resetGalleryFilters() {
  favoriteOnly.value = false
  projectFilter.value = ''
}

const facts = computed(() => {
  if (!current.value) return []
  const i = current.value
  return [
    { label: '尺寸', value: i.size || '' },
    { label: 'LoRA', value: loraName(i.lora) },
    { label: '模型', value: modelName(i.checkpoint) },
    { label: 'Seed', value: i.seed == null ? '' : String(i.seed) },
    { label: 'Sampler', value: i.sampler || '' },
  ]
})

/* ---------- 工具函数 ---------- */
function sceneFor(id: string | null | undefined) { return scenes.value.find(s => s.id === id) }
function sceneTitle(id: string | null | undefined, item?: ArtworkRecord) {
  if (item?.sceneTitle) return item.sceneTitle
  const title = sceneFor(id)?.title
  if (typeof title === 'string' && title) return title
  if (item?.subject === 'popular' || item?.characterId) {
    const popChar = sceneStore.popularCharacters.find(c => c.id === (item.characterId || item.character))
    if (popChar) return `${popChar.displayName} 创作`
  }
  if (item?.story) return item.story.slice(0, 20)
  return id || '未命名作品'
}
function loraName(id: string | null | undefined) {
  if (!id) return '—'
  const item = loras.value.find(l => l.id === id || (l.name && (l.name === id || String(id).startsWith(l.name))))
  return item ? item.name : id
}
function modelName(value: string | undefined) {
  if (!value) return 'WebUI 当前模型'
  const name = String(value).split(/[\\/]/).pop()!.replace(/\s*\[[a-f0-9]+\]\s*$/i, '')
  return name.length > 42 ? name.slice(0, 39) + '…' : name
}
function characterName(v: string | undefined, item?: ArtworkRecord) {
  if (v === 'nene') return '绫地宁宁'
  if (v === 'natsume') return '四季夏目'
  if (v === 'triad' || v === 'both') return '宁宁与夏目'
  const popId = item?.characterId || v
  if (popId) {
    const popChar = sceneStore.popularCharacters.find(c => c.id === popId)
    if (popChar) return popChar.displayName
  }
  return v || '—'
}
/** 时间戳兜底：老记录可能把 timestamp 存成字符串，或干脆没有 */
function stamp(item: ArtworkRecord): number { return artworkTimestamp(item) }
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
function ratioOf(item: ArtworkRecord) {
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

/** 图片解码完成后用真实像素纠正画框；HD 图顺带回填缩略图缓存 */
function measure(item: ArtworkRecord, e: Event) {
  const img = e.target as HTMLImageElement
  if (!img.naturalWidth || !img.naturalHeight) return
  const r = img.naturalWidth / img.naturalHeight
  if (Math.abs((measuredRatios[item.id] ?? 0) - r) > 0.001) measuredRatios[item.id] = r
  // 只有高清图（非缩略图）才回填，用已解码的 img 画缩略图，零额外解码
  if (img.naturalWidth >= 700) void cacheBackfillThumb(item, img)
}

/** 防同一张图并发重复生成缩略图 */
const thumbPending = new Set<string>()

async function cacheBackfillThumb(item: ArtworkRecord, img: HTMLImageElement) {
  const imageId = item.image_id
  if (!imageId || thumbPending.has(imageId) || thumbUrls[item.id]) return
  thumbPending.add(imageId)
  try {
    const dataUrl = jpegThumbDataUrl(img)
    if (dataUrl) {
      await kvSet(thumbKey(imageId), dataUrl)
      thumbUrls[item.id] = dataUrl
    }
  } catch { /* 缩略图只是缓存，失败不影响展示 */ }
  finally { thumbPending.delete(imageId) }
}
function indexOf(item: ArtworkRecord) { return visible.value.indexOf(item) }
function safeImageUrl(v: string | undefined) {
  if (typeof v !== 'string' || !v.trim()) return ''
  try {
    const url = new URL(v.trim(), location.href)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch { return '' }
}
function trackUrl(url: string) { objectUrls.add(url); return url }
function markImageMissing(id: string | number) {
  missingImageIds.value = new Set([...missingImageIds.value, id])
}
function revokeAll() {
  objectUrls.forEach(u => URL.revokeObjectURL(u))
  objectUrls.clear()
}

/* ---------- 图片加载 ---------- */
/**
 * 缩略图（KV 小 dataURL）便宜：整墙全量补齐，先让每张卡有图。
 * HD blob 贵且占内存（KeepAlive 后几百张大图数百 MB），改为可见性驱动：
 * IntersectionObserver 只对进入视口 ±600px 的卡片发起 HD 读取，配合
 * LRU 上限滚动淘汰。旧实现是「全量读出 → 丢掉超出 40 张的」，几百张
 * 作品时绝大多数 IndexedDB 读取和 blob 创建都是纯浪费。
 * 查看器大图单独走 hydrateViewer，不受上限影响。
 */
/** 缩略图是 KV 小 dataURL，读得快，并发放高 */
const THUMB_CONCURRENCY = 8
/** HD 读取并发 */
const CARD_CONCURRENCY = 4
/** 常驻 HD blob 上限，超出按 LRU 淘汰并回落缩略图 */
const HD_CACHE_LIMIT = 40
const cardLruOrder = new Map<string | number, 1>()
const cardQueue: ArtworkRecord[] = []
const queuedCardIds = new Set<string | number>()
let cardWorkers = 0

function touchCardLru(id: string | number) {
  cardLruOrder.delete(id)
  cardLruOrder.set(id, 1)
}

function trimCardUrls() {
  if (cardLruOrder.size <= HD_CACHE_LIMIT) return
  const excess = cardLruOrder.size - HD_CACHE_LIMIT
  for (const id of [...cardLruOrder.keys()].slice(0, excess)) {
    cardLruOrder.delete(id)
    const url = cardUrls[id]
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
      objectUrls.delete(url)
    }
    delete cardUrls[id]
  }
}

async function hydrateThumbs() {
  const pending = visible.value.filter(item => !cardUrls[item.id] && !thumbUrls[item.id])
  let index = 0
  async function worker() {
    while (index < pending.length) {
      const item = pending[index++]
      if (unmounted) return
      if (!item.image_id) continue
      try {
        const thumb = await kvGet<string>(thumbKey(item.image_id))
        if (unmounted) return
        if (typeof thumb === 'string' && thumb.startsWith('data:image/')) {
          thumbUrls[item.id] = thumb
        }
      } catch { /* 缩略图缺失正常，直接走 HD */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(THUMB_CONCURRENCY, pending.length) }, () => worker()))
}

async function hydrateCard(item: ArtworkRecord) {
  const fallback = safeImageUrl(item.image_url)
  let resolved = false
  try {
    const blob = item.image_id ? await imgGet(item.image_id) : null
    if (unmounted) return
    if (blob) { cardUrls[item.id] = trackUrl(URL.createObjectURL(blob)); resolved = true }
    else if (fallback) { cardUrls[item.id] = fallback; resolved = true }
    else if (item.image_data && String(item.image_data).startsWith('data:image/')) { cardUrls[item.id] = item.image_data; resolved = true }
    else markImageMissing(item.id)
  } catch {
    if (fallback) { cardUrls[item.id] = fallback; resolved = true }
    else markImageMissing(item.id)
  }
  if (!resolved) return
  // 读取期间被删除的条目：URL 不入册直接释放，避免缓存里留下孤儿
  if (!history.value.some(entry => entry.id === item.id)) {
    const url = cardUrls[item.id]
    if (url && url.startsWith('blob:')) { URL.revokeObjectURL(url); objectUrls.delete(url) }
    delete cardUrls[item.id]
    return
  }
  touchCardLru(item.id)
  trimCardUrls()
}

/** 只有走进视口的卡片才读 HD；再次可见的已淘汰卡片会按需重读 */
function requestCardHydration(item: ArtworkRecord) {
  if (cardUrls[item.id]) { touchCardLru(item.id); return }
  if (missingImageIds.value.has(item.id) || queuedCardIds.has(item.id)) return
  queuedCardIds.add(item.id)
  cardQueue.push(item)
  pumpCardQueue()
}

function pumpCardQueue() {
  while (cardWorkers < CARD_CONCURRENCY && cardQueue.length) {
    const item = cardQueue.shift()!
    cardWorkers += 1
    void hydrateCard(item).finally(() => {
      cardWorkers -= 1
      queuedCardIds.delete(item.id)
      pumpCardQueue()
    })
  }
}

/* ---------- 可见性驱动 HD 补图 ---------- */
const shellEl = ref<HTMLElement | null>(null)
const observedCards = new Map<Element, ArtworkRecord>()
let cardObserver: IntersectionObserver | null = null

/**
 * （重）扫描展墙卡片并挂观察器。筛选变化会重建部分节点，旧节点若不
 * unobserve 会一直被 IntersectionObserver 强引用——所以每次全量重挂。
 */
function scanWallCards() {
  if (!shellEl.value || !visible.value.length) return
  if (!cardObserver) {
    cardObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const item = observedCards.get(entry.target)
        if (item) requestCardHydration(item)
      }
    }, { rootMargin: '600px 0px' })
  }
  for (const el of observedCards.keys()) cardObserver.unobserve(el)
  observedCards.clear()
  const byId = new Map(visible.value.map(item => [String(item.id), item]))
  for (const el of shellEl.value.querySelectorAll<HTMLElement>('.artwork')) {
    const item = byId.get(el.dataset.cardId || '')
    if (!item) continue
    observedCards.set(el, item)
    cardObserver.observe(el)
  }
}

async function hydrateViewer(item: ArtworkRecord) {
  // 上一张查看器大图用完就释放：卡片缩略图有 cardUrls 去重，
  // 而查看器每翻一张都新建一个 blob URL，不放就攒到卸载才清。
  releaseViewerUrl()
  viewerUrl.value = ''
  const token = ++viewerLoadToken
  const fallback = safeImageUrl(item.image_url)
  try {
    const blob = item.image_id ? await imgGet(item.image_id) : null
    if (unmounted || token !== viewerLoadToken || current.value?.id !== item.id) return
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
  const item = visible.value[index]
  if (!item) return
  viewerIndex.value = index
  infoOpen.value = false
  compareMode.value = false
  void hydrateViewer(item)
}
function closeViewer() {
  viewerLoadToken += 1
  viewerIndex.value = -1
  infoOpen.value = false
  compareMode.value = false
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
async function confirmDelete(item: ArtworkRecord) {
  if (deleting.value) return
  deleting.value = true
  try {
    const wasOpen = viewerIndex.value >= 0
    const removedIndex = visible.value.indexOf(item)

    // Repository 先完成跨库删除与补偿回滚，再改界面；失败时界面不动作。
    const next = history.value.filter(h => h.id !== item.id)
    await artworkRepository.deleteArtwork(item.id)
    history.value = next

    // 释放这张卡自己的 object URL，并清掉派生缓存
    const url = cardUrls[item.id]
    if (url && url.startsWith('blob:')) { URL.revokeObjectURL(url); objectUrls.delete(url) }
    delete cardUrls[item.id]
    cardLruOrder.delete(item.id)
    delete thumbUrls[item.id]
    if (missingImageIds.value.delete(item.id)) missingImageIds.value = new Set(missingImageIds.value)
    delete measuredRatios[item.id]
    pendingDeleteId.value = null

    // 查看器开着就顺移到下一幅，删到空则关闭
    if (wasOpen) {
      if (!visible.value.length) closeViewer()
      else openViewer(Math.min(Math.max(removedIndex, 0), visible.value.length - 1))
    }
  } catch (e) {
    console.warn('delete artwork failed', e)
    showToast('删除失败，请重试')
  } finally {
    deleting.value = false
  }
}

function copyPrompt() {
  const text = current.value?.prompt
  if (!text) return
  navigator.clipboard.writeText(text)
    .then(() => showToast('Prompt 已复制'))
    .catch(() => showToast('复制失败，请手动选取'))
}

/** 下载当前作品的原图文件（优先 IndexedDB 原图 blob，注入 Civitai 级元数据） */
async function downloadCurrent() {
  const item = current.value
  if (!item) return
  const name = (sceneTitle(item.scene) || 'artwork').replace(/[\\/:*?"<>|]/g, '_')
  const fileName = `${name}-${item.seed ?? item.id}.png`

  const metaText = formatA1111Parameters({
    prompt: item.prompt ? String(item.prompt) : undefined,
    negative: item.negative ? String(item.negative) : undefined,
    steps: item.steps ? Number(item.steps) : undefined,
    sampler: item.sampler ? String(item.sampler) : undefined,
    cfg: item.cfg ? Number(item.cfg) : undefined,
    seed: item.seed !== undefined && item.seed !== null ? item.seed : undefined,
    size: item.size ? String(item.size) : undefined,
    model: item.model ? String(item.model) : undefined,
    character: item.character ? String(item.character) : undefined,
  })

  let rawBlob: Blob | null = null
  if (item.image_id || item.id) {
    try {
      rawBlob = await imgGet(String(item.image_id || item.id))
    } catch { /* fallback below */ }
  }

  let finalBuffer: Uint8Array | null = null
  if (rawBlob) {
    try {
      const buffer = await rawBlob.arrayBuffer()
      finalBuffer = injectPngMetadata(buffer, metaText)
    } catch {
      finalBuffer = new Uint8Array(await rawBlob.arrayBuffer())
    }
  }

  // 桌面版：原生保存对话框，可自由选择保存位置
  if (window.companionDesktop && finalBuffer) {
    try {
      const result = await window.companionDesktop.saveImage({ data: finalBuffer, name: fileName })
      if (result.saved) showToast(`已保存到 ${result.filePath || '所选位置'}`)
      return
    } catch { /* 落到浏览器下载兜底 */ }
  }

  let url = ''
  if (finalBuffer) {
    const pngBlob = new Blob([new Uint8Array(finalBuffer.buffer as ArrayBuffer)], { type: 'image/png' })
    url = URL.createObjectURL(pngBlob)
  } else {
    url = cardUrls[item.id] || viewerUrl.value || thumbUrls[item.id] || ''
  }

  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (finalBuffer) setTimeout(() => URL.revokeObjectURL(url), 2000)
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
async function loadGalleryStorage() {
  galleryLoading.value = true
  galleryError.value = ''
  try {
    await kvInit()
    let historyRaw: unknown = await kvGet(HISTORY_KEY)
    let projectRaw: unknown = await kvGet(PROJECT_KEY)
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
      let legacy: unknown = await kvGet(LEGACY_PROJECT_KEY).catch(() => null)
      if (!legacy) {
        try { legacy = JSON.parse(localStorage.getItem(LEGACY_PROJECT_KEY) || 'null') } catch {}
      }
      if (Array.isArray(legacy) && legacy.length) {
        projectRaw = legacy
        await kvSet(PROJECT_KEY, legacy)
        localStorage.removeItem(LEGACY_PROJECT_KEY)
      }
    }
    history.value = parseArtworkRecords(historyRaw)
    projects.value = Array.isArray(projectRaw)
      ? projectRaw.flatMap((item): GalleryProject[] => {
          if (!item || typeof item !== 'object') return []
          const raw = item as Record<string, unknown>
          if (typeof raw.id !== 'string' && typeof raw.id !== 'number') return []
          return [{
            id: String(raw.id),
            title: String(raw.title || raw.name || raw.id),
            history_ids: Array.isArray(raw.history_ids)
              ? raw.history_ids.filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
              : [],
          }]
        })
      : []
  } catch (e) {
    galleryError.value = e instanceof Error ? e.message : String(e)
  } finally {
    galleryLoading.value = false
  }
}

onMounted(async () => {
  unmounted = false
  document.addEventListener('keydown', onKeydown)
  await loadGalleryStorage()

  try {
    await sceneStore.load()
    scenes.value = sceneStore.scenes
    loras.value = sceneStore.loras
  } catch (e) { console.warn('gallery data load failed', e) }
  void hydrateThumbs()
  await nextTick()
  scanWallCards()
})

onUnmounted(() => {
  unmounted = true
  viewerLoadToken += 1
  cardObserver?.disconnect()
  cardObserver = null
  observedCards.clear()
  document.removeEventListener('keydown', onKeydown)
  revokeAll()
})

watch(visible, () => {
  void hydrateThumbs()
  void nextTick(() => scanWallCards())
})
</script>

<style scoped>
.gallery-shell { width:min(1880px,100%); margin:0 auto; padding:clamp(24px,4vw,64px) clamp(14px,3vw,48px) var(--s-8); }
.gallery-intro { margin:0 auto clamp(24px,4vw,48px); max-width:1500px; }
.gallery-title { margin:0; color:var(--text-primary); font-family:var(--font-display); font-size:clamp(2rem,3.8vw,3.95rem); font-weight:760; letter-spacing:-.045em; line-height:.98; }
.gallery-subtitle { max-width:660px; margin:var(--s-3) 0 0; color:var(--text-secondary); font-size:clamp(.86rem,1.2vw,1rem); line-height:1.8; }
.gallery-count { color:var(--text-muted); font:650 var(--fs-label-xs) var(--font-mono); letter-spacing:.08em; white-space:nowrap; }

.gallery-toolbar { max-width:1500px; margin:0 auto clamp(24px,3vw,38px); display:flex; align-items:center; gap:var(--s-2); }
.gallery-filter { min-height:36px; padding:0 15px; border:1px solid transparent; border-radius:var(--r-terminal); background:transparent; color:var(--text-secondary); font:650 var(--fs-label-sm) var(--font-sans); cursor:pointer; transition:border-color var(--t-fast),background var(--t-fast),color var(--t-fast); }
.gallery-filter:hover,.gallery-filter.active { border-color:color-mix(in srgb,var(--accent) 34%,var(--border-soft)); background:var(--accent-soft); color:var(--accent); }
.gallery-project { min-height:36px; min-width:140px; padding:0 34px 0 13px; border:1px solid transparent; border-radius:var(--r-terminal); background:transparent; color:var(--text-secondary); font:650 var(--fs-label-sm) var(--font-sans); cursor:pointer; outline:none; }
.gallery-project:focus { border-color:var(--accent); }
.gallery-toolbar-note { margin-left:auto; padding-right:var(--s-3); color:var(--text-muted); font-size:var(--fs-mono-sm); white-space:nowrap; }

.gallery-wall { max-width:1500px; margin:0 auto; columns:4 260px; column-gap:clamp(12px,1.6vw,24px); }
.gallery-loading-wall { min-height:340px; }
.artwork { position:relative; break-inside:avoid; margin:0 0 clamp(12px,1.6vw,24px); overflow:hidden; border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent); border-radius:var(--r-dossier); background:var(--art-mat); box-shadow:var(--shadow-sm); content-visibility: auto; contain-intrinsic-size: auto 340px; transition:transform var(--t-base),box-shadow var(--t-base),border-color var(--t-base); }
.artwork::before { position:absolute; z-index:var(--z-raised); top:-1px; left:var(--s-3); width:28px; height:var(--line-hairline); background:var(--archive-cyan); content:""; opacity:.82; pointer-events:none; }
.artwork:hover { border-color:color-mix(in srgb,var(--accent) 38%,var(--border-soft)); box-shadow:var(--shadow-md); }
.artwork-button { display:block; width:100%; padding:0; border:0; background:transparent; color:inherit; cursor:zoom-in; }
.artwork-button:focus-visible { outline:3px solid var(--accent); outline-offset:-3px; }
.artwork-tools { position:absolute; z-index:var(--z-raised); top:var(--s-2); right:var(--s-2); display:flex; align-items:center; gap:4px; opacity:0; transform:translateY(-4px); pointer-events:none; transition:opacity var(--t-fast),transform var(--t-fast); }
.artwork:focus-within .artwork-tools,.artwork-pending .artwork-tools { opacity:1; transform:none; pointer-events:auto; }
.artwork-tool { min-height:30px; padding:0 var(--s-2); border:1px solid var(--on-art-line); border-radius:var(--r-terminal); background:var(--art-scrim); color:var(--on-art-primary); font:650 var(--fs-label-xs) var(--font-sans); cursor:pointer; -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); transition:background var(--t-fast),border-color var(--t-fast),color var(--t-fast); }
.artwork-tool:hover:not(:disabled) { border-color:color-mix(in srgb,var(--accent) 60%,var(--on-art-line)); background:color-mix(in srgb,var(--accent) 52%,var(--art-scrim)); }
.artwork-tool.danger { border-color:color-mix(in srgb,var(--danger) 54%,var(--on-art-line)); background:color-mix(in srgb,var(--danger) 48%,var(--art-scrim)); }
.artwork-tool.danger:hover:not(:disabled) { background:var(--danger); color:var(--text-inverse); }
.artwork-tool:focus-visible { outline:2px solid var(--on-art-primary); outline-offset:2px; }
.artwork-tool:disabled { cursor:wait; opacity:.65; }
.artwork-media { position:relative; width:100%; aspect-ratio:var(--art-ratio,3/4); overflow:hidden; background:linear-gradient(135deg,color-mix(in srgb,var(--art-mat) 88%,var(--glass-specular)),var(--art-mat)); }
.artwork-image { display:block; width:100%; height:100%; object-fit:contain; background:var(--art-mat); animation:galleryImageIn .35s ease; }
.artwork-placeholder { position:absolute; inset:0; display:grid; place-items:center; color:var(--on-art-secondary); font-size:var(--fs-glyph); }
.artwork-skeleton { position:absolute; inset:0; background:linear-gradient(105deg,var(--art-mat) 18%,color-mix(in srgb,var(--art-mat) 76%,var(--text-primary)) 42%,var(--art-mat) 68%); background-size:220% 100%; animation:gallerySkeleton 1.3s linear infinite; }
.artwork-caption { position:absolute; inset:auto 0 0; display:flex; align-items:flex-end; justify-content:space-between; gap:var(--s-3); padding:40px var(--s-3) var(--s-3); color:var(--on-art-primary); background:linear-gradient(transparent,var(--art-scrim)); opacity:0; transform:translateY(8px); transition:opacity var(--t-fast) var(--ease-out),transform var(--t-fast) var(--ease-out); text-align:left; pointer-events:none; }
.artwork-button:focus-visible .artwork-caption { opacity:1; transform:none; }
.artwork-name { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--fs-label-sm); font-weight:700; }
.artwork-date { display:block; margin-top:2px; color:var(--on-art-secondary); font-size:var(--fs-mono-xs); }
.artwork-mark { flex:0 0 auto; font-size:var(--fs-label-sm); }

.gallery-section { column-span:all; display:flex; align-items:center; gap:var(--s-3); margin:var(--s-3) 0 var(--s-4); color:var(--text-muted); font:700 var(--fs-mono-xs) var(--font-mono); letter-spacing:.13em; text-transform:uppercase; }
.gallery-section::after { content:""; height:1px; flex:1; background:var(--border-soft); }

@media (hover: hover) and (pointer: fine) {
  .artwork:hover { transform:translateY(-3px); }
  .artwork:hover .artwork-tools { opacity:1; transform:none; pointer-events:auto; }
  .artwork:hover .artwork-caption { opacity:1; transform:none; }
}

@media (max-width:900px) { .gallery-count { display:none; } }
@media (max-width:600px) {
  .gallery-shell { padding:var(--s-5) var(--s-3) var(--s-8); }
  .gallery-wall { columns:2 135px; column-gap:var(--s-3); }
  .artwork { margin-bottom:var(--s-3); border-radius:var(--r-dossier); }
  .artwork-caption { opacity:1; transform:none; padding:34px var(--s-2) var(--s-2); }
  .artwork-name { font-size:var(--fs-mono-sm); }
  .artwork-date { display:none; }
  .artwork-tools { opacity:0; transform:translateY(-4px); pointer-events:none; }
  .artwork-pending .artwork-tools { opacity:1; transform:none; pointer-events:auto; }
}
@media (prefers-reduced-motion:reduce) { .artwork,.artwork-caption { transition:none !important; } .artwork-skeleton { animation:none; } }
@keyframes gallerySkeleton { to { background-position:-120% 0; } }
@keyframes galleryImageIn { from { opacity:0; filter:blur(6px); } to { opacity:1; filter:blur(0); } }
</style>

<style>
/* 非 scoped：Teleport 到 body 的查看器 */
.art-viewer { position:fixed; inset:0; z-index:var(--z-overlay); display:none; grid-template-columns:minmax(0,1fr) minmax(290px,360px); background:var(--art-backdrop); color:var(--on-art-primary); }
.viewer-compare-host { width:100%; height:calc(100vh - 120px); max-width:min(90vw, 1200px); display:flex; align-items:center; justify-content:center; }
.viewer-compare-toggle {
  position:absolute; z-index:var(--z-raised); top:18px; right:64px;
  display:inline-flex; align-items:center; gap:4px;
  padding:6px 12px; border-radius:var(--r-pill);
  border:1px solid var(--on-art-line); background:var(--art-scrim);
  color:var(--on-art-primary); cursor:pointer; font:600 var(--fs-label-xs) var(--font-mono);
  -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);
  transition:background var(--t-fast), border-color var(--t-fast);
}
.viewer-compare-toggle:hover, .viewer-compare-toggle.active {
  border-color:var(--accent); background:color-mix(in srgb,var(--accent) 30%,var(--art-scrim)); color:var(--on-art-primary);
}
.art-viewer.open { display:grid; }
.viewer-stage { position:relative; min-width:0; display:grid; place-items:center; padding:clamp(46px,5vw,76px) clamp(48px,6vw,92px); overflow:hidden; }
.viewer-image { display:block; max-width:100%; max-height:calc(100vh - 92px); width:auto; height:auto; object-fit:contain; filter:drop-shadow(0 24px 56px var(--art-backdrop)); animation:galleryImageIn .35s ease; }
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
