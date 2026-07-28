<template>
  <article class="page" style="--page-max:1100px">
    <div class="page-kicker">Character routes</div>
    <h1 class="title">角色档案</h1>
    <p class="subtitle">视觉特征、性格与绑定模型——这里是角色在这台机器上的完整档案。</p>

    <div v-if="loading" class="empty-state"><div class="empty-state-icon">⏳</div><p>加载中…</p></div>
    <template v-else>
      <!-- tablist 模式补全：aria-controls + roving tabindex + 方向键。
           原先只有 role/aria-selected，读屏会承诺方向键切换但按了没反应。 -->
      <div class="character-tabs" role="tablist" aria-label="选择角色" @keydown="tabs.onKeydown">
        <button v-for="c in characters" :key="c.id" class="character-tab"
          :class="{ active: current?.id === c.id }" type="button" role="tab"
          :id="tabs.tabId(c.id)"
          :aria-controls="tabs.panelId(c.id)"
          :aria-selected="current?.id === c.id"
          :tabindex="tabs.tabIndex(c.id)"
          @click="selectCharacter(c.id)">{{ c.icon }} {{ c.name }}</button>
      </div>

      <section v-if="current" class="character-hero card-direct card-level-3"
        role="tabpanel"
        :id="tabs.panelId(current.id)"
        :aria-labelledby="tabs.tabId(current.id)"
        tabindex="0">
        <div class="portrait" :class="{ natsume: current.id === 'natsume' }">
          <img v-if="current.portrait?.image" class="portrait-image"
            :src="current.portrait.image" :alt="current.portrait.alt || current.name"
            loading="eager" decoding="async" />
          <span class="portrait-badge">{{ current.icon }} 官方角色立绘</span>
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

      <section v-if="recommendations.length" class="recommend-section">
        <h2 class="recommend-title">推荐场景</h2>
        <div class="recommend-grid">
          <RouterLink v-for="s in recommendations" :key="s.id" class="card-direct"
            :to="'/prompt-builder?scene='+encodeURIComponent(s.id)">
            <div class="cg-title">{{ s.title }}</div>
            <div class="cg-story">{{ s.story }}</div>
          </RouterLink>
        </div>
      </section>
    </template>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSceneStore } from '@/stores/sceneStore'
import { useRovingTabs } from '@/composables/useRovingTabs'

const sceneStore = useSceneStore()
const characters = ref<any[]>([])
const scenes = ref<any[]>([])
const loading = ref(true)
const current = ref<any>(null)
const bgExpanded = ref(false)

const characterIds = computed<string[]>(() => characters.value.map(c => String(c.id)))
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
const recommendations = computed(() => {
  if (!current.value?.lora?.recommended_scene) return []
  return current.value.lora.recommended_scene
    .map((id: string) => scenes.value.find(s => s.id === id))
    .filter(Boolean)
})

onMounted(async () => {
  try {
    await sceneStore.load()
    characters.value = sceneStore.characters as any[]
    scenes.value = sceneStore.scenes as any[]
    current.value = characters.value[0] || null
  } catch (e) { console.warn('character data load failed', e) }
  loading.value = false
})
</script>

<style scoped>
.character-tabs { display:flex; gap:var(--s-2); margin-bottom:var(--s-5); }
.character-tab { padding:var(--s-2) var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-pill); background:var(--bg-surface); color:var(--text-secondary); cursor:pointer; font:600 var(--fs-body-sm) var(--font-sans); transition:all var(--t-fast); }
.character-tab.active,.character-tab:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-soft); }
.character-hero { display:grid; grid-template-columns:320px 1fr; gap:var(--s-6); padding:var(--s-6); }
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
.recommend-section { margin-top:var(--s-7); }
.recommend-title { margin:0 0 var(--s-3); font-size:var(--fs-title-sm); }
.recommend-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:var(--s-3); }
.cg-title { margin-bottom:var(--s-1); font-size:var(--fs-title-xs); font-weight:800; }
.cg-story { color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.65; }
@media(max-width:700px){.character-hero{grid-template-columns:1fr}.portrait{min-height:380px}.detail-grid{grid-template-columns:1fr}}
</style>
