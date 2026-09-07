<template>
  <article class="home-page">
    <!-- Hero -->
    <section class="container">
      <div class="home-hero">
        <div class="hero-copy">
          <div class="hero-register" aria-label="本期绘境信息">
            <span class="archive-kicker">A LITTLE SPACE FOR IMAGINATION</span>
            <span>创作手帐</span>
          </div>
          <span class="eyebrow">宁宁与夏目的私人画室</span>
          <h1 class="hero-title">收藏心动，<br /><span class="hero-title-accent">慢慢画成日常。</span></h1>
          <p class="hero-sub">一间属于你的二次元创作小屋。从一个灵感开始，让喜欢的角色、故事与光影在这里相遇。</p>
          <p class="hero-jp">「 ときめきの一瞬を、一枚の CG に 」</p>
          <div class="ctas">
            <RouterLink :to="continueLink.to" class="btn btn-lg btn-primary" id="continueCta">
              <span class="ic"><ArchiveIcon :name="continueIconName" /></span> {{ continueLink.label }}
            </RouterLink>
            <RouterLink to="/showcase" class="btn btn-lg btn-ghost"><span class="ic"><ArchiveIcon name="image" /></span> 翻翻画册</RouterLink>
          </div>
          <div class="continue-hint" v-if="continueHint">
            <strong>{{ continueHint }}</strong>
          </div>
        </div>
        <aside class="hero-orbit" aria-label="宁宁与夏目的角色视觉">
        <div class="hero-watermark" aria-hidden="true">ATELIER</div>
        <!-- 2026-08-15：Hero 粒子场已移除——角色立绘（同层后绘制、52%+52% 拼满）完全盖住粒子，
             右下角 caption 亦不可见，保留纯属空耗 GPU。 -->
        <!-- width/height 是内在尺寸（实测 1024×1344），用来预留版位避免布局抖动；
             CSS 仍然控制显示尺寸。这两张是首屏 LCP 候选，故不 lazy 且给高优先级。 -->
        <picture>
          <img
            class="hero-character nene"
            :src="heroAssets.nene"
            alt="绫地宁宁"
            width="1024"
            height="1344"
            sizes="(max-width: 768px) 100vw, 42vw"
            loading="eager"
            decoding="async"
            fetchpriority="high"
          />
        </picture>
        <picture>
          <img
            class="hero-character natsume"
            :src="heroAssets.natsume"
            alt="四季夏目"
            width="1024"
            height="1344"
            sizes="(max-width: 768px) 100vw, 42vw"
            loading="eager"
            decoding="async"
          />
        </picture>
          <div class="orbit-label"><strong>NENE × NATSUME</strong><span>把今天的心动，收进画面。</span></div>
        </aside>

      </div>
    </section>

    <!-- 创作入口 -->
    <section class="container home-section" data-reveal>
      <div class="home-section-head">
        <div>
          <span class="eyebrow">THE STUDIO / 创作日常</span>
          <h2>今天，想创作些什么？</h2>
          <p class="hint">从画一张图，到讲一个故事。让灵感有个去处。</p>
        </div>
      </div>
      <div class="tools-grid">
        <RouterLink to="/prompt-builder" class="tool-card card-create card-level-2">
          <span class="tool-index" aria-hidden="true">01 / MAKE</span>
          <span class="ic"><ArchiveIcon name="spark" /></span><span class="t">开始绘制</span>
          <span class="d">调和镜头、光影与克制的情绪，将心动一瞬定格为专属 CG。</span>
          <span class="go">→ 打开</span>
        </RouterLink>
        <RouterLink to="/scene-explorer" class="tool-card card-create card-level-2">
          <span class="tool-index" aria-hidden="true">02 / SCENE</span>
          <span class="ic"><ArchiveIcon name="scene" /></span><span class="t">灵感场景</span>
          <span class="d">{{ sceneLibraryCopy }}</span>
          <span class="go">→ 打开</span>
        </RouterLink>
        <RouterLink to="/video-studio" class="tool-card card-create card-level-2">
          <span class="tool-index" aria-hidden="true">03 / MOTION</span>
          <span class="ic"><ArchiveIcon name="play" /></span><span class="t">AI 视频创作</span>
          <span class="d">让静止的画面，成为一段会呼吸的故事。</span>
          <span class="go">→ 开始创作</span>
        </RouterLink>
        <RouterLink to="/chat" class="tool-card card-create card-level-2">
          <span class="tool-index" aria-hidden="true">04 / ROOM</span>
          <span class="ic"><ArchiveIcon name="chat" /></span><span class="t">角色房间</span>
          <span class="d">与宁宁或夏目静享片刻独白，全流程本地语音温情陪伴。</span>
          <span class="go">→ 进入房间</span>
        </RouterLink>
        <!-- 宽屏下第 5 张卡拉通为横幅入口，避免 4+1 网格出现孤行 -->
        <RouterLink to="/showcase" class="tool-card card-create card-level-2 tool-card-banner">
          <span class="tool-index" aria-hidden="true">05 / ARCHIVE</span>
          <span class="ic"><ArchiveIcon name="image" /></span>
          <span class="banner-copy"><span class="t">效果样张</span><span class="d">经人工细致复核的定稿画册，凝结帧帧动人的画面叙事。</span></span>
          <span class="go">→ 浏览完整画册</span>
        </RouterLink>
      </div>
    </section>

    <section class="container home-inspiration" aria-label="场景与角色灵感">
        <div class="hero-strip" aria-labelledby="featuredScenesLabel">
          <div class="strip-label" id="featuredScenesLabel">
            <span class="dot"></span> 今天可以从这里开始 · <span>{{ sceneCountCopy }}</span>
          </div>
          <div ref="stripEl" class="strip-scroll">
            <!--
              不带 &generate=1：点场景卡的意图是「用这个场景开始」，不是「立刻
              出图」。带上它会在落地瞬间静默启动一次分钟级任务，用户既没预览
              也没确认，只能干等或手忙脚乱地取消（2026-08-30 UX 审计 P1）。
              「调整后生成 / 画这个场景」这类写明动作的按钮才带这个参数。
            -->
            <RouterLink
              v-for="s in featuredScenes"
              :key="s.id"
              class="sc-link"
              :to="`/prompt-builder?scene=${encodeURIComponent(s.id)}&step=4`"
            >
              <SceneCard :scene="s" mode="strip" :clickable="false" />
            </RouterLink>
          </div>
        </div>
        <!-- 热门角色：样张立绘横条，点击进入该角色的场景库 -->
        <div v-if="popularCharacters.length" class="pop-strip" aria-labelledby="popStripLabel">
          <div class="strip-label" id="popStripLabel">
            <span class="dot"></span> 热门角色 · <span>{{ popularCharacters.length }} 位角色样张</span>
          </div>
          <div class="pop-scroll">
            <RouterLink
              v-for="c in popularCharacters"
              :key="c.id"
              class="pop-card-mini"
              :to="`/popular-scenes?character=${encodeURIComponent(c.id)}`"
            >
              <img :src="portraitSrc(c.id)" :alt="c.displayName" loading="lazy" decoding="async" />
              <span class="pop-cap">
                <span class="pop-cap-name">{{ c.displayName }}</span>
                <span class="pop-cap-franchise">{{ c.franchise }}</span>
              </span>
            </RouterLink>
          </div>
        </div>
    </section>

    <!-- 资料区 -->
    <section class="container home-section home-section-quiet" data-reveal>
      <div class="home-section-head">
        <div>
          <span class="eyebrow">资料与回顾</span>
          <h2>画室里的小抽屉</h2>
          <p class="hint">角色、画风、模型和旧作，都收在这里。</p>
        </div>
      </div>
      <div class="tools-grid">
        <RouterLink to="/character" class="tool-card card-create">
          <span class="tool-index" aria-hidden="true">05 / PROFILE</span>
          <span class="ic"><ArchiveIcon name="character" /></span><span class="t">角色档案</span>
          <span class="d">认识角色的模样、性格与故事。</span>
          <span class="go">→ 打开</span>
        </RouterLink>
        <RouterLink to="/style" class="tool-card card-create">
          <span class="tool-index" aria-hidden="true">06 / PALETTE</span>
          <span class="ic"><ArchiveIcon name="palette" /></span><span class="t">画风</span>
          <span class="d">探寻画面色阶、情绪氛围与色彩剧本。</span>
          <span class="go">→ 打开</span>
        </RouterLink>
        <RouterLink to="/lora" class="tool-card card-create">
          <span class="tool-index" aria-hidden="true">07 / MODEL</span>
          <span class="ic"><ArchiveIcon name="model" /></span><span class="t">模型</span>
          <span class="d">找到适合这次创作的模型与推荐设置。</span>
          <span class="go">→ 打开</span>
        </RouterLink>
        <RouterLink to="/gallery" class="tool-card card-create">
          <span class="tool-index" aria-hidden="true">08 / WORKS</span>
          <span class="ic"><ArchiveIcon name="gallery" /></span><span class="t">作品册</span>
          <span class="d">以纯净原始画幅，安静收存属于你的每一张心动创作。</span>
          <span class="go">→ 打开</span>
        </RouterLink>
      </div>
    </section>

    <!-- 最近用过的场景 -->
    <section class="container home-section" v-if="recentScenes.length" data-reveal>
      <div class="home-section-head">
        <h2>最近用过的场景</h2>
        <RouterLink to="/scene-explorer" class="link">继续找灵感 →</RouterLink>
      </div>
      <div class="recent-scenes-row">
        <!-- 同上：进场景，不自动开跑 -->
        <RouterLink
          v-for="s in recentScenes"
          :key="s.id"
          class="sc-link"
          :to="`/prompt-builder?scene=${encodeURIComponent(s.id)}&step=4`"
        >
          <SceneCard :scene="s" mode="strip" :clickable="false" />
        </RouterLink>
      </div>
    </section>

    <!-- 最近创作 -->
    <section class="container home-section" data-reveal>
      <div class="home-section-head">
        <h2>最近创作</h2>
        <RouterLink to="/gallery" class="link">打开作品册 →</RouterLink>
      </div>
      <div class="recent-grid stagger-container" ref="recentWorksEl">
        <ArchiveStatePanel
          v-if="!recentWorks.length"
          class="recent-empty-state"
          compact
          kind="empty"
          title="还没有最近作品"
          message="画好之后，它会收进你的本地作品档案。"
        >
          <RouterLink to="/prompt-builder" class="btn btn-primary"><ArchiveIcon name="spark" /> 开始绘制</RouterLink>
        </ArchiveStatePanel>
        <template v-else>
          <RouterLink
            v-for="h in recentWorks"
            :key="h.id"
            class="recent-card"
            :to="`/prompt-builder?regen=${encodeURIComponent(h.id)}`"
          >
            <div class="recent-cover" :data-image-id="h.image_id">
              <img v-if="coverUrl(h)" :src="coverUrl(h)" alt="" class="recent-cover-img" />
              <ArchiveIcon v-else name="image" class="placeholder" />
            </div>
            <div class="recent-body">
              <div class="recent-title">{{ h.sceneTitle || h.scene || '未命名' }}</div>
              <div class="recent-meta">{{ charName(h.character) }} · {{ fmtDate(h.timestamp) }}</div>
            </div>
          </RouterLink>
        </template>
      </div>
    </section>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, nextTick } from 'vue'
import { maintenanceApi } from '../api/maintenanceApi.ts'
import SceneCard from '@/components/SceneCard.vue'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import ArchiveIcon, { type ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'
import { kvInit, kvGet, kvSet } from '@/composables/useKVStore'
import { imgGet } from '@/composables/useImageStore'
import { readRecent } from '@/utils/sceneUX'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useSceneStore } from '@/stores/sceneStore'
import type { Scene } from '@/stores/sceneStore'
import { artworkTimestamp, parseArtworkRecords, type ArtworkRecord } from '@/types/artwork'
import { ARTWORK_HISTORY_KV_KEY } from '@/utils/storageKeys'

useScrollReveal()

const DRAFT_KEY = 'aics_pb_last_draft'

const sceneCountCopy = ref('场景加载中')
const sceneLibraryCopy = ref('招牌灵感瞬间，已悉数备好镜头与光影基调。')
const continueIconName = ref<ArchiveIconName>('spark')
const continueLink = ref({ to: '/prompt-builder', label: '开始绘制' })
const continueHint = ref('')
type HomeScene = Scene & { title?: string; mature?: boolean }

const recentWorks = ref<ArtworkRecord[]>([])
const recentScenes = ref<HomeScene[]>([])
const featuredScenes = ref<HomeScene[]>([])
const sceneStore = useSceneStore()
const coverUrls = reactive<Record<string, string>>({})
const heroAssets = reactive({
  nene: '/assets/characters/nene-home-cg-1024.webp',
  natsume: '/assets/characters/natsume-home-cg-1024.webp',
})
/** 卸载标记：异步 imgGet 回来时组件可能已经没了 */
let unmounted = false
const stripEl = ref<HTMLElement | null>(null)

// ── 热门角色：样张立绘横条（立绘来自展示库发布 assets/characters/popular-<id>.png） ──
const popularCharacters = computed(() => sceneStore.popularCharacters)
function portraitSrc(id: string): string {
  // 横条卡片仅 ~180px 宽，加载 1.2MB 原图曾把首页资源预算打爆 5 倍（16MB）。
  // 改用 build-character-thumbs.py 预生成的 360px WebP 缩略图（~19KB/张）；
  // 源 PNG 重发后需重跑该脚本（mtime 过期自动重建）。
  return `/assets/characters/thumbs/popular-${id}.webp?v=${sceneStore.version || 3}`
}

/** 横条只在真正可滚动时显示右缘渐隐，避免宽屏误遮最后一张卡 */
function updateStripFade() {
  const el = stripEl.value
  if (!el) return
  el.classList.toggle('can-scroll', el.scrollWidth > el.clientWidth + 4)
}

function charName(id: string | undefined) {
  return id === 'nene' ? '宁宁' : id === 'natsume' ? '夏目' : id || '·'
}
function fmtDate(ts: string | number | undefined) {
  const value = typeof ts === 'number' || typeof ts === 'string' ? ts : 0
  return new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
function coverUrl(item: ArtworkRecord): string {
  return item.image_id ? coverUrls[item.image_id] || '' : ''
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isHomeScene(scene: Scene): scene is HomeScene {
  return typeof scene.id === 'string'
    && (scene.mature === undefined || typeof scene.mature === 'boolean')
}

function readDraft(value: string | null): { updatedAt: number; sceneId?: string; sceneTitle?: string; story?: string } | null {
  try {
    const parsed: unknown = JSON.parse(value || 'null')
    if (!parsed || typeof parsed !== 'object') return null
    const draft = parsed as Record<string, unknown>
    if (!Number(draft.updatedAt)) return null
    return {
      updatedAt: Number(draft.updatedAt),
      sceneId: typeof draft.sceneId === 'string' ? draft.sceneId : undefined,
      sceneTitle: typeof draft.sceneTitle === 'string' ? draft.sceneTitle : undefined,
      story: typeof draft.story === 'string' ? draft.story : undefined,
    }
  } catch { return null }
}

function initContinueDraft() {
  const draft = readDraft(localStorage.getItem(DRAFT_KEY))
  if (!draft || (!draft.sceneId && !draft.story)) return false
  const title = draft.sceneTitle || draft.story || '未完成创作'
  continueLink.value = { to: '/prompt-builder?resume=1', label: '继续上次创作' }
  continueIconName.value = 'refresh'
  continueHint.value = `上次停在「${title.slice(0, 24)}」`
  return true
}

/**
 * 首页横条以日期为种子做确定性轮换：每天从「招牌 + 精选」池里换一窗展示，
 * 与横条文案「今天可以从这里开始」一致，且不改变 curation 的层级语义。
 */
function pickFeatured(ids: string[], scenes: HomeScene[], count: number): HomeScene[] {
  const pool = ids
    .map(id => scenes.find(scene => scene.id === id))
    .filter((scene): scene is HomeScene => Boolean(scene && !scene.mature))
  if (!pool.length) return []
  const dayKey = new Date().toISOString().slice(0, 10)
  let seed = 0
  for (let i = 0; i < dayKey.length; i += 1) seed = (seed * 31 + dayKey.charCodeAt(i)) >>> 0
  const start = seed % pool.length
  const out: HomeScene[] = []
  for (let i = 0; i < count && out.length < count; i += 1) out.push(pool[(start + i) % pool.length])
  return out
}

async function loadSceneHighlights() {
  try {
    // 审计 2026-09-05 P2-02：首页只需要精选/最近场景与计数，轻载不再拉 3.4MB 蓝图
    await sceneStore.loadHome()
    const scenes = sceneStore.scenes.filter(isHomeScene)
    const curation = sceneStore.curation
    const signatures: string[] = Array.isArray(curation.signatureSceneIds) ? curation.signatureSceneIds : []
    const curated: string[] = Array.isArray(curation.curatedSceneIds) ? curation.curatedSceneIds : []
    const ids = [...signatures, ...curated.filter((id: string) => !signatures.includes(id))]
    sceneCountCopy.value = `${ids.length} 个精选场景`
    sceneLibraryCopy.value = `${ids.length} 个招牌与精选，完整库共 ${scenes.length} 个。`

    featuredScenes.value = pickFeatured(ids, scenes, 6)

    // 最近用过的场景
    const recent = readRecent(localStorage)
    const recentPicks = recent
      .map(item => scenes.find(scene => scene.id === item.id))
      .filter((scene): scene is HomeScene => Boolean(scene))
      .slice(0, 6)
    recentScenes.value = recentPicks
  } catch (err) {
    sceneCountCopy.value = '精选场景'
    console.warn('场景加载失败：', errorMessage(err))
  }
}

async function loadHomeHeroAssets() {
  try {
    const payload = await maintenanceApi.getHomeHero()
    for (const key of ['nene', 'natsume'] as const) {
      const image = payload.entries[key]?.image
      if (typeof image === 'string' && /^\/scene-showcase\/home\/(nene|natsume)\.jpg(?:\?[^"'<>]*)?$/.test(image)) {
        heroAssets[key] = image
      }
    }
  } catch { /* maintenance API is optional; bundled fallback remains available */ }
}

async function loadRecentWorks() {
  try {
    let history = parseArtworkRecords(await kvGet(ARTWORK_HISTORY_KV_KEY))
    if (!history.length) {
      let old: ArtworkRecord[] = []
      try { old = parseArtworkRecords(JSON.parse(localStorage.getItem(ARTWORK_HISTORY_KV_KEY) || '[]')) } catch {}
      if (old.length) { history = old; await kvSet(ARTWORK_HISTORY_KV_KEY, old); localStorage.removeItem(ARTWORK_HISTORY_KV_KEY) }
    }
    // 历史按生成顺序 append，直接 slice 拿到的是最旧的三幅
    recentWorks.value = history.slice().sort((a, b) => artworkTimestamp(b) - artworkTimestamp(a)).slice(0, 3)

    if (!initContinueDraft() && recentWorks.value[0]) {
      const h = recentWorks.value[0]
      continueLink.value = { to: `/prompt-builder?regen=${encodeURIComponent(h.id)}`, label: '继续最近作品' }
      continueHint.value = `最近保存「${h.sceneTitle || h.scene || '未命名'}」`
    }

    await Promise.all(recentWorks.value.map(async h => {
      if (!h.image_id) return
      try {
        const blob = await imgGet(h.image_id)
        if (!blob) return
        // 组件可能在 await 期间就卸载了，这时候不该再建 URL
        if (unmounted) return
        if (coverUrls[h.image_id]) URL.revokeObjectURL(coverUrls[h.image_id])
        coverUrls[h.image_id] = URL.createObjectURL(blob)
      } catch {}
    }))
  } catch (e) { console.warn('读取历史失败', e) }
}

onMounted(async () => {
  initContinueDraft()
  await loadHomeHeroAssets()
  await loadSceneHighlights()
  try {
    await kvInit()
    await loadRecentWorks()
  } catch (e) { console.warn('KV store unavailable', e) }
  // 横条内容是异步载入的，DOM 渲染完成后才能判断是否真的可滚动；
  // 图片解码会进一步撑宽卡片，再延时重测一次避免漏判
  await nextTick()
  updateStripFade()
  window.setTimeout(updateStripFade, 500)
  window.addEventListener('resize', updateStripFade)
})

onUnmounted(() => {
  unmounted = true
  window.removeEventListener('resize', updateStripFade)
  // 首页封面是 IndexedDB blob，不释放就会一直挂在内存里
  Object.keys(coverUrls).forEach((key) => {
    if (coverUrls[key]) URL.revokeObjectURL(coverUrls[key])
    delete coverUrls[key]
  })
})

</script>

<style scoped src="@/assets/css/home.css"></style>
