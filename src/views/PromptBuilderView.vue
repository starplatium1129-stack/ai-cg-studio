<template>
  <article
    class="pb"
    :data-character="pb.char"
    :data-director-mode="pb.directorMode"
    :class="{
      'focus-mode': pb.focusMode,
      'step-4': Boolean(sd.resultUrl.value || sd.generating.value),
      'has-result': Boolean(sd.resultUrl.value),
    }"
  >
    <a @click.prevent="$router.push('/')" href="/" class="nav-back">← 回首页</a>

    <div class="pb-topline">
      <div class="pb-header">
        <div class="pb-kicker">Nene &amp; Natsume Private Atelier</div>
        <h1 class="pb-title">开始绘制</h1>
        <p class="pb-sub">选一个场景，定下情绪、镜头与光照；参数会自动备好，你只管出图。</p>
      </div>
      <div class="pb-top-actions">
        <button class="focus-mode-btn" type="button" aria-label="进入专注成片模式"
          :aria-pressed="pb.focusMode"
          @click="pb.focusMode = !pb.focusMode">
          <span class="focus-mode-label">{{ pb.focusMode ? '退出专注' : '专注成片' }}</span>
        </button>
        <div class="api-status">
          <span class="badge" :class="sd.online.value ? 'badge-online' : 'badge-offline'">
            {{ sd.online.value ? '✓ SD 已连接' : '正在连接 SD…' }}
          </span>
        </div>

        <!-- 数据工具 -->
        <details ref="utilityEl" class="utility-menu">
          <summary class="utility-trigger" aria-label="数据工具">···</summary>
          <div class="utility-popover">
            <div class="utility-label">本地数据</div>
            <div class="utility-actions">
              <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="backup.exportBackup()">
                ⬇️ 导出备份
              </button>
              <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="pickBackupFile">
                ⬆️ 从备份恢复
              </button>
              <input ref="backupFileEl" class="sr-only" type="file" accept="application/json" @change="onBackupFilePicked" />
            </div>
            <div class="utility-divider"></div>
            <div class="utility-label">存储维护</div>
            <div class="utility-actions">
              <button class="btn btn-ghost wide" type="button" @click="backup.healthCheck()">🩺 存储体检</button>
              <button class="btn btn-ghost wide" type="button" @click="backup.cleanOrphanImages()">🧹 清理孤儿图片</button>
            </div>
          </div>
        </details>
      </div>
    </div>

    <div class="setup-strip">
      <div class="guide-bar">{{ guideText }}</div>
      <div class="project-bar">
        <label>项目</label>
        <select v-model="pb.projectId">
          <option value="">（无项目）</option>
          <option v-for="p in pb.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
    </div>

    <div class="director-workspace">

      <!-- ─── 左栏：剧本 ──────────────────────────────────── -->
      <div class="director-col col-left">

        <!-- Story -->
        <div class="panel step-panel" id="stepStory">
          <div class="panel-title">故事 · Story</div>
          <textarea class="story-input" v-model="pb.story"
            placeholder="一句话描述脑海里的画面…"
            @input="onStoryInput"></textarea>
          <div v-if="pb.activeScene" class="scene-context">
            <span class="scene-context-title">{{ pb.activeScene.title }}</span>
            <button class="scene-context-detach" type="button" @click="pb.clearScene({ keepStory: true })">× 脱离</button>
          </div>
          <div class="story-chips">
            <button v-for="s in storyChips" :key="s" type="button" class="story-chip"
              @click="pb.setStory(s)">{{ s }}</button>
          </div>
        </div>

        <!-- Character -->
        <div class="panel step-panel" id="stepChar">
          <div class="panel-title">角色 · Character</div>
          <div class="char-row">
            <button v-for="c in charOptions" :key="c.id"
              class="char-btn" type="button"
              :class="{ active: pb.char === c.id }"
              :aria-pressed="pb.char === c.id"
              @click="pb.setChar(c.id as any)">{{ c.label }}</button>
          </div>
          <div class="traits-row">
            <button v-for="t in currentTraits" :key="t.tag"
              class="trait-chip"
              :class="{ active: pb.manualTags.has(t.tag) }"
              type="button"
              @click="pb.toggleManualTag(t.tag)">{{ t.icon }} {{ t.label }}</button>
          </div>
        </div>

        <!-- Scenes -->
        <div class="panel step-panel" id="stepScene">
          <div class="panel-title">Scene · <span class="scene-count-badge">{{ pb.filteredScenes.length }}</span></div>
          <div class="scene-search-wrap">
            <input type="search" class="scene-search" v-model="pb.sceneSearch"
              placeholder="试试：安静的夏目雨夜">
            <button class="scene-search-clear" type="button" aria-label="清空"
              @click="pb.sceneSearch = ''">×</button>
          </div>
          <div class="scene-filter-summary">
            <span class="scene-result-count" role="status" aria-live="polite">
              {{ pb.filteredScenes.length }} 个场景
            </span>
            <button class="scene-filter-reset" type="button" @click="pb.sceneSearch = ''; pb.sceneTheme = 'all'">重置筛选</button>
          </div>
          <div class="scene-filter-label">主题</div>
          <div class="scene-cats">
            <button v-for="t in SCENE_THEMES" :key="t.id"
              class="scene-cat-btn" type="button"
              :class="{ active: pb.sceneTheme === t.id }"
              @click="pb.sceneTheme = t.id">{{ t.icon }} {{ t.label }}</button>
          </div>
          <div class="scene-list">
            <div v-if="!pb.dataReady" class="scene-loading">正在加载场景库…</div>
            <div v-else-if="!pb.filteredScenes.length" class="scene-empty">未找到匹配场景</div>
            <button v-for="scene in visibleScenes" :key="scene.id"
              class="scene-card"
              :class="{ active: pb.sceneId === scene.id }"
              type="button"
              @click="selectScene(scene)">
              <div class="scene-card-title">{{ scene.title }}</div>
              <div v-if="scene.story" class="scene-card-story">{{ scene.story }}</div>
              <div class="scene-card-meta">
                <span v-if="scene.category" class="scene-cat-tag">{{ scene.category }}</span>
                <span v-if="scene.rating && scene.rating !== 'All'" class="scene-rating-tag">{{ scene.rating }}</span>
              </div>
            </button>
            <button v-if="pb.filteredScenes.length > sceneLimit" class="btn btn-ghost scene-more"
              type="button" @click="sceneLimit += 20">
              显示更多 ({{ pb.filteredScenes.length - sceneLimit }} 个)
            </button>
          </div>
        </div>

        <HistoryPanel
          :history="pb.history"
          @resume="resumeHistory"
          @duplicate="duplicateHistory"
          @delete="deleteHistory"
        />
      </div>

      <!-- ─── 中栏：监视器 ────────────────────────────────── -->
      <div class="director-col col-center">

        <!-- Stage placeholder -->
        <section
          v-show="!sd.resultUrl.value"
          class="stage-placeholder"
          :class="{ 'is-generating': sd.generating.value }"
          aria-label="成片监看区"
        >
          <div class="stage-chrome">
            <span>CANVAS</span>
            <span class="stage-ready">{{ sd.generating.value ? 'RENDERING' : 'READY' }}</span>
          </div>
          <img class="stage-muse nene" src="/assets/characters/nene-official.webp" alt="" aria-hidden="true" decoding="async">
          <img class="stage-muse natsume" src="/assets/characters/natsume-official.webp" alt="" aria-hidden="true" decoding="async">
          <div class="stage-message">
            <!-- 生成中：呼吸 + 进度，缓解等待焦虑 -->
            <div v-if="sd.generating.value" class="stage-generating-copy">
              <div class="stage-generating-title">正在绘制这一张</div>
              <div class="stage-generating-sub">{{ sd.statusText.value || '模型正在推理…' }} {{ sd.progress.value }}%</div>
              <div class="stage-progress-ring"><i :style="{ '--progress': sd.progress.value + '%' }"></i></div>
            </div>
            <div v-else class="stage-idle">
              <div class="stage-placeholder-title">成片将在这里出现</div>
              <div class="stage-quick-actions">
                <button class="btn btn-ghost" type="button"
                  @click="pb.sceneSearch = ''">
                  自己找场景
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Result image -->
        <div v-if="sd.resultUrl.value" class="result-image-wrap">
          <img class="result-image" :src="sd.resultUrl.value" alt="生成的图片" />
          <div class="result-image-actions">
            <button class="btn btn-ghost" type="button" @click="saveResult">保存快照</button>
            <button class="btn btn-ghost" type="button" @click="sd.clearResult()">清除</button>
          </div>
        </div>

        <!-- Prompt monitor -->
        <div class="monitor" id="promptMonitor">
          <div class="panel-title">
            Prompt 实时预览
            <span v-if="modelProfile" class="monitor-profile">{{ modelProfile.name }}</span>
          </div>
          <div class="preview-output">{{ previewPrompt || '选择左侧场景或调整右侧画面选项，提示词会在这里实时生成。' }}</div>

          <div class="token-row">
            <span class="token-counter" :class="promptReport.level" :title="promptReport.warnings.join(' · ')">
              <span class="bar"><i :style="{ '--progress': Math.min(100, Math.round(promptReport.positiveCount / 72 * 100)) + '%' }"></i></span>
              <span class="num">{{ promptReport.positiveCount }}</span>
              <span class="muted">正向 /</span>
              <span class="neg-num">{{ promptReport.negativeCount }}</span>
              <span class="muted">负向</span>
              <span class="prompt-health">{{ promptReport.label }}</span>
            </span>
            <span v-if="loraSpecs.length" class="lora-hint">
              LoRA {{ loraSpecs.map(s => s.name + ':' + s.weight).join(' · ') }}
            </span>
          </div>

          <div class="art-warn" :hidden="!artViolations.length">
            ⚠️ 检测到 {{ artViolations.length }} 个违反美术规范的标签：{{ artViolations.join(', ') }}
          </div>

          <div class="preview-actions">
            <button class="btn btn-primary" type="button" @click="copyPrompt">复制</button>
            <button class="btn btn-ghost" type="button" @click="saveHistory">保存</button>
          </div>
        </div>

        <!-- SD params -->
        <details class="panel generation-settings">
          <summary class="panel-title settings-summary">出图参数</summary>
          <div class="controls-grid">
            <div class="ctrl"><label>CFG</label>
              <select v-model.number="pb.sdParams.cfg" @change="pb.markParamTouched('cfg')">
                <option v-for="v in [3,4,4.5,5,5.5,6,7,8]" :key="v" :value="v">{{ v }}</option>
              </select>
            </div>
            <div class="ctrl"><label>Steps</label>
              <select v-model.number="pb.sdParams.steps" @change="pb.markParamTouched('steps')">
                <option v-for="v in [20,28,30,35,40,50]" :key="v" :value="v">{{ v }}</option>
              </select>
            </div>
            <div class="ctrl ctrl-full"><label>SD 模型</label>
              <select v-model="pb.sdModelName">
                <option value="">使用 WebUI 当前模型</option>
                <option v-for="m in sd.models.value" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div class="ctrl"><label>Sampler</label>
              <select v-model="pb.sdParams.sampler" @change="pb.markParamTouched('sampler')">
                <option v-for="s in (sd.samplers.value.length ? sd.samplers.value : ['Euler a','Euler','DPM++ 2M','DPM++ 2M SDE'])" :key="s">{{ s }}</option>
              </select>
            </div>
            <div class="ctrl"><label>Scheduler</label>
              <select v-model="pb.sdParams.scheduler" @change="pb.markParamTouched('scheduler')">
                <option value="">自动</option>
                <option v-for="s in (sd.schedulers.value.length ? sd.schedulers.value : ['Karras','Exponential'])" :key="s">{{ s }}</option>
              </select>
            </div>
            <div class="ctrl toggle-row">
              <label class="switch"><input type="checkbox" v-model="pb.sdParams.quality"><span class="slider"></span></label>
              <label>质量前缀</label>
            </div>
            <div class="ctrl toggle-row">
              <label class="switch"><input type="checkbox" v-model="pb.sdParams.negative"><span class="slider"></span></label>
              <label>负面</label>
            </div>
            <div class="ctrl ctrl-seed">
              <label class="seed-lock-label">
                <input type="checkbox" v-model="pb.sdParams.seedLock"> 锁定 seed
              </label>
              <div class="seed-input-wrap">
                <input type="number" v-model.number="pb.sdParams.seed" min="-1" step="1" placeholder="-1">
                <button class="btn btn-ghost btn-mini" type="button" :disabled="!sd.resultSeed.value" @click="reuseLastSeed">复用</button>
              </div>
              <small class="ctrl-hint">{{ pb.sdParams.seedLock ? '将复用固定 seed' : '不锁定时使用随机 seed' }}</small>
            </div>
            <div v-if="pb.sdParams.negative" class="ctrl ctrl-full negative-editor">
              <label>负面提示词</label>
              <textarea v-model="pb.sdParams.negativeCustom" placeholder="留空使用默认负面；可追加如：extra fingers, bad anatomy"></textarea>
            </div>
          </div>
        </details>

        <!-- Result panel -->
        <div class="result-frame step-panel" id="stepResult">
          <div class="panel-title">输出 Result</div>

          <div class="sd-inline-options">
            <label>尺寸<select v-model="sdSize">
              <optgroup label="竖图 Portrait">
                <option value="768x1344">768×1344</option>
                <option value="832x1216">832×1216</option>
                <option value="896x1344">896×1344</option>
                <option value="1024x1344">1024×1344 · WAI 推荐</option>
                <option value="1024x1536">1024×1536</option>
                <option value="1152x1536">1152×1536</option>
                <option value="1216x1664">1216×1664 · 大图</option>
              </optgroup>
              <optgroup label="方图 Square">
                <option value="896x896">896×896</option>
                <option value="1024x1024">1024×1024</option>
                <option value="1280x1280">1280×1280</option>
                <option value="1440x1440">1440×1440 · 大图</option>
              </optgroup>
              <optgroup label="横图 Landscape">
                <option value="1216x832">1216×832</option>
                <option value="1344x896">1344×896</option>
                <option value="1536x1024">1536×1024</option>
                <option value="1664x1216">1664×1216 · 大图</option>
              </optgroup>
              <optgroup label="16:9 官方 CG">
                <option value="1280x720">1280×720</option>
                <option value="1344x768">1344×768</option>
                <option value="1600x896">1600×896</option>
                <option value="1920x1088">1920×1088 · 大图</option>
              </optgroup>
            </select></label>
            <span class="sd-vram-hint" :class="vramLevel">{{ vramHint }}</span>
            <span v-if="baseResolutionRisk" class="sd-base-resolution-hint" :class="baseResolutionRisk">{{ baseResolutionHint }}</span>
            <label class="hires-label">
              <span class="switch"><input type="checkbox" v-model="pb.sdParams.hiresFix"><span class="slider"></span></span>
              hires.fix
            </label>
            <label v-if="canUseFaceDetailer" class="hires-label">
              <span class="switch"><input type="checkbox" v-model="pb.sdParams.faceDetailer" @change="pb.markParamTouched('faceDetailer')"><span class="slider"></span></span>
              面部与手部修复
            </label>
            <details v-if="pb.sdParams.hiresFix" class="sd-advanced-options">
              <summary>高级设置</summary>
              <div class="sd-advanced-grid">
                <label>放大<select v-model.number="pb.sdParams.hiresScale" @change="pb.markParamTouched('hiresScale')"><option :value="1.5">1.5×</option><option :value="2">2×</option></select></label>
                <label>二阶段步数<input type="number" v-model.number="pb.sdParams.hiresSteps" min="0" max="60" step="1" @change="pb.markParamTouched('hiresSteps')"></label>
                 <label>重绘幅度<input type="number" v-model.number="pb.sdParams.hiresDenoise" min="0.1" max="0.9" step="0.05" @change="pb.markParamTouched('hiresDenoise')"></label>
                 <label>放大器<select v-model="pb.sdParams.hiresUpscaler" @change="pb.markParamTouched('hiresUpscaler')">
                   <option>R-ESRGAN 4x+ Anime6B</option>
                   <option>R-ESRGAN 4x+</option>
                 </select></label>
              </div>
            </details>
          </div>

          <div class="preview-actions">
            <button class="btn btn-primary" type="button"
              :disabled="sd.generating.value || !sd.online.value"
               @click="() => callGenerate()">
              {{ sd.generating.value ? '生成中…' : '生成图片' }}
            </button>
            <button v-if="sd.generating.value" class="btn btn-ghost" type="button"
              @click="sd.cancel()">停止生成</button>
            <button class="btn btn-ghost" type="button" :disabled="!sdQueue.canEnqueue.value" @click="enqueueCurrent">
              加入队列
            </button>
            <button class="btn btn-ghost" type="button" :disabled="!sd.resultSeed.value" @click="reuseLastSeed">
              锁定这个 seed 微调
            </button>
            <button class="btn btn-ghost" type="button" @click="pb.clearScene()">再来一次</button>
          </div>

          <!-- Progress -->
          <div v-if="sd.generating.value" class="sd-result-area is-progress">
            <div class="sd-status">{{ sd.statusText.value }}</div>
            <div class="sd-progress"><span class="sd-progress-bar" :style="{ '--progress': sd.progress.value + '%' }"></span></div>
          </div>

          <!-- Error + 分类恢复 -->
          <div v-if="sdErrorReport" class="sd-recovery">
            <div class="sd-recovery-title">{{ sdErrorReport.title }}</div>
            <div class="sd-recovery-copy">{{ sdErrorReport.message }}</div>
            <div class="sd-recovery-actions">
              <button
                v-if="sdErrorReport.action"
                class="btn btn-primary btn-sm" type="button"
                @click="runRecovery(sdErrorReport.action.id)"
              >{{ sdErrorReport.action.label }}</button>
              <button class="btn btn-ghost btn-sm" type="button" @click="dismissError">忽略</button>
            </div>
            <details v-if="sdErrorReport.details">
              <summary>技术细节</summary>
              <pre>{{ sdErrorReport.details }}</pre>
            </details>
          </div>

          <!-- 出图队列 -->
          <div v-if="sdQueue.total.value" class="sd-queue">
            <div class="sd-queue-head">
              <span>出图队列 · {{ sdQueue.total.value }} 个{{ sdQueue.paused.value ? '（已暂停）' : '' }}</span>
              <span class="row-tight">
                <button v-if="sdQueue.paused.value" class="btn btn-ghost btn-sm" type="button" @click="sdQueue.resume()">继续</button>
                <button v-else class="btn btn-ghost btn-sm" type="button" @click="sdQueue.pause()">暂停</button>
                <button class="btn btn-ghost btn-sm" type="button" @click="sdQueue.clear()">清空等待</button>
              </span>
            </div>
            <div class="sd-queue-list">
              <div v-if="sdQueue.activeJob.value" class="sd-queue-item">
                <span class="sd-queue-index">生成中</span>
                <div class="sd-queue-copy">
                  <div class="sd-queue-title">{{ sdQueue.activeJob.value.title }}</div>
                  <div class="sd-queue-meta">{{ sdQueue.activeJob.value.size }} · seed {{ sdQueue.activeJob.value.seed < 0 ? '随机' : sdQueue.activeJob.value.seed }}</div>
                </div>
                <span></span>
              </div>
              <div v-for="(job, i) in sdQueue.queue.value" :key="job.id" class="sd-queue-item">
                <span class="sd-queue-index">{{ i + 1 }}</span>
                <div class="sd-queue-copy">
                  <div class="sd-queue-title">{{ job.title }}</div>
                  <div class="sd-queue-meta">{{ job.size }} · seed {{ job.seed < 0 ? '随机' : job.seed }}</div>
                </div>
                <button class="sd-queue-remove" type="button" aria-label="移出队列" @click="sdQueue.remove(job.id)">×</button>
              </div>
            </div>
          </div>

          <VoiceStudio
            :initial-voice="pb.char === 'natsume' ? 'natsume' : 'nene'"
            :suggested-caption="pb.story"
          />
        </div>
      </div>

      <!-- ─── 右栏：风格 ───────────────────────────────────── -->
      <div class="director-col col-right">

        <!-- Emotion -->
        <div class="panel step-panel" id="stepEmotion">
          <div class="panel-title">情绪 · Emotion</div>
          <div class="emotion-list">
            <button v-for="e in EMOTION" :key="e.id"
              class="option" type="button"
              :class="{ selected: pb.selections.emotion.includes(e.id) }"
              @click="pb.toggleEmotion(e.id)">
              <span class="opt-icon">{{ e.icon }}</span>
              <span class="opt-name">{{ e.name }}</span>
            </button>
          </div>
        </div>

        <!-- Camera / Shot -->
        <div class="panel step-panel" id="stepCamera">
          <div class="panel-title">镜头 · Camera</div>
          <div class="camera-list">
            <button v-for="s in SHOT" :key="s.id"
              class="option" type="button"
              :class="{ selected: pb.selections.shot === s.id }"
              @click="pb.setShot(pb.selections.shot === s.id ? null : s.id)">
              <span class="opt-icon">{{ s.icon }}</span>
              <span class="opt-name">{{ s.name }}</span>
            </button>
          </div>
        </div>

        <!-- Lighting -->
        <div class="panel step-panel" id="stepLighting">
          <div class="panel-title">光照 · Lighting</div>
          <div class="lighting-list">
            <button v-for="l in LIGHTING" :key="l.id"
              class="option" type="button"
              :class="{ selected: pb.selections.lighting === l.id }"
              @click="pb.setLighting(pb.selections.lighting === l.id ? null : l.id)">
              <span class="opt-icon">{{ l.icon }}</span>
              <span class="opt-name">{{ l.name }}</span>
            </button>
          </div>
        </div>

        <!-- Composition -->
        <div class="panel step-panel" id="stepComposition">
          <div class="panel-title">构图 · Composition</div>
          <div class="comp-list">
            <button v-for="c in COMPOSITION" :key="c.id"
              class="option" type="button"
              :class="{ selected: pb.selections.composition === c.id }"
              @click="pb.setComposition(pb.selections.composition === c.id ? null : c.id)">
              <span class="opt-icon">{{ c.icon }}</span>
              <span class="opt-name">{{ c.name }}</span>
            </button>
          </div>
        </div>

        <!-- Color Mood -->
        <div class="panel step-panel" id="stepMood">
          <div class="panel-title">色彩情调 · Mood</div>
          <div class="mood-grid">
            <button v-for="m in COLOR_MOODS" :key="m.id"
              class="mood-card" type="button"
              :class="{ active: pb.colorMood === m.id }"
              @click="pb.setColorMood(pb.colorMood === m.id ? null : m.id)">
              <span class="mood-icon">{{ m.icon }}</span>
              <span class="mood-name">{{ m.name }}</span>
              <span class="mood-desc">{{ m.desc }}</span>
            </button>
          </div>
        </div>

        <!-- Manual tags -->
        <div class="panel step-panel" id="stepTags">
          <div class="panel-title">手动标签 · Tags</div>
          <div class="manual-tags">
            <span v-for="tag in pb.manualTags" :key="tag" class="manual-tag">
              {{ tag }}
              <button type="button" class="tag-remove" @click="pb.toggleManualTag(tag)">×</button>
            </span>
          </div>
          <input class="tag-input" type="text" placeholder="输入 Danbooru 标签后回车"
            @keydown.enter.prevent="addTag($event)" />
        </div>

      </div>
    </div>

    <!-- 备份恢复确认 -->
    <Teleport to="body">
      <div v-if="backup.pending.value" class="pb-backup-overlay open" @click.self="backup.discard()">
        <div
          ref="backupCardEl"
          class="pb-backup-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="backup-restore-title"
        >
          <h3 id="backup-restore-title">从备份恢复</h3>
          <p>选择恢复方式。覆盖会替换现有数据，合并会按 id 保留较新的记录。</p>
          <div class="pb-backup-summary">
            <strong>{{ backup.pendingName.value }}</strong>
            <span>
              {{ pendingSummary?.history ?? 0 }} 条历史 ·
              {{ pendingSummary?.projects ?? 0 }} 个项目 ·
              {{ pendingSummary?.images ?? 0 }} 张图片 ·
              数据版本 v{{ backup.pending.value.schemaVersion }}
            </span>
          </div>
          <div class="pb-backup-actions">
            <button class="btn btn-ghost" type="button" :disabled="backup.busy.value" @click="backup.discard()">取消</button>
            <button class="btn btn-ghost" type="button" :disabled="backup.busy.value" @click="backup.restore('merge')">合并恢复</button>
            <button class="btn btn-danger" type="button" :disabled="backup.busy.value" @click="backup.restore('replace')">覆盖本地</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Toast -->
    <div v-if="pb.toastMsg" class="pb-toast" role="status" aria-live="polite">{{ pb.toastMsg }}</div>
  </article>
</template>

<script setup lang="ts">
// 导演台专属样式（91.6KB）随本路由块加载，不再进全局包
import '@/assets/css/director.css'
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePromptBuilderStore } from '@/stores/promptBuilderStore'
import { useSDGenerate } from '@/composables/useSDGenerate'
import HistoryPanel from '@/components/HistoryPanel.vue'
import { NEGATIVE_DEFAULT } from '@/stores/promptBuilderStore'
import {
  adaptNegative, analyzeParts, applyFraming, checkArtDirection, dedupeParts,
  enrichDualPrompt, loraSpecText, mergeTokenText, modelNegativePrompt, norm,
  normalizeKey, qualityPrefix, resolveLoraSpecs, resolveModelProfile,
  sanitizePrompt, sceneSupportsCharacter, sceneTemplateText, splitBreaks, tokenize,
  type PromptPart,
} from '@/utils/promptPolicy'
import { EMOTION, SHOT, LIGHTING, COMPOSITION, COLOR_MOODS, SCENE_THEMES } from '@/config/promptConstants'
import { kvGet } from '@/composables/useKVStore'
import { useSDQueue, type SDQueueJob } from '@/composables/useSDQueue'
import { classifySDError, SAFE_SAMPLING, LIGHT_LOAD, type SDErrorReport, type SDRecoveryId } from '@/utils/sdError'
import { useBackup, type BackupSummary } from '@/composables/useBackup'
import { useFocusTrap } from '@/composables/useFocusTrap'
import VoiceStudio from '@/components/VoiceStudio.vue'
import type { HistoryEntry, Scene } from '@/stores/promptBuilderStore'

const router = useRouter()
const route = useRoute()
const pb = usePromptBuilderStore()
const sd = useSDGenerate()

// ── UI state ──────────────────────────────────────────────────────────────
const sceneLimit = ref(20)
const sdSize = ref('832x1216')

// ── 显存预算提示（重构前的 sdBudgetHint） ─────────────────────────────────
const vramBudget = computed(() => {
  const [w, h] = sdSize.value.split('x').map(Number)
  const scale = pb.sdParams.hiresFix ? (pb.sdParams.hiresScale || 1.5) : 1
  const finalW = Math.round((w || 832) * scale)
  const finalH = Math.round((h || 1216) * scale)
  return { width: finalW, height: finalH, megapixels: (finalW * finalH) / 1_000_000 }
})
const vramLevel = computed(() => {
  const mp = vramBudget.value.megapixels
  // 16GB 显存下 SDXL：约 4MP 内稳，6MP 起偏紧
  if (mp > 6) return 'danger'
  if (mp > 4) return 'warn'
  return ''
})
const baseResolutionRisk = computed(() => {
  const [w, h] = sdSize.value.split('x').map(Number)
  const megapixels = ((w || 832) * (h || 1216)) / 1_000_000
  // SDXL is most coherent near its 1024^2 training buckets. This is unrelated to VRAM.
  if (megapixels > 1.8) return 'danger'
  if (megapixels > 1.5) return 'warn'
  return ''
})
const vramHint = computed(() => {
  const b = vramBudget.value
  const base = `最终 ${b.width}×${b.height} · ${b.megapixels.toFixed(1)} MP`
  if (vramLevel.value === 'danger') return base + ' · 16G 显存可能 OOM'
  if (vramLevel.value === 'warn') return base + ' · 接近 16G 上限'
  return base
})
const baseResolutionHint = computed(() => {
  const [w, h] = sdSize.value.split('x').map(Number)
  const megapixels = ((w || 832) * (h || 1216)) / 1_000_000
  const base = `基础 ${w}×${h} · ${megapixels.toFixed(1)} MP`
  if (baseResolutionRisk.value === 'danger') return base + ' · SDXL 人物结构风险高'
  return base + ' · SDXL 人物结构风险偏高'
})
const canUseFaceDetailer = computed(() => {
  const [w, h] = sdSize.value.split('x').map(Number)
  return pb.char !== 'triad' && !pb.sdParams.hiresFix && ((w || 832) * (h || 1216)) > 1_500_000
})

// ── Static data ───────────────────────────────────────────────────────────
const storyChips = [
  '放学后在樱花树下等人的宁宁',
  '第一次在海边看日出的夏目',
  '夏夜祭典穿浴衣看烟花',
  '雪天围围巾的温柔一瞬',
]

const charOptions = [
  { id: 'nene',    label: '🌸 宁宁' },
  { id: 'natsume', label: '🍂 夏目' },
  { id: 'triad',   label: '🌸🍂 双人' },
]

// ── Derived ───────────────────────────────────────────────────────────────
const currentTraits = computed(() => {
  const charDef = pb.characters.find(c =>
    c.id.includes(pb.char) || (c.lora?.name ?? '').toLowerCase().includes(pb.char)
  )
  return charDef?.traits ?? []
})

const visibleScenes = computed(() => pb.filteredScenes.slice(0, sceneLimit.value))

const guideText = computed(() => {
  if (!pb.story && !pb.sceneId) return '写一个故事，或选一张场景卡'
  if (pb.sceneId) return `场景已选：${pb.activeScene?.title ?? ''}`
  return '故事已填写，现在选择导演决策'
})

// ── Prompt builder（对齐重构前 buildParts 的完整管线） ──────────────────────

/** 当前 checkpoint 对应的 model profile（决定质量前缀 / 负面策略 / rating 标签） */
const modelProfile = computed(() =>
  resolveModelProfile(pb.modelProfiles as any, pb.sdModelName || sd.checkpoint.value),
)

/** 场景必须支持当前角色，否则不套用场景模板 */
const effectiveScene = computed(() => {
  const sc = pb.activeScene
  if (!sc) return null
  return sceneSupportsCharacter(sc, pb.char) ? sc : null
})

const LORA_ID_BY_CHAR = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  const find = (key: string) =>
    pb.characters.find(c => c.id.includes(key) || (c.lora?.name ?? '').toLowerCase().includes(key))
  const nene = find('nene')
  const natsume = find('natsume')
  if (nene?.lora?.name) map.nene = nene.lora.name
  if (natsume?.lora?.name) map.natsume = natsume.lora.name
  if (nene?.lora?.name && natsume?.lora?.name) {
    map.triad = `${nene.lora.name}, ${natsume.lora.name}`
  }
  return map
})

/** LoRA 按镜头动态定权（特写/全身/双人/复杂场景各不同） */
const loraSpecs = computed(() =>
  resolveLoraSpecs(
    pb.char,
    effectiveScene.value,
    pb.loraMeta as any,
    LORA_ID_BY_CHAR.value,
    { shot: pb.selections.shot, manualTags: pb.manualTags },
  ),
)

/** 分块 parts：与旧版同序同类，便于着色与结构统计 */
const promptParts = computed<PromptPart[]>(() => {
  const parts: PromptPart[] = []
  const sel = pb.selections
  const scene = effectiveScene.value
  const profile = modelProfile.value

  const sceneTemplate = sceneTemplateText(scene, {
    char: pb.char,
    manualTags: pb.manualTags,
    shot: sel.shot,
  })

  // 1) 质量前缀（模型 profile + rating 标签）
  if (pb.sdParams.quality) parts.push({ cls: 'q', text: qualityPrefix(profile, scene) })

  // 2) 角色行 + 已勾选特征
  const traitTags = currentTraits.value
    .filter(t => pb.manualTags.has(t.tag))
    .map(t => t.tag)
  const charLine = pb.charPrompt
  if (charLine) {
    parts.push({ cls: 'c', text: norm(traitTags.length ? `${charLine}, ${traitTags.join(', ')}` : charLine) })
  }

  // 3) 双人：无场景模板时补构图增强
  if (pb.char === 'triad' && !sceneTemplate) {
    parts.push({
      cls: 't',
      text: enrichDualPrompt(
        '',
        ['ayachi_nene', 'white_hair', 'very_long_hair', 'low_twintails', 'purple_eyes', 'ahoge', 'hair_ribbon'],
        ['shiki_natsume', 'black_hair', 'long_hair', 'yellow_eyes', 'mole_under_eye', 'hairclip'],
      ),
    })
  }

  // 4) 场景模板
  if (sceneTemplate && !pb.concise) parts.push({ cls: 't', text: sceneTemplate })

  // 精简模式：quality + character + top5 tags + shot + LoRA
  if (pb.concise) {
    if (pb.manualTags.size) {
      parts.push({ cls: 't', text: norm([...pb.manualTags].slice(0, 5).join(', ')) })
    }
    if (sel.shot) {
      const s = SHOT.find(x => x.id === sel.shot)
      if (s?.prompt) parts.push({ cls: 't', text: norm(s.prompt) })
    }
    loraSpecs.value.forEach(spec => parts.push({ cls: 'l', text: `<lora:${loraSpecText(spec)}>` }))
    return dedupeParts(applyFraming(parts, sel.shot))
  }

  // 5) 色彩情调
  if (pb.colorMood) {
    const m = COLOR_MOODS.find(x => x.id === pb.colorMood)
    if (m?.prompt) parts.push({ cls: 't', text: norm(m.prompt) })
  }
  // 6) 情绪
  if (pb.emotionPrompt) parts.push({ cls: 't', text: norm(pb.emotionPrompt) })
  // 7) 镜头
  if (sel.shot) {
    const s = SHOT.find(x => x.id === sel.shot)
    if (s?.prompt) parts.push({ cls: 't', text: norm(s.prompt) })
  }
  // 8) 光照
  if (sel.lighting) {
    const l = LIGHTING.find(x => x.id === sel.lighting)
    if (l?.prompt) parts.push({ cls: 'c', text: norm(l.prompt) })
  }
  // 9) 构图
  if (sel.composition) {
    const c = COMPOSITION.find(x => x.id === sel.composition)
    if (c?.prompt) parts.push({ cls: 't', text: norm(c.prompt) })
  }

  // 10) 手动标签（剔除与场景模板重复的）
  if (pb.manualTags.size) {
    const templateKeys = new Set(
      splitBreaks(sceneTemplate).flatMap(seg => tokenize(seg)).map(normalizeKey),
    )
    const manual = [...pb.manualTags].filter(t => !templateKeys.has(normalizeKey(t)))
    if (manual.length) parts.push({ cls: 't', text: norm(manual.join(', ')) })
  }

  // 11) 智能 tail：全身走 deep_focus，其余 depth_of_field
  if (pb.sdParams.tail) {
    const isWide = sel.shot
      ? sel.shot === 'wide'
      : (pb.manualTags.has('wide_shot') || pb.manualTags.has('full_body'))
    parts.push({ cls: 'c', text: isWide ? 'deep_focus' : 'depth_of_field' })
  }

  // 12) LoRA
  loraSpecs.value.forEach(spec => parts.push({ cls: 'l', text: `<lora:${loraSpecText(spec)}>` }))

  return dedupeParts(applyFraming(parts, sel.shot))
})

const positivePrompt = computed(() =>
  sanitizePrompt(promptParts.value.filter(p => p.cls !== 'n').map(p => p.text).join(', ')),
)

const negativePrompt = computed(() => {
  if (!pb.sdParams.negative) return ''
  const scene = effectiveScene.value
  // 场景自带负面优先，其次全站默认；再叠加 model profile 策略
  const sceneNegativeBase = (scene as any)?.negative || NEGATIVE_DEFAULT
  const custom = String(pb.sdParams.negativeCustom || '').trim()
  const withProfile = modelNegativePrompt(modelProfile.value, sceneNegativeBase)
  const merged = custom ? mergeTokenText(custom, withProfile) : withProfile
  return adaptNegative(merged, scene, { shot: pb.selections.shot, character: pb.char })
})

const promptReport = computed(() => {
  const parts = [...promptParts.value]
  if (negativePrompt.value) parts.push({ cls: 'n' as const, text: negativePrompt.value })
  return analyzeParts(parts)
})

const artViolations = computed(() => checkArtDirection(positivePrompt.value))

const previewPrompt = computed(() => {
  if (!positivePrompt.value) return ''
  return negativePrompt.value ? `${positivePrompt.value}\n[NEG]\n${negativePrompt.value}` : positivePrompt.value
})

const livePrompt = positivePrompt

// ── Actions ───────────────────────────────────────────────────────────────
function selectScene(scene: Scene) {
  pb.loadScene(scene)
  sceneLimit.value = 20
}

function onStoryInput() {
  // Clear scene context if user edits story away from scene's default
  if (pb.sceneId && pb.story !== pb.sceneBaseStory) {
    pb.clearScene({ keepStory: true })
  }
}

// ── 出图 + 队列 + 错误恢复 ──────────────────────────────────────────────────
const sdErrorReport = ref<SDErrorReport | null>(null)
function dismissError() { sdErrorReport.value = null }

/** 把当前导演台状态快照成一个队列任务 */
function captureJob(): Omit<SDQueueJob, 'id'> | null {
  if (!livePrompt.value) return null
  const scene = effectiveScene.value
  const story = String(pb.story || '').trim()
  return {
    title: scene?.title || (story ? story.slice(0, 28) : (pb.char === 'natsume' ? '夏目构图' : '宁宁构图')),
    prompt: livePrompt.value,
    negative: negativePrompt.value,
    sceneId: pb.sceneId,
    sceneTitle: scene?.title || '',
    char: pb.char,
    story,
    size: sdSize.value,
    seed: pb.sdParams.seedLock && pb.sdParams.seed >= 0 ? pb.sdParams.seed : -1,
    cfg: pb.sdParams.cfg,
    steps: pb.sdParams.steps,
    sampler: pb.sdParams.sampler,
    scheduler: pb.sdParams.scheduler || '',
    checkpoint: pb.sdModelName || sd.checkpoint.value || '',
    hiresFix: pb.sdParams.hiresFix,
    hiresScale: pb.sdParams.hiresScale,
    hiresUpscaler: pb.sdParams.hiresUpscaler,
    hiresSteps: pb.sdParams.hiresSteps,
    denoisingStrength: pb.sdParams.hiresDenoise,
    faceDetailer: pb.sdParams.faceDetailer,
  }
}

function buildSingleDetailerScripts(): Record<string, unknown> {
  return {
    ADetailer: {
      args: [
        true,
        false,
        {
          ad_model: 'face_yolov8s.pt',
          ad_prompt: 'detailed eyes, clean face, character-accurate facial features',
          ad_negative_prompt: 'deformed face, asymmetrical eyes, cross-eyed',
          ad_confidence: 0.35,
          ad_denoising_strength: 0.18,
          ad_inpaint_only_masked: true,
          ad_inpaint_only_masked_padding: 32,
          ad_use_inpaint_width_height: true,
          ad_inpaint_width: 768,
          ad_inpaint_height: 768,
          is_api: true,
        },
        {
          ad_model: 'hand_yolov8n.pt',
          ad_prompt: 'detailed hands, five fingers, natural fingers',
          ad_negative_prompt: 'extra fingers, missing fingers, fused fingers, malformed hands',
          ad_confidence: 0.3,
          ad_denoising_strength: 0.16,
          ad_inpaint_only_masked: true,
          ad_inpaint_only_masked_padding: 32,
          ad_use_inpaint_width_height: true,
          ad_inpaint_width: 768,
          ad_inpaint_height: 768,
          is_api: true,
        },
      ],
    },
  }
}

/** 执行一个任务（队列与直接出图共用同一条路径） */
async function runJob(job: Omit<SDQueueJob, 'id'>, opts: { disableLora?: boolean } = {}) {
  const [w, h] = String(job.size).split('x').map(Number)
  let prompt = job.prompt
  if (opts.disableLora) prompt = prompt.replace(/<lora:[^>]+>\s*,?\s*/gi, '').trim().replace(/,\s*$/, '')
  const directHighResolution = !job.hiresFix && (w || 832) * (h || 1216) > 1_500_000
  const alwaysonScripts = job.faceDetailer && job.char !== 'triad' && directHighResolution
    ? buildSingleDetailerScripts()
    : undefined

  const url = await sd.generate({
    prompt,
    negative_prompt: job.negative || undefined,
    width: w || 832,
    height: h || 1216,
    cfg_scale: job.cfg,
    steps: job.steps,
    sampler_name: job.sampler,
    scheduler: job.scheduler || undefined,
    hr_fix: job.hiresFix,
    hr_scale: job.hiresScale,
    hr_upscaler: job.hiresUpscaler,
    hr_second_pass_steps: job.hiresSteps,
    denoising_strength: job.denoisingStrength,
    seed: job.seed,
    model: job.checkpoint || undefined,
    alwayson_scripts: alwaysonScripts,
  })

  if (sd.resultSeed.value) pb.sdParams.seed = sd.resultSeed.value
  return url
}

// ── 备份 / 恢复 ────────────────────────────────────────────────────────────
const backup = useBackup((m) => pb.flash(m))

/** 恢复确认弹层：覆盖本地是破坏性操作，必须有焦点陷阱 + Escape */
const backupCardEl = ref<HTMLElement | null>(null)
useFocusTrap(backupCardEl, () => backup.pending.value !== null, {
  onEscape: () => { if (!backup.busy.value) backup.discard() },
})
const backupFileEl = ref<HTMLInputElement | null>(null)
const utilityEl = ref<HTMLDetailsElement | null>(null)
const pendingSummary = ref<BackupSummary | null>(null)

function pickBackupFile() { backupFileEl.value?.click() }

async function onBackupFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  pendingSummary.value = await backup.loadFile(file)
  input.value = ''
  if (utilityEl.value) utilityEl.value.open = false
}

const sdQueue = useSDQueue({
  isBusy: () => sd.generating.value,
  onFlash: (m) => pb.flash(m),
  run: async (job) => {
    const url = await runJob(job)
    if (url) {
      sdErrorReport.value = null
      // 队列产出自动入册，避免跑完一批还要手点保存
      try {
        // url 是本地 blob URL，不会回 HTML 错误页，但可能已被 revoke 而拿到空 blob。
        // 空 blob 入册会在作品册里留下一条打不开的记录。
        const blob = await (await fetch(url)).blob()
        if (!blob.size) throw new Error('成片数据已失效')
        await pb.commitHistoryEntry({
          blob, seed: sd.resultSeed.value ?? undefined,
          size: job.size, negative: job.negative, prompt: job.prompt,
        })
      } catch (e) { console.warn('queue autosave failed', e) }
      return { status: 'success' as const }
    }
    const err = sd.errorMsg.value
    if (!err) return { status: 'cancelled' as const }
    sdErrorReport.value = classifySDError({ message: err })
    return { status: 'failure' as const, error: err }
  },
})

function enqueueCurrent() {
  const job = captureJob()
  if (!job) { pb.flash('请先选择场景或填写故事'); return }
  sdQueue.enqueue(job)
}

async function callGenerate(opts: { disableLora?: boolean } = {}) {
  if (!livePrompt.value) { pb.flash('请先选择场景或填写故事'); return }
  sdErrorReport.value = null
  const job = captureJob()
  if (!job) return
  const url = await runJob(job, opts)
  if (!url && sd.errorMsg.value) {
    sdErrorReport.value = classifySDError({ message: sd.errorMsg.value })
  }
}

/** 分类恢复：对应旧版 runSDRecovery */
async function runRecovery(id: SDRecoveryId) {
  sdErrorReport.value = null
  if (id === 'retry_light') {
    sdSize.value = LIGHT_LOAD.size
    pb.sdParams.hiresFix = LIGHT_LOAD.hiresFix
    pb.markParamTouched('size')
    pb.flash('已降到 832×1216 并关闭 hires.fix，正在重试')
    await callGenerate()
    return
  }
  if (id === 'retry_without_lora') {
    pb.flash('本次临时跳过角色 LoRA')
    await callGenerate({ disableLora: true })
    return
  }
  if (id === 'retry_current_model') {
    pb.sdModelName = ''
    pb.flash('已改用 WebUI 当前模型，正在重试')
    await callGenerate()
    return
  }
  if (id === 'retry_safe_sampler') {
    pb.sdParams.sampler = SAFE_SAMPLING.sampler
    pb.sdParams.scheduler = SAFE_SAMPLING.scheduler
    pb.markParamTouched('sampler')
    pb.markParamTouched('scheduler')
    pb.flash('已恢复稳定采样器，正在重试')
    await callGenerate()
    return
  }
  if (id === 'recheck_connection') {
    const ok = await sd.checkStatus()
    pb.flash(ok ? 'SD WebUI 已连接' : 'SD WebUI 仍未响应')
    return
  }
  if (id === 'open_settings') {
    const el = document.querySelector('details.generation-settings') as HTMLDetailsElement | null
    if (el) { el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  }
}

async function copyPrompt() {
  try { await navigator.clipboard.writeText(previewPrompt.value); pb.flash('Prompt 已复制') }
  catch { pb.flash('复制失败，请手动选取') }
}

async function saveHistory() {
  try {
    const url = sd.resultUrl.value
    if (!url) { pb.flash('暂无可保存的成片'); return }
    // 抓取成片 blob 写入 IndexedDB，并 commit 历史
    const response = await fetch(url)
    const blob = await response.blob()
    // 空 blob 会入册成一条打不开的记录，宁可报错
    if (!blob.size) { pb.flash('成片数据已失效，请重新生成'); return }
    const entry = await pb.commitHistoryEntry({
      blob,
      seed: sd.resultSeed.value ?? undefined,
      size: sdSize.value,
      negative: negativePrompt.value,
      prompt: livePrompt.value,
    })
    if (entry) pb.flash('快照已存入本地作品册')
    else pb.flash('保存失败')
  } catch (e) { pb.flash('保存失败'); console.warn(e) }
}

function saveResult() { saveHistory() }

function reuseLastSeed() {
  const seed = sd.resultSeed.value ?? pb.lastSeed
  if (seed == null || seed < 0) { pb.flash('还没有可复用的 seed'); return }
  pb.sdParams.seed = seed
  pb.sdParams.seedLock = true
  pb.flash(`已锁定 seed ${seed}`)
}

function applyHistory(entry: HistoryEntry, keepAsVariant = false) {
  if (entry.character) pb.setChar(entry.character)
  if (entry.story) pb.setStory(entry.story)
  if (entry.scene) {
    const sc = pb.scenes.find(s => s.id === entry.scene)
    if (sc) pb.loadScene(sc)
  } else {
    pb.clearScene({ keepStory: true })
  }
  pb.selections.emotion.splice(0, pb.selections.emotion.length, ...(entry.emotion || []))
  pb.setShot(entry.shot || null)
  pb.setLighting(entry.lighting || null)
  pb.setComposition(entry.composition || null)
  pb.setColorMood(entry.colorMood || null)
  pb.manualTags = new Set(entry.manual_tags || [])
  if (entry.seed >= 0) { pb.sdParams.seed = entry.seed; pb.sdParams.seedLock = true }
  pb.sdParams.cfg = Number(entry.cfg) || pb.sdParams.cfg
  pb.sdParams.steps = Number(entry.steps) || pb.sdParams.steps
  if (entry.sampler) pb.sdParams.sampler = entry.sampler
  if (entry.scheduler) pb.sdParams.scheduler = entry.scheduler
  if (entry.negative) { pb.sdParams.negative = true; pb.sdParams.negativeCustom = entry.negative }
  if (entry.size) sdSize.value = entry.size
  if (keepAsVariant) pb.flash('已复制为新变体草稿')
  else pb.flash('已恢复历史参数')
}

function resumeHistory(entry: HistoryEntry) { applyHistory(entry) }
function duplicateHistory(entry: HistoryEntry) { applyHistory(entry, true) }
async function deleteHistory(entry: HistoryEntry) {
  await pb.removeHistoryEntry(entry.id)
  pb.flash('历史记录已删除')
}

function addTag(e: Event) {
  const input = e.target as HTMLInputElement
  const tag = input.value.trim().replace(/\s+/g, '_').toLowerCase()
  if (tag) { pb.toggleManualTag(tag); input.value = '' }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await pb.loadData()
  await sd.checkStatus()
  // 拿到 WebUI 真实 checkpoint 后，再按对应 model profile 填参数
  pb.applyModelProfile(pb.sdModelName || sd.checkpoint.value)
  // 历史载入（IndexedDB）
  await pb.loadHistory()

  // 深链参数恢复（?scene / ?char / ?mood / ?regen / ?resume / ?quick / ?variant）
  const q = route.query
  let handledDeepLink = false
  if (typeof q.char === 'string' && ['nene','natsume','triad'].includes(q.char)) {
    pb.setChar(q.char as any); handledDeepLink = true
  }
  if (typeof q.mood === 'string' && COLOR_MOODS.some(m => m.id === q.mood)) {
    pb.setColorMood(q.mood); handledDeepLink = true
  }
  if (typeof q.scene === 'string') {
    const sc = pb.scenes.find(s => s.id === q.scene)
    if (sc) { pb.loadScene(sc); handledDeepLink = true }
  } else if (typeof q.regen === 'string' || typeof q.variant === 'string') {
    const targetId = q.regen ? Number(q.regen) : NaN
    const entry = targetId ? (pb.history as any[]).find(h => h.id === targetId) : null
    if (entry) {
      if (entry.char) pb.setChar(entry.char)
      if (entry.story) pb.setStory(entry.story)
      if (entry.scene) {
        const sc = pb.scenes.find(s => s.id === entry.scene)
        if (sc) pb.loadScene(sc)
      }
      if (Array.isArray(entry.emotion)) entry.emotion.forEach((e:string) => { if (!pb.selections.emotion.includes(e)) pb.selections.emotion.push(e) })
      if (entry.shot) pb.setShot(entry.shot)
      if (entry.lighting) pb.setLighting(entry.lighting)
      if (entry.composition) pb.setComposition(entry.composition)
      if (entry.colorMood) pb.setColorMood(entry.colorMood)
      if (Array.isArray(entry.manual_tags)) { pb.manualTags = new Set(entry.manual_tags) }
      if (entry.seed && entry.seed >= 0) { pb.sdParams.seed = entry.seed; pb.sdParams.seedLock = true }
      handledDeepLink = true
    }
  } else if (q.resume === '1') {
    handledDeepLink = pb.restoreDraft()
  } else if (q.quick === '1' && !pb.story) {
    pb.setStory('用一张画面来讲今天想画的故事')
    handledDeepLink = true
  }
  if (!handledDeepLink) pb.restoreDraft()
  // 推荐尺寸同步到出图选择
  if (pb.lastRecommendedSize) sdSize.value = pb.lastRecommendedSize
})

// Autosave draft
watch([() => pb.story, () => pb.char, () => pb.sceneId, () => pb.selections, () => pb.manualTags, () => pb.colorMood], () => {
  pb.saveDraft?.()
}, { deep: true })

// 切换 SD 模型时重新套用对应 profile 的推荐参数
watch(() => pb.sdModelName, (name) => {
  pb.applyModelProfile(name || sd.checkpoint.value)
})
</script>
