<template>
  <article class="page" style="--page-max:1400px">
    <header class="sm-head">
      <div>
        <div class="page-kicker">Scene manager</div>
        <h1 class="title">场景管理</h1>
        <div class="maintenance-state" :class="{ dirty: dirty }">
          <strong id="maintenanceTitle">{{ dirty ? '有尚未保存的修改' : '已同步' }}</strong>
          <span id="maintenanceHint">{{ maintenanceHint }}</span>
        </div>
      </div>
      <div class="sm-head-actions">
        <button class="btn btn-ghost" type="button" @click="exportJSON" :disabled="!scenes.length">⬇️ 导出 JSON</button>
        <button class="btn btn-primary" type="button" :disabled="!dirty || saving" @click="saveToProject">
          {{ saving ? '正在保存…' : '💾 保存到项目' }}
        </button>
      </div>
    </header>

    <div v-if="loadError" class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <p>{{ loadError }}</p>
      <p style="color:var(--text-muted);font-size:var(--fs-label-sm)">请确认通过 localhost 访问且文件存在</p>
    </div>

    <template v-else>
      <!-- Stats -->
      <div class="stats">
        <div class="stat-card" v-for="s in stats" :key="s.label">
          <div class="stat-value">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tab-row">
        <button v-for="t in TABS" :key="t.id" class="tab-btn" :class="{active: tab===t.id}" type="button" @click="tab=t.id">{{ t.label }}</button>
      </div>

      <!-- 场景表 -->
      <template v-if="tab==='scenes'">
        <div class="toolbar">
          <input v-model="search" class="search-input" type="search" placeholder="🔍 搜索 ID、标题、故事、标签…" />
          <select v-model="fCat" class="filter-select">
            <option value="">全部分类</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="fChar" class="filter-select">
            <option value="">全部角色</option>
            <option value="nene">宁宁</option>
            <option value="natsume">夏目</option>
            <option value="triad">双人</option>
          </select>
          <select v-model="fRating" class="filter-select">
            <option value="">全部分级</option>
            <option value="All">All</option>
            <option value="R15">R15</option>
            <option value="R18">R18</option>
          </select>
          <select v-model="sortBy" class="filter-select">
            <option value="id">ID</option>
            <option value="title">标题</option>
            <option value="category">分类</option>
            <option value="char">角色</option>
          </select>
          <button class="btn btn-ghost btn-sm" type="button" @click="openAddModal">＋ 新增场景</button>
          <span class="list-meta">{{ filtered.length }} / {{ scenes.length }} 条</span>
        </div>
        <div class="table-wrap">
          <table class="data-table-scenes">
            <thead>
              <tr>
                <th>ID</th><th>标题</th><th>分类</th><th>角色</th><th>分级</th><th>层级</th><th>故事</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="8" class="table-msg">⏳ 正在加载数据…</td></tr>
              <tr v-else-if="!filtered.length"><td colspan="8" class="table-msg">暂无匹配场景</td></tr>
              <template v-else>
                <tr v-for="s in paged" :key="s.id">
                  <td><code style="font-size:var(--fs-mono-xs)">{{ s.id }}</code></td>
                  <td>{{ s.title }}</td>
                  <td>{{ s.category }}</td>
                  <td>{{ charIcon(s.char) }}</td>
                  <td><span class="rating-badge" :class="'rating-' + s.rating">{{ s.rating || 'All' }}</span></td>
                  <td><span v-if="curationTier(s.id)!=='normal'" class="tier-badge" :class="'tier-' + curationTier(s.id)">{{ tierLabel(curationTier(s.id)) }}</span><span v-else class="muted">—</span></td>
                  <td><div class="story-preview">{{ s.story }}</div></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn btn-ghost btn-sm" type="button" @click="openEditModal(s.id)">编辑</button>
                      <button class="btn btn-ghost btn-sm" type="button" @click="duplicateScene(s.id)">复制</button>
                      <button class="btn btn-danger btn-sm" type="button" @click="deleteScene(s.id)">下架</button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div v-if="totalPages > 1" class="pagination">
          <button class="btn btn-ghost btn-sm" :disabled="page <= 1" @click="page--">← 上一页</button>
          <span style="color:var(--text-muted);font-size:var(--fs-label-sm)">{{ page }} / {{ totalPages }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="page >= totalPages" @click="page++">下一页 →</button>
        </div>
      </template>

      <!-- 标签库 -->
      <template v-if="tab==='tags'">
        <div class="toolbar">
          <input v-model="tagSearch" class="search-input" type="search" placeholder="🔍 搜索标签（英文/中文/分类）…" />
          <select v-model="tagCatFilter" class="filter-select">
            <option value="">全部分类</option>
            <option v-for="c in tagCats" :key="c" :value="c">{{ c }}</option>
          </select>
          <button class="btn btn-ghost btn-sm" type="button" @click="openAddTag">＋ 新增标签</button>
          <span class="list-meta">{{ filteredTags.length }} / {{ tags.length }} 个</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>分类</th><th>英文</th><th>中文</th><th>权重</th><th>使用</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-if="!filteredTags.length"><td colspan="7" class="table-msg">暂无匹配标签</td></tr>
              <tr v-for="t in pagedTags" :key="t.id">
                <td><code style="font-size:var(--fs-mono-xs)">{{ t.id }}</code></td>
                <td>{{ t.cat }}</td>
                <td><span class="tag-chip">{{ t.en }}</span></td>
                <td>{{ t.cn }}</td>
                <td>{{ t.weight }}</td>
                <td>{{ tagUsage[t.en] || 0 }}</td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn-ghost btn-sm" type="button" @click="openEditTag(t.id)">编辑</button>
                    <button class="btn btn-danger btn-sm" type="button" @click="deleteTag(t.id)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="tagTotalPages > 1" class="pagination">
          <button class="btn btn-ghost btn-sm" :disabled="tagPage <= 1" @click="tagPage--">← 上一页</button>
          <span style="color:var(--text-muted);font-size:var(--fs-label-sm)">{{ tagPage }} / {{ tagTotalPages }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="tagPage >= tagTotalPages" @click="tagPage++">下一页 →</button>
        </div>
      </template>

      <!-- 样张管理 -->
      <template v-if="tab==='images'">
        <div class="toolbar">
          <input v-model="imageSearch" class="search-input" type="search" placeholder="🔍 搜索场景 ID 或标题…" />
          <span class="list-meta">{{ filteredImageScenes.length }} 个场景</span>
        </div>
        <p class="note">点场景查看当前样张，可上传替换。图片会归一化为 JPEG（原图 ≤4096px，缩略图 560px），上限 15MB / 6000 万像素。</p>
        <div class="image-grid">
          <button
            v-for="s in pagedImageScenes" :key="s.id"
            class="sm-image-card" type="button"
            :class="{ active: selectedImageId === s.id }"
            @click="previewImage(s)"
          >
            <span class="sm-card-id">{{ s.id }}</span>
            <span class="sm-card-title">{{ s.title }}</span>
            <span class="sm-card-meta">{{ charIcon(s.char) }} {{ s.rating || 'All' }}</span>
          </button>
        </div>
        <div v-if="imageTotalPages > 1" class="pagination">
          <button class="btn btn-ghost btn-sm" :disabled="imagePage <= 1" @click="imagePage--">← 上一页</button>
          <span style="color:var(--text-muted);font-size:var(--fs-label-sm)">{{ imagePage }} / {{ imageTotalPages }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="imagePage >= imageTotalPages" @click="imagePage++">下一页 →</button>
        </div>

        <div v-if="selectedImageId" class="image-preview">
          <div class="image-preview-head">
            <strong>{{ selectedImageId }} · {{ selectedImageTitle }}</strong>
            <span class="row-tight">
              <button class="btn btn-ghost btn-sm" type="button" :disabled="uploadBusy" @click="pickShowcase">上传 / 替换样张</button>
              <button class="btn btn-ghost btn-sm" type="button" @click="selectedImageId = ''">关闭</button>
            </span>
          </div>
          <img class="image-preview-img" :src="showcaseUrl" :alt="selectedImageTitle" @error="onShowcaseMissing" />
          <input ref="showcaseFileEl" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="onShowcasePicked" />
          <p class="image-feedback" :class="{ err: showcaseError }">{{ showcaseFeedback }}</p>
        </div>
      </template>

      <!-- 重复检测 -->
      <template v-if="tab==='duplicates'">
        <div class="toolbar">
          <button class="btn btn-primary btn-sm" type="button" @click="detectDuplicates">开始检测</button>
          <span class="list-meta">{{ dupResult }}</span>
        </div>
        <p class="note">按关键词分组，同一关键词命中 3 个以上场景会列出，便于合并或下架冗余场景。</p>
        <div v-if="!dupGroups.length" class="table-msg">{{ dupChecked ? '未发现明显重复' : '尚未检测' }}</div>
        <div v-for="g in dupGroups" :key="g.keyword" class="dup-group">
          <h4>「{{ g.keyword }}」· {{ g.scenes.length }} 个场景</h4>
          <div v-for="s in g.scenes" :key="s.id" class="dup-item">
            <span>
              <strong>{{ s.id }}</strong> {{ s.title }}
              <span class="rating-badge" :class="'rating-' + (s.rating || 'All')">{{ s.rating || 'All' }}</span>
            </span>
            <div class="action-btns">
              <button class="btn btn-ghost btn-sm" type="button" @click="openEditModal(s.id)">编辑</button>
              <button class="btn btn-danger btn-sm" type="button" @click="deleteSceneFromDup(s.id)">下架</button>
            </div>
          </div>
        </div>
      </template>

      <!-- 导入 -->
      <template v-if="tab==='import'">
        <p class="note">粘贴单个或多个场景 JSON（数组或对象），校验后加入列表。记得保存到项目。</p>
        <textarea v-model="importInput" class="import-input" rows="10" placeholder='[{ "id":"sc999", "title":"…", "story":"…", "char":"nene" }]'></textarea>
        <div class="import-actions">
          <button class="btn btn-primary" type="button" @click="importScenes">校验并导入</button>
          <button class="btn btn-ghost" type="button" @click="importInput=''; importResult=''">清空</button>
        </div>
        <div v-if="importResult" class="import-result" v-html="importResult"></div>
      </template>

      <!-- 维护工具 -->
      <template v-if="tab==='tools'">
        <div class="tool-grid">
          <button v-for="t in TOOLS" :key="t.id" class="sm-tool-card" type="button" :disabled="toolRunning" @click="runTool(t.id)">
            <div class="sm-tool-icon">{{ t.icon }}</div>
            <div class="sm-tool-label">{{ t.label }}</div>
            <div class="sm-tool-desc">{{ t.desc }}</div>
          </button>
        </div>
        <div v-if="toolResult" class="tool-result-panel">
          <div class="tool-result-head">
            <strong>{{ toolResultTitle }}</strong>
            <span class="badge" :class="toolResult.ok ? 'badge-success' : 'badge-danger'">{{ toolResult.ok ? '✓ 通过' : '⚠️ 有问题' }}</span>
          </div>
          <pre class="tool-output">{{ toolResult.output }}</pre>
        </div>
      </template>
    </template>

    <!-- 编辑 Modal -->
    <Teleport to="body">
      <div v-if="editing" class="overlay" @click.self="closeModal">
        <div class="modal-card modal-card-wide">
          <h2>{{ editingId ? '编辑场景 · ' + editing.id : '新增场景' }}</h2>
          <div class="form-grid">
            <div class="form-group"><label>ID</label><input v-model="editing.id" class="input" :disabled="!!editingId" placeholder="sc001" /></div>
            <div class="form-group"><label>标题 *</label><input v-model="editing.title" class="input" :class="{invalid: !editing.title.trim() && triedSave}" /></div>
            <div class="form-group"><label>分类</label><input v-model="editing.category" class="input" placeholder="恋爱 / 日常 / 校园…" /></div>
            <div class="form-group">
              <label>角色</label>
              <select v-model="editing.char" class="filter-select" @change="updateCharacterDefaults">
                <option value="nene">宁宁</option><option value="natsume">夏目</option><option value="triad">双人</option>
              </select>
            </div>
            <div class="form-group"><label>LoRA</label><input v-model="editing.lora" class="input" /></div>
            <div class="form-group"><label>情绪</label><input v-model="editing.emotion" class="input" /></div>
            <div class="form-group"><label>季节</label><input v-model="editing.season" class="input" placeholder="春/夏/秋/冬/不限" /></div>
            <div class="form-group"><label>时段</label><input v-model="editing.time" class="input" placeholder="清晨/白天/黄昏/深夜" /></div>
            <div class="form-group"><label>timeOfDay</label><input v-model="editing.timeOfDay" class="input" placeholder="morning/noon/late_night" /></div>
            <div class="form-group">
              <label>分级</label>
              <select v-model="editing.rating" class="filter-select">
                <option value="All">All</option><option value="R15">R15</option><option value="R18">R18</option>
              </select>
            </div>
            <div class="form-group">
              <label>策展层级</label>
              <select v-model="curationTierValue" class="filter-select" @change="onCurationTierChange">
                <option value="normal">普通</option><option value="review">待审</option><option value="curated">精选</option><option value="signature">招牌</option>
              </select>
            </div>
            <div class="form-group form-group-full"><label>推荐理由（招牌必填）</label><input v-model="curationReason" class="input" :disabled="curationTierValue==='normal'||curationTierValue==='review'" :class="{invalid: curationTierValue==='signature' && !curationReason.trim() && triedSave}" /></div>
            <div class="form-group"><label>地点</label><input v-model="editing.location" class="input" /></div>
            <div class="form-group"><label>天气</label><input v-model="editing.weather" class="input" /></div>
            <div class="form-group"><label>镜头</label><input v-model="editing.camera" class="input" /></div>
            <div class="form-group"><label>光照</label><input v-model="editing.lighting" class="input" /></div>
            <div class="form-group form-group-full"><label>标签（逗号分隔）</label><input v-model="tagsInput" class="input" placeholder="silk, looking_back,…" /></div>
            <div class="form-group form-group-full"><label>用途（逗号分隔）</label><input v-model="usageInput" class="input" placeholder="壁纸, 表情包" /></div>
            <div class="form-group form-group-full"><label>故事 *</label><textarea v-model="editing.story" class="input" rows="3" :class="{invalid: !editing.story.trim() && triedSave}"></textarea></div>
            <div class="form-group form-group-full"><label>故事日文</label><textarea v-model="editing.storyJa" class="input" rows="2"></textarea></div>
            <div class="form-group form-group-full"><label>画面提示词</label><textarea v-model="editing.prompt" class="input" rows="2"></textarea></div>
            <div class="form-group form-group-full"><label>负面提示词</label><textarea v-model="editing.negative" class="input input-mono" rows="2"></textarea></div>
          </div>
          <p v-if="formHint" class="form-hint">{{ formHint }}</p>
          <div class="modal-actions">
            <button class="btn btn-primary" type="button" @click="saveScene">保存</button>
            <button class="btn btn-ghost" type="button" @click="copyJson">复制 JSON</button>
            <button class="btn btn-ghost" type="button" @click="closeModal">取消</button>
          </div>
          <p class="note-sm">注意：修改仅在内存中生效，需点"保存到项目"写回 data/scenes.json</p>
        </div>
      </div>
    </Teleport>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const TABS = [
  { id:'scenes',     label:'场景库' },
  { id:'tags',       label:'标签库' },
  { id:'images',     label:'样张' },
  { id:'duplicates', label:'重复检测' },
  { id:'import',     label:'导入' },
  { id:'tools',      label:'维护工具' },
]

const TAG_CATS = ['Character','Clothing','Action','Emotion','Scene','Lighting','Body','Appearance']
const DUP_KEYWORDS = ['吊带','丝绸','围裙','泳衣','温泉','旗袍','毛衣','衬衫','图书馆','天台','烟花','神社','巫女','咖啡','卧室','寝室','影音室','休息室','后厨','厨房','吧台','晚礼服','魔女','洛丽塔','浴衣','和服','赛车','冰箱','冷藏','露台','阳台','泳池','书房','试衣']
const TOOLS = [
  { id:'lint-colors', icon:'🎨', label:'检查硬编码颜色', desc:'扫描未用 token 的硬编码颜色' },
  { id:'validate',   icon:'✅', label:'完整场景校验',   desc:'ID 唯一性、字段完整性、评级一致性' },
  { id:'classify',   icon:'🏷', label:'更新场景评级',   desc:'根据标签重新计算 All/R15/R18' },
  { id:'optimize',   icon:'⚙️', label:'规范化提示词',   desc:'统一标签命名、补全负面词' },
]
const PAGE_SIZE = 30

const scenes = ref<any[]>([])
const tags = ref<any[]>([])
const curation = ref<any>({})
const loading = ref(true)
const loadError = ref('')
const tab = ref('scenes')
const search = ref(''); const fCat = ref(''); const fChar = ref(''); const fRating = ref('')
const sortBy = ref('id'); const page = ref(1)
const editing = ref<any>(null)
const editingId = ref('')
const curationTierValue = ref('normal')
const curationReason = ref('')
const tagsInput = ref('')
const usageInput = ref('')
const triedSave = ref(false)
const formHint = ref('')
const dirty = ref(false)
const saving = ref(false)
const maintenanceHint = ref('所有改动已同步')
const importInput = ref('')
const importResult = ref('')
const toolRunning = ref(false)
const toolResult = ref<any>(null)
const toolResultTitle = ref('')

const categories = computed(() => [...new Set(scenes.value.map(s => s.category))].sort())

const stats = computed(() => {
  const s = scenes.value
  return [
    { label:'总场景', value: s.length },
    { label:'宁宁',   value: s.filter((x:any) => x.char==='nene').length },
    { label:'夏目',   value: s.filter((x:any) => x.char==='natsume').length },
    { label:'双人',   value: s.filter((x:any) => x.char==='triad'||x.char==='both').length },
    { label:'All',    value: s.filter((x:any) => x.rating==='All').length },
    { label:'R15',    value: s.filter((x:any) => x.rating==='R15').length },
    { label:'R18',    value: s.filter((x:any) => x.rating==='R18').length },
    { label:'Tags',   value: tags.value.length },
  ]
})

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  let r = scenes.value.filter(s => {
    if (fCat.value && s.category !== fCat.value) return false
    if (fChar.value && s.char !== fChar.value) return false
    if (fRating.value && s.rating !== fRating.value) return false
    if (q) {
      const hay = [s.id, s.title, s.story, s.category, s.char, ...(s.tags||[])].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  return r.sort((a,b) => {
    if (sortBy.value === 'title') return String(a.title).localeCompare(String(b.title), 'zh-CN')
    if (sortBy.value === 'category') return String(a.category).localeCompare(String(b.category))
    if (sortBy.value === 'char') return String(a.char).localeCompare(String(b.char))
    return String(a.id).localeCompare(String(b.id))
  })
})

watch([search, fCat, fChar, fRating, sortBy], () => { page.value = 1 })

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value-1)*PAGE_SIZE, page.value*PAGE_SIZE))

// ── 标签库 CRUD ────────────────────────────────────────────────────────────
// 注意：tags.json 的字段是 en/cn/cat/weight，不是 name/description/category
const TAG_PAGE_SIZE = 60
const tagSearch = ref('')
const tagCatFilter = ref('')
const tagPage = ref(1)

const tagUsage = computed(() => {
  const map: Record<string, number> = {}
  scenes.value.forEach(s => (s.tags || []).forEach((t: string) => { map[t] = (map[t] || 0) + 1 }))
  return map
})

const tagCats = computed(() => {
  const found = [...new Set(tags.value.map((t: any) => t.cat).filter(Boolean))] as string[]
  return [...new Set([...TAG_CATS, ...found])]
})

const filteredTags = computed(() => {
  const q = tagSearch.value.trim().toLowerCase()
  return tags.value
    .filter((t: any) => {
      if (tagCatFilter.value && t.cat !== tagCatFilter.value) return false
      if (!q) return true
      return [t.id, t.en, t.cn, t.cat].join(' ').toLowerCase().includes(q)
    })
    .slice()
    .sort((a: any, b: any) => (tagUsage.value[b.en] || 0) - (tagUsage.value[a.en] || 0))
})
const tagTotalPages = computed(() => Math.max(1, Math.ceil(filteredTags.value.length / TAG_PAGE_SIZE)))
const pagedTags = computed(() =>
  filteredTags.value.slice((tagPage.value - 1) * TAG_PAGE_SIZE, tagPage.value * TAG_PAGE_SIZE),
)
watch([tagSearch, tagCatFilter], () => { tagPage.value = 1 })

function nextTagId() {
  const max = tags.value.reduce((m: number, t: any) =>
    Math.max(m, parseInt(String(t.id).replace('tag_', ''), 10) || 0), 0)
  return 'tag_' + String(max + 1).padStart(3, '0')
}

function openAddTag() {
  const en = prompt('标签英文名（Danbooru 格式，用下划线）：')
  if (!en?.trim()) return
  if (tags.value.some((t: any) => String(t.en).toLowerCase() === en.trim().toLowerCase())) {
    alert('这个英文名已存在'); return
  }
  const cn = prompt('标签中文名：')
  if (!cn?.trim()) return
  const cat = prompt(`分类（${TAG_CATS.join(' / ')}）：`, 'Scene')
  if (!cat?.trim()) return
  const weight = Number(prompt('默认权重（0–2）：', '0.8'))
  if (!Number.isFinite(weight) || weight <= 0 || weight > 2) { alert('权重必须是 0–2 之间的数字'); return }
  tags.value.push({ id: nextTagId(), cat: cat.trim(), en: en.trim(), cn: cn.trim(), weight, related: [] })
  markDirty('新增标签等待保存到项目')
}

function openEditTag(id: string) {
  const tag: any = tags.value.find((t: any) => t.id === id)
  if (!tag) return
  const en = prompt('标签英文名：', tag.en)
  if (!en?.trim()) return
  if (tags.value.some((t: any) => t.id !== id && String(t.en).toLowerCase() === en.trim().toLowerCase())) {
    alert('这个英文名已存在'); return
  }
  const cn = prompt('标签中文名：', tag.cn || '')
  if (!cn?.trim()) return
  const cat = prompt('分类：', tag.cat || 'Scene')
  if (!cat?.trim()) return
  const weight = Number(prompt('默认权重（0–2）：', String(tag.weight ?? 0.8)))
  if (!Number.isFinite(weight) || weight <= 0 || weight > 2) { alert('权重必须是 0–2 之间的数字'); return }

  const oldEn = tag.en
  Object.assign(tag, { en: en.trim(), cn: cn.trim(), cat: cat.trim(), weight })
  if (oldEn !== tag.en) {
    // 改名级联：场景里引用的旧标签一并替换，否则引用会悬空
    let touched = 0
    scenes.value.forEach(s => {
      if (!Array.isArray(s.tags)) return
      const next = s.tags.map((v: string) => (v === oldEn ? tag.en : v))
      if (next.join('\u0000') !== s.tags.join('\u0000')) { s.tags = next; touched++ }
    })
    markDirty(`标签改名已级联更新 ${touched} 个场景，等待保存`)
  } else {
    markDirty('标签修改等待保存到项目')
  }
}

function deleteTag(id: string) {
  const tag: any = tags.value.find((t: any) => t.id === id)
  if (!tag) return
  const used = tagUsage.value[tag.en] || 0
  if (!confirm(`确认删除标签「${tag.en}」？${used ? `场景中的 ${used} 处引用也会一并移除。` : ''}`)) return
  tags.value = tags.value.filter((t: any) => t.id !== id)
  scenes.value.forEach(s => {
    if (Array.isArray(s.tags)) s.tags = s.tags.filter((v: string) => v !== tag.en)
  })
  markDirty('标签删除及其场景引用等待保存')
}

// ── 样张管理 ──────────────────────────────────────────────────────────────
const IMAGE_PAGE_SIZE = 60
const imageSearch = ref('')
const imagePage = ref(1)
const selectedImageId = ref('')
const selectedImageTitle = ref('')
const showcaseFeedback = ref('')
const showcaseError = ref(false)
const showcaseVersion = ref(Date.now())
const uploadBusy = ref(false)
const showcaseFileEl = ref<HTMLInputElement | null>(null)

const filteredImageScenes = computed(() => {
  const q = imageSearch.value.trim().toLowerCase()
  if (!q) return scenes.value
  return scenes.value.filter(s => (s.id + ' ' + s.title).toLowerCase().includes(q))
})
const imageTotalPages = computed(() => Math.max(1, Math.ceil(filteredImageScenes.value.length / IMAGE_PAGE_SIZE)))
const pagedImageScenes = computed(() =>
  filteredImageScenes.value.slice((imagePage.value - 1) * IMAGE_PAGE_SIZE, imagePage.value * IMAGE_PAGE_SIZE),
)
watch(imageSearch, () => { imagePage.value = 1 })

const showcaseUrl = computed(() =>
  selectedImageId.value
    ? `/scene-showcase/images/${encodeURIComponent(selectedImageId.value)}.jpg?v=${showcaseVersion.value}`
    : '',
)

function previewImage(s: any) {
  selectedImageId.value = s.id
  selectedImageTitle.value = s.title
  showcaseError.value = false
  showcaseVersion.value = Date.now()
  showcaseFeedback.value = '支持 PNG / JPEG / WebP，最大 15MB；仅本机可替换。'
}
function onShowcaseMissing() {
  showcaseError.value = true
  showcaseFeedback.value = '该场景还没有样张，可直接上传一张。'
}
function pickShowcase() { showcaseFileEl.value?.click() }

/** 归一化为 JPEG，与后端 15MB 原图 / 3MB 缩略图限制对齐 */
function jpegAtWidth(image: HTMLImageElement, maxWidth: number, quality: number): string {
  const scale = Math.min(1, maxWidth / image.naturalWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

async function onShowcasePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !selectedImageId.value) return
  showcaseError.value = false
  if (file.size > 15 * 1024 * 1024) {
    showcaseError.value = true
    showcaseFeedback.value = '图片超过 15MB，请先压缩。'
    input.value = ''
    return
  }
  uploadBusy.value = true
  showcaseFeedback.value = '正在保存样张…'
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('无法读取这张图片'))
      reader.readAsDataURL(file)
    })
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('无法解析这张图片'))
      img.src = dataUrl
    })
    if (image.naturalWidth * image.naturalHeight > 60_000_000) {
      throw new Error('图片像素过大，请使用不超过 6000 万像素的版本')
    }
    const normalized = jpegAtWidth(image, 4096, 0.94)
    const thumbnail = jpegAtWidth(image, 560, 0.86)
    const r = await fetch('/api/maintenance/showcase', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedImageId.value, image: normalized, thumbnail }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || '保存失败')
    showcaseFeedback.value = data.message || '样张已保存'
    showcaseVersion.value = Date.now()
  } catch (err: any) {
    showcaseError.value = true
    showcaseFeedback.value = '未能保存：' + (err.message || '请确认通过本机控制面板打开网站')
  } finally {
    uploadBusy.value = false
    input.value = ''
  }
}

// ── 重复检测 ──────────────────────────────────────────────────────────────
const dupGroups = ref<Array<{ keyword: string; scenes: any[] }>>([])
const dupResult = ref('')
const dupChecked = ref(false)

function detectDuplicates() {
  const groups: Array<{ keyword: string; scenes: any[] }> = []
  let total = 0
  DUP_KEYWORDS.forEach(kw => {
    const matches = scenes.value.filter(s =>
      String(s.title || '').includes(kw) || String(s.story || '').includes(kw),
    )
    if (matches.length >= 3) { groups.push({ keyword: kw, scenes: matches }); total += matches.length }
  })
  dupGroups.value = groups
  dupChecked.value = true
  dupResult.value = `发现 ${groups.length} 组，共 ${total} 个疑似重复`
}

function deleteSceneFromDup(id: string) {
  deleteScene(id)
  detectDuplicates()
}

function charIcon(v: string) { return v==='nene'?'🌸':v==='natsume'?'🍂':'✦' }
function charLabel(v: string) { return v==='nene'?'宁宁':v==='natsume'?'夏目':v==='triad'||v==='both'?'双人':v||'—' }
function tierLabel(v: string) { return ({signature:'招牌', curated:'精选', review:'待审', normal:''} as any)[v] || '' }

function curationTier(id: string) {
  if ((curation.value.signatureSceneIds||[]).includes(id)) return 'signature'
  if ((curation.value.curatedSceneIds||[]).includes(id)) return 'curated'
  if ((curation.value.reviewSceneIds||[]).includes(id)) return 'review'
  return 'normal'
}

function markDirty(message: string) {
  dirty.value = true
  maintenanceHint.value = message
}

function updateCharacterDefaults() {
  const c = editing.value?.char
  if (!c || editingId.value) return
  if (c === 'nene') editing.value.lora = 'ayachi_nene_v15'
  else if (c === 'natsume') editing.value.lora = 'shiki_natsume_v15'
  else if (c === 'triad') editing.value.lora = 'ayachi_nene_v15:0.52, shiki_natsume_v15:0.52'
}

function onCurationTierChange() {
  if (curationTierValue.value === 'normal' || curationTierValue.value === 'review') curationReason.value = ''
}

function blankScene(): any {
  return {
    id: '', title: '', category: '恋爱', char: 'nene',
    lora: 'ayachi_nene_v15', emotion: '恋爱',
    season: '不限', time: '深夜', timeOfDay: 'late_night',
    rating: 'All', mature: false,
    location: '', weather: '', camera: '', lighting: '',
    tags: [], usage: ['壁纸用'],
    story: '', storyJa: '', prompt: '', negative: 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands',
  }
}

function openAddModal() {
  const maxId = scenes.value.reduce((m, s) => Math.max(m, parseInt(String(s.id).replace('sc','')) || 0), 0)
  editing.value = blankScene()
  editing.value.id = 'sc' + String(maxId + 1).padStart(3, '0')
  editingId.value = ''
  curationTierValue.value = 'normal'
  curationReason.value = ''
  tagsInput.value = ''
  usageInput.value = '壁纸用'
  triedSave.value = false
  formHint.value = ''
}

function openEditModal(id: string) {
  const s = scenes.value.find(x => x.id === id)
  if (!s) return
  editing.value = JSON.parse(JSON.stringify(s))
  editingId.value = id
  curationTierValue.value = curationTier(id)
  curationReason.value = (curation.value.recommendationReasons || {})[id] || ''
  tagsInput.value = (s.tags || []).join(', ')
  usageInput.value = (s.usage || []).join(', ')
  triedSave.value = false
  formHint.value = ''
}

function closeModal() { editing.value = null; editingId.value = '' }

function setSceneCuration(id: string, tier: string, reason: string) {
  const groups = ['signatureSceneIds','curatedSceneIds','reviewSceneIds'] as const
  groups.forEach(g => {
    if (!Array.isArray(curation.value[g])) curation.value[g] = []
    curation.value[g] = curation.value[g].filter((x:string) => x !== id)
  })
  if (tier !== 'normal') (curation.value as any)[tier + 'SceneIds'].push(id)
  if (!curation.value.recommendationReasons) curation.value.recommendationReasons = {}
  if (reason) curation.value.recommendationReasons[id] = reason
  else delete curation.value.recommendationReasons[id]
}

function saveScene() {
  triedSave.value = true
  const e = editing.value
  if (!e.title?.trim() || !e.story?.trim()) { formHint.value = '请先补齐标题和故事'; return }
  if (curationTierValue.value === 'signature' && !curationReason.value.trim()) { formHint.value = '招牌场景必须填写推荐理由'; return }
  e.character = e.char === 'triad' ? ['nene','natsume'] : [e.char]
  e.tags = tagsInput.value.split(',').map((t:string) => t.trim()).filter(Boolean)
  e.usage = usageInput.value.split(',').map((t:string) => t.trim()).filter(Boolean)
  e.mature = e.rating === 'R18'
  if (editingId.value) {
    const idx = scenes.value.findIndex(s => s.id === editingId.value)
    if (idx >= 0) scenes.value[idx] = JSON.parse(JSON.stringify(e))
  } else {
    if (scenes.value.some(s => s.id === e.id)) { formHint.value = 'ID 已存在：' + e.id; return }
    scenes.value.push(JSON.parse(JSON.stringify(e)))
  }
  setSceneCuration(e.id, curationTierValue.value, curationReason.value.trim())
  closeModal()
  markDirty('场景内容有修改，等待保存到项目')
}

function deleteScene(id: string) {
  if (!confirm('确认下架 ' + id + '？保存到项目后它将不再出现在场景库中。')) return
  scenes.value = scenes.value.filter(s => s.id !== id)
  setSceneCuration(id, 'normal', '')
  markDirty('有场景等待下架')
}

function duplicateScene(id: string) {
  const source = scenes.value.find(s => s.id === id)
  if (!source) return
  const maxId = scenes.value.reduce((m, s) => Math.max(m, parseInt(String(s.id).replace('sc','')) || 0), 0)
  const copy = JSON.parse(JSON.stringify(source))
  copy.id = 'sc' + String(maxId + 1).padStart(3, '0')
  copy.title = source.title + ' · 副本'
  scenes.value.push(copy)
  markDirty('已复制场景，请编辑副本内容')
  openEditModal(copy.id)
}

function copyJson() {
  if (!editing.value) return
  navigator.clipboard.writeText(JSON.stringify(editing.value, null, 2))
}

function exportJSON() {
  if (!scenes.value.length) return
  const blob = new Blob([JSON.stringify(scenes.value, null, 2)], { type:'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'scenes.json'; a.click()
  URL.revokeObjectURL(url)
}

function importScenes() {
  const input = importInput.value.trim()
  if (!input) { importResult.value = '<p class="msg-danger">请粘贴 JSON</p>'; return }
  let data: any
  try { data = JSON.parse(input) } catch (e:any) { importResult.value = '<p class="msg-danger">JSON 错误：' + esc(e.message) + '</p>'; return }
  if (!Array.isArray(data)) data = [data]
  const existingIds = new Set(scenes.value.map(s => s.id))
  const success: string[] = [], skipped: string[] = [], errors: string[] = []
  data.forEach((item:any, idx:number) => {
    if (!item.id) { errors.push('#' + idx + ' 缺少 id'); return }
    if (existingIds.has(item.id)) { skipped.push(item.id); return }
    const scene = {
      id: item.id, title: item.title || '未命名', category: item.category || '恋爱',
      story: item.story || '', char: item.char || 'nene',
      character: item.char === 'triad' ? ['nene','natsume'] : [item.char || 'nene'],
      lora: item.lora || (item.char === 'natsume' ? 'shiki_natsume_v15' : item.char === 'triad' ? 'ayachi_nene_v15:0.52, shiki_natsume_v15:0.52' : 'ayachi_nene_v15'),
      emotion: item.emotion || '恋爱', season: item.season || '不限', time: item.time || '深夜',
      timeOfDay: item.timeOfDay || 'late_night', tags: item.tags || [], mature: item.mature || false,
      rating: item.rating || (item.mature ? 'R18' : 'All'), location: item.location || '',
      weather: item.weather || '', camera: item.camera || '', lighting: item.lighting || '',
      usage: item.usage || ['壁纸用'], prompt: item.prompt || '',
      negative: item.negative || 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands',
      storyJa: item.storyJa || ''
    }
    scenes.value.push(scene); existingIds.add(scene.id); success.push(scene.id)
  })
  let html = ''
  if (success.length) html += '<p class="msg-ok">✓ 导入 ' + success.length + ' 个：' + esc(success.join(', ')) + '</p>'
  if (skipped.length) html += '<p class="msg-warn">⚠️ 跳过 ' + skipped.length + ' 个（ID 已存在）</p>'
  if (errors.length) html += '<p class="msg-danger">✗ ' + esc(errors.join('; ')) + '</p>'
  importResult.value = html || '<p class="muted">无变化</p>'
  if (success.length) markDirty('批量导入已通过基础检查，等待保存到项目')
}

async function saveToProject() {
  if (!dirty.value || saving.value) return
  saving.value = true
  maintenanceHint.value = '正在保存并检查…'
  try {
    const r = await fetch('/api/maintenance/scenes', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ scenes: scenes.value, tags: tags.value, curation: curation.value })
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || '保存失败')
    dirty.value = false
    maintenanceHint.value = data.count + ' 个场景已同步；备份编号 ' + data.backup
  } catch (e:any) {
    maintenanceHint.value = '保存未完成：' + e.message
  } finally {
    saving.value = false
  }
}

async function runTool(taskId: string) {
  if (toolRunning.value) return
  const tool = TOOLS.find(t => t.id === taskId)
  if (!tool) return
  toolRunning.value = true
  toolResultTitle.value = tool.icon + ' ' + tool.label
  toolResult.value = { ok: true, output: '...' }
  try {
    const r = await fetch('/api/maintenance/run', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ task: taskId })
    })
    const data = await r.json()
    toolResult.value = { ok: !!data.ok, output: data.output || '(no output)' }
  } catch (e:any) {
    toolResult.value = { ok: false, output: '网络请求失败：' + e.message }
  } finally {
    toolRunning.value = false
  }
}

function esc(s: string) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault(); e.returnValue = ''
}
onMounted(() => { window.addEventListener('beforeunload', onBeforeUnload) })
onBeforeUnmount(() => { window.removeEventListener('beforeunload', onBeforeUnload) })

onMounted(async () => {
  try {
    const v = Date.now()
    const [sRes, tRes, cRes] = await Promise.all([
      fetch('/data/scenes.json?v=' + v),
      fetch('/data/tags.json?v=' + v),
      fetch('/data/curation.json?v=' + v),
    ])
    if (!sRes.ok) throw new Error('scenes.json 加载失败 (HTTP ' + sRes.status + ')')
    scenes.value = await sRes.json()
    tags.value = await tRes.json().catch(() => [])
    curation.value = await cRes.json().catch(() => ({}))
    if (!Array.isArray(scenes.value)) throw new Error('scenes.json 格式错误')
  } catch (err:any) {
    loadError.value = err.message
  }
  loading.value = false
})
</script>

<style scoped>
.sm-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--s-4); margin-bottom:var(--s-5); flex-wrap:wrap; }
.sm-head-actions { display:flex; gap:var(--s-2); flex-shrink:0; }
.maintenance-state { display:inline-flex; align-items:center; gap:var(--s-2); margin-top:var(--s-2); padding:4px 12px; border-radius:var(--r-pill); background:color-mix(in srgb,var(--success) 10%,transparent); color:var(--success-text); font-size:var(--fs-label-sm); }
.maintenance-state.dirty { background:color-mix(in srgb,var(--warning) 14%,transparent); color:var(--warning-text); }
.maintenance-state span { color:var(--text-muted); font-size:var(--fs-label-xs); }
.muted { color:var(--text-muted); }
.note { color:var(--text-secondary); font-size:var(--fs-body-sm); margin:0 0 var(--s-3); line-height:1.65; }
.note-sm { color:var(--text-muted); font-size:var(--fs-label-xs); margin-top:var(--s-3); line-height:1.5; }

.toolbar { display:flex; gap:var(--s-3); flex-wrap:wrap; align-items:center; margin-bottom:var(--s-4); padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:var(--bg-surface); }
.search-input { flex:1; min-width:200px; padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font-size:var(--fs-body); }
.search-input:focus { border-color:var(--accent); outline:none; }
.filter-select { padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font-size:var(--fs-body-sm); }
.stats { display:flex; gap:var(--s-3); margin-bottom:var(--s-4); flex-wrap:wrap; }
.stat-card { background:var(--bg-surface); border:1px solid var(--border-soft); border-radius:var(--r-md); padding:var(--s-3) var(--s-4); min-width:100px; text-align:center; }
.stat-value { font-size:var(--fs-title-xs); font-weight:800; color:var(--accent); }
.stat-label { font-size:var(--fs-label-xs); color:var(--text-muted); }
.tab-row { display:flex; gap:var(--s-2); margin-bottom:var(--s-4); flex-wrap:wrap; }
.tab-btn { padding:var(--s-2) var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-pill); background:transparent; color:var(--text-secondary); cursor:pointer; font:600 var(--fs-body-sm) var(--font-sans); transition:all var(--t-fast); }
.tab-btn.active { background:var(--accent); color:var(--text-inverse); border-color:var(--accent); }
.table-wrap { overflow-x:auto; background:var(--bg-surface); border:1px solid var(--border-soft); border-radius:var(--r-lg); margin-bottom:var(--s-4); }
table { width:100%; border-collapse:collapse; font-size:var(--fs-body-sm); }
th { background:var(--bg-deep); padding:var(--s-3); text-align:left; font-weight:700; color:var(--text-secondary); font-size:var(--fs-label-sm); text-transform:uppercase; letter-spacing:.05em; }
td { padding:var(--s-2) var(--s-3); border-top:1px solid var(--border-soft); vertical-align:top; }
tr:hover td { background:var(--bg-elevated); }
.rating-badge { display:inline-block; padding:2px var(--s-2); border-radius:var(--r-pill); font-size:var(--fs-label-xs); font-weight:700; }
.rating-All { background:color-mix(in srgb,var(--success) 22%,transparent); color:var(--success-text); }
.rating-R15 { background:color-mix(in srgb,var(--warning) 22%,transparent); color:var(--warning-text); }
.rating-R18 { background:color-mix(in srgb,var(--danger) 22%,transparent); color:var(--danger-text); }
.tier-badge { display:inline-block; padding:2px 8px; border-radius:var(--r-pill); font-size:var(--fs-label-xs); font-weight:700; }
.tier-signature { background:color-mix(in srgb,var(--natsume-amber) 26%,transparent); color:var(--natsume-amber); }
.tier-curated { background:var(--accent-soft); color:var(--accent); }
.tier-review { background:var(--bg-elevated); color:var(--text-secondary); }
.story-preview { max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-secondary); font-size:var(--fs-label-sm); }
.action-btns { display:flex; gap:var(--s-1); white-space:nowrap; }
.table-msg { padding:var(--s-6); color:var(--text-muted); text-align:center; }
.list-meta { margin-left:auto; color:var(--text-muted); font-size:var(--fs-label-sm); }
.pagination { display:flex; align-items:center; justify-content:center; gap:var(--s-3); margin-top:var(--s-3); }

.import-input { width:100%; min-height:200px; padding:var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font:400 var(--fs-label) var(--font-mono); line-height:1.6; resize:vertical; outline:none; }
.import-input:focus { border-color:var(--accent); }
.import-actions { display:flex; gap:var(--s-2); margin:var(--s-3) 0; }
.import-result { padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-md); background:var(--bg-surface); font-size:var(--fs-label-sm); line-height:1.7; }
.msg-ok { color:var(--success-text); margin:0 0 4px; } .msg-warn { color:var(--warning-text); margin:0 0 4px; } .msg-danger { color:var(--danger-text); margin:0 0 4px; }

.tool-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:var(--s-3); margin-bottom:var(--s-4); }
.sm-tool-card { display:flex; flex-direction:column; gap:var(--s-1); text-align:left; padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--bg-surface); cursor:pointer; transition:border-color var(--t-fast),transform var(--t-fast); }
.sm-tool-card:hover:not(:disabled) { border-color:var(--accent); transform:translateY(-2px); }
.sm-tool-card:disabled { opacity:.5; cursor:not-allowed; }
.sm-tool-icon { font-size:var(--fs-title); }
.sm-tool-label { font-weight:700; font-size:var(--fs-body); color:var(--text-primary); }
.sm-tool-desc { color:var(--text-muted); font-size:var(--fs-label-sm); line-height:1.5; }
.tool-result-panel { padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--bg-deep); }
.tool-result-head { display:flex; align-items:center; gap:var(--s-3); margin-bottom:var(--s-3); }
.tool-output { max-height:340px; overflow:auto; padding:var(--s-3); background:var(--bg-base); border:1px solid var(--border-soft); border-radius:var(--r-md); font:400 var(--fs-mono-xs)/1.7 var(--font-mono); color:var(--text-secondary); white-space:pre-wrap; word-break:break-word; }

/* 样张管理 */
.image-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:var(--s-2); margin-bottom:var(--s-3); }
.sm-image-card { display:grid; gap:3px; text-align:left; padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--bg-surface); cursor:pointer; transition:border-color var(--t-fast),transform var(--t-fast); }
.sm-image-card:hover { border-color:var(--accent); transform:translateY(-2px); }
.sm-image-card.active { border-color:var(--accent); background:var(--accent-soft); }
.sm-card-id { color:var(--text-muted); font:650 var(--fs-mono-xs) var(--font-mono); }
.sm-card-title { color:var(--text-primary); font-size:var(--fs-label-sm); font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sm-card-meta { color:var(--text-muted); font-size:var(--fs-mono-xs); }
.image-preview { margin-top:var(--s-4); padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:var(--bg-surface); }
.image-preview-head { display:flex; align-items:center; justify-content:space-between; gap:var(--s-3); margin-bottom:var(--s-3); flex-wrap:wrap; }
.image-preview-img { display:block; width:100%; max-height:60vh; object-fit:contain; border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--art-mat); }
.image-feedback { margin:var(--s-2) 0 0; color:var(--text-muted); font-size:var(--fs-label-sm); line-height:1.6; }
.image-feedback.err { color:var(--warning-text); }
.row-tight { display:inline-flex; gap:var(--s-2); flex-wrap:wrap; }

/* 重复检测 */
.dup-group { margin-bottom:var(--s-4); padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:var(--bg-surface); }
.dup-group h4 { margin:0 0 var(--s-3); font-size:var(--fs-body); color:var(--text-primary); }
.dup-item { display:flex; align-items:center; justify-content:space-between; gap:var(--s-3); padding:var(--s-2) 0; border-top:1px solid var(--border-soft); flex-wrap:wrap; font-size:var(--fs-label-sm); }
.dup-item:first-of-type { border-top:0; }

.overlay { position:fixed; inset:0; z-index:var(--z-overlay); display:flex; align-items:center; justify-content:center; padding:var(--s-4); background:var(--art-backdrop); backdrop-filter:blur(6px); }
.modal-card-wide { width:min(820px,94vw); }
.modal-card { max-height:90vh; overflow-y:auto; padding:var(--s-6); border:1px solid var(--accent); border-radius:var(--r-xl); background:var(--bg-elevated); box-shadow:var(--shadow-lg); }
.modal-card h2 { margin-bottom:var(--s-4); font-size:var(--fs-title-sm); }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:var(--s-3); margin-bottom:var(--s-3); }
.form-group { display:grid; gap:var(--s-1); }
.form-group-full { grid-column:1 / -1; }
.form-group label { font-size:var(--fs-label-sm); color:var(--text-muted); font-weight:600; }
.input { padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font:var(--fs-body)/1.5 var(--font-sans); outline:none; width:100%; resize:vertical; }
.input-mono { font-family:var(--font-mono); font-size:var(--fs-label); }
.input:focus { border-color:var(--accent); }
.input.invalid { border-color:var(--danger-text); box-shadow:0 0 0 2px color-mix(in srgb,var(--danger) 22%,transparent); }
.filter-select { padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font-size:var(--fs-body-sm); width:100%; }
.form-hint { color:var(--danger-text); font-size:var(--fs-label-sm); margin:0 0 var(--s-3); }
.modal-actions { display:flex; gap:var(--s-2); margin-top:var(--s-2); flex-wrap:wrap; }
@media(max-width:680px) { .form-grid { grid-template-columns:1fr; } .sm-head { flex-direction:column; } }
</style>