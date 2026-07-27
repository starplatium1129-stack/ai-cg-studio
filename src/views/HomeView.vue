<template>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <main id="main">
    <!-- Hero -->
    <section class="container">
      <div class="home-hero">
        <div class="hero-copy">
          <span class="eyebrow">✦ NENE &amp; NATSUME ATELIER</span>
          <h1 class="hero-title">绫季绘境<span class="jp">把心动的一瞬，画成一张 CG</span></h1>
          <p class="hero-sub">选一个想画的瞬间。角色、情绪与光线会替你备好，你只管按下出图。</p>
          <p class="hero-jp">「 ときめきの一瞬を、一枚の CG に 」</p>
          <div class="ctas">
            <RouterLink :to="continueLink.to" class="btn btn-lg btn-primary" id="continueCta">
              <span class="ic">{{ continueLink.icon }}</span> {{ continueLink.label }}
            </RouterLink>
            <RouterLink to="/showcase" class="btn btn-lg btn-ghost"><span class="ic">🖼</span> 先看成片</RouterLink>
          </div>
          <div class="continue-hint" v-if="continueHint">
            <strong>{{ continueHint }}</strong>
          </div>
          <div class="chain">
            <div class="chain-step"><span class="ic">📖</span> 故事 <span class="en">Story</span></div>
            <span class="chain-arrow">→</span>
            <div class="chain-step"><span class="ic">👤</span> 角色 <span class="en">Character</span></div>
            <span class="chain-arrow">→</span>
            <div class="chain-step"><span class="ic">🎬</span> 场景 <span class="en">Scene</span></div>
            <span class="chain-arrow">→</span>
            <div class="chain-step"><span class="ic">✦</span> 绘制 <span class="en">Draw</span></div>
            <span class="chain-arrow">→</span>
            <div class="chain-step final"><span class="ic">🖼</span> 画面 <span class="en">Image</span></div>
          </div>
        </div>
        <aside class="hero-orbit" aria-label="宁宁与夏目的角色视觉">
          <img class="hero-character nene" src="/assets/characters/nene-home-cg.jpg" alt="绫地宁宁" decoding="async" />
          <img class="hero-character natsume" src="/assets/characters/natsume-home-cg.jpg" alt="四季夏目" decoding="async" />
          <div class="orbit-label"><strong>NENE × NATSUME</strong><span>把今天的心动，收进画面。</span></div>
        </aside>
        <div class="hero-strip" aria-labelledby="featuredScenesLabel">
          <div class="strip-label" id="featuredScenesLabel">
            <span class="dot"></span> 今天可以从这里开始 · <span>{{ sceneCountCopy }}</span>
          </div>
          <div class="strip-scroll" ref="featuredScenesEl"></div>
        </div>
      </div>
    </section>

    <!-- 创作入口 -->
    <section class="container home-section">
      <div class="home-section-head">
        <div>
          <span class="eyebrow"><span class="num">01</span> 创作入口</span>
          <h2>从这里开画</h2>
          <p class="hint">想出图就进绘制台；想先找感觉，去灵感或角色房间。</p>
        </div>
      </div>
      <div class="tools-grid">
        <RouterLink to="/prompt-builder" class="tool-card card-create card-level-2">
          <span class="ic">✦</span><span class="t">开始绘制</span>
          <span class="d">选场景、调情绪与镜头，一键出图。</span>
          <span class="go">→ 打开</span>
        </RouterLink>
        <RouterLink to="/scene-explorer" class="tool-card card-create card-level-2">
          <span class="ic">🌸</span><span class="t">灵感场景</span>
          <span class="d">{{ sceneLibraryCopy }}</span>
          <span class="go">→ 打开</span>
        </RouterLink>
        <RouterLink to="/chat" class="tool-card card-create card-level-2">
          <span class="ic">☕</span><span class="t">角色房间</span>
          <span class="d">和宁宁或夏目聊一会儿，声音也在本机。</span>
          <span class="go">→ 进入房间</span>
        </RouterLink>
        <RouterLink to="/showcase" class="tool-card card-create card-level-2">
          <span class="ic">🖼</span><span class="t">效果样张</span>
          <span class="d">逐张审核后的真实成图，不是示意图。</span>
          <span class="go">→ 浏览</span>
        </RouterLink>
      </div>
    </section>

    <!-- 资料区 -->
    <section class="container home-section home-section-quiet">
      <div class="home-section-head">
        <div>
          <span class="eyebrow">资料与回顾</span>
          <h2>慢慢看的部分</h2>
          <p class="hint">角色、画风、模型与作品册——需要时再打开。</p>
        </div>
      </div>
      <div class="tools-grid">
        <RouterLink to="/character" class="tool-card card-create">
          <span class="ic">👤</span><span class="t">角色档案</span>
          <span class="d">视觉特征、性格与绑定模型。</span>
          <span class="go">→ 打开</span>
        </RouterLink>
        <RouterLink to="/style" class="tool-card card-create">
          <span class="ic">🎨</span><span class="t">画风</span>
          <span class="d">色调、配色与画面情绪。</span>
          <span class="go">→ 打开</span>
        </RouterLink>
        <RouterLink to="/lora" class="tool-card card-create">
          <span class="ic">🧪</span><span class="t">模型</span>
          <span class="d">训练信息与推荐强度。</span>
          <span class="go">→ 打开</span>
        </RouterLink>
        <RouterLink to="/gallery" class="tool-card card-create">
          <span class="ic">🎞</span><span class="t">作品册</span>
          <span class="d">本机创作，原比例安静欣赏。</span>
          <span class="go">→ 打开</span>
        </RouterLink>
      </div>
    </section>

    <!-- 最近用过的场景 -->
    <section class="container home-section" v-if="recentScenes.length">
      <div class="home-section-head">
        <h2>最近用过的场景</h2>
        <RouterLink to="/scene-explorer" class="link">继续找灵感 →</RouterLink>
      </div>
      <div class="recent-scenes-row" ref="recentScenesEl"></div>
    </section>

    <!-- 最近创作 -->
    <section class="container home-section">
      <div class="home-section-head">
        <h2>最近创作</h2>
        <RouterLink to="/gallery" class="link">打开作品册 →</RouterLink>
      </div>
      <div class="recent-grid" ref="recentWorksEl">
        <div v-if="!recentWorks.length" class="empty-state">
          <div class="empty-state-icon">🎞</div>
          <p>作品册还是空的。去开始绘制，留下第一张 CG。</p>
          <RouterLink to="/prompt-builder" class="btn btn-primary">✦ 开始绘制</RouterLink>
        </div>
        <template v-else>
          <a
            v-for="h in recentWorks"
            :key="h.id"
            class="recent-card"
            :href="`/prompt-builder?regen=${encodeURIComponent(h.id)}`"
          >
            <div class="recent-cover" :data-image-id="h.image_id">
              <img v-if="coverUrls[h.image_id]" :src="coverUrls[h.image_id]" alt="" />
              <span v-else class="placeholder">🎬</span>
            </div>
            <div class="recent-body">
              <div class="recent-title">{{ h.sceneTitle || h.scene || '未命名' }}</div>
              <div class="recent-meta">{{ charName(h.character) }} · {{ fmtDate(h.timestamp) }}</div>
            </div>
          </a>
        </template>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'

// 全局工具库（由 index.html 通过 <script> 标签注入）
declare const AICKVStore: any
declare const AICGImageStore: any
declare const AICSceneUX: any
declare const createSceneCard: (scene: any, opts: any) => HTMLElement

const DRAFT_KEY = 'aics_pb_last_draft'

const sceneCountCopy = ref('场景加载中')
const sceneLibraryCopy = ref('招牌瞬间已备好情绪与镜头。')
const continueLink = ref({ to: '/prompt-builder', icon: '✨', label: '开始绘制' })
const continueHint = ref('')
const recentWorks = ref<any[]>([])
const recentScenes = ref<any[]>([])
const coverUrls = reactive<Record<string, string>>({})
const featuredScenesEl = ref<HTMLElement | null>(null)
const recentScenesEl = ref<HTMLElement | null>(null)

function charName(id: string) {
  return id === 'nene' ? '宁宁' : id === 'natsume' ? '夏目' : id || '·'
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function initContinueDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    if (!draft || !draft.updatedAt || (!draft.sceneId && !draft.story)) return false
    const title = draft.sceneTitle || draft.story || '未完成创作'
    continueLink.value = { to: '/prompt-builder?resume=1', icon: '↩', label: '继续上次创作' }
    continueHint.value = `上次停在「${String(title).slice(0, 24)}」`
    return true
  } catch { return false }
}

async function loadSceneHighlights() {
  try {
    const [scenes, curation] = await Promise.all([
      fetch('/data/scenes.json?v=9').then(r => { if (!r.ok) throw new Error('Scenes HTTP ' + r.status); return r.json() }),
      fetch('/data/curation.json?v=3').then(r => { if (!r.ok) throw new Error('Curation HTTP ' + r.status); return r.json() })
    ])
    const signatures: string[] = Array.isArray(curation.signatureSceneIds) ? curation.signatureSceneIds : []
    const curated: string[] = Array.isArray(curation.curatedSceneIds) ? curation.curatedSceneIds : []
    const ids = [...signatures, ...curated.filter((id: string) => !signatures.includes(id))]
    sceneCountCopy.value = `${ids.length} 个精选场景`
    sceneLibraryCopy.value = `${ids.length} 个招牌与精选，完整库共 ${scenes.length} 个。`

    const picks = ids
      .map((id: string) => scenes.find((s: any) => s.id === id))
      .filter((s: any) => s && !s.mature)
      .slice(0, 6)

    if (featuredScenesEl.value && typeof createSceneCard !== 'undefined') {
      featuredScenesEl.value.innerHTML = ''
      picks.forEach((scene: any) => {
        featuredScenesEl.value!.appendChild(createSceneCard(scene, {
          mode: 'strip', clickable: true,
          onPick: (s: any) => { window.location.href = `/prompt-builder?scene=${encodeURIComponent(s.id)}&step=4&generate=1` }
        }))
      })
    }

    // 最近用过的场景
    if (typeof AICSceneUX !== 'undefined') {
      const recent: any[] = AICSceneUX.readRecent(localStorage) || []
      const recentPicks = recent
        .map((item: any) => scenes.find((s: any) => s.id === item.id))
        .filter(Boolean)
        .slice(0, 6)
      recentScenes.value = recentPicks
      if (recentScenesEl.value && recentPicks.length && typeof createSceneCard !== 'undefined') {
        recentPicks.forEach((scene: any) => {
          recentScenesEl.value!.appendChild(createSceneCard(scene, {
            mode: 'strip', clickable: true,
            onPick: (s: any) => { window.location.href = `/prompt-builder?scene=${encodeURIComponent(s.id)}&step=4&generate=1` }
          }))
        })
      }
    }
  } catch (err: any) {
    sceneCountCopy.value = '精选场景'
    if (featuredScenesEl.value) {
      featuredScenesEl.value.innerHTML = `<div class="strip-state strip-state-error">⚠️ 场景加载失败：${err.message}</div>`
    }
  }
}

async function loadRecentWorks() {
  try {
    let history: any[] = await AICKVStore.get('aics_pb_history') || []
    if (!history.length) {
      const old = JSON.parse(localStorage.getItem('aics_pb_history') || '[]')
      if (old.length) { history = old; await AICKVStore.set('aics_pb_history', old); localStorage.removeItem('aics_pb_history') }
    }
    recentWorks.value = history.slice(0, 3)

    if (!initContinueDraft() && recentWorks.value[0]) {
      const h = recentWorks.value[0]
      continueLink.value = { to: `/prompt-builder?regen=${encodeURIComponent(h.id)}`, icon: '↩', label: '继续最近作品' }
      continueHint.value = `最近保存「${h.sceneTitle || h.scene || '未命名'}」`
    }

    // 加载封面图
    recentWorks.value.forEach(async (h: any) => {
      if (!h.image_id) return
      try {
        const blob = await AICGImageStore.get(h.image_id)
        if (blob) coverUrls[h.image_id] = URL.createObjectURL(blob)
      } catch {}
    })
  } catch (e) { console.warn('读取历史失败', e) }
}

onMounted(async () => {
  initContinueDraft()
  await loadSceneHighlights()
  if (typeof AICKVStore !== 'undefined') {
    await AICKVStore.init()
    await loadRecentWorks()
  }
})
</script>

<style scoped>
/* ---------- Story → Scene → Prompt → Image chain ---------- */
.chain { display:flex; align-items:center; gap:var(--s-2); margin:var(--s-5) 0; flex-wrap:nowrap; overflow-x:auto; padding-bottom:2px; }
.chain-step { display:flex; align-items:center; gap:var(--s-2); background:var(--bg-surface); border:1px solid var(--border-soft); border-radius:var(--r-md); padding:var(--s-2) var(--s-4); font-size:var(--fs-body-sm); font-weight:600; }
.chain-step .ic { font-size:var(--fs-body-lg); }
.chain-step .en { font-size:var(--fs-mono-sm); color:var(--text-muted); font-weight:400; }
.chain-step.final { border-color:var(--accent); background:linear-gradient(135deg,var(--accent-soft),var(--bg-surface)); box-shadow:var(--glow-sm); }
.chain-arrow { color:var(--text-muted); font-size:var(--fs-body-sm); }

/* ---------- Hero ---------- */
.home-hero { padding:var(--s-8) 0 var(--s-6); display:grid; grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr); grid-template-rows:auto auto; gap:var(--s-5) var(--s-6); align-items:end; }
.hero-copy { grid-column:1; grid-row:1; align-self:end; }
.hero-title { font-size:clamp(2.4rem,4.5vw,3.8rem); font-weight:800; line-height:1.12; margin-bottom:var(--s-4); letter-spacing:-0.02em; }
.hero-title :deep(.accent) { background:linear-gradient(135deg,var(--accent) 60%,var(--mood-love)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.jp { display:block; margin-top:var(--s-2); font-size:.25em; letter-spacing:.32em; text-transform:uppercase; color:var(--accent-violet); -webkit-text-fill-color:var(--accent-violet); }
.hero-sub { font-size:1.15rem; color:var(--text-secondary); margin-bottom:var(--s-3); max-width:520px; line-height:1.7; }
.hero-jp { color:var(--accent-violet); font-size:var(--fs-label); letter-spacing:0.3em; margin:0 0 var(--s-5); opacity:.9; }
.ctas { display:flex; gap:var(--s-3); flex-wrap:wrap; margin-bottom:var(--s-4); align-items:center; }
.hero-orbit { grid-column:2; grid-row:1; min-height:380px; position:relative; isolation:isolate; border:1px solid var(--border-soft); border-radius:var(--r-stage); overflow:hidden; background:linear-gradient(135deg,rgba(244,166,215,.18),transparent 42%),linear-gradient(155deg,#4d3d67 0%,#2a233d 48%,#171422 100%); box-shadow:inset 0 1px 0 var(--on-art-line),var(--shadow-lg); }
[data-theme="light"] .hero-orbit { background:linear-gradient(135deg,var(--on-art-sheen),transparent 38%),linear-gradient(155deg,#e9ddf4 0%,#c8b9df 48%,#8c789f 100%); }
.hero-character { position:absolute; z-index:var(--z-base); bottom:0; width:72%; height:94%; object-fit:contain; object-position:center bottom; filter:drop-shadow(0 24px 28px rgba(8,5,18,.36)); transition:transform .6s var(--ease-out),filter .6s ease; }
.hero-character.nene { left:0; width:54%; height:100%; object-fit:cover; object-position:50% 38%; filter:saturate(.84) contrast(.96); transform:translateX(-1%); clip-path:polygon(0 0,100% 0,86% 100%,0 100%); }
.hero-character.natsume { right:0; width:54%; height:100%; object-fit:cover; object-position:50% 35%; filter:saturate(.84) contrast(.96); transform:translateX(1%); clip-path:polygon(14% 0,100% 0,100% 100%,0 100%); }
.hero-orbit:hover .hero-character.nene { transform:translateX(1%); }
.hero-orbit:hover .hero-character.natsume { transform:translateX(-1%); }
.orbit-label { position:absolute; z-index:var(--z-raised); left:var(--s-5); right:var(--s-5); bottom:var(--s-5); padding:var(--s-3) var(--s-4); border:1px solid var(--on-art-line); border-radius:var(--r-xl); background:var(--art-scrim-soft); backdrop-filter:blur(16px); }
.orbit-label strong { display:block; font-size:var(--fs-body-sm); letter-spacing:.08em; color:var(--on-art-primary); }
.orbit-label span { display:block; margin-top:3px; color:var(--on-art-secondary); font-size:var(--fs-label-sm); }
.hero-strip { grid-column:1 / -1; grid-row:2; position:relative; background:linear-gradient(135deg,var(--accent-soft),transparent 65%),var(--bg-surface); border:1px solid var(--border-soft); border-radius:var(--r-xl); padding:var(--s-4) var(--s-5); overflow:hidden; }
.strip-label { display:flex; align-items:center; gap:var(--s-2); font-size:var(--fs-label-xs); font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-muted); margin-bottom:var(--s-3); }
.strip-label .dot { width:6px; height:6px; border-radius:50%; background:var(--accent); box-shadow:var(--glow-sm); }
.strip-scroll { display:flex; gap:var(--s-3); overflow-x:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; padding-bottom:var(--s-2); }
.strip-scroll::-webkit-scrollbar { height:4px; }
.strip-scroll::-webkit-scrollbar-thumb { background:var(--border-soft); border-radius:var(--r-pill); }
.continue-hint { min-height:20px; margin-top:var(--s-2); color:var(--text-muted); font-size:var(--fs-label-sm); }
.continue-hint strong { color:var(--accent); }

/* ---------- Sections ---------- */
.home-section { padding:var(--s-6) 0; border-top:1px solid var(--border-soft); }
.home-section-quiet { padding:var(--s-5) 0; }
.home-section-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:var(--s-4); gap:var(--s-4); }
.home-section-head h2 { font-size:var(--fs-title-sm); margin-bottom:var(--s-1); }
.home-section-head .hint { font-size:var(--fs-body-sm); color:var(--text-muted); margin:0; }
.home-section-head .link { font-size:var(--fs-body-sm); flex-shrink:0; }
.eyebrow .num { color:var(--text-muted); font-weight:600; }

/* ---------- Tools ---------- */
.tools-grid { display:grid; grid-template-columns:1fr; gap:var(--s-3); }
@media (min-width:768px) { .tools-grid { grid-template-columns:repeat(2,1fr); } }
@media (min-width:1200px) { .tools-grid { grid-template-columns:repeat(4,1fr); } }
.tool-card { display:flex; flex-direction:column; gap:var(--s-2); background:var(--bg-surface); border:1px solid var(--border-soft); border-radius:var(--r-lg); padding:var(--s-5); text-decoration:none; color:var(--text-primary); transition:border-color var(--t-fast),transform var(--t-fast); }
.tool-card:hover { border-color:var(--accent); transform:translateY(-2px); }
.tool-card .ic { font-size:var(--fs-title-sm); }
.tool-card .t { font-weight:700; font-size:var(--fs-body-lg); }
.tool-card .d { font-size:var(--fs-label); color:var(--text-muted); line-height:1.5; margin:0; flex:1; }
.tool-card .go { font-size:var(--fs-label-sm); color:var(--accent); margin-top:var(--s-2); }

/* ---------- Recent ---------- */
.recent-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:var(--s-4); }
.recent-card { background:var(--bg-surface); border:1px solid var(--border-soft); border-radius:var(--r-lg); overflow:hidden; cursor:pointer; transition:border-color var(--t-fast),transform var(--t-fast); text-decoration:none; color:var(--text-primary); }
.recent-card:hover { border-color:var(--accent); transform:translateY(-2px); }
.recent-cover { aspect-ratio:4/3; display:flex; align-items:center; justify-content:center; background:var(--bg-deep); font-size:var(--fs-glyph); overflow:hidden; }
.recent-cover img { width:100%; height:100%; object-fit:cover; }
.recent-cover .placeholder { color:var(--text-muted); }
.recent-body { padding:var(--s-3); }
.recent-title { font-weight:700; font-size:var(--fs-body-sm); margin-bottom:2px; }
.recent-meta { font-size:var(--fs-label-xs); color:var(--text-muted); }
.recent-scenes-row { display:flex; gap:var(--s-3); overflow-x:auto; padding:4px 2px var(--s-3); scroll-snap-type:x proximity; }
.recent-scenes-row > * { flex:0 0 min(300px,82vw); scroll-snap-align:start; }
@media (max-width:600px) { .recent-grid { grid-template-columns:1fr 1fr; } }
.recent-grid .empty-state { grid-column:1 / -1; margin-top:0; }

/* ---------- Responsive ---------- */
@media (max-width:768px) {
  .home-hero { grid-template-columns:1fr; gap:var(--s-5); }
  .hero-copy,.hero-strip,.hero-orbit { grid-column:1; grid-row:auto; }
  .hero-copy { order:1; }
  .hero-orbit { order:2; min-height:360px; }
  .hero-strip { order:3; }
}
@media (max-width:480px) {
  .hero-sub { font-size:var(--fs-body-lg); }
  .ctas { flex-direction:column; align-items:stretch; }
}
@media (prefers-reduced-motion:reduce) { .tool-card,.recent-card { transition:none; } }
</style>
