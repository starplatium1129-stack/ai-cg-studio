<template>
  <article class="home-page">
    <!-- Hero -->
    <section class="container">
      <div class="home-hero">
        <div ref="heroCopyEl" class="hero-copy">
          <div class="hero-register" aria-label="本期绘境信息">
            <span class="archive-kicker">ARCHIVE // 00</span>
            <span>{{ sceneCountCopy }}</span>
            <span>Local studio</span>
          </div>
          <span class="eyebrow">NENE &amp; NATSUME ATELIER</span>
          <h1 class="hero-title">绫季绘境<span class="jp">把心动的一瞬，画成一张 CG</span></h1>
          <p class="hero-sub">捕捉触动心弦的瞬间，画下专属你的 CG。</p>
          <p class="hero-jp">「 ときめきの一瞬を、一枚の CG に 」</p>
          <div class="ctas">
            <RouterLink :to="continueLink.to" class="btn btn-lg btn-primary" id="continueCta">
              <span class="ic"><ArchiveIcon :name="continueIconName" /></span> {{ continueLink.label }}
            </RouterLink>
            <RouterLink to="/showcase" class="btn btn-lg btn-ghost"><span class="ic"><ArchiveIcon name="image" /></span> 先看成片</RouterLink>
          </div>
          <div class="continue-hint" v-if="continueHint">
            <strong>{{ continueHint }}</strong>
          </div>
        </div>
        <aside ref="heroOrbitEl" class="hero-orbit" aria-label="宁宁与夏目的角色视觉">
        <div ref="heroWmEl" class="hero-watermark" aria-hidden="true">ATELIER</div>
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
            loading="eager"
            decoding="async"
          />
        </picture>
          <div class="orbit-label"><strong>NENE × NATSUME</strong><span>把今天的心动，收进画面。</span></div>
        </aside>
        <div class="hero-strip" aria-labelledby="featuredScenesLabel">
          <div class="strip-label" id="featuredScenesLabel">
            <span class="dot"></span> 今天可以从这里开始 · <span>{{ sceneCountCopy }}</span>
          </div>
          <div ref="stripEl" class="strip-scroll">
            <RouterLink
              v-for="s in featuredScenes"
              :key="s.id"
              class="sc-link"
              :to="`/prompt-builder?scene=${encodeURIComponent(s.id)}&step=4&generate=1`"
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
      </div>
    </section>

    <!-- 创作入口 -->
    <section class="container home-section" data-reveal>
      <div class="home-section-head">
        <div>
          <span class="eyebrow"><span class="num">01</span> 创作入口</span>
          <h2>创作工坊 · Studio</h2>
          <p class="hint">即刻开启画面绘制；亦可在场景灵感或角色房间静享酝酿。</p>
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
          <span class="d">用简单的镜头意图驱动本地视频模型，工作流与复杂参数由工作室接管。</span>
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

    <!-- 资料区 -->
    <section class="container home-section home-section-quiet" data-reveal>
      <div class="home-section-head">
        <div>
          <span class="eyebrow">资料与回顾</span>
          <h2>工坊档案 · Archives</h2>
          <p class="hint">细描角色设定，凝固色彩基调，在无扰的本机空间慢慢回味。</p>
        </div>
      </div>
      <div class="tools-grid">
        <RouterLink to="/character" class="tool-card card-create">
          <span class="tool-index" aria-hidden="true">05 / PROFILE</span>
          <span class="ic"><ArchiveIcon name="character" /></span><span class="t">角色档案</span>
          <span class="d">收录角色设定、官方特征词与 LoRA 契约映射。</span>
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
          <span class="d">查阅训练集配比、触发词典与最佳推荐权重。</span>
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
        <RouterLink
          v-for="s in recentScenes"
          :key="s.id"
          class="sc-link"
          :to="`/prompt-builder?scene=${encodeURIComponent(s.id)}&step=4&generate=1`"
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
              <span v-else class="placeholder">▤</span>
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
const heroCopyEl = ref<HTMLElement | null>(null)
const heroOrbitEl = ref<HTMLElement | null>(null)
const heroWmEl = ref<HTMLElement | null>(null)
const stripEl = ref<HTMLElement | null>(null)
let heroScrollFrame = 0

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

/**
 * 滚动叙事：hero 三层以不同速率上移（视差），标题随滚动淡出，
 * 让首屏像一页被轻轻翻走。reduced-motion 下完全跳过。
 */
function onHeroScroll() {
  if (heroScrollFrame) return
  heroScrollFrame = requestAnimationFrame(() => {
    heroScrollFrame = 0
    const y = window.scrollY
    if (y <= 0) {
      if (heroCopyEl.value) { heroCopyEl.value.style.transform = ''; heroCopyEl.value.style.opacity = '' }
      if (heroOrbitEl.value) heroOrbitEl.value.style.transform = ''
      if (heroWmEl.value) heroWmEl.value.style.transform = ''
      return
    }
    if (heroCopyEl.value) {
      heroCopyEl.value.style.transform = `translateY(${y * 0.1}px)`
      heroCopyEl.value.style.opacity = String(Math.max(0, 1 - y / 420))
    }
    if (heroOrbitEl.value) heroOrbitEl.value.style.transform = `translateY(${y * 0.05}px)`
    if (heroWmEl.value) heroWmEl.value.style.transform = `translateY(${y * 0.14}px)`
  })
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
    await sceneStore.load()
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
    let history = parseArtworkRecords(await kvGet('aics_pb_history'))
    if (!history.length) {
      let old: ArtworkRecord[] = []
      try { old = parseArtworkRecords(JSON.parse(localStorage.getItem('aics_pb_history') || '[]')) } catch {}
      if (old.length) { history = old; await kvSet('aics_pb_history', old); localStorage.removeItem('aics_pb_history') }
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
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('scroll', onHeroScroll, { passive: true })
  }
  // 横条内容是异步载入的，DOM 渲染完成后才能判断是否真的可滚动；
  // 图片解码会进一步撑宽卡片，再延时重测一次避免漏判
  await nextTick()
  updateStripFade()
  window.setTimeout(updateStripFade, 500)
  window.addEventListener('resize', updateStripFade)
})

onUnmounted(() => {
  unmounted = true
  window.removeEventListener('scroll', onHeroScroll)
  window.removeEventListener('resize', updateStripFade)
  if (heroScrollFrame) cancelAnimationFrame(heroScrollFrame)
  // 首页封面是 IndexedDB blob，不释放就会一直挂在内存里
  Object.keys(coverUrls).forEach((key) => {
    if (coverUrls[key]) URL.revokeObjectURL(coverUrls[key])
    delete coverUrls[key]
  })
})

</script>

<style scoped>
/* ---------- Hero ---------- */
.home-hero { position:relative; padding:var(--s-8) 0 var(--s-4); display:grid; grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr); grid-template-rows:auto auto; gap:var(--s-5) var(--s-6); align-items:end; }
.home-page .hero-copy { animation:homeCopyIn .58s var(--ease-out) .04s both; }
.home-page .hero-orbit { animation:homeOrbitIn .66s var(--ease-out) .12s both; }
.home-page .hero-strip { animation:homeStripIn .62s var(--ease-out) .22s both; }
@keyframes homeCopyIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:none; } }
@keyframes homeOrbitIn { from { opacity:0; filter:blur(8px); transform:translateX(12px) scale(.985); } to { opacity:1; filter:none; transform:none; } }
@keyframes homeStripIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
.home-hero::before { content:""; position:absolute; left:-18px; top:var(--s-8); width:2px; height:92px; border-radius:var(--r-pill); background:linear-gradient(180deg,var(--accent),var(--accent-violet),transparent); opacity:.72; }
.hero-copy { grid-column:1; grid-row:1; align-self:end; min-width:0; }
.hero-register { display:flex; align-items:center; gap:var(--s-3); margin-bottom:var(--s-4); color:var(--text-muted); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.12em; text-transform:uppercase; }
.hero-register .archive-kicker { color:var(--editorial-gold); }
.hero-register span { display:inline-flex; align-items:center; gap:var(--s-2); }
.hero-register span+span::before { content:""; width:18px; height:1px; background:var(--archive-blue); opacity:.72; }
.hero-title { max-width:12ch; text-wrap:balance; margin-bottom:var(--s-4); font:600 clamp(2.4rem,4.7vw,4.2rem)/1.06 var(--font-serif); letter-spacing:.02em; }
.hero-title :deep(.accent) { background:linear-gradient(135deg,var(--accent) 60%,var(--mood-love)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.jp { display:block; margin-top:var(--s-2); font-size:.25em; letter-spacing:.32em; text-transform:uppercase; color:var(--accent-violet); -webkit-text-fill-color:var(--accent-violet); }
.hero-sub { font-size:var(--fs-body-lg); color:var(--text-secondary); margin-bottom:var(--s-3); max-width:520px; line-height:1.7; }
.hero-jp { color:var(--accent-violet); font:500 var(--fs-label)/1.8 var(--font-serif); letter-spacing:0.22em; margin:0 0 var(--s-5); opacity:.9; }
.ctas { display:flex; gap:var(--s-3); flex-wrap:wrap; margin-bottom:var(--s-4); align-items:center; }
.hero-orbit { grid-column:2; grid-row:1; min-width:0; min-height:380px; position:relative; isolation:isolate; border:1px solid color-mix(in srgb,var(--editorial-gold) 38%,var(--border-soft)); border-radius:2px var(--r-xl) 2px var(--r-xl); overflow:hidden; background:linear-gradient(90deg,color-mix(in srgb,var(--on-art-line) 42%,transparent) 1px,transparent 1px) 0 0/32px 32px,linear-gradient(color-mix(in srgb,var(--on-art-line) 42%,transparent) 1px,transparent 1px) 0 0/32px 32px,linear-gradient(135deg,var(--accent-glow),transparent 42%),var(--stage-rella); box-shadow:inset 0 1px 0 var(--on-art-line),var(--shadow-lg); }
.hero-orbit::before { content:""; position:absolute; z-index:var(--z-raised); inset:0; pointer-events:none; background:linear-gradient(115deg,var(--on-art-sheen),transparent 18%,transparent 70%,var(--on-art-wash)); mix-blend-mode:soft-light; opacity:.48; }
.hero-orbit::after { content:""; position:absolute; z-index:var(--z-base); inset:0; pointer-events:none; box-shadow:inset 0 0 72px color-mix(in srgb,var(--art-backdrop) 34%,transparent); }
.hero-watermark { position:absolute; z-index:var(--z-base); top:var(--s-4); left:var(--s-4); color:var(--on-art-wash); font:800 clamp(2rem,5vw,4.5rem) var(--font-mono); letter-spacing:-.07em; writing-mode:vertical-rl; pointer-events:none; opacity:.32; will-change:transform; }
.hero-character { position:absolute; z-index:var(--z-base); bottom:0; width:72%; height:94%; object-fit:contain; object-position:center bottom; filter:drop-shadow(0 24px 28px color-mix(in srgb,var(--bg-deep) 36%,transparent)); transition:transform .6s var(--ease-out),filter .6s ease; }
/* 双人分割：原来两张各占 54% + 斜切，宽屏下右侧人物会被容器边缘切掉。
   改成各占 52% 并把 object-position 收回中心，接缝仍在中线附近。 */
.hero-character.nene { left:0; width:52%; height:100%; object-fit:cover; object-position:46% 32%; filter:saturate(1.04) contrast(1.03); clip-path:polygon(0 0,100% 0,88% 100%,0 100%); }
.hero-character.natsume { right:0; width:52%; height:100%; object-fit:cover; object-position:54% 30%; filter:saturate(1.04) contrast(1.03); clip-path:polygon(12% 0,100% 0,100% 100%,0 100%); }
/* 悬停时两人向中间靠一点，做出"同框"的呼应 */
@media (hover: hover) and (pointer: fine) {
  .hero-orbit:hover .hero-character.nene { transform:translateX(1.5%) scale(1.015); }
  .hero-orbit:hover .hero-character.natsume { transform:translateX(-1.5%) scale(1.015); }
}
@media (prefers-reduced-motion:reduce) {
  .hero-orbit:hover .hero-character.nene,
  .hero-orbit:hover .hero-character.natsume { transform:none; }
}
.orbit-label { position:absolute; z-index:var(--z-raised); left:var(--s-5); right:var(--s-5); bottom:var(--s-5); padding:var(--s-3) var(--s-4); border:1px solid color-mix(in srgb,var(--editorial-gold) 34%,var(--on-art-line)); border-radius:2px var(--r-lg) 2px var(--r-lg); background:var(--art-scrim-soft); backdrop-filter:blur(16px); }
.orbit-label strong { display:block; font-size:var(--fs-body-sm); letter-spacing:.08em; color:var(--on-art-primary); }
.orbit-label span { display:block; margin-top:3px; color:var(--on-art-secondary); font-size:var(--fs-label-sm); }
.hero-strip { grid-column:1 / -1; grid-row:2; position:relative; background:linear-gradient(135deg,var(--accent-soft),transparent 65%),var(--bg-surface); border:1px solid var(--border-soft); border-left:2px solid var(--editorial-gold); border-radius:2px var(--r-lg) 2px var(--r-lg); padding:var(--s-4) var(--s-5); overflow:hidden; }
.strip-label { display:flex; align-items:center; gap:var(--s-2); font-size:var(--fs-label-xs); font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-muted); margin-bottom:var(--s-3); }
.strip-label .dot { width:6px; height:6px; border-radius:50%; background:var(--accent); box-shadow:var(--glow-sm); }
.strip-scroll { display:flex; gap:var(--s-3); overflow-x:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; padding:2px var(--s-2) var(--s-2) 0; scrollbar-width:thin; }
.strip-scroll.can-scroll { mask-image:linear-gradient(90deg,#000 calc(100% - 36px),transparent); -webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 36px),transparent); }
.strip-scroll::-webkit-scrollbar { height:4px; }
.strip-scroll::-webkit-scrollbar-thumb { background:var(--border-soft); border-radius:var(--r-pill); }

/* 热门角色：样张立绘横条（玻璃卡语言与 hero-strip 同源） */
.home-page .pop-strip {
  grid-column:1 / -1;
  margin-top: var(--s-3);
  padding: var(--s-3) var(--s-4);
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent 55%), var(--bg-surface);
  border: 1px solid var(--border-soft);
  border-radius: 2px var(--r-xl) 2px var(--r-xl);
  overflow: hidden;
  animation: homeStripIn .62s var(--ease-out) .32s both;
}
.pop-scroll {
  display:flex; gap:var(--s-3); overflow-x:auto;
  scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch;
  padding:2px var(--s-2) var(--s-2) 0; scrollbar-width:thin;
}
.pop-scroll::-webkit-scrollbar { height:4px; }
.pop-scroll::-webkit-scrollbar-thumb { background:var(--border-soft); border-radius:var(--r-pill); }
.pop-card-mini {
  flex:0 0 auto; position:relative; width:132px;
  padding:6px 6px 4px;
  border:1px solid var(--border-soft);
  border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--bg-elevated) 86%, transparent);
  box-shadow: var(--shadow-glass-sm);
  scroll-snap-align:start;
  /* 普通块流：img 的 width:100% 直接绑定卡片内容宽度。
     （grid 的 auto 轨道会被部分图片的内在尺寸撑大导致溢出，已实测复现） */
  display:block;
  overflow:hidden;
  min-width:0;
  text-decoration:none;
  transition: transform var(--motion-hover) var(--ease-out), box-shadow var(--motion-hover), border-color var(--motion-hover);
}
.pop-card-mini:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border-soft)); box-shadow: 0 16px 34px -16px color-mix(in srgb, var(--accent) 45%, transparent), var(--shadow-glass-md); }
.pop-card-mini:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pop-card-mini img {
  display:block; width:100%; height:auto; aspect-ratio:3/4; object-fit:cover; object-position:center top;
  border-radius: var(--r-md);
  filter: saturate(.94); transition: filter var(--motion-surface), transform var(--motion-surface) var(--ease-out);
}
.pop-card-mini:hover img { filter: saturate(1.06); }
.pop-cap {
  display:flex; flex-direction:column; gap:1px;
  margin-top:6px;
  padding: 0 2px 2px;
}
.pop-cap-name {
  font-size: var(--fs-label-sm); font-weight:600; color: var(--text-primary);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.pop-cap-franchise {
  font: 600 var(--fs-mono-xs) var(--font-mono); color: var(--text-muted);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.continue-hint { min-height:20px; margin-top:var(--s-2); color:var(--text-muted); font-size:var(--fs-label-sm); }
.continue-hint strong { color:var(--accent); }

/* ---------- Sections ---------- */
/* 2026-08-21：区块间距收紧（原 clamp(40px,6vw,76px) 在区块间叠加出大片空白带） */
.home-section { padding:clamp(30px, 4.2vw, 52px) 0; border-top:1px solid var(--border-soft); }
.home-section-quiet { padding:clamp(24px, 3.2vw, 40px) 0; }
.home-section-head { position:relative; display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:var(--s-5); padding-left:var(--s-4); gap:var(--s-4); }
.home-section-head::before { content:""; position:absolute; left:0; top:2px; bottom:2px; width:2px; background:linear-gradient(180deg,var(--archive-blue),var(--accent),transparent); }
.home-section-head h2 { margin-bottom:var(--s-1); font:600 var(--fs-title)/1.35 var(--font-serif); letter-spacing:.035em; }
.home-section-head .hint { font-size:var(--fs-body-sm); color:var(--text-muted); margin:0; }
.home-section-head .link { font-size:var(--fs-body-sm); flex-shrink:0; }
.eyebrow .num { color:var(--text-muted); font-weight:600; }

/* ---------- Tools ---------- */
.tools-grid { display:grid; grid-template-columns:1fr; gap:var(--s-3); }
@media (min-width:768px) { .tools-grid { grid-template-columns:repeat(2,1fr); } }
@media (min-width:1200px) { .tools-grid { grid-template-columns:repeat(4,1fr); } }
.tool-card { display:flex; flex-direction:column; gap:var(--s-2); min-height:176px; background:linear-gradient(145deg,var(--editorial-gold-soft),transparent 26%),var(--bg-surface); border:1px solid var(--border-soft); border-radius:2px var(--r-lg) 2px var(--r-lg); padding:var(--s-5); text-decoration:none; color:var(--text-primary); transition:border-color var(--motion-hover),transform var(--motion-hover) var(--ease-out),box-shadow var(--motion-hover); }
.tool-card .tool-index { position:absolute; top:var(--s-3); right:var(--s-4); color:var(--editorial-gold); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.1em; opacity:.86; }
.tool-card .ic { margin-top:var(--s-3); }
.tool-card:hover { border-color:color-mix(in srgb,var(--accent) 58%,var(--border-soft)); }
.tool-card .ic { display:grid; place-items:center; width:36px; height:36px; border:1px solid color-mix(in srgb,var(--accent) 28%,var(--border-soft)); border-radius:var(--r-lg); background:var(--accent-soft); font-size:var(--fs-title-sm); box-shadow:inset 0 1px 0 var(--glass-highlight); }
.tool-card .t { font:600 var(--fs-title-xs)/1.35 var(--font-serif); letter-spacing:.025em; }
.tool-card .d { font-size:var(--fs-label); color:var(--text-muted); line-height:1.5; margin:0; flex:1; }
.tool-card .go { display:inline-flex; align-items:center; gap:var(--s-1); width:max-content; font-size:var(--fs-label-sm); color:var(--accent); margin-top:var(--s-2); transition:transform var(--motion-hover) var(--ease-out); }

/* ---------- Banner 卡（05/ARCHIVE）：≥768px 拉通为横向入口，消除 4+1 孤行 ---------- */
.banner-copy { display:flex; flex-direction:column; gap:var(--s-2); flex:1; min-width:0; }
@media (min-width:768px) {
  .tools-grid .tool-card-banner { grid-column:1 / -1; flex-direction:row; align-items:center; gap:var(--s-4); min-height:0; padding:var(--s-4) var(--s-5); }
  .tool-card-banner .ic { margin-top:0; width:44px; height:44px; font-size:var(--fs-title); flex-shrink:0; }
  .tool-card-banner .go { margin-top:0; margin-left:auto; flex-shrink:0; }
}

/* ---------- Recent ---------- */
.recent-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:var(--s-4); }
.recent-card { background:var(--bg-surface); border:1px solid var(--border-soft); border-radius:var(--r-lg); overflow:hidden; cursor:pointer; transition:border-color var(--motion-hover),transform var(--motion-hover); text-decoration:none; color:var(--text-primary); }
.recent-card:hover { border-color:var(--accent); }
.recent-cover { aspect-ratio:4/3; display:flex; align-items:center; justify-content:center; background:var(--bg-deep); font-size:var(--fs-glyph); overflow:hidden; }
.recent-cover img { width:100%; height:100%; object-fit:cover; animation:archive-image-in .3s ease; }
.recent-cover .placeholder { color:var(--text-muted); }
.recent-body { padding:var(--s-3); }
.recent-title { font-weight:700; font-size:var(--fs-body-sm); margin-bottom:2px; }
.recent-meta { font-size:var(--fs-label-xs); color:var(--text-muted); }
.recent-scenes-row { display:flex; gap:var(--s-3); overflow-x:auto; padding:4px 2px var(--s-3); scroll-snap-type:x proximity; }
.recent-scenes-row > * { flex:0 0 min(300px,82vw); scroll-snap-align:start; }
.sc-link { display:block; color:inherit; text-decoration:none; }
.strip-scroll .sc-link { flex:0 0 auto; }
@media (max-width:600px) { .recent-grid { grid-template-columns:1fr 1fr; } }
.recent-grid .recent-empty-state { grid-column:1 / -1; margin-top:0; }

@media (hover: hover) and (pointer: fine) {
  .pop-card-mini:hover { transform:translateY(-3px) scale(1.02); }
  .tool-card:hover { transform:translateY(-2px); }
  .tool-card:hover .go { transform:translateX(3px); }
  .recent-card:hover { transform:translateY(-2px); }
}

/* ---------- Responsive ---------- */
@media (max-width:768px) {
  .home-hero { grid-template-columns:minmax(0,1fr); gap:var(--s-5); }
  .hero-copy,.hero-strip,.hero-orbit { grid-column:1; grid-row:auto; min-width:0; width:100%; max-width:100%; }
  .hero-copy { order:1; }
  .hero-orbit { order:2; min-height:360px; }
  .hero-strip { order:3; }
  .home-page .pop-strip { order:4; }
}
@media (max-width:480px) {
  .home-hero { padding-top:var(--s-6); }
  .hero-sub { font-size:var(--fs-body-lg); }
  .ctas { flex-direction:column; align-items:stretch; }
  .home-hero::before { display:none; }
  .hero-title { max-width:none; }
  .hero-title { font-size:2.55rem; }
  .hero-jp { letter-spacing:.14em; }
  .hero-orbit { min-height:290px; }
  .hero-register { gap:var(--s-2); flex-wrap:wrap; }
  .hero-register span:last-child { display:none; }
  .chain { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); margin:var(--s-4) 0 var(--s-5); overflow:visible; }
  .chain-step { min-width:0; justify-content:center; gap:2px; padding:7px 2px; font-size:var(--fs-label-xs); }
  .chain-step::before { margin-right:2px; }
  .chain-step .ic { display:none; }
  .chain-arrow { display:none; }
}
@media (prefers-reduced-motion:reduce) {
  .home-page .hero-copy, .home-page .hero-orbit, .home-page .hero-strip { animation:none; }
  .tool-card,.recent-card { transition:none; }
}
</style>
