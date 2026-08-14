<template>
  <article class="page character-page" style="--page-max:1100px">
    <ArchivePageHero
      chapter="03"
      section="Identity file"
      :shape="current?.id === 'natsume' ? 'lantern' : 'moon'"
      :label="`${current?.name || '角色'}的身份档案粒子标记`"
      caption="PERSONA 03 / 08"
      compact
    >
      <div class="page-kicker">Character routes</div>
      <h1 class="title">角色档案</h1>
      <p class="subtitle">视觉特征、性格轨迹与专属模型——记录她们在工坊中的完整灵动设定。</p>
      <template #meta>
        <span class="archive-status">LOCAL PROFILE</span>
        <span class="archive-status">{{ characters.length || '—' }} SUBJECTS</span>
      </template>
    </ArchivePageHero>

    <ArchiveStatePanel
      v-if="loading"
      kind="loading"
      title="正在读取角色档案"
      message="身份资料、绑定模型与视觉特征正在从本机载入。"
    />
    <ArchiveStatePanel
      v-else-if="loadError"
      kind="error"
      title="角色档案读取失败"
      message="本地角色资料暂时读不到，请稍后重试。"
    >
      <button class="btn btn-primary" type="button" @click="loadProfiles">重新读取</button>
    </ArchiveStatePanel>
    <ArchiveStatePanel
      v-else-if="!characters.length"
      kind="empty"
      title="角色档案目前为空"
      message="本地角色资料已读取，但还没有可浏览的角色记录。"
    />
    <template v-else>
      <!-- tablist 模式补全：aria-controls + roving tabindex + 方向键。
           原先只有 role/aria-selected，读屏会承诺方向键切换但按了没反应。 -->
      <div class="character-tabs" role="tablist" aria-label="选择角色" data-reveal @keydown="tabs.onKeydown">
        <button v-for="c in characters" :key="c.id" class="character-tab"
          :class="{ active: current?.id === c.id }" type="button" role="tab"
          :id="tabs.tabId(c.id)"
          :aria-controls="tabs.panelId(c.id)"
          :aria-selected="current?.id === c.id"
          :tabindex="tabs.tabIndex(c.id)"
          @click="selectCharacter(c.id)"><ArchiveIcon :name="c.id === 'natsume' ? 'natsume' : 'nene'" /> {{ c.name }}</button>
      </div>

      <section v-if="current" class="character-hero card-direct card-level-3" data-reveal data-reveal-delay="1"
        role="tabpanel"
        :id="tabs.panelId(current.id)"
        :aria-labelledby="tabs.tabId(current.id)"
        tabindex="0">
        <div class="portrait" :class="{ natsume: current.id === 'natsume' }">
          <img v-if="current.portrait?.image" class="portrait-image"
            :src="current.portrait.image" :alt="current.portrait.alt || current.name"
            loading="eager" decoding="async" />
          <span class="portrait-badge"><ArchiveIcon :name="current.id === 'natsume' ? 'natsume' : 'nene'" /> 官方角色立绘</span>
          <span class="portrait-source">{{ current.source }}</span>
        </div>
        <div>
          <h2 class="character-name">{{ current.name }}</h2>
          <div v-if="hasIdentity" class="identity-row">
            <span v-if="current.identity?.role" class="item role">{{ current.identity.role }}</span>
            <span v-if="current.identity?.age" class="item">{{ current.identity.age }}</span>
            <span v-if="current.identity?.occupation" class="item">{{ current.identity.occupation }}</span>
          </div>
          <div v-if="current.alias?.length" class="character-alias">{{ current.alias.join(' / ') }}</div>
          <div v-if="current.voice" class="voice-block">
            <span class="voice-label">语气示例</span>{{ current.voice }}
          </div>
          <div class="tags-grid">
            <span v-for="(t,i) in current.tags" :key="t" class="tag-chip" :class="tagClass(i)">{{ t }}</span>
          </div>
          <div class="character-actions" aria-label="角色快捷操作">
            <RouterLink v-if="!isPopular" class="btn btn-primary" :to="`/chat?character=${encodeURIComponent(current.id)}`">进入她的房间</RouterLink>
            <RouterLink class="btn btn-primary" :to="isPopular
              ? `/prompt-builder?popular=${encodeURIComponent(current.id)}`
              : `/prompt-builder?char=${encodeURIComponent(current.id)}`">以她开始绘制</RouterLink>
            <RouterLink class="btn btn-ghost" :to="isPopular
              ? `/prompt-builder?popular=${encodeURIComponent(current.id)}`
              : `/scene-explorer?character=${encodeURIComponent(current.id)}`">{{ isPopular ? '看原型场景' : '看核心场景' }}</RouterLink>
          </div>
          <!-- 简介被 CSS 截断（max-height），展开是真的在露出内容，
           所以必须是可聚焦控件并汇报 aria-expanded；原先只有 @click -->
      <button
        v-if="current.bg_story"
        type="button"
        class="bg-story"
        :class="{ expanded: bgExpanded }"
        :aria-expanded="bgExpanded"
        @click="bgExpanded=!bgExpanded"
      >{{ current.bg_story }}</button>
          <div class="detail-grid">
            <section class="detail-section"><div class="lab">性格标签</div><div class="chips"><span v-for="p in current.personality" :key="p" class="chip trait">{{ p }}</span></div></section>
            <section class="detail-section"><div class="lab">喜欢的事</div><div class="chips"><span v-for="l in current.likes" :key="l" class="chip">{{ l }}</span></div></section>
            <section v-if="current.lora" class="detail-section wide">
              <div class="lab">绑定 LoRA</div>
              <div class="char-lora">触发词：<code>{{ (current.lora.trigger_words||[]).join(', ') }}</code></div>
            </section>
          </div>
        </div>
      </section>

      <section v-if="recommendations.length" class="recommend-section" data-reveal data-reveal-delay="2">
        <div class="recommend-head">
          <div>
            <div class="page-kicker">Persona core</div>
            <h2 class="recommend-title">人设核心场景</h2>
            <p>先从最像她的瞬间开始；其他换装、AU 与成人向变体仍可在完整场景库中找到。</p>
          </div>
          <a v-if="officialProfileUrl" class="official-link" :href="officialProfileUrl" target="_blank" rel="noreferrer">查看官方人设依据 ↗</a>
        </div>
        <div class="recommend-grid">
          <RouterLink v-for="s in recommendations" :key="s.id" class="card-direct"
            :to="isPopular && current
              ? `/prompt-builder?popular=${encodeURIComponent(current.id)}`
              : '/prompt-builder?scene='+encodeURIComponent(s.id)">
            <div class="cg-title">{{ s.title }}</div>
            <div v-if="recommendationReason(s.id)" class="cg-reason">{{ recommendationReason(s.id) }}</div>
            <div class="cg-story">{{ s.story }}</div>
          </RouterLink>
        </div>
      </section>
    </template>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSceneStore } from '@/stores/sceneStore'
import { useRovingTabs } from '@/composables/useRovingTabs'
import ArchivePageHero from '@/components/visual/ArchivePageHero.vue'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import {
  parseCharacterProfiles,
  parseCharacterScenes,
  type CharacterProfile,
  type CharacterScene,
} from '@/utils/characterProfiles'

const sceneStore = useSceneStore()
const route = useRoute()
const characters = ref<CharacterProfile[]>([])
const scenes = ref<CharacterScene[]>([])
const loading = ref(true)
const current = ref<CharacterProfile | null>(null)
const bgExpanded = ref(false)
useScrollReveal()

// 角色空间只展示 heroine（宁宁/夏目）；type=popular 的热门出图角色档案不进入切换列表。
const characterIds = computed<string[]>(() =>
  characters.value.filter(c => String(c.type ?? 'heroine') !== 'popular').map(c => String(c.id)),
)
function selectCharacter(id: string) {
  const found = characters.value.find(c => String(c.id) === id)
  if (found) { current.value = found; bgExpanded.value = false }
}
function tagClass(index: unknown) { return 'm' + (Number(index) % 6) }
const tabs = useRovingTabs(
  characterIds,
  () => String(current.value?.id ?? ''),
  selectCharacter,
  { prefix: 'character' },
)

const hasIdentity = computed(() => {
  const id = current.value?.identity || {}
  return id.role || id.age || id.occupation || id.faction
})
const isPopular = computed(() => current.value?.type === 'popular')
const recommendations = computed(() => {
  if (!current.value) return []
  if (current.value.type === 'popular') {
    // 热门角色：人设核心场景 = 该角色的原型场景（scene-blueprints 按 characterId）
    return sceneStore.sceneBlueprints
      .filter(bp => bp.characterId === current.value?.id)
      .slice(0, 6)
      .map(bp => ({
        id: bp.id,
        title: bp.title,
        story: bp.description,
        char: current.value?.id ?? '',
      }))
  }
  const core = sceneStore.curation.personaCoreSceneIds
  const ids = Array.isArray(core) && core.length ? core : current.value.lora?.recommended_scene
  if (!Array.isArray(ids)) return []
  return ids
    .map((id: string) => scenes.value.find(s => s.id === id))
    .filter((scene): scene is CharacterScene =>
      Boolean(scene && [current.value?.id, 'triad', 'both'].includes(scene.char)))
    .slice(0, 6)
})
const officialProfileUrl = computed(() => current.value?.id === 'nene'
  ? 'https://www.yuzu-soft.com/products/sothewitch/character.html'
  : current.value?.id === 'natsume'
    ? 'https://www.yuzu-soft.com/products/stella/character.html'
    : '')
function recommendationReason(id: string) {
  return sceneStore.curation.personaCoreReasons?.[id] || ''
}

const loadError = ref('')

async function loadProfiles() {
  loading.value = true
  loadError.value = ''
  try {
    await sceneStore.load()
    characters.value = parseCharacterProfiles(sceneStore.characters)
    scenes.value = parseCharacterScenes(sceneStore.scenes)
    const requested = typeof route.query.character === 'string' ? route.query.character : ''
    current.value = characters.value.find(c => c.id === requested) || characters.value[0] || null
  } catch (e) {
    console.warn('character data load failed', e)
    loadError.value = String(e instanceof Error ? e.message : e)
  }
  loading.value = false
}

onMounted(() => { void loadProfiles() })
</script>

<style scoped>
.archive-status { padding:4px 9px; border:1px solid var(--border-soft); color:var(--text-muted); font:700 var(--fs-mono-xs) var(--font-mono); letter-spacing:.1em; }
.character-tabs { position:relative; display:flex; gap:var(--s-2); margin-bottom:var(--s-5); padding-left:var(--s-4); }
.character-tabs::before { content:""; position:absolute; left:0; top:0; bottom:0; width:2px; background:linear-gradient(180deg,var(--archive-blue),var(--accent),transparent); }
.character-tab { padding:var(--s-2) var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-pill); background:var(--bg-surface); color:var(--text-secondary); cursor:pointer; font:600 var(--fs-body-sm) var(--font-sans); transition:border-color var(--t-fast),color var(--t-fast),background var(--t-fast),transform var(--t-fast) var(--ease-out); }
.character-tab.active,.character-tab:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-soft); }
.character-hero { position:relative; overflow:hidden; display:grid; grid-template-columns:320px 1fr; gap:var(--s-6); padding:var(--s-6); }
.character-hero::before { content:""; position:absolute; top:-1px; left:var(--s-6); width:42px; height:1px; background:var(--archive-blue); opacity:.86; }
/* 立绘按"画框里的展品"处理：底光 + 顶部渐隐 + 轻微入场位移，
   与作品册的画框语言保持一致 */
.portrait {
  position:relative; min-height:520px; border-radius:var(--r-stage);
  overflow:hidden; isolation:isolate;
  border:1px solid var(--on-art-line);
  background:
    radial-gradient(circle at 50% 22%, color-mix(in srgb,var(--nene-violet) 22%,transparent), transparent 58%),
    var(--stage-violet);
  box-shadow:inset 0 1px 0 var(--on-art-line), var(--shadow-lg);
}
.portrait.natsume {
  background:
    radial-gradient(circle at 50% 22%, color-mix(in srgb,var(--natsume-amber) 20%,transparent), transparent 58%),
    var(--stage-amber);
}
/* 脚下地台光：让人物"站"在画面里而不是漂着 */
.portrait::before {
  content:''; position:absolute; z-index:var(--z-below); inset:auto 14% 0; height:34%;
  border-radius:50% 50% 0 0; filter:blur(18px);
  background:radial-gradient(ellipse at center bottom, color-mix(in srgb,var(--accent) 26%,transparent), transparent 68%);
}
.portrait-image {
  position:absolute; z-index:var(--z-base); bottom:0; left:50%;
  transform:translateX(-50%); max-height:100%; object-fit:contain;
  filter:drop-shadow(0 22px 34px rgba(8,5,18,.42));
  animation:portraitRise .55s var(--ease-out) both;
}
@keyframes portraitRise {
  from { opacity:0; transform:translateX(-50%) translateY(12px); }
  to   { opacity:1; transform:translateX(-50%) translateY(0); }
}
@media (prefers-reduced-motion:reduce) { .portrait-image { animation:none; } }
.portrait-badge,.portrait-source {
  position:absolute; z-index:var(--z-raised);
  font-size:var(--fs-mono-xs); color:var(--on-art-secondary);
}
.portrait-badge { top:var(--s-3); left:var(--s-3); }
.portrait-source { bottom:var(--s-3); right:var(--s-3); }
.character-name { font-size:clamp(1.6rem,3vw,2.4rem); font-weight:800; margin-bottom:var(--s-2); }
.identity-row { display:flex; flex-wrap:wrap; gap:var(--s-2); margin-bottom:var(--s-3); }
.identity-row .item { padding:3px var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-pill); font-size:var(--fs-label-sm); color:var(--text-secondary); }
.identity-row .item.role { color:var(--accent); border-color:var(--accent); background:var(--accent-soft); }
.character-alias { color:var(--text-muted); font-size:var(--fs-label-sm); margin-bottom:var(--s-3); }
.voice-block { margin:var(--s-3) 0; padding:var(--s-2) var(--s-3); border-left:3px solid var(--accent); background:var(--accent-soft); color:var(--text-secondary); font-size:var(--fs-body); font-style:italic; }
.voice-label { display:block; margin-bottom:2px; color:var(--accent); font-size:var(--fs-mono-xs); font-style:normal; letter-spacing:.08em; text-transform:uppercase; }
.tags-grid { display:flex; flex-wrap:wrap; gap:var(--s-2); margin-bottom:var(--s-3); }
.character-actions { display:flex; flex-wrap:wrap; gap:var(--s-2); margin:var(--s-4) 0; }
.character-actions .btn { justify-content:center; }
/* 视觉特征标签：原来直接用 mood 原色做实心底（那是给色块调的高饱和值），
   六个彩色胶囊在紫黑档案页里像贴纸。改成同色系描边 + 极淡底，
   保留可区分度但回到画册气质。 */
.tag-chip {
  padding:var(--s-1) var(--s-3); border-radius:var(--r-pill);
  font-size:var(--fs-label-sm); font-weight:600;
  color:var(--chip-tone, var(--text-secondary));
  background:color-mix(in srgb, var(--chip-tone, var(--text-muted)) 12%, transparent);
  border:1px solid color-mix(in srgb, var(--chip-tone, var(--text-muted)) 30%, transparent);
}
.tag-chip.m0 { --chip-tone:var(--mood-joy-text); }
.tag-chip.m1 { --chip-tone:var(--mood-love-text); }
.tag-chip.m2 { --chip-tone:var(--mood-calm-text); }
.tag-chip.m3 { --chip-tone:var(--mood-sad-text); }
.tag-chip.m4 { --chip-tone:var(--mood-tension-text); }
.tag-chip.m5 { --chip-tone:var(--mood-warmth-text); }
/* 现在是 <button>：重置默认样式，保留原来的截断+展开观感 */
.bg-story { display:block; width:100%; text-align:left; border:none; background:none; font-family:inherit; position:relative; max-height:80px; overflow:hidden; color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.7; cursor:pointer; transition:max-height var(--t-base); }
.bg-story.expanded { max-height:500px; }
.bg-story::after { content:'展开'; position:absolute; right:0; bottom:0; padding-left:var(--s-6); background:linear-gradient(90deg,transparent,var(--bg-surface)); color:var(--accent); font-size:var(--fs-label-xs); }
.bg-story.expanded::after { content:none; }
.detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--s-3); }
.detail-section { padding:var(--s-3); border-radius:var(--r-md); background:var(--bg-deep); }
.detail-section.wide { grid-column:1/-1; }
.lab { margin-bottom:var(--s-2); color:var(--text-muted); font-size:var(--fs-mono-sm); font-weight:700; letter-spacing:.07em; text-transform:uppercase; }
.chips { display:flex; flex-wrap:wrap; gap:var(--s-2); }
.chips .chip { padding:var(--s-1) var(--s-3); font-size:var(--fs-label-sm); cursor:default; }
.chips .chip.trait { border-color:var(--border-soft); background:var(--bg-surface); color:var(--text-primary); }
.char-lora { color:var(--text-secondary); font-size:var(--fs-body-sm); }
.char-lora code { color:var(--accent); font-family:var(--font-mono); }
.recommend-section { position:relative; margin-top:var(--s-7); padding-top:var(--s-5); border-top:1px solid var(--border-soft); }
.recommend-section::before { content:"02 / PERSONA CORE"; position:absolute; top:-.55em; left:0; padding-right:var(--s-2); background:var(--bg-base); color:var(--archive-blue); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.1em; }
.recommend-head { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--s-4); margin-bottom:var(--s-3); }
.recommend-head p { max-width:680px; margin:var(--s-1) 0 0; color:var(--text-muted); font-size:var(--fs-body-sm); }
.recommend-title { margin:0 0 var(--s-3); font-size:var(--fs-title-sm); }
.recommend-head .recommend-title { margin-bottom:0; }
.official-link { flex:0 0 auto; color:var(--accent); font-size:var(--fs-label-sm); text-decoration:none; }
.official-link:hover { text-decoration:underline; }
.recommend-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:var(--s-3); }
.cg-title { margin-bottom:var(--s-1); font-size:var(--fs-title-xs); font-weight:800; }
.cg-reason { margin-bottom:var(--s-2); color:var(--accent); font-size:var(--fs-label-sm); line-height:1.55; }
.cg-story { color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.65; }
@media(max-width:700px){.character-hero{grid-template-columns:1fr}.portrait{min-height:380px}.detail-grid{grid-template-columns:1fr}.recommend-head{align-items:flex-start;flex-direction:column}.character-actions .btn{flex:1 1 100%}}
</style>
