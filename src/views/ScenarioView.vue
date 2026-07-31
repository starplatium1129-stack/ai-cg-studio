<template>
  <article class="page" style="--page-max:1100px">
    <ArchivePageHero
      chapter="08"
      section="Narrative sequence"
      shape="book"
      label="多幕剧本的书页粒子标记"
      caption="SCENARIO 08 / 08"
      compact
    >
      <div class="page-kicker">Scenario mode</div>
      <h1 class="title">剧本模式</h1>
      <p class="subtitle">把一个故事拆成多帧 CG；每一幕都包含完整的场景结构、美术自检与分层负面提示词。</p>
    </ArchivePageHero>

    <div class="info-callout" data-reveal>
      <strong>🎯 设计理念</strong> | 每一幕都是一个完整场景。切换右上角角色后，全部分幕的提示词会在宁宁与夏目之间同步转换。
      当前灵感场景共有 <strong>{{ sceneCount }}</strong> 个。
    </div>

    <!-- 剧本列表 -->
    <div v-if="!activeScenario" class="scenario-list" data-reveal data-reveal-delay="1">
      <!-- 必须是 button:这是进入剧本查看器的唯一入口,
           原先是 <div @click>,没有 role/tabindex/keydown → 键盘完全进不去 -->
      <button
        v-for="s in SCENARIOS" :key="s.id"
        type="button"
        class="scenario-card card-create card-level-2"
        @click="openScenario(s)"
      >
        <span class="scenario-icon" aria-hidden="true">{{ s.icon }}</span>
        <span class="scenario-name">{{ s.name }}</span>
        <span class="scenario-en">{{ s.en }}</span>
        <span class="scenario-desc">{{ s.desc }}</span>
        <span class="scenario-count">{{ s.acts.length }} 幕 · 点击查看</span>
      </button>
    </div>

    <!-- 分幕查看器 -->
    <div v-else class="viewer show">
      <div class="viewer-header-row">
        <div>
          <h2 class="viewer-h2">{{ activeScenario.icon }} {{ activeScenario.name }}</h2>
          <div class="viewer-en">{{ activeScenario.en }}</div>
        </div>
        <div class="char-toggle">
          <button
            v-for="c in CHARACTER_OPTIONS" :key="c"
            class="char-btn" :class="{ active: currentChar === c }"
            type="button" @click="currentChar = c"
          >{{ c === 'nene' ? '🌸 宁宁' : '🍂 夏目' }}</button>
        </div>
      </div>
      <p class="viewer-desc">{{ activeScenario.desc }}</p>

      <div class="acts">
        <div v-for="a in activeScenario.acts" :key="a.n" class="act">
          <div class="act-head">
            <span class="act-num">{{ a.n }}</span>
            <h3 class="act-title">{{ a.title }}</h3>
          </div>
          <div class="act-en">{{ a.en }}</div>
          <div class="act-desc">{{ a.desc }}</div>

          <div class="scene-grid">
            <div class="scene-meta"><div class="label">情绪</div><div class="value">{{ a.emotion }}</div></div>
            <div class="scene-meta"><div class="label">角色</div><div class="value">{{ currentChar }}</div></div>
            <div class="scene-meta"><div class="label">Resolution</div><div class="value" :title="resInfo(a.res).dim">{{ a.res }}</div></div>
            <div class="scene-meta"><div class="label">LoRA</div><div class="value">{{ a.lora }}</div></div>
            <div class="scene-meta"><div class="label">锁定参数 <span class="lock-badge">🔒</span></div><div class="value value-dense">{{ LOCK_PARAMS }}</div></div>
          </div>

          <div class="res-rec">
            <span class="res-icon">📐</span>
            <strong>推荐 {{ a.res }} ({{ resInfo(a.res).dim }} · {{ resInfo(a.res).vram }})</strong>
            → {{ resInfo(a.res).reason }}
          </div>

          <div v-if="violations(a).length" class="art-warn show">
            ⚠️ 本幕有 {{ violations(a).length }} 个违反美术规范的标签: {{ violations(a).join(', ') }}
          </div>

          <div class="prompt-label">Positive (10 模块)</div>
          <div class="prompt-code" v-html="renderModules(a)"></div>

          <div class="neg-section">
            <div class="prompt-label prompt-label-neg">Negative</div>
            <div class="neg-layer"><div class="neg-layer-label">基础层（永远带）</div><div class="neg-output">{{ BASE_NEG }}</div></div>
            <div class="neg-layer"><div class="neg-layer-label">场景特定层</div><div class="neg-output">{{ a.neg }}</div></div>
          </div>

          <div class="act-actions">
            <button class="btn btn-primary" type="button" @click="copyPrompt(a)">📋 复制本幕 Prompt</button>
            <RouterLink :to="'/prompt-builder?scenario=' + activeScenario.id" class="btn btn-ghost">→ 去开始绘制</RouterLink>
          </div>
        </div>
      </div>
      <button class="btn btn-ghost" type="button" @click="activeScenario = null">← 返回剧本列表</button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSceneStore } from '@/stores/sceneStore'
import { useToast } from '@/composables/useToast'
import ArchivePageHero from '@/components/visual/ArchivePageHero.vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { BANNED_TAGS } from '@/utils/promptPolicy'

const sceneStore = useSceneStore()
useScrollReveal()

type ScenarioCharacter = 'nene' | 'natsume'
type ScenarioResolution = keyof typeof RES_MAP

interface ScenarioAct {
  n: string
  title: string
  en: string
  desc: string
  emotion: string
  res: ScenarioResolution
  lora: number
  neg: string
  prompt: string
}

interface Scenario {
  id: string
  icon: string
  name: string
  en: string
  desc: string
  acts: ScenarioAct[]
}

const LOCK_PARAMS = 'CFG 5 · DPM++ 2M SDE · Steps 28 · Hires 0.45'
const BASE_NEG = 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name'
const CHAR_TRAITS: Record<ScenarioCharacter,string> = {
  nene: 'white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, hair_ribbon',
  natsume: 'black_hair, long_hair, yellow_eyes, mole_under_eye, hairclip'
}
const CHAR_NAME: Record<ScenarioCharacter,string> = { nene: 'ayachi_nene', natsume: 'shiki_natsume' }
const LORA_ID: Record<ScenarioCharacter,string> = { nene: 'ayachi_nene_v18_wd14:0.85', natsume: 'shiki_natsume_v18_wd14:0.85' }
const RES_MAP = {
  'Square':    { dim:'1024×1024', vram:'~10GB', reason:'方形·头像/特写/通用' },
  'Half-body': { dim:'832×1216',  vram:'~10GB', reason:'竖版半身·肖像感·内心独白' },
  'Full CG':   { dim:'1216×832',  vram:'~10GB', reason:'横版全身·场景为主·故事感★★★' },
  'Wide CG':   { dim:'1344×768',  vram:'~12GB', reason:'超宽画幅·风景/电影感/留白' },
  'Tall':      { dim:'768×1344',  vram:'~12GB', reason:'竖版插画·人物主体/海报感' },
  'Close-up':  { dim:'832×1216',  vram:'~10GB', reason:'近景特写·表情/情绪/亲密感' },
  'Portrait':  { dim:'832×1216',  vram:'~10GB', reason:'半身肖像·人物聚焦·柔美感' },
  'Mobile':    { dim:'720×1280',  vram:'~8GB',  reason:'手机竖屏壁纸' }
} as const
const CHARACTER_OPTIONS = ['nene', 'natsume'] as const

const SCENARIOS: Scenario[] = [
  { id:'promise', icon:'🌸', name:'放学后的约定', en:'After-School Promise', desc:'放学以后，她一直在校门口等你。花瓣落在肩上，她没有说，只是笑了起来。',
    acts:[
      { n:'01', title:'空·教室', en:'Empty Classroom', desc:'夕阳从窗户照进来，教室里已经没有人了。', emotion:'期待', res:'Half-body', lora:0.75, neg:'night, snow, autumn leaves',
        prompt:'masterpiece, best quality, newest, very aesthetic, absurdres, highly detailed\n1girl, solo, {{char}}, {{traits}}\nschool uniform\nclassroom, window, afternoon, sunlight streaming, dust motes\ngentle smile, soft eyes, looking through window, expectant\nclose-up, upper body\ncentered composition, by window, soft focus\nwindow light, soft afternoon glow, warm, quiet atmosphere\nbeautiful detailed eyes, depth of field' },
      { n:'02', title:'走廊', en:'School Hallway', desc:'她抱着书，走过长长的走廊。脚步声回响。', emotion:'紧张', res:'Half-body', lora:0.75, neg:'night, darkness, sunny, bright sunlight, outdoor',
        prompt:'masterpiece, best quality, newest, very aesthetic, absurdres, highly detailed\n1girl, solo, {{char}}, {{traits}}\nschool uniform\nschool hallway, long corridor, tiled floor, windows on one side\nnervous, walking, looking ahead, gentle\nmedium shot, walking away, from behind\nleft composition, leading lines, perspective depth\nafternoon light, soft glow through windows, quiet\nbeautiful detailed eyes, depth of field, echo atmosphere' },
      { n:'03', title:'校门口', en:'School Gate', desc:'她站在校门口，背着书包，望着道路远方。', emotion:'期待', res:'Full CG', lora:0.75, neg:'night, snow, autumn leaves, indoor',
        prompt:'masterpiece, best quality, newest, very aesthetic, absurdres, highly detailed\n1girl, solo, {{char}}, {{traits}}\nschool uniform, backpack\nschool gate, road stretching, sakura trees, golden hour sky\nstanding, looking afar, expectant, gentle posture\nwide shot, full body, distant\nrule of thirds, by school gate, depth\ngolden hour, warm light, backlit, soft shadows\nhair blowing, petals floating, depth of field' },
      { n:'04', title:'回眸', en:'The Turn', desc:'她看见你，终于露出了笑容。樱花落在肩上。', emotion:'温柔', res:'Half-body', lora:0.75, neg:'night, darkness, snow, rain',
        prompt:'masterpiece, best quality, newest, very aesthetic, absurdres, highly detailed\n1girl, solo, {{char}}, {{traits}}\nschool uniform, pleated skirt\nschool gate, cherry blossoms in bloom, petals floating\ngentle smile, soft eyes, blush, looking at viewer\nmedium shot, looking back, over shoulder\nrule of thirds, by school gate, depth\ngolden hour, backlit, soft shadows, warm atmosphere\nbeautiful detailed eyes, depth of field' }
    ]
  },
  { id:'rainy', icon:'🌧', name:'雨天的共伞', en:'Sharing an Umbrella', desc:'突然下起雨。两个人挤在一把伞下。肩膀贴着肩膀。沉默比语言多。',
    acts:[
      { n:'01', title:'雨落', en:'Rain Falls', desc:'天空变暗。雨点打在柏油路上。她没有伞。', emotion:'失落', res:'Wide CG', lora:0.75, neg:'sunny, bright lighting, day, summer, cherry blossoms',
        prompt:'masterpiece, best quality, newest, very aesthetic, absurdres, highly detailed\n1girl, solo, {{char}}, {{traits}}\nschool uniform, no umbrella, wet\nrainy street, wet road, puddle reflections, grey sky\nsad, distant gaze, walking alone\nwide shot, full body, small in frame\nrule of thirds, leading lines, depth\novercast, cool tones, soft diffused light, rainy atmosphere\nbeautiful detailed eyes, depth of field, melancholic' },
      { n:'02', title:'递伞', en:'The Umbrella', desc:'你递过伞。她愣了一下，接过去，指尖微凉。', emotion:'羞涩', res:'Half-body', lora:0.75, neg:'sunny, bright lighting, day, summer, dramatic',
        prompt:'masterpiece, best quality, newest, very aesthetic, absurdres, highly detailed\n1girl, solo, {{char}}, {{traits}}\nschool uniform, holding umbrella, rain in background\ngentle surprise, soft expression, shy, slight blush, looking at viewer\nmedium shot, upper body, intimate\ncentered, foreground umbrella edge\novercast, cool color tones, warm interaction, soft\nbeautiful detailed eyes, depth of field' },
      { n:'03', title:'共伞', en:'Under One Umbrella', desc:'两个人挤在一把伞下。没有人说话。雨声很大。', emotion:'亲密', res:'Close-up', lora:0.75, neg:'sunny, bright lighting, day, summer, outdoor',
        prompt:'masterpiece, best quality, newest, very aesthetic, absurdres, highly detailed\n1girl, solo, {{char}}, {{traits}}\nunder umbrella, rain, close to viewer\nshy, looking away, slight blush, intimate\nclose-up, face and umbrella edge, intimate distance\ncentered, foreground framing\novercast, rainy atmosphere, soft lighting, cool tones\nbeautiful detailed eyes, beautiful detailed hair, depth of field' }
    ]
  },
  { id:'sakura', icon:'🌸', name:'樱花树下的初见', en:'Under the Sakura', desc:'春天的公园，樱花盛开。她站在树下等人，花瓣落在发梢。',
    acts:[
      { n:'01', title:'等待', en:'Waiting', desc:'她站在樱花树下，不时看一眼路的尽头。', emotion:'期待', res:'Full CG', lora:0.75, neg:'night, snow, autumn leaves, winter, rain',
        prompt:'masterpiece, best quality, newest, very aesthetic, absurdres, highly detailed\n1girl, solo, {{char}}, {{traits}}\nschool uniform, spring coat\npark, sakura tree in full bloom, petals floating, afternoon\nexpectant, looking at path, gentle, hopeful\nwide shot, full body, among sakura\nrule of thirds, layered foreground petals, depth\nsoft spring light, warm pink glow, petals in air, dreamlike\nhair blowing, beautiful detailed eyes, depth of field' },
      { n:'02', title:'落樱', en:'Falling Petals', desc:'一阵风来，花瓣如雪落下。她伸手去接。', emotion:'开心', res:'Half-body', lora:0.75, neg:'night, snow, autumn leaves, indoor',
        prompt:'masterpiece, best quality, newest, very aesthetic, absurdres, highly detailed\n1girl, solo, {{char}}, {{traits}}\nschool uniform, cherry blossoms falling\npark, sakura tree, petals in air, spring afternoon\nhappy, looking up, reaching for petals, playful\nmedium shot, upper body, near\ncentered, foreground petals framing\nsoft spring light, pink glow, petals, airy\nhair blowing, beautiful detailed eyes, depth of field' },
      { n:'03', title:'重逢', en:'Reunion', desc:'她终于看见你，笑了。花瓣停在发梢。', emotion:'幸福', res:'Half-body', lora:0.75, neg:'night, snow, rain, autumn leaves',
        prompt:'masterpiece, best quality, newest, very aesthetic, absurdres, highly detailed\n1girl, solo, {{char}}, {{traits}}\nschool uniform, sakura in hair\npark, sakura tree, petals on ground, spring\ngentle smile, eyes lighting up, blush, looking at viewer\nmedium shot, upper body, intimate\nrule of thirds, foreground sakura branches\nsoft spring light, warm glow, petals falling, romantic\nbeautiful detailed eyes, depth of field' }
    ]
  }
]

const activeScenario = ref<Scenario | null>(null)
const currentChar = ref<ScenarioCharacter>('nene')
const sceneCount = ref('--')

function esc(s: string) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function norm(t: string) { return t.split(',').map(s => s.trim().replace(/[\s-]+/g,'_')).join(', ') }
function resInfo(res: ScenarioResolution) { return RES_MAP[res] }
function violations(a: ScenarioAct) {
  const lower = a.prompt.toLowerCase()
  return BANNED_TAGS.filter(b => lower.includes(b.toLowerCase()))
}
function substitutePrompt(tpl: string, char: ScenarioCharacter) {
  return tpl.split('\n').map(l => {
    let line = l.replace(/\{\{char\}\}/g, CHAR_NAME[char]).replace(/\{\{traits\}\}/g, CHAR_TRAITS[char])
    if (char === 'nene' && /school uniform/i.test(line)) line = line.replace(/school uniform/i, 'nene_school_uniform, school uniform')
    return line
  }).join('\n')
}
function buildFullPrompt(a: ScenarioAct, char: ScenarioCharacter) {
  return norm(substitutePrompt(a.prompt, char)) + ',\n<lora:' + LORA_ID[char] + '>'
}

const MODULE_CLASSES = ['m-q','m-c','m-cl','m-s','m-e','m-sh','m-co','m-l','m-d','m-lora']
function renderModules(a: ScenarioAct) {
  const char = currentChar.value
  const modPrompt = substitutePrompt(a.prompt, char)
  const modules = modPrompt.split('\n')
  modules.push('<lora:' + LORA_ID[char] + '>')
  return modules.map((line, i) => {
    const cls = MODULE_CLASSES[i] || 'm-q'
    const parts = line.split(',').map(tk => {
      const t = tk.trim(); if (!t) return ''
      const low = t.toLowerCase()
      const bad = BANNED_TAGS.some(b => low === b.toLowerCase() || low.includes(b.toLowerCase()))
      return bad ? `<span class="violate">${esc(t)}</span>` : esc(t)
    }).join(', ')
    return `<span class="mod ${cls}">${parts}</span>`
  }).join('\n')
}

function copyPrompt(a: ScenarioAct) {
  const text = buildFullPrompt(a, currentChar.value)
  navigator.clipboard.writeText(text)
    .then(() => showToast('📋 已复制 (' + text.split(',').length + ' tokens)'))
    .catch(() => prompt('请手动复制', text))
}

function openScenario(s: Scenario) { activeScenario.value = s }

// 走全局 AppToast。原先手搓 DOM + 内联 cssText，硬编码了 z-index:9999
// （会盖住 --z-skip 的跳转链接）、border-radius、font-size 与 rgba 阴影。
const { show: showToast } = useToast()

onMounted(async () => {
  try {
    await sceneStore.load()
    sceneCount.value = String(sceneStore.count || '--')
  } catch (e) { console.warn('scene count load failed', e) }
})
</script>

<style scoped>
.info-callout { margin-bottom:var(--s-5); padding:var(--s-3) var(--s-4); border:1px solid var(--accent); border-radius:var(--r-md); background:var(--accent-soft); font-size:var(--fs-body-sm); }
.info-callout strong { color:var(--accent); }
.scenario-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:var(--s-4); }
/* 卡片现在是 <button>：重置浏览器默认样式，并保持原本的块级排版 */
.scenario-card { padding:var(--s-5); cursor:pointer; display:block; width:100%; text-align:left; font:inherit; color:inherit; }
.scenario-icon { display:block; font-size:var(--fs-glyph); margin-bottom:var(--s-2); }
.scenario-name { display:block; font-size:var(--fs-title-xs); font-weight:800; margin-bottom:2px; }
.scenario-en { display:block; color:var(--text-muted); font-size:var(--fs-mono-sm); margin-bottom:var(--s-2); }
.scenario-desc { display:block; color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.65; margin-bottom:var(--s-2); }
.scenario-count { display:block; color:var(--accent); font-size:var(--fs-label-sm); font-weight:700; }

.viewer { margin-top:var(--s-4); }
.viewer-header-row { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--s-4); margin-bottom:var(--s-3); }
.viewer-h2 { font-size:var(--fs-title-sm); font-weight:800; }
.viewer-en { color:var(--text-muted); font-size:var(--fs-label-sm); }
.viewer-desc { color:var(--text-secondary); font-size:var(--fs-body-sm); margin-bottom:var(--s-5); }
.char-toggle { display:flex; gap:var(--s-2); flex-shrink:0; }
.char-btn { padding:var(--s-2) var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-pill); background:var(--bg-surface); color:var(--text-secondary); cursor:pointer; font:600 var(--fs-body-sm) var(--font-sans); transition:border-color var(--t-fast),color var(--t-fast),background var(--t-fast),transform var(--t-fast) var(--ease-out); }
.char-btn.active { background:var(--accent); color:var(--text-inverse); border-color:var(--accent); }

.acts { display:grid; gap:var(--s-5); margin-bottom:var(--s-5); }
.act { padding:var(--s-5); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:var(--bg-surface); }
.act-head { display:flex; align-items:center; gap:var(--s-3); margin-bottom:4px; }
.act-num { padding:2px var(--s-2); border:1px solid var(--accent); border-radius:var(--r-pill); color:var(--accent); font:700 var(--fs-mono-sm) var(--font-mono); }
.act-title { font-size:var(--fs-title-xs); font-weight:800; }
.act-en { color:var(--text-muted); font-size:var(--fs-mono-sm); margin-bottom:var(--s-2); }
.act-desc { color:var(--text-secondary); font-size:var(--fs-body-sm); font-style:italic; margin-bottom:var(--s-3); }
.scene-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:var(--s-2); margin-bottom:var(--s-3); }
.scene-meta { padding:var(--s-2) var(--s-3); border-radius:var(--r-md); background:var(--bg-elevated); text-align:center; }
.scene-meta .label { color:var(--text-muted); font-size:var(--fs-mono-sm); letter-spacing:.05em; text-transform:uppercase; }
.scene-meta .value { margin-top:2px; color:var(--accent); font-size:var(--fs-body-sm); font-weight:600; }
.scene-meta .value-dense { font-size:var(--fs-label-xs); }
.lock-badge { display:inline-flex; align-items:center; gap:var(--s-1); padding:2px var(--s-2); border-radius:var(--r-pill); background:color-mix(in srgb,var(--success) 10%,transparent); color:var(--success-text); font-size:var(--fs-mono-sm); font-weight:600; }
.res-rec { display:flex; align-items:flex-start; gap:var(--s-2); flex-wrap:wrap; margin-bottom:var(--s-3); padding:var(--s-2) var(--s-3); border:1px solid var(--accent); border-radius:var(--r-md); background:var(--accent-soft); color:var(--text-primary); font-size:var(--fs-body-sm); }
.res-rec strong { color:var(--accent); }
.art-warn { display:none; align-items:center; gap:var(--s-2); margin-bottom:var(--s-3); padding:var(--s-2) var(--s-3); border:1px solid var(--warning); border-radius:var(--r-md); background:color-mix(in srgb,var(--warning) 12%,transparent); color:var(--warning-text); font-size:var(--fs-label); }
.art-warn.show { display:flex; }
.prompt-label { margin-bottom:var(--s-1); color:var(--accent); font-size:var(--fs-label-sm); font-weight:600; letter-spacing:.06em; text-transform:uppercase; }
.prompt-label-neg { color:var(--danger-text); }
.prompt-code { padding:var(--s-3); background:var(--bg-elevated); border-radius:var(--r-md); font:400 var(--fs-mono-sm)/1.8 var(--font-mono); white-space:pre-wrap; word-break:break-word; margin-bottom:var(--s-3); }
:deep(.mod) { display:block; border-left:3px solid var(--border-soft); padding-left:var(--s-2); margin-bottom:2px; }
:deep(.m-q) { border-color:var(--text-muted); } :deep(.m-c) { border-color:var(--accent); } :deep(.m-cl) { border-color:var(--nene-violet); }
:deep(.m-s) { border-color:var(--mood-calm); } :deep(.m-e) { border-color:var(--mood-love); } :deep(.m-sh) { border-color:var(--natsume-amber); }
:deep(.m-co) { border-color:var(--info); } :deep(.m-l) { border-color:var(--mood-joy); } :deep(.m-d) { border-color:var(--text-secondary); } :deep(.m-lora) { border-color:var(--success); }
:deep(.violate) { color:var(--danger-text); text-decoration:underline wavy; }
.neg-section { margin-top:var(--s-3); padding-top:var(--s-3); border-top:1px solid var(--border-soft); }
.neg-layer { margin-bottom:var(--s-2); }
.neg-layer-label { margin-bottom:2px; color:var(--text-muted); font-size:var(--fs-label-xs); font-weight:600; }
.neg-output { padding:var(--s-3); border:1px solid color-mix(in srgb,var(--danger) 20%,transparent); border-radius:var(--r-md); background:color-mix(in srgb,var(--danger) 4%,transparent); color:var(--danger-text); font:400 var(--fs-label-sm)/1.8 var(--font-mono); white-space:pre-wrap; word-break:break-word; }
.act-actions { display:flex; gap:var(--s-2); flex-wrap:wrap; margin-top:var(--s-3); }
@media(max-width:768px) { .viewer-header-row { flex-direction:column; align-items:flex-start; } }
</style>
