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
      <!--
        展墙搜索（2026-08-30 UX 审计 P1）：攒到几百张之后，「找某一张旧作」是
        最高频也最痛苦的动作，此前只能靠翻。检索范围含场景名、角色、当时写的
        故事与完整 prompt——很多旧作只记得里面出现过某个词。
      -->
      <div class="gallery-search-field">
        <input v-model="searchQuery" type="search" class="gallery-search" aria-label="搜索作品"
          placeholder="搜场景、角色或关键词…" />
        <button v-if="searchQuery" class="gallery-search-clear" type="button" aria-label="清空搜索" @click="searchQuery = ''">×</button>
      </div>
      <button class="gallery-filter" :class="{ active: favoriteOnly }" type="button" :aria-pressed="favoriteOnly" @click="favoriteOnly = !favoriteOnly">
        <ArchiveIcon name="love" /> 收藏 {{ favoriteCount }}
      </button>
      <select v-model="projectFilter" class="gallery-project" aria-label="按项目筛选">
        <option value="">全部项目</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.title }}</option>
      </select>
      <!--
        多选（2026-08-30 UX 审计 P1）：清 500 张废稿原本要点约 1500 次（每张进大图
        → 点删除 → 再确认）。删除已改软删可撤销，批量删的风险随之降到可接受。
      -->
      <button class="gallery-filter" type="button" :class="{ active: selectMode }"
        :aria-pressed="selectMode" @click="toggleSelectMode">
        <ArchiveIcon name="pin" />{{ selectMode ? '退出选择' : '选择' }}
      </button>
      <!-- 回收站（2026-08-31）：查看/恢复软删作品，30 天保留 -->
      <button class="gallery-filter" type="button" :class="{ active: trashMode }"
        :aria-pressed="trashMode" @click="toggleTrashMode">
        <ArchiveIcon name="trash" />回收站{{ trashItems.length ? `（${trashItems.length}）` : '' }}
      </button>
      <span class="gallery-toolbar-note">{{ selectMode ? '点卡片勾选，再批量移入回收站' : '点作品进入沉浸观画' }}</span>
    </div>

    <div v-if="selectMode" class="gallery-bulkbar" role="region" aria-label="批量操作">
      <span class="gallery-bulk-count" aria-live="polite">已选 {{ selectedIds.size }} / {{ visible.length }}</span>
      <span class="gallery-bulk-actions">
        <button class="btn btn-ghost btn-sm" type="button" :disabled="!visible.length"
          @click="selectAllVisible">{{ allVisibleSelected ? '取消全选' : '全选当前' }}</button>
        <button class="btn btn-danger btn-sm" type="button" :disabled="!selectedIds.size || bulkDeleting"
          @click="bulkDelete">{{ bulkDeleting ? '处理中…' : `移入回收站（${selectedIds.size}）` }}</button>
        <button class="btn btn-ghost btn-sm" type="button" @click="toggleSelectMode">完成</button>
      </span>
    </div>

    <section aria-live="polite" data-reveal data-reveal-delay="1">
      <!-- 回收站视图（2026-08-31）：列出软删条目，可逐条恢复；30 天超期自动清理 -->
      <div v-if="trashMode" class="trash-wall">
        <div class="trash-toolbar">
          <span class="trash-hint">软删保留 30 天，超期自动清理；点「恢复」放回展墙</span>
          <span class="trash-count" aria-live="polite">{{ trashItems.length }} 条</span>
        </div>
        <template v-if="trashItems.length">
          <article
            v-for="entry in trashItems"
            :key="entry.id"
            class="artwork trash-card"
            :class="{ 'artwork-pending': trashBusy === entry.id }"
          >
            <div class="artwork-media" style="--art-ratio: 1">
              <img
                v-if="trashThumbs[entry.id]"
                class="artwork-image"
                :src="trashThumbs[entry.id]"
                :alt="trashPrompt(entry)"
                loading="lazy"
                decoding="async"
              />
              <div v-else class="artwork-placeholder"><ArchiveIcon name="image" /></div>
            </div>
            <div class="artwork-caption">
              <span class="artwork-name truncate">{{ trashPrompt(entry) }}</span>
              <span class="artwork-date">删除于 {{ formatTrashTime(entry.deletedAt) }}</span>
            </div>
            <div class="artwork-tools">
              <button class="artwork-tool" type="button" :disabled="trashBusy === entry.id"
                :aria-label="`恢复作品：${trashPrompt(entry)}`" title="恢复放回展墙"
                @click="restoreTrashItem(entry.id)">
                <ArchiveIcon name="spark" /><span>{{ trashBusy === entry.id ? '恢复中…' : '恢复' }}</span>
              </button>
            </div>
          </article>
        </template>
        <ArchiveStatePanel v-else kind="empty" title="回收站是空的"
          message="删除的作品会在这里保留 30 天，随时可以恢复。" />
      </div>
      <template v-else>
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
        message="作品仍在本地档案中，清空搜索或重置收藏 / 项目筛选即可重新显示。"
      >
        <button class="btn btn-primary" type="button" @click="resetGalleryFilters">重置筛选</button>
      </ArchiveStatePanel>
      <div v-else ref="wallEl" class="gallery-wall stagger-container" :style="{ '--wall-gap': wallGap }">
        <template v-for="group in wallGroups" :key="group.key">
          <div class="gallery-section">{{ group.key }}</div>
          <!--
            等高行：一行里的画共用同一高度，宽度按各自宽高比分配，左右刚好铺满。
            行高与列宽由 useJustifiedWall 实测容器宽度后算出，断行只发生在时间
            顺序的相邻两幅之间，因此「最新在前」的时间轴不被打乱。
          -->
          <div
            v-for="(row, rowIdx) in group.rows"
            :key="`${group.key}-${rowIdx}`"
            class="gallery-row"
            :style="{ height: `${row.height}px` }"
          >
            <article
              v-for="cell in row.cells"
              :key="cell.item.id"
              class="artwork"
              :class="{ 'artwork-pending': pendingDeleteId === cell.item.id, 'artwork-selected': selectMode && selectedIds.has(cell.item.id) }"
              :data-card-id="String(cell.item.id)"
              :style="{ width: `${cell.width}px` }"
            >
              <!-- 多选勾选标记：只在选择模式出现，纯视觉，状态由按钮的 aria-pressed 承载 -->
              <span v-if="selectMode" class="artwork-check" aria-hidden="true">
                <ArchiveIcon v-if="selectedIds.has(cell.item.id)" name="success" />
              </span>
              <!--
                快捷工具条：选择模式下让位给右上角的勾选标记。此时点卡片是勾选而非
                进大图，把收藏/沿用配方/删除留在原位会与勾选标记叠在一起，且容易误触。
              -->
              <div v-if="!selectMode" class="artwork-tools">
                <template v-if="pendingDeleteId === cell.item.id">
                  <button class="artwork-tool danger" type="button" :disabled="deleting"
                    @click="confirmDelete(cell.item)">{{ deleting ? '删除中…' : '确认删除' }}</button>
                  <button class="artwork-tool" type="button" :disabled="deleting"
                    @click="pendingDeleteId = null">取消</button>
                </template>
                <template v-else>
                  <button class="artwork-tool" type="button"
                    :class="{ 'artwork-tool-on': cell.item.favorite }"
                    :aria-pressed="!!cell.item.favorite"
                    :aria-label="`${cell.item.favorite ? '取消收藏' : '收藏'}：${sceneTitle(cell.item.scene, cell.item)}`"
                    title="收藏后可在顶部按「收藏」筛选"
                    @click="toggleFavorite(cell.item)">
                    <ArchiveIcon name="love" /><span>{{ cell.item.favorite ? '已收藏' : '收藏' }}</span>
                  </button>
                  <RouterLink class="artwork-tool" :to="`/prompt-builder?remix=${encodeURIComponent(cell.item.id || '')}`" title="以此作品配方回填创作台">
                    <ArchiveIcon name="spark" /><span>沿用配方</span>
                  </RouterLink>
                  <button class="artwork-tool danger" type="button"
                    :aria-label="`删除作品：${sceneTitle(cell.item.scene, cell.item)}`"
                    title="删除作品"
                    @click="pendingDeleteId = cell.item.id">
                    <ArchiveIcon name="close" /><span>删除</span>
                  </button>
                </template>
              </div>
              <button
                class="artwork-button"
                type="button"
                :aria-pressed="selectMode ? selectedIds.has(cell.item.id) : undefined"
                :aria-label="selectMode
                  ? `${selectedIds.has(cell.item.id) ? '取消选择' : '选择'}作品：${sceneTitle(cell.item.scene, cell.item)}`
                  : `欣赏作品：${sceneTitle(cell.item.scene, cell.item)}`"
                @click="selectMode ? toggleSelect(cell.item.id) : openViewer(indexOf(cell.item))"
              >
                <div class="artwork-media">
                  <img
                    v-if="cardUrls[cell.item.id] || thumbUrls[cell.item.id]"
                    class="artwork-image"
                    :src="cardUrls[cell.item.id] || thumbUrls[cell.item.id]"
                    :alt="sceneTitle(cell.item.scene, cell.item)"
                    loading="lazy"
                    decoding="async"
                    referrerpolicy="no-referrer"
                    @load="measure(cell.item, $event)"
                  />
                  <div v-else-if="missingImageIds.has(cell.item.id)" class="artwork-placeholder"><ArchiveIcon name="image" /></div>
                  <div v-else class="artwork-skeleton" aria-hidden="true"></div>
                  <div class="artwork-caption">
                    <span>
                      <span class="artwork-name">{{ sceneTitle(cell.item.scene, cell.item) }}</span>
                      <span class="artwork-date">{{ formatDate(stamp(cell.item)) }}</span>
                    </span>
                    <span class="artwork-mark"><ArchiveIcon v-if="cell.item.favorite" name="love" /><span v-else aria-hidden="true">＋</span></span>
                  </div>
                </div>
              </button>
            </article>
          </div>
        </template>
        <!-- 分页哨兵：进入视口即追加下一页（作品很多时避免一次性铺满 DOM） -->
        <div v-if="hasMoreToRender" ref="sentinelEl" class="gallery-more" role="status">
          已显示 {{ pagedVisible.length }} / {{ visible.length }} 幅 · 滚动继续加载
        </div>
      </div>
      </template>
    </section>

    <!-- 沉浸查看器（Teleport 渲染到 body；放在根元素内保持单根，
         否则多根组件不会继承 AppLayout 注入的 route-view class） -->
    <Teleport to="body">
      <Transition name="layer-pop">
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
        <ZoomableImageViewer
          v-else-if="viewerUrl"
          :src="viewerUrl"
          :alt="current ? sceneTitle(current.scene, current) : ''"
        >
          <template #fallback>
            <div class="viewer-fallback"><ArchiveIcon name="image" /></div>
          </template>
        </ZoomableImageViewer>
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
          <button class="btn btn-ghost" type="button"
            :class="{ 'btn-favorite-on': current.favorite }"
            :aria-pressed="!!current.favorite"
            @click="toggleFavorite(current)">
            <ArchiveIcon name="love" /><span>{{ current.favorite ? '取消收藏' : '收藏这幅' }}</span>
          </button>
          <RouterLink class="btn btn-primary" :to="`/prompt-builder?remix=${encodeURIComponent(current.id || '')}`"><ArchiveIcon name="spark" /> 沿用配方</RouterLink>
          <RouterLink class="btn btn-ghost" :to="`/prompt-builder?regen=${encodeURIComponent(current.id || '')}`">原参重跑</RouterLink>
          <button class="btn btn-ghost" type="button" @click="downloadCurrent">下载原图</button>
          <button
            class="btn btn-ghost"
            :class="{ 'btn-copied-success': copiedPrompt }"
            type="button"
            @click="copyPrompt"
          >
            <ArchiveIcon :name="copiedPrompt ? 'success' : 'copy'" />
            <span>{{ copiedPrompt ? '已复制' : '复制 Prompt' }}</span>
          </button>
          <button v-if="pendingDeleteId !== current.id" class="btn btn-ghost btn-danger" type="button"
            @click="pendingDeleteId = current.id">删除这幅</button>
          <template v-else>
            <button class="btn btn-danger" type="button" :disabled="deleting"
              @click="confirmDelete(current)">{{ deleting ? '删除中…' : '移入回收站' }}</button>
            <button class="btn btn-ghost" type="button" :disabled="deleting"
              @click="pendingDeleteId = null">取消</button>
          </template>
        </div>
      </aside>
        </div>
      </Transition>
    </Teleport>
  </article>

</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onActivated, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'
import { kvInit, kvGet, kvSet } from '@/composables/useKVStore'
import { imgGet } from '@/composables/useImageStore'
import { artworkRepository, type TrashEntry } from '@/storage/artworkRepository'
import { storageWriteMessage } from '@/utils/storageWriteError'
import { useSceneStore } from '@/stores/sceneStore'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useToast } from '@/composables/useToast'
import { confirmAction } from '@/composables/useConfirm'
import ArchivePageHero from '@/components/visual/ArchivePageHero.vue'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import ImageCompareSlider from '@/components/visual/ImageCompareSlider.vue'
import ZoomableImageViewer from '@/components/visual/ZoomableImageViewer.vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { blobThumbDataUrl, jpegThumbDataUrl, thumbKey } from '@/utils/imageThumb'
import { useJustifiedWall, buildWallGroups } from '@/composables/gallery/useJustifiedWall'
import { useArtworkRatios } from '@/composables/gallery/useArtworkRatios'
import type { Scene, LoraMeta } from '@/stores/sceneStore'
import { artworkTimestamp, parseArtworkRecords, type ArtworkRecord } from '@/types/artwork'
import { buildArtworkFileName } from '@/utils/artworkFileName'
import { formatA1111Parameters, injectPngMetadata } from '@/utils/pngMetadata'
import { ARTWORK_HISTORY_KV_KEY, ARTWORK_PROJECTS_KV_KEY } from '@/utils/storageKeys'

const sceneStore = useSceneStore()
useScrollReveal()
const { show: showToast } = useToast()
const route = useRoute()
const router = useRouter()

const HISTORY_KEY = ARTWORK_HISTORY_KV_KEY
// 键名统一出处：src/utils/storageKeys.ts。本文件曾把项目键写成旧键
// aics_projects（见下方 LEGACY_PROJECT_KEY），与备份读写的新键各操作一套数据且永久分叉。
const PROJECT_KEY = ARTWORK_PROJECTS_KV_KEY
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
/** 展墙搜索（2026-08-30 UX 审计 P1）：此前只有「收藏 + 项目」两个控件，
 *  攒到几百张后找某张旧作只能靠翻。 */
const searchQuery = ref('')
const galleryLoading = ref(true)
const galleryError = ref('')
const viewerIndex = ref(-1)
const infoOpen = ref(false)
const compareMode = ref(false)
const viewerUrl = ref('')
const copiedPrompt = ref(false)
const cardUrls = reactive<Record<string, string>>({})
/** 缩略图缓存（KV dataURL），比 HD blob 快读先显示 */
const thumbUrls = reactive<Record<string, string>>({})
const missingImageIds = ref(new Set<string | number>())
/** 缩略图生成去重：HD 管线与解码回填共用，同一张图并发只生成一次 */
const thumbPending = new Set<string>()
const { measuredRatios, ratioOf, measure, forgetRatio } = useArtworkRatios({
  pending: thumbPending,
  hasThumb: item => Boolean(thumbUrls[item.id]),
  saveThumb: (item, dataUrl, imageId) => kvSet(thumbKey(imageId), dataUrl).then(() => { thumbUrls[item.id] = dataUrl }),
})

/** 待确认删除的条目 id：删除有回收站兜底，但二次确认仍是防手滑的第一道闸 */
const pendingDeleteId = ref<string | number | null>(null)
const deleting = ref(false)
/** 多选模式与已选集合（2026-08-30 UX 审计 P1：批量清理） */
const selectMode = ref(false)
const selectedIds = ref(new Set<string | number>())
const bulkDeleting = ref(false)
// ── 回收站视图（2026-08-31）：软删条目列表 + 逐条恢复 ────────────────────
const trashMode = ref(false)
const trashItems = ref<TrashEntry[]>([])
const trashThumbs = reactive<Record<string, string>>({})
const trashBusy = ref<string | number | null>(null)

function toggleTrashMode() {
  trashMode.value = !trashMode.value
  if (trashMode.value) void loadTrash()
}

/** 读取回收站列表并加载首图缩略图（30 天保留期内缩略图仍在）。 */
async function loadTrash() {
  try {
    const entries = await artworkRepository.listTrash()
    entries.sort((a, b) => Number(b.deletedAt) - Number(a.deletedAt))
    trashItems.value = entries
    for (const entry of entries) {
      const imageId = entry.imageIds?.[0]
      if (!imageId || trashThumbs[entry.id]) continue
      const thumb = await kvGet<string>(thumbKey(imageId))
      if (thumb) trashThumbs[entry.id] = thumb
    }
  } catch (e) {
    console.warn('[gallery] load trash failed', e)
  }
}

/** 恢复一条软删作品：放回展墙后刷新回收站与主墙。 */
async function restoreTrashItem(id: string | number) {
  if (trashBusy.value !== null) return
  trashBusy.value = id
  try {
    const result = await artworkRepository.restoreArtwork(id)
    if (result.restored) {
      showToast('已恢复，放回展墙', 'success')
      trashItems.value = trashItems.value.filter(entry => entry.id !== id)
      delete trashThumbs[id]
      await loadGalleryStorage()
    } else {
      showToast('这条作品已不在回收站，无法恢复', 'warning')
      await loadTrash()
    }
  } catch (e) {
    console.warn('[gallery] restore trash failed', e)
    showToast('恢复失败，请重试', 'warning')
  } finally {
    trashBusy.value = null
  }
}

/** 回收站卡片摘要：取原 history 条目的 prompt 短述。 */
function trashPrompt(entry: TrashEntry): string {
  const first = entry.historyEntries?.[0]
  if (first && typeof first === 'object') {
    const record = first as Record<string, unknown>
    const prompt = typeof record.prompt === 'string' ? record.prompt : ''
    if (prompt) return prompt.length > 60 ? `${prompt.slice(0, 60)}…` : prompt
    const scene = typeof record.scene === 'string' ? record.scene : ''
    if (scene) return scene.length > 60 ? `${scene.slice(0, 60)}…` : scene
  }
  return '（已删除作品）'
}

function formatTrashTime(ts: number): string {
  const d = new Date(Number(ts))
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const closeBtn = ref<HTMLElement | null>(null)
const viewerEl = ref<HTMLElement | null>(null)
const objectUrls = new Set<string>()
/** 查看器当前显示的 blob URL，翻页时要主动释放 */
let viewerObjectUrl = ''
let viewerLoadToken = 0
let unmounted = false

/* ---------- 派生数据 ---------- */
/**
 * 一条作品的检索文本。
 *
 * 拼的是「用户会拿来找图的那些词」：场景名、角色、当时写的故事、所属项目，
 * 最后是完整 prompt——很多旧作只记得里面出现过某个词。prompt 可能很长，
 * 但几百条记录的拼接 + includes 在毫秒级，为它建索引属于过度设计。
 */
function searchHaystack(item: ArtworkRecord): string {
  return [
    item.sceneTitle, item.scene, item.character, item.story, item.project, item.prompt,
  ].filter(part => typeof part === 'string' && part).join(' ').toLowerCase()
}

const visible = computed(() => {
  let source = favoriteOnly.value ? history.value.filter(i => i.favorite) : history.value.slice()
  if (projectFilter.value) {
    const p = projects.value.find(x => x.id === projectFilter.value)
    if (p) source = source.filter(i => Array.isArray(p.history_ids) && p.history_ids.includes(i.id))
  }
  const term = searchQuery.value.trim().toLowerCase()
  if (term) source = source.filter(i => searchHaystack(i).includes(term))
  // 历史是按生成顺序 append 的，展墙必须自己排：最新在前。
  // 之前直接用了存储顺序，所以作品册永远是最旧的排在最上面。
  return source.sort((a, b) => stamp(b) - stamp(a))
})
const favoriteCount = computed(() => history.value.filter(i => i.favorite).length)
const countLabel = computed(() => `${visible.value.length} 幅作品`)
const current = computed(() => visible.value[viewerIndex.value] || null)

/* ---------- 分页渲染：滚动触底递增，避免数百作品全量铺 DOM ----------
   查看器导航仍走完整 visible；分页只约束「展墙渲染多少张」。 */
const PAGE_SIZE = 60
const renderLimit = ref(PAGE_SIZE)
const pagedVisible = computed(() => visible.value.slice(0, renderLimit.value))
const hasMoreToRender = computed(() => visible.value.length > pagedVisible.value.length)

/* ---------- 等高行展墙 ----------
   实测容器宽度，按宽高比把作品断成若干行；行内左右铺满、不留空洞。 */
const wallEl = ref<HTMLElement | null>(null)
const wall = useJustifiedWall(wallEl)
/** 行距 / 间距：由 JS 与排版共用一份数值，避免 CSS 与计算结果对不上 */
const wallGap = computed(() => `${wall.gap.value}px`)

const groups = computed(() => {
  const order = ['今天', '本周', '更早']
  const buckets: Record<string, ArtworkRecord[]> = {}
  pagedVisible.value.forEach(item => {
    const key = dayGroup(stamp(item))
    ;(buckets[key] = buckets[key] || []).push(item)
  })
  return order.filter(k => buckets[k]?.length).map(k => ({ key: k, items: buckets[k] }))
})

/**
 * 展墙实际渲染用的结构：每个时间分组内部再切成若干等高行。
 *
 * 依赖链是 pagedVisible → ratioOf → measuredRatios，加上 useJustifiedWall 实测的
 * 容器宽度。所以图片解码后真实比例回填、窗口缩放、分页追加，都会自动重排。
 * 排版只决定「在哪儿断行」，从不重排数组——时间轴和键盘 Tab 顺序原样保留。
 */
const wallGroups = computed(() => buildWallGroups(groups.value, ratioOf, wall.layout))

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
  searchQuery.value = ''
}

/* ---------- 筛选状态进 URL（2026-08-30 UX 审计 P1）----------
   刷新页面、把链接存成书签、或从别处带着参数跳进来时，筛选条件不该归零。 */

/**
 * 只在挂载时读 URL。
 *
 * 不在 onActivated 读：本页被 KeepAlive 缓存，从 Remix 回来时组件状态还在，
 * 而那次返回的 URL 大概率是干净的 /gallery——照着它恢复反而会把用户当前的
 * 筛选清掉，比不做还糟。
 */
function restoreFiltersFromQuery() {
  const q = route.query
  if (typeof q.fav === 'string') favoriteOnly.value = q.fav === '1'
  if (typeof q.project === 'string') projectFilter.value = q.project
  if (typeof q.q === 'string') searchQuery.value = q.q
}

let syncTimer: ReturnType<typeof setTimeout> | null = null
/**
 * 写回 URL。
 *
 * 用 replace 而不是 push：筛选是高频微调，不该把后退键变成「逐步撤销筛选」
 * 的历史栈。搜索输入带 300ms 防抖，避免每敲一个字就改一次地址。
 */
function syncFiltersToQuery() {
  const q = route.query
  const fav = q.fav === '1'
  const project = typeof q.project === 'string' ? q.project : ''
  const term = typeof q.q === 'string' ? q.q : ''
  // 与地址栏已经一致就什么都不做：挂载时从 URL 恢复会反过来触发这里，
  // 不挡住会多出一次无意义的导航
  if (fav === favoriteOnly.value && project === projectFilter.value && term === searchQuery.value.trim()) return

  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    // LocationQuery 的值允许是数组（?a=1&a=2），不能断言成 Record<string,string>
    const query: LocationQueryRaw = { ...route.query }
    if (favoriteOnly.value) query.fav = '1'
    else delete query.fav
    if (projectFilter.value) query.project = projectFilter.value
    else delete query.project
    const next = searchQuery.value.trim()
    if (next) query.q = next
    else delete query.q
    void router.replace({ query })
  }, 300)
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
    // 2026-08-29 修复：回显高清修复与采样参数（旧条目缺字段显示「—」）。
    { label: '高清修复', value: hiresLabel(i) },
    { label: 'CFG', value: i.cfg == null ? '' : String(i.cfg) },
    { label: '步数', value: i.steps == null ? '' : String(i.steps) },
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
/** 高清修复参数回显：旧条目无字段显示「—」，新条目精确显示倍率/放大器/步数。 */
function hiresLabel(i: ArtworkRecord): string {
  if (i.hiresFix == null) return '—'
  if (!i.hiresFix) return '关'
  const scale = i.hiresScale ? ` ×${i.hiresScale}` : ''
  const upscaler = i.hiresUpscaler ? ` · ${String(i.hiresUpscaler).split(/[\\/]/).pop()}` : ''
  const steps = i.hiresSteps ? ` · ${i.hiresSteps}步` : ''
  return `开${scale}${upscaler}${steps}`
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
  // 只为已进入渲染窗口的作品取缩略图（分页外的不预取）
  const pending = pagedVisible.value.filter(item => !cardUrls[item.id] && !thumbUrls[item.id])
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
    if (blob) {
      cardUrls[item.id] = trackUrl(URL.createObjectURL(blob)); resolved = true
      // 2026-08-30 治本：旧图缺 KV 缩略图（早期回填逻辑不存在）→ 全靠 HD 大图管线
      // （并发 4 + LRU 40 淘汰），滚动浏览旧区域反复重读大 blob → 一直 loading。
      // 读到 blob 立即降采样出缩略图垫底并回填 KV：卡片秒出图，后续打开走 KV 秒读。
      const imageId = item.image_id
      if (imageId && !thumbUrls[item.id] && !thumbPending.has(imageId)) {
        thumbPending.add(imageId)
        blobThumbDataUrl(blob).then(dataUrl => {
          if (dataUrl) {
            thumbUrls[item.id] = dataUrl
            void kvSet(thumbKey(imageId), dataUrl)
          }
        }).catch(() => { /* 缩略图失败不影响 HD 显示 */ }).finally(() => thumbPending.delete(imageId))
      }
    }
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
/**
 * 收藏切换（2026-08-30 UX 审计：收藏此前是死功能）。
 *
 * 「收藏」筛选与卡片爱心标记一直都在，但全库没有任何写入 `favorite` 的入口，
 * 创建作品时恒为 false —— 于是顶部「收藏 N」永远是 0，角色厨想标精选无门。
 *
 * 乐观更新：大图墙里等一次 KV 往返再变色会有肉眼可见的迟滞。写失败则回滚
 * 并如实告知，不静默吞（与本项目其他存储写入失败的修法一致）。
 */
async function toggleFavorite(item: ArtworkRecord) {
  const next = !item.favorite
  item.favorite = next
  try {
    const result = await artworkRepository.patchArtwork(item.id, { favorite: next })
    if (!result.updated) {
      item.favorite = !next
      showToast('没找到这幅作品，收藏没能保存', 'warning')
      return
    }
  } catch (e) {
    item.favorite = !next
    console.warn('[gallery] 收藏写入失败', e)
    showToast(storageWriteMessage(e, '收藏状态'), 'error')
  }
}

/**
 * 释放一张卡片占用的内存：blob URL、LRU 登记、缩略图与尺寸缓存。
 *
 * 单张删除与批量删除共用这一条路径——审计里「数百张大图不卡」靠的就是
 * LRU + 显式 revoke，批量清 500 张如果只改数组不释放，会让 blob 全部泄漏，
 * 等于把最花力气修好的工程又捅一个洞。
 */
function releaseCardResources(id: string | number) {
  const url = cardUrls[id]
  if (url && url.startsWith('blob:')) { URL.revokeObjectURL(url); objectUrls.delete(url) }
  delete cardUrls[id]
  cardLruOrder.delete(id)
  delete thumbUrls[id]
  if (missingImageIds.value.delete(id)) missingImageIds.value = new Set(missingImageIds.value)
  forgetRatio(id)
}

/**
 * 删除（2026-08-30 UX 审计 P0-8：原为硬删不可恢复）。
 *
 * 现在默认走软删：列表与项目引用立即消失（界面反馈与从前一致），但原图
 * 与缩略图保留 30 天，toast 上给 5 秒「撤销」窗口；超期由挂载时的懒清理
 * 真删。攒几百张时误删不再是不可逆损失。
 */
async function confirmDelete(item: ArtworkRecord) {
  if (deleting.value) return
  deleting.value = true
  try {
    const wasOpen = viewerIndex.value >= 0
    const removedIndex = visible.value.indexOf(item)

    // Repository 先完成跨库删除与补偿回滚，再改界面；失败时界面不动作。
    const next = history.value.filter(h => h.id !== item.id)
    await artworkRepository.softDeleteArtwork(item.id)
    history.value = next

    releaseCardResources(item.id)
    pendingDeleteId.value = null

    // 查看器开着就顺移到下一幅，删到空则关闭
    if (wasOpen) {
      if (!visible.value.length) closeViewer()
      else openViewer(Math.min(Math.max(removedIndex, 0), visible.value.length - 1))
    }

    showToast('已移入回收站，30 天内可撤销', 'info', 5000, {
      label: '撤销',
      onClick: () => { void undoDelete(item) },
    })
  } catch (e) {
    console.warn('delete artwork failed', e)
    showToast('删除失败，请重试')
  } finally {
    deleting.value = false
  }
}

/* ---------- 多选批量（2026-08-30 UX 审计 P1）---------- */

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selectedIds.value = new Set()
}

function toggleSelect(id: string | number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const allVisibleSelected = computed(() =>
  visible.value.length > 0 && visible.value.every(item => selectedIds.value.has(item.id)))

function selectAllVisible() {
  if (allVisibleSelected.value) { selectedIds.value = new Set(); return }
  selectedIds.value = new Set(visible.value.map(item => item.id))
}

/**
 * 批量移入回收站。
 *
 * 逐条走软删（与单张同一实现），因此同样享受 30 天保留与「已移入回收站」的
 * 一致性；失败不中断，最后如实汇报成功/失败条数——批量操作最怕的是「以为全
 * 成了，其实只成了一半」。
 */
async function bulkDelete() {
  if (bulkDeleting.value || !selectedIds.value.size) return
  const count = selectedIds.value.size
  const ok = await confirmAction({
    title: `把 ${count} 幅作品移入回收站？`,
    message: '它们会立即从展墙消失，但原图保留 30 天，可在提示里一键撤销。',
    confirmLabel: '移入回收站',
    danger: true,
  })
  if (!ok) return

  bulkDeleting.value = true
  const ids = [...selectedIds.value]
  const failed: (string | number)[] = []
  try {
    for (const id of ids) {
      try {
        const result = await artworkRepository.softDeleteArtwork(id)
        if (!result.deleted) failed.push(id)
      } catch {
        failed.push(id)
      }
    }

    const done = ids.length - failed.length
    if (done) {
      // 查看器可能正指着被删掉的某一幅，先收起来，避免停在一张空图上
      if (viewerIndex.value >= 0) closeViewer()
      // 软删已在仓储层摘掉项目引用，整体重载一次即可同步展墙与项目下拉
      for (const id of ids) if (!failed.includes(id)) releaseCardResources(id)
      selectedIds.value = new Set()
      await loadGalleryStorage()
    }

    if (failed.length) {
      showToast(done
        ? `${done} 幅已移入回收站，${failed.length} 幅没成功，请重试`
        : `一幅都没能移进去，请重试`, 'warning', 5000)
    } else {
      showToast(`${done} 幅已移入回收站，30 天内可撤销`, 'info', 6000, {
        label: '撤销',
        onClick: () => { void undoBulkDelete(ids) },
      })
    }
  } finally {
    bulkDeleting.value = false
  }
}

/** 批量撤销：整组恢复，失败条数如实汇报。 */
async function undoBulkDelete(ids: (string | number)[]) {
  let restored = 0
  for (const id of ids) {
    try {
      if ((await artworkRepository.restoreArtwork(id)).restored) restored += 1
    } catch { /* 逐条继续，不因一条失败放弃其余 */ }
  }
  await loadGalleryStorage()
  showToast(restored ? `已把 ${restored} 幅放回展墙` : '这些作品已不在回收站，无法恢复',
    restored ? 'success' : 'warning')
}

/** 撤销软删：整条恢复（历史条目 + 项目引用），刷新列表即可见。 */
async function undoDelete(item: ArtworkRecord) {
  try {
    const result = await artworkRepository.restoreArtwork(item.id)
    if (!result.restored) { showToast('这条作品已不在回收站，无法恢复', 'warning'); return }
    await loadGalleryStorage()
    showToast('已恢复到作品册')
  } catch (e) {
    console.warn('restore artwork failed', e)
    showToast('恢复失败，请重试')
  }
}

function copyPrompt() {
  const text = current.value?.prompt
  if (!text) return
  navigator.clipboard.writeText(text)
    .then(() => {
      copiedPrompt.value = true
      showToast('Prompt 已复制')
      setTimeout(() => { copiedPrompt.value = false }, 2000)
    })
    .catch(() => showToast('复制失败，请手动选取'))
}

/** 下载当前作品的原图文件（优先 IndexedDB 原图 blob，注入 Civitai 级元数据） */
async function downloadCurrent() {
  const item = current.value
  if (!item) return
  // 2026-09-01 文件名去重：旧方案「标题-seed」同场景同 seed 会撞名，
  // 新方案带上时间戳与 id 尾号（见 utils/artworkFileName.ts）。
  // artworkTimestamp 会给老记录兜底（字符串时间 / 纯数字 id），拿不到才是真没有。
  const ts = stamp(item)
  const fileName = buildArtworkFileName({
    title: sceneTitle(item.scene, item),
    character: item.character ? characterName(item.character, item) : undefined,
    timestamp: ts > 0 ? ts : undefined,
    seed: item.seed,
    id: item.id,
    ext: 'png',
  })

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
  showToast('已下载原图（已嵌入完整 A1111/ComfyUI 咒文元数据）')
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

  // 回收站懒清理（2026-08-30 UX 审计 P0-8）：真删超期软删条目的图片与
  // 缩略图。不阻塞首屏，失败静默（下次挂载再试）。
  void artworkRepository.purgeExpiredTrash().catch(e => console.warn('[gallery] trash purge failed', e))

  try {
    await sceneStore.load()
    scenes.value = sceneStore.scenes
    loras.value = sceneStore.loras
  } catch (e) { console.warn('gallery data load failed', e) }
  // 深链 / 刷新后恢复筛选：必须在项目列表读完之后，否则 select 没有选项可匹配
  restoreFiltersFromQuery()
  void hydrateThumbs()
  await nextTick()
  scanWallCards()
})

/**
 * 作品册被 AppLayout 的 KeepAlive 缓存（数百张大图 blob 与解码结果常驻内存，
 * 切走再回来秒开，不需要重新从 IndexedDB 读图）。
 *
 * 代价是 onMounted 只在**首次**进入时跑一次，此后重新激活不会重读 KV：
 * 画出一张 →「保存快照」→ 进作品册，看到的仍是离开时那份旧列表，
 * 用户会判定「保存失败」并重复保存、甚至重画（2026-08-30 UX 审计 P0-7）。
 *
 * 这里只增量重读 KV，不重建 blob 缓存（revokeAll 挂在 onUnmounted，
 * 缓存期间不触发）——既修掉陈旧列表，又不丢 KeepAlive 的意义。
 * 列表若真有变化，watch(visible) 会自动补缩略图并重挂观察器。
 */
onActivated(() => {
  void loadGalleryStorage()
})

onUnmounted(() => {
  unmounted = true
  viewerLoadToken += 1
  // 防抖定时器里握着 router，不请掉会在组件卸载后改一次导航
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null }
  cardObserver?.disconnect()
  cardObserver = null
  observedCards.clear()
  moreObserver?.disconnect()
  moreObserver = null
  document.removeEventListener('keydown', onKeydown)
  revokeAll()
})

watch(visible, () => {
  void hydrateThumbs()
  void nextTick(() => scanWallCards())
})

// 2026-08-30 修复：分页追加（renderLimit 增）只改变 pagedVisible，visible 不变 →
// 上面 watch 不触发 → 新页卡片从未挂 IntersectionObserver → 无缩略图的旧图永远 skeleton。
// 监听 pagedVisible 长度变化，翻页后重新取缩略图 + 重挂观察器。
watch(() => pagedVisible.value.length, () => {
  void hydrateThumbs()
  void nextTick(() => scanWallCards())
})

/* ---------- 分页：哨兵进入视口即追加下一页 ---------- */
const sentinelEl = ref<HTMLElement | null>(null)
let moreObserver: IntersectionObserver | null = null

function loadMoreIfNeeded() {
  if (!hasMoreToRender.value) return
  renderLimit.value = Math.min(renderLimit.value + PAGE_SIZE, visible.value.length)
  // 极端情况：新页仍不足以把哨兵推出视口（如全部同比例小图）。
  // nextTick 后再探测一次，直到哨兵离开视口或加载完毕，保证分页总能继续。
  void nextTick(() => {
    if (!hasMoreToRender.value || !sentinelEl.value) return
    if (sentinelEl.value.getBoundingClientRect().top < window.innerHeight + 800) loadMoreIfNeeded()
  })
}

onMounted(() => {
  moreObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) loadMoreIfNeeded()
  }, { rootMargin: '800px 0px' })
  if (sentinelEl.value) moreObserver.observe(sentinelEl.value)
})

watch(sentinelEl, el => {
  if (!moreObserver) return
  moreObserver.disconnect()
  if (el) moreObserver.observe(el)
})

// 筛选变化回到第一页，让用户始终从最新作品看起
watch([favoriteOnly, projectFilter, searchQuery], () => {
  renderLimit.value = PAGE_SIZE
  syncFiltersToQuery()
})
</script>

<style scoped>
.gallery-shell { width:min(1880px,100%); margin:0 auto; padding:clamp(24px,4vw,64px) clamp(14px,3vw,48px) var(--s-8); }
.gallery-intro { margin:0 auto clamp(24px,4vw,48px); max-width:1500px; }
.gallery-title { margin:0; color:var(--text-primary); font-family:var(--font-display); font-size:clamp(2rem,3.8vw,3.95rem); font-weight:760; letter-spacing:-.045em; line-height:var(--lh-flush); }
.gallery-subtitle { max-width:660px; margin:var(--s-3) 0 0; color:var(--text-secondary); font-size:clamp(.86rem,1.2vw,1rem); line-height:var(--lh-loose); }
.gallery-count { color:var(--text-muted); font:650 var(--fs-label-xs) var(--font-mono); letter-spacing:.08em; white-space:nowrap; }

.gallery-toolbar { max-width:1500px; margin:0 auto clamp(24px,3vw,38px); display:flex; align-items:center; gap:var(--s-2); flex-wrap:wrap; }
/* 展墙搜索：占满富余宽度但设下限，窄屏自己换行 */
.gallery-search-field { position:relative; flex:1 1 220px; min-width:180px; max-width:340px; }
.gallery-search {
  width:100%; min-height:36px; padding:0 34px 0 var(--s-3);
  border:1px solid var(--border-soft); border-radius:var(--r-terminal);
  background:var(--bg-deep); color:var(--text-primary);
  font:400 var(--fs-label-sm) var(--font-sans); outline:none;
  -webkit-appearance:none; appearance:none; /* 去掉 WebKit 原生清除钮，避免两个 × */
  transition:border-color var(--motion-hover);
}
.gallery-search::placeholder { color:var(--text-muted); }
.gallery-search:focus { border-color:var(--accent); }
.gallery-search-clear { position:absolute; top:50%; right:6px; transform:translateY(-50%); display:grid; place-items:center; width:24px; height:24px; border:0; background:transparent; color:var(--text-muted); font-size:var(--fs-body-lg); cursor:pointer; }
.gallery-search-clear:hover { color:var(--text-primary); }
.gallery-search-clear:focus-visible { outline:2px solid var(--accent); outline-offset:1px; border-radius:var(--r-sm); }
.gallery-filter { min-height:36px; padding:0 15px; border:1px solid transparent; border-radius:var(--r-terminal); background:transparent; color:var(--text-secondary); font:650 var(--fs-label-sm) var(--font-sans); cursor:pointer; transition:border-color var(--motion-hover),background var(--motion-hover),color var(--motion-hover); }
.gallery-filter:hover,.gallery-filter.active { border-color:color-mix(in srgb,var(--accent) 34%,var(--border-soft)); background:var(--accent-soft); color:var(--accent); }
.gallery-project { min-height:36px; min-width:140px; padding:0 34px 0 13px; border:1px solid transparent; border-radius:var(--r-terminal); background:transparent; color:var(--text-secondary); font:650 var(--fs-label-sm) var(--font-sans); cursor:pointer; outline:none; }
.gallery-project:focus { border-color:var(--accent); }
.gallery-toolbar-note { margin-left:auto; padding-right:var(--s-3); color:var(--text-muted); font-size:var(--fs-mono-sm); white-space:nowrap; }

/* 批量操作条（2026-08-30 UX 审计 P1）：只在勾选态出现，避免常态占一行 */
.gallery-bulkbar { max-width:1500px; margin:0 auto var(--s-3); display:flex; align-items:center; gap:var(--s-3); flex-wrap:wrap; padding:var(--s-2) var(--s-3); border:1px solid color-mix(in srgb,var(--accent) 30%,var(--border-soft)); border-radius:var(--r-dossier); background:var(--accent-soft); }
.gallery-bulk-count { color:var(--text-primary); font:650 var(--fs-label-sm) var(--font-mono); white-space:nowrap; }
.gallery-bulk-actions { display:flex; align-items:center; gap:var(--s-2); margin-left:auto; flex-wrap:wrap; }

/* 等高行展墙：纵向是「行」流，每行内部横向铺满。行高与画宽由 useJustifiedWall
   实测容器后算出并写成 inline style，CSS 只负责把行流起来。 */
.gallery-wall { max-width:1500px; margin:0 auto; display:flex; flex-direction:column; gap:var(--wall-gap,20px); }
.gallery-row { display:flex; align-items:stretch; gap:var(--wall-gap,20px); }
.gallery-row .artwork { flex:0 0 auto; height:100%; }
/* 画框高度跟着行走，不再自己算 aspect-ratio */
.gallery-row .artwork-media { height:100%; width:100%; aspect-ratio:auto; }
/* 悬停抬起时压住相邻画作，否则会被后一张盖住一条边 */
.gallery-row .artwork:hover { z-index:2; }
.gallery-loading-wall { min-height:340px; }
.artwork { position:relative; margin:0; overflow:hidden; border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent); border-radius:var(--r-dossier); background:var(--art-mat); box-shadow:var(--shadow-sm); content-visibility: auto; contain-intrinsic-size: auto 340px; transition:transform var(--motion-surface),box-shadow var(--motion-surface),border-color var(--motion-surface); }
.artwork::before { position:absolute; z-index:var(--z-raised); top:-1px; left:var(--s-3); width:28px; height:var(--line-hairline); background:var(--archive-cyan); content:""; opacity:.82; pointer-events:none; }
.artwork:hover { border-color:color-mix(in srgb,var(--accent) 38%,var(--border-soft)); box-shadow:var(--shadow-md); }
.artwork-button { display:block; width:100%; padding:0; border:0; background:transparent; color:inherit; cursor:zoom-in; }
.artwork-button:focus-visible { outline:3px solid var(--accent); outline-offset:-3px; }
.artwork-tools { position:absolute; z-index:var(--z-raised); top:var(--s-2); right:var(--s-2); display:flex; align-items:center; gap:3px; padding:3px; opacity:0; transform:translateY(-4px); pointer-events:none; border:1px solid var(--on-art-line); border-radius:var(--r-pill); background:var(--art-scrim); box-shadow:var(--shadow-sm); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); transition:opacity var(--motion-hover),transform var(--motion-hover); }
.artwork:focus-within .artwork-tools,.artwork-pending .artwork-tools { opacity:1; transform:none; pointer-events:auto; }
/* 多选选中态：外描边用 box-shadow 而非 border 位移，不改布局、不触发重排 */
.artwork-selected { border-color:var(--accent); box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 42%,transparent), var(--shadow-md); }
.artwork-check { position:absolute; z-index:var(--z-raised); top:var(--s-2); right:var(--s-2); display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border:1.5px solid var(--on-art-line); border-radius:var(--r-pill); background:var(--art-scrim); color:var(--on-art-primary); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); }
.artwork-selected .artwork-check { border-color:var(--accent); background:var(--accent); color:var(--text-inverse); }
.artwork-tool { display:inline-flex; align-items:center; gap:5px; min-height:28px; padding:0 11px; border:1px solid transparent; border-radius:var(--r-pill); background:transparent; color:var(--on-art-primary); font:650 var(--fs-label-xs) var(--font-sans); cursor:pointer; -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); transition:background var(--motion-hover),border-color var(--motion-hover),color var(--motion-hover); }
.artwork-tool:hover:not(:disabled) { border-color:var(--on-art-sheen); background:var(--on-art-fill); }
/* 全局 a:hover 链接色 (0,1,1) 会盖过 .artwork-tool 的 on-art 墨色——深色画膜上变暗梅色难以辨认，钉回 */
a.artwork-tool:hover { color:var(--on-art-primary); }
.artwork-tool.danger { border-color:color-mix(in srgb,var(--danger) 28%,var(--on-art-line)); background:color-mix(in srgb,var(--danger) 12%,transparent); color:color-mix(in srgb,var(--danger-text) 92%,white); }
.artwork-tool.danger:hover:not(:disabled) { background:color-mix(in srgb,var(--danger) 78%,var(--art-scrim)); border-color:var(--danger); color:var(--text-inverse); }
.artwork-tool:focus-visible { outline:2px solid var(--on-art-primary); outline-offset:2px; }
/* 审计修复: 处理中态也要读得清 */
.artwork-tool:disabled { cursor:wait; color: var(--text-disabled); border-color: var(--border-soft); background: transparent; }
/* 收藏激活态：画膜上要够亮才看得见，用 on-art 令牌而非全局强调色（后者在深色膜上偏暗） */
.artwork-tool-on { border-color:color-mix(in srgb,var(--accent) 42%,var(--on-art-line)); background:color-mix(in srgb,var(--accent) 20%,transparent); color:var(--on-art-primary); }
.artwork-tool :deep(.archive-icon) { width:14px; height:14px; vertical-align:-.12em; }
.artwork-media { position:relative; width:100%; aspect-ratio:var(--art-ratio,3/4); overflow:hidden; background:linear-gradient(135deg,color-mix(in srgb,var(--art-mat) 88%,var(--glass-specular)),var(--art-mat)); }
.artwork-image { display:block; width:100%; height:100%; object-fit:contain; background:var(--art-mat); animation:galleryImageIn .35s var(--ease-out); }
.artwork-placeholder { position:absolute; inset:0; display:grid; place-items:center; color:var(--on-art-secondary); font-size:var(--fs-glyph); }
/* 审计修复：骨架微光原为逐帧补间 background-position（无限循环 → 每帧重绘整块渐变），
   改为伪元素承载渐变 + transform:translateX 位移（合成器属性，零重绘）。 */
.artwork-skeleton { position:absolute; inset:0; overflow:hidden; }
.artwork-skeleton::after {
  content:""; position:absolute; top:0; bottom:0; left:0; width:220%;
  background:linear-gradient(105deg,var(--art-mat) 18%,color-mix(in srgb,var(--art-mat) 76%,var(--text-primary)) 42%,var(--art-mat) 68%);
  animation:gallerySkeleton 1.3s linear infinite;
}
.artwork-caption { position:absolute; inset:auto 0 0; display:flex; align-items:flex-end; justify-content:space-between; gap:var(--s-3); padding:40px var(--s-3) var(--s-3); color:var(--on-art-primary); background:linear-gradient(transparent,var(--art-scrim)); opacity:0; transform:translateY(8px); transition:opacity var(--motion-hover) var(--ease-out),transform var(--motion-hover) var(--ease-out); text-align:left; pointer-events:none; }
.artwork-button:focus-visible .artwork-caption { opacity:1; transform:none; }
.artwork-name { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--fs-label-sm); font-weight:700; }
.artwork-date { display:block; margin-top:2px; color:var(--on-art-secondary); font-size:var(--fs-mono-xs); }
.artwork-mark { flex:0 0 auto; font-size:var(--fs-label-sm); }

.gallery-section { display:flex; align-items:center; gap:var(--s-3); margin:var(--s-3) 0 var(--s-4); color:var(--text-muted); font:700 var(--fs-mono-xs) var(--font-mono); letter-spacing:.13em; text-transform:uppercase; }
.gallery-more { display:flex; align-items:center; justify-content:center; gap:var(--s-2); margin:var(--s-5) 0 0; padding:var(--s-3); color:var(--text-muted); font:600 var(--fs-label-xs) var(--font-mono); letter-spacing:.06em; }
.gallery-section::after { content:""; height:1px; flex:1; background:var(--border-soft); }

@media (hover: hover) and (pointer: fine) {
  .artwork:hover { transform:translateY(-3px); }
  .artwork:hover .artwork-tools { opacity:1; transform:none; pointer-events:auto; }
  .artwork:hover .artwork-caption { opacity:1; transform:none; }
}

@media (max-width:900px) { .gallery-count { display:none; } }
@media (max-width:600px) {
  .gallery-shell { padding:var(--s-5) var(--s-3) var(--s-8); }
  .artwork { border-radius:var(--r-dossier); }
  .artwork-caption { opacity:1; transform:none; padding:34px var(--s-2) var(--s-2); }
  .artwork-name { font-size:var(--fs-mono-sm); }
  .artwork-date { display:none; }
  .artwork-tools { opacity:0; transform:translateY(-4px); pointer-events:none; }
  .artwork-pending .artwork-tools { opacity:1; transform:none; pointer-events:auto; }
}
@media (prefers-reduced-motion:reduce) { .artwork,.artwork-caption { transition:none !important; } .artwork-skeleton { animation:none; } }
/* 位移量：层宽 220%，右端对齐容器右缘需左移 1.2 倍容器宽 = 层宽的 54.5% */
@keyframes gallerySkeleton { to { transform: translateX(-54.5%); } }
/* 2026-08-22 动效审计 #13：入场去掉 blur 补间（绘制级且随懒加载滚动反复触发），只走 opacity/transform */
@keyframes galleryImageIn { from { opacity:0; transform:scale(.985); } to { opacity:1; transform:scale(1); } }
/* ── 回收站（2026-08-31）── */
.trash-wall { max-width:1500px; margin:0 auto; }
.trash-toolbar { display:flex; align-items:center; justify-content:space-between; gap:var(--s-3); margin-bottom:var(--s-4); color:var(--text-secondary); }
.trash-hint { font-size:var(--fs-body-sm); }
.trash-count { font-weight:500; color:var(--text-primary); }
.trash-card { position:relative; border:1px solid var(--border-soft); border-radius:var(--r-lg); overflow:hidden; background:var(--bg-surface); }
.trash-card .artwork-media { height:100%; }
.trash-card .artwork-caption { position:static; opacity:1; transform:none; pointer-events:auto; background:none; padding:var(--s-2) var(--s-3) var(--s-3); color:var(--text-primary); }
.trash-card .artwork-name { display:block; font-size:var(--fs-body-sm); line-height:1.4; }
.trash-card .artwork-date { display:block; margin-top:2px; font-size:var(--fs-label-xs); color:var(--text-secondary); }
.trash-card .artwork-tools { position:static; opacity:1; transform:none; pointer-events:auto; justify-content:flex-start; margin:0 var(--s-3) var(--s-3); background:none; border:none; box-shadow:none; -webkit-backdrop-filter:none; backdrop-filter:none; padding:0; }
.trash-card .artwork-tool { color:var(--text-secondary); }
.trash-card .artwork-tool:hover { color:var(--text-primary); }
.trash-card .artwork-placeholder { min-height:200px; display:grid; place-items:center; color:var(--text-tertiary); }
</style>

<style>
/* 非 scoped：Teleport 到 body 的查看器 */
.art-viewer { position:fixed; inset:0; z-index:var(--z-overlay); display:grid; grid-template-columns:minmax(0,1fr) minmax(290px,360px); background:var(--art-backdrop); color:var(--on-art-primary); }
.art-viewer.layer-pop-enter-active,
.art-viewer.layer-pop-leave-active { transition:opacity var(--motion-surface) var(--ease-out); }
.art-viewer.layer-pop-enter-active > .viewer-stage,
.art-viewer.layer-pop-leave-active > .viewer-stage { transition:transform var(--motion-surface) var(--ease-out),opacity var(--motion-surface) var(--ease-out); }
.art-viewer.layer-pop-enter-from,
.art-viewer.layer-pop-leave-to { opacity:0; }
.art-viewer.layer-pop-enter-from > .viewer-stage { transform:scale(.985); opacity:0; }
.art-viewer.layer-pop-leave-to > .viewer-stage { transform:scale(.98); opacity:0; }
.viewer-compare-host { width:100%; height:calc(100vh - 120px); max-width:min(90vw, 1200px); display:flex; align-items:center; justify-content:center; }
.viewer-compare-toggle {
  position:absolute; z-index:var(--z-raised); top:18px; right:64px;
  display:inline-flex; align-items:center; gap:4px;
  padding:6px 12px; border-radius:var(--r-pill);
  border:1px solid var(--on-art-line); background:var(--art-scrim);
  color:var(--on-art-primary); cursor:pointer; font:600 var(--fs-label-xs) var(--font-mono);
  -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);
  transition:background var(--motion-hover), border-color var(--motion-hover);
}
.viewer-compare-toggle:hover, .viewer-compare-toggle.active {
  border-color:var(--accent); background:color-mix(in srgb,var(--accent) 30%,var(--art-scrim)); color:var(--on-art-primary);
}
.viewer-stage { position:relative; min-width:0; display:grid; place-items:center; padding:clamp(46px,5vw,76px) clamp(48px,6vw,92px); overflow:hidden; }
.viewer-image { display:block; max-width:100%; max-height:calc(100vh - 92px); width:auto; height:auto; object-fit:contain; filter:drop-shadow(0 24px 56px var(--art-backdrop)); animation:galleryImageIn .35s var(--ease-out); }
.viewer-fallback { color:var(--on-art-secondary); font-size:var(--fs-glyph-lg); }
.art-viewer .viewer-close { position:absolute; z-index:var(--z-raised); top:18px; left:18px; }
.viewer-nav,.viewer-info-toggle { position:absolute; z-index:var(--z-raised); display:grid; place-items:center; border:1px solid var(--on-art-line); background:var(--art-scrim); color:var(--on-art-primary); cursor:pointer; -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); transition:background var(--motion-hover),transform var(--motion-hover); }
.viewer-info-toggle { top:18px; right:18px; width:40px; height:40px; border-radius:50%; display:none; }
.viewer-nav { top:50%; width:44px; height:64px; border-radius:var(--r-pill); transform:translateY(-50%); font-size:var(--fs-title); }
.viewer-nav:hover,.viewer-info-toggle:hover { background:color-mix(in srgb,var(--accent) 58%,var(--art-scrim)); }
.viewer-prev { left:var(--s-4); }
.viewer-next { right:var(--s-4); }
/* 审计修复: .24 远低于 UI 组件 3:1 门槛 */
.viewer-nav:disabled { color: var(--text-disabled); border-color: var(--border-soft); cursor:default; }
.viewer-position { position:absolute; left:50%; bottom:18px; transform:translateX(-50%); color:var(--on-art-secondary); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.12em; }
.viewer-info { min-width:0; overflow-y:auto; padding:56px var(--s-5) var(--s-6); border-left:1px solid var(--on-art-line); background:var(--art-scrim); }
.viewer-title { margin:var(--s-3) 0 var(--s-1); color:var(--on-art-primary); font-size:var(--fs-title); line-height:var(--lh-tight); }
.viewer-meta { color:var(--on-art-secondary); font-size:var(--fs-label-xs); line-height:var(--lh-body); }
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
  .viewer-info { position:absolute; inset:0 0 0 auto; width:min(86vw,360px); transform:translateX(100%); transition:transform var(--motion-surface) var(--ease-drawer); z-index:var(--z-raised); }
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
