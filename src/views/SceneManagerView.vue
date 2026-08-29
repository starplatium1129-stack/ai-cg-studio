<template>
  <article class="page" style="--page-max:1400px">
    <WorkspaceArchiveBar
      chapter="12"
      title="SCENE MAINTENANCE"
      :subtitle="`${scenes.length || '—'} RECORDS · ${tab.toUpperCase()}`"
      :status="loading ? 'READING ARCHIVE' : (loadError ? 'ARCHIVE EXCEPTION' : (saving ? 'WRITING PROJECT' : (dirty ? 'UNSAVED CHANGES' : 'ARCHIVE SYNCED')))"
      :state="loading ? 'active' : (loadError ? 'warning' : (saving ? 'active' : (dirty ? 'warning' : 'success')))"
      shape="frame"
    />
    <header class="sm-head">
      <div>
        <div class="page-kicker">Scene manager</div>
        <h1 class="title">场景管理</h1>
        <div class="maintenance-state" :class="{ dirty: dirty }">
          <strong id="maintenanceTitle">{{ loading ? '正在读取场景档案' : (loadError ? '场景档案暂不可用' : (dirty ? '有尚未保存的修改' : '已同步')) }}</strong>
          <span id="maintenanceHint">{{ loading ? '正在同步磁盘数据…' : (loadError || maintenanceHint) }}</span>
          <span v-if="saving && savingPhase" class="saving-phase">{{ savingPhase }}</span>
        </div>
      </div>
      <div class="sm-head-actions">
        <button class="btn btn-ghost" type="button" @click="exportJSON" :disabled="!scenes.length"><ArchiveIcon name="download" /> 导出 JSON</button>
        <button class="btn btn-primary" type="button" :disabled="!dirty || saving || desktopPackaged" :title="desktopPackaged ? '桌面应用模式不支持保存场景内容' : ''" @click="saveToProject">
          {{ saving ? '正在保存…' : (desktopPackaged ? '桌面模式不可保存' : '▣ 保存到项目') }}
        </button>
      </div>
    </header>

    <ArchiveStatePanel
      v-if="loading"
      kind="loading"
      title="正在读取场景档案"
      message="正在从本地数据源同步场景、标签和维护记录。"
    />

    <ArchiveStatePanel
      v-if="desktopPackaged"
      kind="warning"
      title="桌面应用为只读模式"
      message="场景内容位于只读应用包内，仅可浏览与导出，保存与维护任务不可用。请用源码开发模式编辑。"
    />

    <ArchiveStatePanel
      v-if="!loading && loadError"
      kind="error"
      title="场景档案读取失败"
      :message="`${loadError} 请确认通过 localhost 访问且文件存在。`"
    >
      <button class="btn btn-primary" type="button" @click="loadFromStore(true)">重新读取</button>
    </ArchiveStatePanel>

    <template v-if="!loading && !loadError">
      <!-- Stats: 4 groups — 总览 / 角色 / 分级 / Tags -->
      <div class="stats">
        <div class="stat-group stat-group--overview">
          <div class="stat-card stat-card--accent">
            <div class="stat-value">{{ stats[0]?.value }}</div>
            <div class="stat-label">{{ stats[0]?.label }}</div>
          </div>
        </div>
        <div class="stat-group stat-group--chars">
          <div class="stat-card stat-card--amber">
            <div class="stat-value">{{ stats[1]?.value }}</div>
            <div class="stat-label">{{ stats[1]?.label }}</div>
          </div>
          <div class="stat-card stat-card--accent">
            <div class="stat-value">{{ stats[2]?.value }}</div>
            <div class="stat-label">{{ stats[2]?.label }}</div>
          </div>
          <div class="stat-card stat-card--muted">
            <div class="stat-value">{{ stats[3]?.value }}</div>
            <div class="stat-label">{{ stats[3]?.label }}</div>
          </div>
        </div>
        <div class="stat-group stat-group--rating">
          <div class="stat-card stat-card--success">
            <div class="stat-value">{{ stats[4]?.value }}</div>
            <div class="stat-label">{{ stats[4]?.label }}</div>
          </div>
          <div class="stat-card stat-card--warning">
            <div class="stat-value">{{ stats[5]?.value }}</div>
            <div class="stat-label">{{ stats[5]?.label }}</div>
          </div>
          <div class="stat-card stat-card--danger">
            <div class="stat-value">{{ stats[6]?.value }}</div>
            <div class="stat-label">{{ stats[6]?.label }}</div>
          </div>
        </div>
        <div class="stat-group stat-group--tags">
          <div class="stat-card">
            <div class="stat-value">{{ stats[7]?.value }}</div>
            <div class="stat-label">{{ stats[7]?.label }}</div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tab-row">
        <button v-for="t in TABS" :key="t.id" class="tab-btn" :class="{active: tab===t.id}" type="button" @click="tab=t.id">{{ t.label }}</button>
      </div>

      <!-- 场景表 -->
      <template v-if="tab==='scenes'">
        <div class="toolbar">
          <input v-model="search" class="search-input" type="search" placeholder="搜索 ID、标题、故事、标签…" />
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
          <button class="btn btn-ghost btn-sm" type="button" :disabled="desktopPackaged" :title="desktopPackaged ? '桌面只读模式不可编辑' : ''" @click="openAddModal">＋ 新增场景</button>
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
              <tr v-if="loading" class="table-state-row">
                <td colspan="8">
                  <ArchiveStatePanel compact kind="loading" title="正在读取场景记录" message="同步本机场景、标签与维护状态。" />
                </td>
              </tr>
              <tr v-else-if="!filtered.length" class="table-state-row">
                <td colspan="8">
                  <ArchiveStatePanel compact kind="filtered" title="没有匹配的场景" message="调整筛选条件，或新建一条场景记录。" />
                </td>
              </tr>
              <template v-else>
                <tr v-for="s in paged" :key="s.id">
                  <td><code class="id-code">{{ s.id }}</code></td>
                  <td v-html="hl(s.title, searchDebounced)"></td>
                  <td>{{ s.category }}</td>
                  <td>{{ charIcon(s.char) }}</td>
                  <td><span class="rating-badge" :class="'rating-' + s.rating">{{ s.rating || 'All' }}</span></td>
                  <td><span v-if="curationTier(s.id)!=='normal'" class="tier-badge" :class="'tier-' + curationTier(s.id)">{{ tierLabel(curationTier(s.id)) }}</span><span v-else class="muted">—</span></td>
                  <td><div class="story-preview">{{ s.story }}</div></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn btn-ghost btn-sm" type="button" :disabled="desktopPackaged" @click="openEditModal(s.id)">编辑</button>
                      <button class="btn btn-ghost btn-sm" type="button" :disabled="desktopPackaged" @click="duplicateScene(s.id)">复制</button>
                      <button class="btn btn-danger btn-sm" type="button" :disabled="desktopPackaged" @click="deleteScene(s.id)">下架</button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div v-if="totalPages > 1" class="pagination">
          <button class="btn btn-ghost btn-sm" :disabled="page <= 1" @click="page--">← 上一页</button>
          <span class="hint-sm">{{ page }} / {{ totalPages }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="page >= totalPages" @click="page++">下一页 →</button>
        </div>
      </template>

      <!-- 蓝图库 -->
      <template v-if="tab==='blueprints'">
        <div class="toolbar">
          <input v-model="bpSearch" class="search-input" type="search" placeholder="搜索蓝图 ID、标题、角色、标签、Prompt…" />
          <select v-model="bpChar" class="filter-select">
            <option value="">全部角色</option>
            <option v-for="c in bpCharacters" :key="c" :value="c">{{ charLabel(c) }}</option>
          </select>
          <select v-model="bpCat" class="filter-select">
            <option value="">全部分类</option>
            <option v-for="c in bpCategories" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="bpAdult" class="filter-select">
            <option value="">全部内容</option>
            <option value="safe">普通</option>
            <option value="adult">成人</option>
          </select>
          <button class="btn btn-ghost btn-sm" type="button" :disabled="desktopPackaged" :title="desktopPackaged ? '桌面只读模式不可编辑' : ''" @click="openBlueprintAddModal">＋ 新增蓝图</button>
          <span class="list-meta">{{ filteredBlueprints.length }} / {{ blueprints.length }} 条</span>
        </div>
        <div class="table-wrap">
          <table class="data-table-scenes">
            <thead>
              <tr><th>ID</th><th>标题</th><th>角色</th><th>分类</th><th>定级</th><th>动作</th><th>操作</th></tr>
            </thead>
            <tbody>
              <tr v-if="!filteredBlueprints.length" class="table-state-row">
                <td colspan="7">
                  <ArchiveStatePanel compact kind="filtered" title="没有匹配的蓝图" message="调整筛选条件，或新建一条蓝图。" />
                </td>
              </tr>
              <template v-else>
                <tr v-for="b in pagedBlueprints" :key="b.id">
                  <td><code class="id-code">{{ b.id }}</code></td>
                  <td>{{ b.title }}</td>
                  <td>{{ charLabel(b.characterId) }}</td>
                  <td>{{ b.category }}</td>
                  <td><span class="rating-badge" :class="'rating-' + (b.sampleRating || (b.adult ? 'R18' : 'All'))">{{ b.sampleRating || (b.adult ? 'R18' : 'All') }}</span></td>
                  <td><div class="story-preview">{{ b.action }}</div></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn btn-ghost btn-sm" type="button" :disabled="desktopPackaged" @click="openBlueprintEditModal(b.id)">编辑</button>
                      <button class="btn btn-ghost btn-sm" type="button" :disabled="desktopPackaged" @click="duplicateBlueprint(b.id)">复制</button>
                      <button class="btn btn-danger btn-sm" type="button" :disabled="desktopPackaged" @click="deleteBlueprint(b.id)">删除</button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div v-if="bpTotalPages > 1" class="pagination">
          <button class="btn btn-ghost btn-sm" :disabled="bpPage <= 1" @click="bpPage--">← 上一页</button>
          <span class="hint-sm">{{ bpPage }} / {{ bpTotalPages }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="bpPage >= bpTotalPages" @click="bpPage++">下一页 →</button>
        </div>
      </template>

      <!-- 标签库 -->
      <template v-if="tab==='tags'">
        <div class="toolbar">
          <input v-model="tagSearch" class="search-input" type="search" placeholder="搜索标签（英文/中文/分类）…" />
          <select v-model="tagCatFilter" class="filter-select">
            <option value="">全部分类</option>
            <option v-for="c in tagCats" :key="c" :value="c">{{ c }}</option>
          </select>
          <button class="btn btn-ghost btn-sm" type="button" :disabled="desktopPackaged" @click="startAddTag">＋ 新增标签</button>
          <span class="list-meta">{{ filteredTags.length }} / {{ tags.length }} 个</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>分类</th><th>英文</th><th>中文</th><th>权重</th><th>使用</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-if="!filteredTags.length" class="table-state-row">
                <td colspan="7">
                  <ArchiveStatePanel compact kind="filtered" title="没有匹配的标签" message="调整筛选条件，或新建一个标签。" />
                </td>
              </tr>
              <tr v-for="t in pagedTags" :key="t.id">
                <td><code class="id-code">{{ t.id }}</code></td>
                <td>{{ t.cat }}</td>
                <td><span class="tag-chip" v-html="hl(t.en, tagSearchDebounced)"></span></td>
                <td>{{ t.cn }}</td>
                <td>{{ t.weight }}</td>
                <td>{{ tagUsage[t.en] || 0 }}</td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn-ghost btn-sm" type="button" :disabled="desktopPackaged" @click="startEditTag(t.id)">编辑</button>
                    <button class="btn btn-danger btn-sm" type="button" :disabled="desktopPackaged" @click="deleteTag(t.id)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="tagTotalPages > 1" class="pagination">
          <button class="btn btn-ghost btn-sm" :disabled="tagPage <= 1" @click="tagPage--">← 上一页</button>
          <span class="hint-sm">{{ tagPage }} / {{ tagTotalPages }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="tagPage >= tagTotalPages" @click="tagPage++">下一页 →</button>
        </div>
      </template>

      <!-- 样张管理 -->
      <template v-if="tab==='images'">
        <section class="home-hero-maintenance">
          <div class="toolbar">
            <strong>首页主视觉</strong>
            <span class="list-meta">当前首页右侧的宁宁 / 夏目两张图，可单独替换</span>
          </div>
          <p class="note">上传后会归一化为 JPEG 并写入本机 SceneShowcase；首页刷新后立即生效。点击“恢复内置图”可回退到项目自带版本。</p>
          <div class="image-grid home-hero-grid">
            <button v-for="hero in homeHeroes" :key="hero.id" class="sm-image-card" type="button" :class="{ active: selectedHeroId === hero.id }" @click="previewHero(hero)">
              <span class="sm-card-id">首页 · {{ hero.id }}</span>
              <span class="sm-card-title">{{ hero.title }}</span>
              <span class="sm-card-meta">{{ hero.updatedAt ? `已替换 ${hero.updatedAt}` : '使用内置图' }}</span>
            </button>
          </div>
          <div v-if="selectedHeroId" class="image-preview">
            <div class="image-preview-head">
              <strong>首页 · {{ selectedHeroTitle }}</strong>
              <span class="row-tight">
                <button class="btn btn-ghost btn-sm" type="button" :disabled="uploadBusy || desktopPackaged" @click="pickHero">上传 / 替换</button>
                <button class="btn btn-ghost btn-sm" type="button" :disabled="uploadBusy || desktopPackaged" @click="resetHero">恢复内置图</button>
                <button class="btn btn-ghost btn-sm" type="button" @click="selectedHeroId = ''">关闭</button>
              </span>
            </div>
            <img class="image-preview-img home-hero-preview" :src="heroUrl" :alt="selectedHeroTitle" />
            <input ref="heroFileEl" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp" @change="onHeroPicked" />
            <p class="image-feedback" :class="{ err: showcaseError }">{{ showcaseFeedback }}</p>
          </div>
        </section>
        <div class="toolbar">
          <input v-model="imageSearch" class="search-input" type="search" placeholder="搜索场景/蓝图 ID、标题、角色…" />
          <select v-model="imageTypeFilter" class="filter-select">
            <option value="all">全部样张 ({{ allShowcaseItems.length }})</option>
            <option value="scene">经典主线场景 ({{ scenes.length }})</option>
            <option value="popular">热门角色蓝图 ({{ allShowcaseItems.length - scenes.length }})</option>
          </select>
          <span class="list-meta">{{ filteredImageScenes.length }} 个场景/蓝图</span>
        </div>
        <p class="note">点选任意主线场景或热门角色蓝图查看当前样张，支持直接上传替换。图片会自动归一化为标准 JPEG 并更新官方 Manifest，刷新后即时生效。</p>
        <div class="image-grid">
          <button
            v-for="s in pagedImageScenes" :key="s.id"
            class="sm-image-card" type="button"
            :class="{ active: selectedImageId === s.id }"
            @click="previewImage(s)"
          >
            <img :src="`/scene-showcase/thumbs/${encodeURIComponent(s.id)}.jpg?v=${showcaseVersion}`" loading="lazy" class="sm-card-thumb" @error="onThumbError" alt="" />
            <span class="sm-card-id">{{ s.id }}</span>
            <span class="sm-card-title">{{ s.title }}</span>
            <span class="sm-card-meta">{{ charLabel(s.char) }} · {{ s.rating || 'All' }}</span>
          </button>
        </div>
        <div v-if="imageTotalPages > 1" class="pagination">
          <button class="btn btn-ghost btn-sm" :disabled="imagePage <= 1" @click="imagePage--">← 上一页</button>
          <span class="hint-sm">{{ imagePage }} / {{ imageTotalPages }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="imagePage >= imageTotalPages" @click="imagePage++">下一页 →</button>
        </div>

        <div v-if="selectedImageId" class="image-preview">
          <div class="image-preview-head">
            <strong>{{ selectedImageId }} · {{ selectedImageTitle }}</strong>
            <span class="row-tight">
              <button class="btn btn-ghost btn-sm" type="button" :disabled="uploadBusy || desktopPackaged" @click="pickShowcase">上传 / 替换样张</button>
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
        <ArchiveStatePanel
          v-if="!dupGroups.length"
          compact
          :kind="dupChecked ? 'success' : 'empty'"
          :title="dupChecked ? '未发现明显重复' : '尚未开始检测'"
          :message="dupChecked ? '当前场景库没有命中三条以上的重复关键词。' : '按关键词分组，快速定位可合并或下架的冗余场景。'"
        />
        <div v-for="g in dupGroups" :key="g.keyword" class="dup-group">
          <h4>「{{ g.keyword }}」· {{ g.scenes.length }} 个场景</h4>
          <div v-for="s in g.scenes" :key="s.id" class="dup-item">
            <span>
              <strong>{{ s.id }}</strong> {{ s.title }}
              <span class="rating-badge" :class="'rating-' + (s.rating || 'All')">{{ s.rating || 'All' }}</span>
            </span>
            <div class="action-btns">
              <button class="btn btn-ghost btn-sm" type="button" :disabled="desktopPackaged" @click="openEditModal(s.id)">编辑</button>
              <button class="btn btn-danger btn-sm" type="button" :disabled="desktopPackaged" @click="deleteSceneFromDup(s.id)">下架</button>
            </div>
          </div>
        </div>
      </template>

      <!-- 导入 -->
      <template v-if="tab==='import'">
        <p class="note">粘贴单个或多个场景 JSON（数组或对象），校验后加入列表。记得保存到项目。</p>
        <textarea v-model="importInput" class="import-input" rows="10" placeholder='[{ "id":"sc999", "title":"…", "story":"…", "char":"nene" }]'></textarea>
        <div class="import-actions">
          <button class="btn btn-primary" type="button" :disabled="desktopPackaged" @click="importScenes">校验并导入</button>
          <button class="btn btn-ghost" type="button" @click="importInput=''; importResult=''">清空</button>
        </div>
        <div v-if="importResult" class="import-result" v-html="importResult"></div>
      </template>

      <!-- 维护工具 -->
      <template v-if="tab==='tools'">
        <div class="tool-grid">
          <button v-for="t in TOOLS" :key="t.id" class="sm-tool-card" type="button" :disabled="toolRunning || desktopPackaged" :title="desktopPackaged ? '桌面应用模式不支持维护任务' : ''" @click="runTool(t.id)">
            <div class="sm-tool-icon"><ArchiveIcon :name="t.iconName" /></div>
            <div class="sm-tool-label">{{ t.label }}</div>
            <div class="sm-tool-desc">{{ t.desc }}</div>
          </button>
        </div>
        <div v-if="toolResult" class="tool-result-panel">
          <div class="tool-result-head">
            <strong>{{ toolResultTitle }}</strong>
            <span class="badge" :class="toolResult.ok ? 'badge-success' : 'badge-danger'">{{ toolResult.ok ? '通过' : '有问题' }}</span>
            <span v-if="!toolResult.ok" class="tool-error-hint">可按上方高亮的 scXXX 定位失败场景</span>
          </div>
          <pre class="tool-output" v-html="highlightedOutput"></pre>
        </div>
        <section class="backup-history">
          <div class="backup-history-head">
            <strong>备份历史</strong>
            <button class="btn btn-ghost btn-sm" type="button" :disabled="backupsLoading" @click="loadBackups">{{ backupsLoading ? '读取中…' : '查看备份历史' }}</button>
          </div>
          <p class="note">展示最近 50 份维护备份（按创建时间倒序），只读清单，便于核对保存前后的备份编号。</p>
          <p v-if="backupsError" class="form-hint" role="alert">{{ backupsError }}</p>
          <template v-if="backupsExpanded">
            <ArchiveStatePanel v-if="!backups.length && !backupsError" compact kind="empty" title="暂无备份" message="尚未产生任何维护备份，保存一次场景内容后会自动创建。" />
            <ul v-else-if="backups.length" class="backup-list">
              <li v-for="b in backups" :key="b.id" class="backup-item">
                <code class="id-code">{{ b.id }}</code>
                <span class="backup-label">{{ b.label || '—' }}</span>
                <span class="backup-meta">{{ formatBackupTime(b.createdAt) }} · {{ b.fileCount }} 文件</span>
              </li>
            </ul>
          </template>
        </section>
      </template>
    </template>

    <!-- 编辑 Modal -->
    <Teleport to="body">
      <Transition name="layer-pop">
      <div v-if="editing" class="overlay" @click.self="closeModal">
        <div
          ref="modalEl"
          class="modal-card modal-card-wide"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scene-editor-title"
        >
          <h2 id="scene-editor-title">{{ editingId ? '编辑场景 · ' + editing.id : '新增场景' }}</h2>
          <fieldset class="form-section">
            <legend class="form-legend">基础信息</legend>
            <div class="form-grid">
              <label class="form-group"><span class="field-label">ID</span><input v-model="editing.id" class="input" :disabled="!!editingId || desktopPackaged" placeholder="sc001" /></label>
              <label class="form-group"><span class="field-label">标题 *</span><input v-model="editing.title" class="input" :disabled="desktopPackaged" required :aria-invalid="!editing.title.trim() && triedSave" :class="{invalid: !editing.title.trim() && triedSave}" /></label>
              <label class="form-group"><span class="field-label">分类</span><input v-model="editing.category" class="input" :disabled="desktopPackaged" placeholder="恋爱 / 日常 / 校园…" /></label>
              <label class="form-group">
                <span class="field-label">角色</span>
                <select v-model="editing.char" class="filter-select" :disabled="desktopPackaged" @change="updateCharacterDefaults">
                  <option value="nene">宁宁</option><option value="natsume">夏目</option><option value="triad">双人</option>
                </select>
              </label>
              <label class="form-group"><span class="field-label">LoRA</span><input v-model="editing.lora" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group">
                <span class="field-label">分级</span>
                <select v-model="editing.rating" class="filter-select" :disabled="desktopPackaged">
                  <option value="All">All</option><option value="R15">R15</option><option value="R18">R18</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset class="form-section">
            <legend class="form-legend">叙事信息</legend>
            <div class="form-grid">
              <label class="form-group form-group-full"><span class="field-label">故事 *</span><textarea v-model="editing.story" class="input" :disabled="desktopPackaged" rows="3" required :aria-invalid="!editing.story.trim() && triedSave" :class="{invalid: !editing.story.trim() && triedSave}"></textarea></label>
              <label class="form-group form-group-full"><span class="field-label">故事日文</span><textarea v-model="editing.storyJa" class="input" :disabled="desktopPackaged" rows="2"></textarea></label>
              <label class="form-group"><span class="field-label">地点</span><input v-model="editing.location" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">天气</span><input v-model="editing.weather" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">镜头</span><input v-model="editing.camera" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">光照</span><input v-model="editing.lighting" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">季节</span><input v-model="editing.season" class="input" :disabled="desktopPackaged" placeholder="春/夏/秋/冬/不限" /></label>
              <label class="form-group"><span class="field-label">时段</span><input v-model="editing.time" class="input" :disabled="desktopPackaged" placeholder="清晨/白天/黄昏/深夜" /></label>
              <label class="form-group"><span class="field-label">timeOfDay</span><input v-model="editing.timeOfDay" class="input" :disabled="desktopPackaged" placeholder="morning/noon/late_night" /></label>
            </div>
          </fieldset>

          <fieldset class="form-section">
            <legend class="form-legend">视觉标签</legend>
            <div class="form-grid">
              <label class="form-group form-group-full"><span class="field-label">标签（逗号分隔）</span><input v-model="tagsInput" class="input" :disabled="desktopPackaged" placeholder="silk, looking_back,…" /></label>
              <label class="form-group form-group-full"><span class="field-label">用途（逗号分隔）</span><input v-model="usageInput" class="input" :disabled="desktopPackaged" placeholder="壁纸, 表情包" /></label>
              <label class="form-group form-group-full"><span class="field-label">画面提示词</span><textarea v-model="editing.prompt" class="input" :disabled="desktopPackaged" rows="2"></textarea></label>
              <label class="form-group form-group-full"><span class="field-label">负面提示词</span><textarea v-model="editing.negative" class="input input-mono" :disabled="desktopPackaged" rows="2"></textarea></label>
              <label class="form-group"><span class="field-label">情绪</span><input v-model="editing.emotion" class="input" :disabled="desktopPackaged" /></label>
            </div>
          </fieldset>

          <fieldset class="form-section">
            <legend class="form-legend">策展信息</legend>
            <div class="form-grid">
              <label class="form-group">
                <span class="field-label">策展层级</span>
                <select v-model="curationTierValue" class="filter-select" :disabled="desktopPackaged" @change="onCurationTierChange">
                  <option value="normal">普通</option><option value="review">待审</option><option value="curated">精选</option><option value="signature">招牌</option>
                </select>
              </label>
              <label class="form-group form-group-full"><span class="field-label">推荐理由（招牌必填）</span><input v-model="curationReason" class="input" :disabled="desktopPackaged || curationTierValue==='normal'||curationTierValue==='review'" :aria-invalid="curationTierValue==='signature' && !curationReason.trim() && triedSave" :class="{invalid: curationTierValue==='signature' && !curationReason.trim() && triedSave}" /></label>
            </div>
          </fieldset>
          <p v-if="formHint" id="scene-form-hint" class="form-hint" role="alert">{{ formHint }}</p>
          <div class="modal-actions">
            <button class="btn btn-primary" type="button" @click="saveScene">保存</button>
            <button class="btn btn-ghost" type="button" @click="copyJson">复制 JSON</button>
            <button class="btn btn-ghost" type="button" @click="closeModal">取消</button>
          </div>
          <p class="note-sm">注意：修改仅在内存中生效，需点"保存到项目"写回 data/scenes.json</p>
        </div>
      </div>
      </Transition>
    </Teleport>

    <!-- 蓝图编辑 Modal -->
    <Teleport to="body">
      <Transition name="layer-pop">
      <div v-if="bpEditing" class="overlay" @click.self="closeBlueprintModal">
        <div
          ref="bpModalEl"
          class="modal-card modal-card-wide"
          role="dialog"
          aria-modal="true"
          aria-labelledby="blueprint-editor-title"
        >
          <h2 id="blueprint-editor-title">{{ bpEditingId ? '编辑蓝图 · ' + bpEditing.id : '新增蓝图' }}</h2>
          <fieldset class="form-section">
            <legend class="form-legend">基础信息</legend>
            <div class="form-grid">
              <label class="form-group"><span class="field-label">ID *</span><input v-model="bpEditing.id" class="input" :disabled="!!bpEditingId || desktopPackaged" placeholder="bp_001 / character_scene" /></label>
              <label class="form-group"><span class="field-label">标题 *</span><input v-model="bpEditing.title" class="input" :disabled="desktopPackaged" required :aria-invalid="!bpEditing.title.trim() && bpTriedSave" :class="{invalid: !bpEditing.title.trim() && bpTriedSave}" /></label>
              <label class="form-group"><span class="field-label">角色 *</span><input v-model="bpEditing.characterId" class="input" :disabled="desktopPackaged" required :aria-invalid="!bpEditing.characterId?.trim() && bpTriedSave" :class="{invalid: !bpEditing.characterId?.trim() && bpTriedSave}" placeholder="raiden_shogun / nene" /></label>
              <label class="form-group"><span class="field-label">分类</span><input v-model="bpEditing.category" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">服装 outfitId</span><input v-model="bpEditing.outfitId" class="input" :disabled="desktopPackaged" placeholder="default / school / witch…" /></label>
              <label class="form-group">
                <span class="field-label">样张定级</span>
                <select v-model="bpEditing.sampleRating" class="filter-select" :disabled="desktopPackaged">
                  <option value="All">All</option><option value="R15">R15</option><option value="R18">R18</option>
                </select>
              </label>
              <label class="form-group form-check"><input v-model="bpEditing.adult" type="checkbox" :disabled="desktopPackaged" /><span>成人蓝图（adult）</span></label>
              <label class="form-group form-group-full"><span class="field-label">描述</span><textarea v-model="bpEditing.description" class="input" :disabled="desktopPackaged" rows="2"></textarea></label>
            </div>
          </fieldset>

          <fieldset class="form-section">
            <legend class="form-legend">场景要素</legend>
            <div class="form-grid">
              <label class="form-group"><span class="field-label">地点</span><input v-model="bpEditing.location" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">动作</span><input v-model="bpEditing.action" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">时段</span><input v-model="bpEditing.timeOfDay" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">光照</span><input v-model="bpEditing.lighting" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">镜头</span><input v-model="bpEditing.camera" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">情绪</span><input v-model="bpEditing.mood" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group form-group-full"><span class="field-label">场景标签（逗号分隔）</span><input v-model="bpSceneTagsInput" class="input" :disabled="desktopPackaged" placeholder="inazuma, shoji, night…" /></label>
              <label class="form-group form-group-full"><span class="field-label">推荐尺寸</span><input v-model="bpEditing.recommendedSize" class="input" :disabled="desktopPackaged" placeholder="832x1216 / 1024x1024" /></label>
            </div>
          </fieldset>

          <fieldset class="form-section">
            <legend class="form-legend">Prompt 数据（核心）</legend>
            <div class="form-grid">
              <label class="form-group form-group-full"><span class="field-label">Krea 散文 promptProse</span><textarea v-model="bpEditing.promptProse" class="input" :disabled="desktopPackaged" rows="4"></textarea></label>
              <label class="form-group form-group-full"><span class="field-label">Anima 标签 promptTokens（逗号分隔）*</span><textarea v-model="bpPromptTokensInput" class="input input-mono" :disabled="desktopPackaged" rows="3" required></textarea></label>
              <label class="form-group form-group-full"><span class="field-label">负面 negativeTokens（逗号分隔）*</span><textarea v-model="bpNegativeTokensInput" class="input input-mono" :disabled="desktopPackaged" rows="3" required></textarea></label>
            </div>
          </fieldset>

          <fieldset class="form-section">
            <legend class="form-legend">风格 / 成人扩展</legend>
            <div class="form-grid">
              <label class="form-group"><span class="field-label">Krea 风格 hint</span><input v-model="bpEditing.kreaStyleHint" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group"><span class="field-label">Anima 风格 hint</span><input v-model="bpEditing.animaStyleHint" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group form-group-full"><span class="field-label">成人画师提示</span><input v-model="bpEditing.adultArtistHint" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group form-group-full"><span class="field-label">NSFW 标签（逗号分隔）</span><input v-model="bpNsfwTokensInput" class="input" :disabled="desktopPackaged" /></label>
              <label class="form-group form-group-full"><span class="field-label">NSFW 散文</span><textarea v-model="bpEditing.nsfwProse" class="input" :disabled="desktopPackaged" rows="2"></textarea></label>
              <label class="form-group form-group-full"><span class="field-label">验收覆盖 coverageTags（逗号分隔）</span><input v-model="bpCoverageTagsInput" class="input" :disabled="desktopPackaged" placeholder="iconic, daily, special_nsfw" /></label>
            </div>
          </fieldset>

          <p v-if="bpFormHint" class="form-hint" role="alert">{{ bpFormHint }}</p>
          <div class="modal-actions">
            <button class="btn btn-primary" type="button" @click="saveBlueprint">保存</button>
            <button class="btn btn-ghost" type="button" @click="copyBlueprintJson">复制 JSON</button>
            <button class="btn btn-ghost" type="button" @click="closeBlueprintModal">取消</button>
          </div>
          <p class="note-sm">注意：修改仅在内存中生效，需点“保存到项目”写回 data/scene-blueprints.json</p>
        </div>
      </div>
      </Transition>
    </Teleport>

    <!-- 标签表单 Modal -->
    <Teleport to="body">
      <Transition name="layer-pop">
      <div v-if="tagModalOpen" class="overlay" @click.self="closeTagModal">
        <div
          ref="tagModalEl"
          class="modal-card modal-card-tag"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="tagEditing ? 'tag-editor-title-edit' : 'tag-editor-title-add'"
        >
          <h2 :id="tagEditing ? 'tag-editor-title-edit' : 'tag-editor-title-add'">{{ tagEditing ? '编辑标签 · ' + tagEditing.id : '新增标签' }}</h2>
          <div class="form-grid form-grid-single">
            <label class="form-group">
              <span class="field-label">英文名 *</span>
              <input v-model="tagForm.en" class="input" :disabled="desktopPackaged" placeholder="Danbooru 格式，用下划线" />
            </label>
            <label class="form-group">
              <span class="field-label">中文名 *</span>
              <input v-model="tagForm.cn" class="input" :disabled="desktopPackaged" placeholder="标签中文名" />
            </label>
            <label class="form-group">
              <span class="field-label">分类 *</span>
              <select v-model="tagForm.cat" class="filter-select" :disabled="desktopPackaged">
                <option v-for="c in tagCats" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
            <label class="form-group">
              <span class="field-label">权重 * (0–2)</span>
              <input v-model.number="tagForm.weight" class="input" :disabled="desktopPackaged" type="number" :min="0" :max="2" :step="0.1" />
            </label>
          </div>
          <p v-if="tagFormError" class="form-hint" role="alert">{{ tagFormError }}</p>
          <div class="modal-actions">
            <button class="btn btn-primary" type="button" @click="submitTag">{{ tagEditing ? '保存' : '新增' }}</button>
            <button class="btn btn-ghost" type="button" @click="closeTagModal">取消</button>
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useSceneStore } from '@/stores/sceneStore'
// 场景编辑器的领域模型契约。原先整块是 any[] / any —— 这个视图会全量覆盖写回
// data/scenes/*.json，字段拼错或丢字段等于静默删数据。
import type {
  SceneDraft, TagRecord, CurationData, CurationTier,
} from '@/types/api'
import type { SceneBlueprint } from '@/utils/popularContent'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useSceneShowcaseUpload } from '@/composables/scene/useSceneShowcaseUpload'
import { useSceneTagManager } from '@/composables/scene/useSceneTagManager'
import { useSceneEditorModal } from '@/composables/scene/useSceneEditorModal'
import { useSceneImportExport } from '@/composables/scene/useSceneImportExport'
import { useSceneMaintenance } from '@/composables/scene/useSceneMaintenance'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { confirmAction } from '@/composables/useConfirm'

const sceneStore = useSceneStore()

/** 场景编辑器是破坏性弹层，必须有焦点陷阱 + Escape（原先只有 @click.self） */
const modalEl = ref<HTMLElement | null>(null)
/** 蓝图编辑器同样需要焦点陷阱 + Escape */
const bpModalEl = ref<HTMLElement | null>(null)

const TABS = [
  { id:'scenes',     label:'场景库' },
  { id:'blueprints', label:'蓝图库' },
  { id:'tags',       label:'标签库' },
  { id:'images',     label:'样张' },
  { id:'duplicates', label:'重复检测' },
  { id:'import',     label:'导入' },
  { id:'tools',      label:'维护工具' },
]

const DUP_KEYWORDS = ['吊带','丝绸','围裙','泳衣','温泉','旗袍','毛衣','衬衫','图书馆','天台','烟花','神社','巫女','咖啡','卧室','寝室','影音室','休息室','后厨','厨房','吧台','晚礼服','魔女','洛丽塔','浴衣','和服','赛车','冰箱','冷藏','露台','阳台','泳池','书房','试衣']
const PAGE_SIZE = 30

const scenes = ref<SceneDraft[]>([])
const blueprints = ref<SceneBlueprint[]>([])
const tags = ref<TagRecord[]>([])
const curation = ref<CurationData>({})
/** 脏标记与维护提示为跨簇共享通道（编辑/导入/标签/策展 → 保存/离开守卫）。 */
const dirty = ref(false)
const maintenanceHint = ref('所有改动已同步')
const loading = ref(true)
const loadError = ref('')
const tab = ref('scenes')
const search = ref(''); const searchDebounced = ref(''); let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, (v) => { if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(() => { searchDebounced.value = v }, 250) })
const fCat = ref(''); const fChar = ref(''); const fRating = ref('')
const sortBy = ref('id'); const page = ref(1)

// ── 热门角色蓝图编辑状态 ────────────────────────────────────────────────
const bpSearch = ref(''); const bpSearchDebounced = ref(''); let bpSearchTimer: ReturnType<typeof setTimeout> | null = null
watch(bpSearch, (v) => { if (bpSearchTimer) clearTimeout(bpSearchTimer); bpSearchTimer = setTimeout(() => { bpSearchDebounced.value = v }, 250) })
const bpChar = ref(''); const bpCat = ref(''); const bpAdult = ref('')
const bpPage = ref(1)
const bpEditing = ref<SceneBlueprint | null>(null)
const bpEditingId = ref('')
const bpTriedSave = ref(false)
const bpFormHint = ref('')
const bpSnapshot = ref('')
const bpSceneTagsInput = ref('')
const bpPromptTokensInput = ref('')
const bpNegativeTokensInput = ref('')
const bpNsfwTokensInput = ref('')
const bpCoverageTagsInput = ref('')

// 标签库 CRUD（改名级联、使用频次、筛选分页）
const tagManager = useSceneTagManager({ tags, scenes, markDirty })
const {
  tagSearch, tagSearchDebounced, tagCatFilter, tagPage, tagUsage, tagCats, filteredTags, tagTotalPages, pagedTags,
  deleteTag,
  tagModalOpen, tagEditing, tagForm, tagFormError,
  startAddTag, startEditTag, closeTagModal, submitTag,
} = tagManager
const tagModalEl = ref<HTMLElement | null>(null)
useFocusTrap(tagModalEl, () => tagModalOpen.value, { onEscape: closeTagModal })

// 样张与首页主视觉上传（预览、JPEG 归一化、上传/恢复生命周期）
const showcase = useSceneShowcaseUpload({
  scenes,
  blueprints: computed(() => sceneStore.sceneBlueprints),
  errorMessage,
})
const {
  imageSearch, imageSearchDebounced, imagePage, imageTypeFilter, selectedImageId, selectedImageTitle,
  showcaseFeedback, showcaseError, showcaseVersion, uploadBusy,
  showcaseFileEl, heroFileEl, selectedHeroId, selectedHeroTitle, homeHeroVersion, homeHeroes,
  allShowcaseItems, filteredImageScenes, imageTotalPages, pagedImageScenes, showcaseUrl, heroUrl,
  previewImage, onShowcaseMissing, pickShowcase, previewHero, pickHero,
  loadHomeHeroes, resetHero, onShowcasePicked, onHeroPicked,
} = showcase

// ── 场景编辑弹层 + CRUD + 策展（已下沉 useSceneEditorModal）───────────────
const {
  editing,
  editingId,
  curationTierValue,
  curationReason,
  tagsInput,
  usageInput,
  triedSave,
  formHint,
  curationTier,
  updateCharacterDefaults,
  onCurationTierChange,
  openAddModal,
  openEditModal,
  closeModal,
  saveScene,
  deleteScene,
  duplicateScene,
  copyJson,
} = useSceneEditorModal({ scenes, curation, markDirty })

// ── 导入 / 导出（已下沉 useSceneImportExport）─────────────────────────────
const { importInput, importResult, importScenes, exportJSON } = useSceneImportExport({
  scenes,
  tags,
  curation,
  markDirty,
  esc,
  errorMessage,
})

// ── 维护任务：落盘/工具/备份/桌面只读探测（已下沉 useSceneMaintenance）────
const {
  TOOLS,
  saving,
  savingPhase,
  toolRunning,
  toolResult,
  toolResultTitle,
  backups,
  backupsLoading,
  backupsError,
  backupsExpanded,
  desktopPackaged,
  saveToProject,
  runTool,
  loadBackups,
  formatBackupTime,
  highlightedOutput,
} = useSceneMaintenance({
  scenes,
  tags,
  curation,
  blueprints,
  dirty,
  maintenanceHint,
  invalidateSceneCache: () => { sceneStore.loaded = false },
})

const categories = computed(() => [...new Set(scenes.value.map(s => s.category))].sort())
const bpCategories = computed(() => [...new Set(blueprints.value.map(b => b.category).filter(Boolean))].sort())
const bpCharacters = computed(() => [...new Set(blueprints.value.map(b => b.characterId).filter(Boolean))].sort())
const filteredBlueprints = computed(() => {
  const needle = bpSearchDebounced.value.trim().toLowerCase()
  return blueprints.value.filter(b => {
    if (bpChar.value && b.characterId !== bpChar.value) return false
    if (bpCat.value && b.category !== bpCat.value) return false
    if (bpAdult.value === 'adult' && !b.adult) return false
    if (bpAdult.value === 'safe' && b.adult) return false
    if (!needle) return true
    return [
      b.id, b.title, b.characterId, b.category, b.description, b.location, b.action,
      ...(b.sceneTags || []), ...(b.promptTokens || []),
    ].join(' ').toLowerCase().includes(needle)
  })
})
const bpTotalPages = computed(() => Math.max(1, Math.ceil(filteredBlueprints.value.length / PAGE_SIZE)))
const pagedBlueprints = computed(() => {
  const start = (bpPage.value - 1) * PAGE_SIZE
  return filteredBlueprints.value.slice(start, start + PAGE_SIZE)
})

function blankBlueprint(): SceneBlueprint {
  return {
    id: '', title: '', category: '', description: '', characterId: '',
    location: '', action: '', timeOfDay: '', lighting: '', camera: '', mood: '',
    sceneTags: [], promptProse: '', promptTokens: [], negativeTokens: [],
    recommendedSize: '832x1216', adult: false,
    kreaStyleHint: '', animaStyleHint: '', adultArtistHint: '', sampleRating: 'All',
    nsfwTokens: [], nsfwProse: '', outfitId: '', coverageTags: [],
  }
}

function splitList(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function serializeBlueprintModal() {
  return JSON.stringify({
    ...bpEditing.value,
    bpSceneTagsInput: bpSceneTagsInput.value,
    bpPromptTokensInput: bpPromptTokensInput.value,
    bpNegativeTokensInput: bpNegativeTokensInput.value,
    bpNsfwTokensInput: bpNsfwTokensInput.value,
    bpCoverageTagsInput: bpCoverageTagsInput.value,
  })
}

function openBlueprintAddModal() {
  const max = blueprints.value.reduce((m, b) => Math.max(m, String(b.id || '').length), 0)
  bpEditing.value = blankBlueprint()
  bpEditing.value.id = 'bp_' + String(max + 1).padStart(3, '0')
  bpEditingId.value = ''
  bpSceneTagsInput.value = ''
  bpPromptTokensInput.value = ''
  bpNegativeTokensInput.value = ''
  bpNsfwTokensInput.value = ''
  bpCoverageTagsInput.value = ''
  bpTriedSave.value = false
  bpFormHint.value = ''
  bpSnapshot.value = serializeBlueprintModal()
}

function openBlueprintEditModal(id: string) {
  const source = blueprints.value.find(b => b.id === id)
  if (!source) return
  bpEditing.value = JSON.parse(JSON.stringify(source)) as SceneBlueprint
  bpEditingId.value = id
  bpSceneTagsInput.value = (source.sceneTags || []).join(', ')
  bpPromptTokensInput.value = (source.promptTokens || []).join(', ')
  bpNegativeTokensInput.value = (source.negativeTokens || []).join(', ')
  bpNsfwTokensInput.value = (source.nsfwTokens || []).join(', ')
  bpCoverageTagsInput.value = (source.coverageTags || []).join(', ')
  bpTriedSave.value = false
  bpFormHint.value = ''
  bpSnapshot.value = serializeBlueprintModal()
}

async function closeBlueprintModal() {
  if (bpEditing.value && bpSnapshot.value && serializeBlueprintModal() !== bpSnapshot.value) {
    if (!(await confirmAction('蓝图有未保存的修改，确定放弃？'))) return
  }
  bpEditing.value = null
  bpEditingId.value = ''
  bpSnapshot.value = ''
}

function saveBlueprint() {
  bpTriedSave.value = true
  const e = bpEditing.value
  if (!e) return
  if (!e.id.trim() || !e.title.trim() || !e.characterId?.trim()) {
    bpFormHint.value = '请补齐 ID、标题和角色'
    return
  }
  e.sceneTags = splitList(bpSceneTagsInput.value)
  e.promptTokens = splitList(bpPromptTokensInput.value)
  e.negativeTokens = splitList(bpNegativeTokensInput.value)
  e.nsfwTokens = splitList(bpNsfwTokensInput.value)
  e.coverageTags = splitList(bpCoverageTagsInput.value)
  if (!e.promptTokens.length || !e.negativeTokens.length) {
    bpFormHint.value = 'promptTokens 和 negativeTokens 至少各填一项'
    return
  }
  if (bpEditingId.value) {
    const idx = blueprints.value.findIndex(b => b.id === bpEditingId.value)
    if (idx >= 0) blueprints.value[idx] = JSON.parse(JSON.stringify(e)) as SceneBlueprint
  } else {
    if (blueprints.value.some(b => b.id === e.id)) { bpFormHint.value = 'ID 已存在：' + e.id; return }
    blueprints.value.push(JSON.parse(JSON.stringify(e)) as SceneBlueprint)
  }
  bpSnapshot.value = serializeBlueprintModal()
  closeBlueprintModal()
  markDirty('蓝图内容有修改，等待保存到项目')
}

async function deleteBlueprint(id: string) {
  if (!(await confirmAction('确认删除蓝图 ' + id + '？保存到项目后它将从 scene-blueprints.json 中移除。'))) return
  blueprints.value = blueprints.value.filter(b => b.id !== id)
  markDirty('有蓝图等待删除')
}

function duplicateBlueprint(id: string) {
  const source = blueprints.value.find(b => b.id === id)
  if (!source) return
  const copy = JSON.parse(JSON.stringify(source)) as SceneBlueprint
  copy.id = source.id + '_copy'
  copy.title = source.title + ' · 副本'
  blueprints.value.push(copy)
  markDirty('已复制蓝图，请编辑副本内容')
  openBlueprintEditModal(copy.id)
}

function copyBlueprintJson() {
  if (!bpEditing.value) return
  navigator.clipboard.writeText(JSON.stringify(bpEditing.value, null, 2))
}

const stats = computed(() => {
  const s = scenes.value
  return [
    { label:'总场景', value: s.length },
    { label:'宁宁',   value: s.filter((x) => x.char==='nene').length },
    { label:'夏目',   value: s.filter((x) => x.char==='natsume').length },
    { label:'双人',   value: s.filter((x) => x.char==='triad'||x.char==='both').length },
    { label:'All',    value: s.filter((x) => x.rating==='All').length },
    { label:'R15',    value: s.filter((x) => x.rating==='R15').length },
    { label:'R18',    value: s.filter((x) => x.rating==='R18').length },
    { label:'Tags',   value: tags.value.length },
  ]
})

function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function hl(text: string, query: string) {
  const t = String(text ?? '')
  const q = String(query ?? '').trim()
  if (!q) return esc(t)
  const re = new RegExp('(' + escapeRegExp(q) + ')', 'gi')
  return esc(t).replace(re, '<mark class="search-hl">$1</mark>')
}

const filtered = computed(() => {
  const q = searchDebounced.value.toLowerCase()
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

watch([searchDebounced, fCat, fChar, fRating, sortBy], () => { page.value = 1 })

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value-1)*PAGE_SIZE, page.value*PAGE_SIZE))

// ── 重复检测 ──────────────────────────────────────────────────────────────
const dupGroups = ref<Array<{ keyword: string; scenes: SceneDraft[] }>>([])
const dupResult = ref('')
const dupChecked = ref(false)

function detectDuplicates() {
  const groups: Array<{ keyword: string; scenes: SceneDraft[] }> = []
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

  function charIcon(v: string) { return v==='nene'?'宁':v==='natsume'?'夏':v==='triad'||v==='both'?'双':'—' }
function charLabel(v: string | undefined) { return v==='nene'?'宁宁':v==='natsume'?'夏目':v==='triad'||v==='both'?'双人':(v || '—') }
function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  const text = String(error ?? '').trim()
  return text || fallback
}
const TIER_LABELS: Record<CurationTier, string> = {
  signature: '招牌', curated: '精选', review: '待审', normal: '',
}
function tierLabel(v: string) { return TIER_LABELS[v as CurationTier] || '' }

function markDirty(message: string) {
  dirty.value = true
  maintenanceHint.value = message
}

useFocusTrap(modalEl, () => editing.value !== null, { onEscape: closeModal })
useFocusTrap(bpModalEl, () => bpEditing.value !== null, { onEscape: closeBlueprintModal })

function esc(s: string) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function onThumbError(e: Event) {
  const img = e.target as HTMLImageElement | null
  if (img) img.style.display = 'none'
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault(); e.returnValue = ''
}
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return confirmAction('场景修改尚未保存到项目，仍要离开吗？')
})
onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => { window.removeEventListener('beforeunload', onBeforeUnload) })

/**
 * 场景管理会写回 data/，所以用 reload() 强制绕过缓存拿落盘结果。
 * 以前用 `?v=' + Date.now()`，等于每次进页面都全量重传 230KB 且永不复用。
 */
async function loadFromStore(force = false) {
  loading.value = true
  try {
    await (force ? sceneStore.reload() : sceneStore.load())
    if (sceneStore.error) throw new Error(sceneStore.error)
    if (!Array.isArray(sceneStore.scenes)) throw new Error('scenes.json 格式错误')
    // 同样不能 structuredClone reactive proxy，数据源本身是 JSON。
    scenes.value = JSON.parse(JSON.stringify(sceneStore.scenes)) as SceneDraft[]
    blueprints.value = JSON.parse(JSON.stringify(sceneStore.sceneBlueprints)) as SceneBlueprint[]
    tags.value = JSON.parse(JSON.stringify(sceneStore.tags)) as TagRecord[]
    curation.value = JSON.parse(JSON.stringify(sceneStore.curation)) as CurationData
    loadError.value = ''
  } catch (err) {
    loadError.value = errorMessage(err, '场景数据加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // 首次进入拉最新落盘状态：编辑器要基于真实文件而不是别的页面留下的内存副本
  await loadFromStore(true)
  await loadHomeHeroes()
})
</script>

<style scoped>
/* 替代原先散落的 6 处内联 style */
.hint-sm { color:var(--text-muted); font-size:var(--fs-label-sm); }
.id-code { font-size:var(--fs-mono-xs); }
.sm-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--s-4); margin-bottom:var(--s-5); flex-wrap:wrap; }
.sm-head-actions { display:flex; gap:var(--s-2); flex-shrink:0; }
.maintenance-state { display:inline-flex; align-items:center; gap:var(--s-2); margin-top:var(--s-2); padding:4px 12px; border-radius:var(--r-pill); background:color-mix(in srgb,var(--success) 10%,transparent); color:var(--success-text); font-size:var(--fs-label-sm); }
.maintenance-state.dirty { background:color-mix(in srgb,var(--warning) 14%,transparent); color:var(--warning-text); }
.maintenance-state span { color:var(--text-muted); font-size:var(--fs-label-xs); }
.saving-phase { color:var(--text-muted); font-size:var(--fs-label-xs); }
.muted { color:var(--text-muted); }
.note { color:var(--text-secondary); font-size:var(--fs-body-sm); margin:0 0 var(--s-3); line-height:var(--lh-loose); }
.note-sm { color:var(--text-muted); font-size:var(--fs-label-xs); margin-top:var(--s-3); line-height:var(--lh-body); }

.toolbar { display:flex; gap:var(--s-2) var(--s-3); flex-wrap:wrap; align-items:center; margin-bottom:var(--s-4); padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:var(--bg-surface); }
.toolbar-primary { flex:1 1 100%; display:flex; gap:var(--s-2); }
.toolbar-filters { display:flex; gap:var(--s-2); flex-wrap:wrap; align-items:center; flex:1 1 auto; }
.search-input { flex:1 1 280px; min-width:200px; padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font-size:var(--fs-body); }
.search-input:focus { border-color:var(--accent); outline:none; }
.filter-select { padding:var(--s-1) var(--s-2); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font-size:var(--fs-body-sm); min-width:110px; flex:0 1 auto; }
.stats { display:flex; gap:var(--s-3); margin-bottom:var(--s-4); flex-wrap:wrap; align-items:stretch; }
.stat-group { display:flex; gap:var(--s-2); flex-wrap:wrap; align-items:stretch; padding:var(--s-1); border-radius:var(--r-md); }
.stat-group--overview { background:color-mix(in srgb,var(--accent) 6%,transparent); }
.stat-group--chars { background:color-mix(in srgb,var(--bg-elevated) 80%,transparent); }
.stat-group--rating { background:color-mix(in srgb,var(--bg-deep) 60%,transparent); }
.stat-group--tags { background:transparent; }
.stat-card { background:var(--bg-surface); border:1px solid var(--border-soft); border-radius:var(--r-md); padding:var(--s-3) var(--s-4); min-width:96px; text-align:center; }
.stat-card--accent { border-color:var(--accent); }
.stat-card--accent .stat-value { color:var(--accent); }
.stat-card--amber { border-color:var(--natsume-amber); }
.stat-card--amber .stat-value { color:var(--natsume-amber); }
.stat-card--muted .stat-value { color:var(--text-secondary); }
.stat-card--success { border-color:var(--success); }
.stat-card--success .stat-value { color:var(--success-text); }
.stat-card--warning { border-color:var(--warning); }
.stat-card--warning .stat-value { color:var(--warning-text); }
.stat-card--danger { border-color:var(--danger); }
.stat-card--danger .stat-value { color:var(--danger-text); }
.stat-value { font-size:var(--fs-title-xs); font-weight:800; color:var(--accent); }
.stat-label { font-size:var(--fs-label-xs); color:var(--text-muted); }
.tab-row { display:flex; gap:var(--s-2); margin-bottom:var(--s-4); flex-wrap:wrap; }
.tab-btn { padding:var(--s-2) var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-pill); background:transparent; color:var(--text-secondary); cursor:pointer; font:600 var(--fs-body-sm) var(--font-sans); transition:border-color var(--motion-hover),color var(--motion-hover),background var(--motion-hover),transform var(--motion-hover) var(--ease-out); }
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
.table-state-row > td { padding:0; }
.table-state-row .archive-state-panel { border:0; border-radius:0; box-shadow:none; }
.list-meta { margin-left:auto; color:var(--text-muted); font-size:var(--fs-label-sm); }
.pagination { display:flex; align-items:center; justify-content:center; gap:var(--s-3); margin-top:var(--s-3); }

.import-input { width:100%; min-height:200px; padding:var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font:400 var(--fs-label) var(--font-mono); line-height:var(--lh-body); resize:vertical; outline:none; }
.import-input:focus { border-color:var(--accent); }
.import-actions { display:flex; gap:var(--s-2); margin:var(--s-3) 0; }
.import-result { padding:var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-md); background:var(--bg-surface); font-size:var(--fs-label-sm); line-height:var(--lh-loose); }
.msg-ok { color:var(--success-text); margin:0 0 4px; } .msg-warn { color:var(--warning-text); margin:0 0 4px; } .msg-danger { color:var(--danger-text); margin:0 0 4px; }

.tool-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:var(--s-3); margin-bottom:var(--s-4); }
.sm-tool-card { display:flex; flex-direction:column; gap:var(--s-1); text-align:left; padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--bg-surface); cursor:pointer; transition:border-color var(--motion-hover),transform var(--motion-hover); }
.sm-tool-card:hover:not(:disabled) { border-color:var(--accent); }
/* 审计修复: 不用 opacity 压字 */
.sm-tool-card:disabled { color: var(--text-disabled); border-color: var(--border-soft); cursor:not-allowed; }
.sm-tool-icon { font-size:var(--fs-title); }
.sm-tool-label { font-weight:700; font-size:var(--fs-body); color:var(--text-primary); }
.sm-tool-desc { color:var(--text-muted); font-size:var(--fs-label-sm); line-height:var(--lh-body); }
.tool-result-panel { padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--bg-deep); }
.tool-result-head { display:flex; align-items:center; gap:var(--s-3); margin-bottom:var(--s-3); }
.tool-output { max-height:340px; overflow:auto; padding:var(--s-3); background:var(--bg-base); border:1px solid var(--border-soft); border-radius:var(--r-md); font:400 var(--fs-mono-xs)/1.7 var(--font-mono); color:var(--text-secondary); white-space:pre-wrap; word-break:break-word; }
.hl-id { color:var(--accent); font-weight:700; background:var(--accent-soft); padding:0 4px; border-radius:var(--r-xs); }
.tool-error-hint { color:var(--text-muted); font-size:var(--fs-label-xs); }
:deep(.hl-id) { color:var(--accent); font-weight:700; background:var(--accent-soft); padding:0 4px; border-radius:var(--r-xs); }

/* 样张管理 */
.image-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:var(--s-2); margin-bottom:var(--s-3); }
.sm-image-card { display:grid; gap:4px; text-align:left; padding:var(--s-2); border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--bg-surface); cursor:pointer; transition:border-color var(--motion-hover),transform var(--motion-hover); overflow:hidden; }
.sm-card-thumb { width:100%; aspect-ratio:16/10; object-fit:cover; border-radius:var(--r-md); border:1px solid var(--border-soft); background:var(--art-mat); display:block; }
.sm-image-card:hover { border-color:var(--accent); }
@media (hover: hover) and (pointer: fine) {
  .sm-tool-card:hover:not(:disabled),
  .sm-image-card:hover { transform:translateY(-2px); }
}
.sm-image-card.active { border-color:var(--accent); background:var(--accent-soft); }
.home-hero-maintenance { margin-bottom:var(--s-5); }
.home-hero-grid { grid-template-columns:repeat(2,minmax(180px,1fr)); margin-bottom:var(--s-3); }
.home-hero-preview { max-width:520px; }
.sm-card-id { color:var(--text-muted); font:650 var(--fs-mono-xs) var(--font-mono); }
.sm-card-title { color:var(--text-primary); font-size:var(--fs-label-sm); font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sm-card-meta { color:var(--text-muted); font-size:var(--fs-mono-xs); }
.image-preview { margin-top:var(--s-4); padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:var(--bg-surface); }
.image-preview-head { display:flex; align-items:center; justify-content:space-between; gap:var(--s-3); margin-bottom:var(--s-3); flex-wrap:wrap; }
.image-preview-img { display:block; width:100%; max-height:60vh; object-fit:contain; border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--art-mat); }
.image-feedback { margin:var(--s-2) 0 0; color:var(--text-muted); font-size:var(--fs-label-sm); line-height:var(--lh-body); }
.image-feedback.err { color:var(--warning-text); }
.row-tight { display:inline-flex; gap:var(--s-2); flex-wrap:wrap; }

/* 备份历史 */
.backup-history { margin-top:var(--s-5); padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:var(--bg-surface); }
.backup-history-head { display:flex; align-items:center; justify-content:space-between; gap:var(--s-3); margin-bottom:var(--s-2); flex-wrap:wrap; }
.backup-list { list-style:none; margin:0; padding:0; display:grid; gap:var(--s-2); }
.backup-item { display:flex; align-items:center; gap:var(--s-3); flex-wrap:wrap; padding:var(--s-2) var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-md); background:var(--bg-deep); }
.backup-label { color:var(--text-secondary); font-size:var(--fs-label-sm); }
.backup-meta { margin-left:auto; color:var(--text-muted); font-size:var(--fs-label-xs); }

/* 重复检测 */
.dup-group { margin-bottom:var(--s-4); padding:var(--s-4); border:1px solid var(--border-soft); border-radius:var(--r-xl); background:var(--bg-surface); }
.dup-group h4 { margin:0 0 var(--s-3); font-size:var(--fs-body); color:var(--text-primary); }
.dup-item { display:flex; align-items:center; justify-content:space-between; gap:var(--s-3); padding:var(--s-2) 0; border-top:1px solid var(--border-soft); flex-wrap:wrap; font-size:var(--fs-label-sm); }
.dup-item:first-of-type { border-top:0; }

.overlay { position:fixed; inset:0; z-index:var(--z-overlay); display:flex; align-items:center; justify-content:center; padding:var(--s-4); background:var(--art-backdrop); backdrop-filter:blur(6px); }
.modal-card-wide { width:min(820px,94vw); }
.modal-card-tag { width:min(480px,94vw); }
.form-grid-single { grid-template-columns:1fr; }
.modal-card { max-height:90vh; overflow-y:auto; padding:var(--s-6); border:1px solid var(--accent); border-radius:var(--r-xl); background:var(--bg-elevated); box-shadow:var(--shadow-lg); }
.modal-card h2 { margin-bottom:var(--s-4); font-size:var(--fs-title-sm); }
.form-section { border:1px solid var(--border-soft); border-radius:var(--r-lg); padding:var(--s-3); margin-bottom:var(--s-3); }
.form-legend { font-size:var(--fs-label-sm); font-weight:700; color:var(--text-secondary); padding:0 var(--s-2); }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:var(--s-3); margin-bottom:var(--s-3); }
.form-group { display:grid; gap:var(--s-1); }
.form-group-full { grid-column:1 / -1; }
.form-group { cursor:default; }
.field-label { font-size:var(--fs-label-sm); color:var(--text-muted); font-weight:600; }
.input { padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font:var(--fs-body)/1.5 var(--font-sans); outline:none; width:100%; resize:vertical; }
.input-mono { font-family:var(--font-mono); font-size:var(--fs-label); }
.input:focus { border-color:var(--accent); }
.input.invalid { border-color:var(--danger-text); box-shadow:0 0 0 2px color-mix(in srgb,var(--danger) 22%,transparent); }
.filter-select { padding:var(--s-2) var(--s-3); background:var(--bg-deep); border:1px solid var(--border-soft); border-radius:var(--r-md); color:var(--text-primary); font-size:var(--fs-body-sm); width:100%; }
.form-hint { color:var(--danger-text); font-size:var(--fs-label-sm); margin:0 0 var(--s-3); }
.form-check { display:flex; align-items:center; gap:var(--s-2); }
.modal-actions { display:flex; gap:var(--s-2); margin-top:var(--s-2); flex-wrap:wrap; }
.search-hl { background:color-mix(in srgb,var(--accent) 22%,transparent); color:var(--accent); padding:0 2px; border-radius:var(--r-xs); }
@media(max-width: 768px) { .form-grid { grid-template-columns:1fr; } .sm-head { flex-direction:column; } }
</style>
