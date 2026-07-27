<template>
  <main class="page" style="--page-max:1400px">
    <div class="page-kicker">Scene manager</div>
    <h1 class="title">场景管理</h1>

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
          </select>
          <span class="list-meta">{{ filtered.length }} / {{ scenes.length }} 条</span>
        </div>
        <div class="table-wrap">
          <table class="data-table-scenes">
            <thead>
              <tr>
                <th>ID</th><th>标题</th><th>分类</th><th>角色</th><th>分级</th><th>故事</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading"><td colspan="7" class="table-msg">⏳ 正在加载数据…</td></tr>
              <tr v-else-if="!filtered.length"><td colspan="7" class="table-msg">暂无匹配场景</td></tr>
              <template v-else>
                <tr v-for="s in paged" :key="s.id">
                  <td><code style="font-size:var(--fs-mono-xs)">{{ s.id }}</code></td>
                  <td>{{ s.title }}</td>
                  <td>{{ s.category }}</td>
                  <td>{{ charLabel(s.char) }}</td>
                  <td><span class="rating-badge" :class="'rating-' + s.rating">{{ s.rating || 'All' }}</span></td>
                  <td><div class="story-preview">{{ s.story }}</div></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn btn-ghost btn-sm" type="button" @click="editScene(s)">编辑</button>
                      <RouterLink :to="'/prompt-builder?scene=' + encodeURIComponent(s.id)" class="btn btn-ghost btn-sm">绘制</RouterLink>
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

      <!-- Tags 标签库 -->
      <template v-if="tab==='tags'">
        <div class="toolbar">
          <input v-model="tagSearch" class="search-input" type="search" placeholder="🔍 搜索标签…" />
        </div>
        <div class="table-wrap">
          <table class="data-table-tags">
            <thead><tr><th>#</th><th>标签</th><th>描述</th><th>分类</th><th>角色</th><th>使用</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="t in filteredTags" :key="t.id">
                <td><code style="font-size:var(--fs-mono-xs)">{{ t.id }}</code></td>
                <td><span class="tag-chip">{{ t.name || t.id }}</span></td>
                <td style="color:var(--text-secondary);font-size:var(--fs-label-sm)">{{ t.description }}</td>
                <td>{{ t.category }}</td>
                <td>{{ t.char || '—' }}</td>
                <td>{{ tagUsage[t.id] || 0 }}</td>
                <td>
                  <RouterLink :to="'/scene-explorer?tag=' + encodeURIComponent(t.id)" class="btn btn-ghost btn-sm">查看</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <!-- 编辑 Modal -->
    <Teleport to="body">
      <div v-if="editing" class="overlay" @click.self="editing=null">
        <div class="modal-card">
          <h2>编辑场景 · {{ editing.id }}</h2>
          <div class="form-group"><label>标题</label><input v-model="editing.title" class="input" /></div>
          <div class="form-group"><label>故事</label><textarea v-model="editing.story" class="input" rows="4"></textarea></div>
          <div class="form-group"><label>分类</label><input v-model="editing.category" class="input" /></div>
          <div class="form-group"><label>情绪</label><input v-model="editing.emotion" class="input" /></div>
          <div class="form-group"><label>角色</label>
            <select v-model="editing.char" class="filter-select">
              <option value="nene">宁宁</option><option value="natsume">夏目</option><option value="triad">双人</option>
            </select>
          </div>
          <div class="form-group"><label>分级</label>
            <select v-model="editing.rating" class="filter-select">
              <option value="All">All</option><option value="R15">R15</option><option value="R18">R18</option>
            </select>
          </div>
          <div style="display:flex;gap:var(--s-2);margin-top:var(--s-4)">
            <button class="btn btn-primary" type="button" @click="saveEdit">保存修改</button>
            <button class="btn btn-ghost" type="button" @click="editing=null">取消</button>
            <button class="btn btn-ghost" type="button" @click="copyJson">复制 JSON</button>
          </div>
          <p style="margin-top:var(--s-3);color:var(--text-muted);font-size:var(--fs-label-xs)">注意：修改仅在内存中生效，需手动更新 data/scenes.json</p>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const TABS = [{ id:'scenes', label:'场景库' }, { id:'tags', label:'标签库' }]
const PAGE_SIZE = 30

const scenes = ref<any[]>([])
const tags = ref<any[]>([])
const curation = ref<any>({})
const loading = ref(true)
const loadError = ref('')
const tab = ref('scenes')
const search = ref(''); const fCat = ref(''); const fChar = ref(''); const fRating = ref('')
const sortBy = ref('id'); const page = ref(1)
const tagSearch = ref('')
const editing = ref<any>(null)

const categories = computed(() => [...new Set(scenes.value.map(s => s.category))].sort())

const stats = computed(() => {
  const s = scenes.value
  return [
    { label:'总场景', value: s.length },
    { label:'宁宁',   value: s.filter(x => x.char==='nene').length },
    { label:'夏目',   value: s.filter(x => x.char==='natsume').length },
    { label:'双人',   value: s.filter(x => x.char==='triad'||x.char==='both').length },
    { label:'All',    value: s.filter(x => x.rating==='All').length },
    { label:'R15',    value: s.filter(x => x.rating==='R15').length },
    { label:'R18',    value: s.filter(x => x.rating==='R18').length },
    { label:'Tags',   value: tags.value.length },
  ]
})

const tagUsage = computed(() => {
  const map: Record<string,number> = {}
  scenes.value.forEach(s => (s.tags||[]).forEach((t: string) => { map[t] = (map[t]||0) + 1 }))
  return map
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
    if (sortBy.value === 'title') return a.title.localeCompare(b.title, 'zh-CN')
    if (sortBy.value === 'category') return a.category.localeCompare(b.category)
    return a.id.localeCompare(b.id)
  })
})

watch([search, fCat, fChar, fRating, sortBy], () => { page.value = 1 })

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value-1)*PAGE_SIZE, page.value*PAGE_SIZE))
const filteredTags = computed(() => {
  const q = tagSearch.value.toLowerCase()
  if (!q) return tags.value
  return tags.value.filter(t => [t.id, t.name, t.description, t.category].join(' ').toLowerCase().includes(q))
})

function charLabel(v: string) {
  return v==='nene'?'宁宁':v==='natsume'?'夏目':v==='triad'||v==='both'?'双人':v||'—'
}

function editScene(s: any) { editing.value = { ...s } }
function saveEdit() {
  if (!editing.value) return
  const idx = scenes.value.findIndex(s => s.id === editing.value.id)
  if (idx >= 0) scenes.value[idx] = { ...editing.value }
  editing.value = null
}
function copyJson() {
  if (!editing.value) return
  navigator.clipboard.writeText(JSON.stringify(editing.value, null, 2))
}

onMounted(async () => {
  try {
    const v = Date.now()
    const [sRes, tRes, cRes] = await Promise.all([
      fetch('/data/scenes.json?v=' + v),
      fetch('/data/tags.json?v=' + v),
      fetch('/data/curation.json?v=' + v),
    ])
    if (!sRes.ok) throw new Error('scenes.json 加载失败 (HTTP ' + sRes.status + ')')
    if (!tRes.ok) throw new Error('tags.json 加载失败 (HTTP ' + tRes.status + ')')
    scenes.value = await sRes.json()
    tags.value = await tRes.json().catch(() => [])
    curation.value = await cRes.json().catch(() => ({}))
    if (!Array.isArray(scenes.value)) throw new Error('scenes.json 格式错误')
  } catch (err: any) {
    loadError.value = err.message
  }
  loading.value = false
})
</script>

<style scoped>
.toolbar { display:flex; gap:var(--s-3); flex-wrap:wrap; align-items:center; margin-bottom:var(--s-4); padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:var(--bg-surface); }
.search-input { flex:1; min-width:200px; padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font-size:var(--fs-body); }
.search-input:focus { border-color:var(--accent); outline:none; }
.filter-select { padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font-size:var(--fs-body-sm); }
.stats { display:flex; gap:var(--s-3); margin-bottom:var(--s-4); flex-wrap:wrap; }
.stat-card { background:var(--bg-surface); border:1px solid var(--border-soft); border-radius:var(--r-md); padding:var(--s-3) var(--s-4); min-width:100px; text-align:center; }
.stat-value { font-size:var(--fs-title-xs); font-weight:800; color:var(--accent); }
.stat-label { font-size:var(--fs-label-xs); color:var(--text-muted); }
.tab-row { display:flex; gap:var(--s-2); margin-bottom:var(--s-4); }
.tab-btn { padding:var(--s-2) var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-pill); background:transparent; color:var(--text-secondary); cursor:pointer; font:600 var(--fs-body-sm) var(--font-sans); transition:all var(--t-fast); }
.tab-btn.active { background:var(--accent); color:var(--text-inverse); border-color:var(--accent); }
.table-wrap { overflow-x:auto; background:var(--bg-surface); border:1px solid var(--border-soft); border-radius:var(--r-lg); margin-bottom:var(--s-4); }
table { width:100%; border-collapse:collapse; font-size:var(--fs-body-sm); }
th { background:var(--bg-deep); padding:var(--s-3); text-align:left; font-weight:700; color:var(--text-secondary); font-size:var(--fs-label-sm); text-transform:uppercase; letter-spacing:.05em; }
td { padding:var(--s-2) var(--s-3); border-top:1px solid var(--border-soft); vertical-align:top; }
tr:hover td { background:var(--bg-elevated); }
.tag-chip { display:inline-block; padding:2px var(--s-2); background:var(--accent-soft); color:var(--accent); border-radius:var(--r-pill); font-size:var(--fs-label-xs); }
.rating-badge { display:inline-block; padding:2px var(--s-2); border-radius:var(--r-pill); font-size:var(--fs-label-xs); font-weight:700; }
.rating-All { background:color-mix(in srgb,var(--success) 22%,transparent); color:var(--success-text); }
.rating-R15 { background:color-mix(in srgb,var(--warning) 22%,transparent); color:var(--warning-text); }
.rating-R18 { background:color-mix(in srgb,var(--danger) 22%,transparent); color:var(--danger-text); }
.story-preview { max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-secondary); font-size:var(--fs-label-sm); }
.action-btns { display:flex; gap:var(--s-1); white-space:nowrap; }
.table-msg { padding:var(--s-6); color:var(--text-muted); text-align:center; }
.list-meta { margin-left:auto; color:var(--text-muted); font-size:var(--fs-label-sm); }
.pagination { display:flex; align-items:center; justify-content:center; gap:var(--s-3); margin-top:var(--s-3); }
.overlay { position:fixed; inset:0; z-index:var(--z-overlay); display:flex; align-items:center; justify-content:center; background:var(--art-backdrop); backdrop-filter:blur(6px); }
.modal-card { width:min(600px,92vw); max-height:90vh; overflow-y:auto; padding:var(--s-6); border:1px solid var(--accent); border-radius:var(--r-xl); background:var(--bg-elevated); box-shadow:var(--shadow-lg); }
.modal-card h2 { margin-bottom:var(--s-4); font-size:var(--fs-title-sm); }
.form-group { display:grid; gap:var(--s-1); margin-bottom:var(--s-3); }
.form-group label { font-size:var(--fs-label-sm); color:var(--text-muted); font-weight:600; }
.input { padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font:var(--fs-body)/1.5 var(--font-sans); outline:none; resize:vertical; }
.input:focus { border-color:var(--accent); }
</style>
