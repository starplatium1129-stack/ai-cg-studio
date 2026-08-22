<template>
  <article
    class="pb"
    :data-character="pb.subject.kind === 'popular' ? pb.subject.characterId : pb.char"
    :data-subject="pb.subject.kind"
    :data-director-mode="pb.directorMode"
    :class="{
      'focus-mode': pb.focusMode,
      'step-4': Boolean(displayResultUrl || generationBusy),
      'has-result': Boolean(displayResultUrl),
    }"
  >
    <a @click.prevent="$router.push('/')" href="/" class="nav-back">← 回首页</a>

    <WorkspaceArchiveBar
      chapter="01"
      title="DIRECTOR CONSOLE"
      :subtitle="pb.isPopular ? popularCharacter?.displayName || '热门角色' : (pb.activeScene?.title || (pb.directorMode === 'basic' ? '场景模式' : '专家模式'))"
      :status="pb.isPopular ? 'POPULAR · NO LORA' : (pb.directorMode === 'basic' ? 'SCENE MODE' : 'PRO MODE')"
      :state="pb.isPopular ? 'active' : (pb.directorMode === 'basic' ? 'success' : 'active')"
      :shape="archiveBarShape"
    />

    <div class="pb-topline">
      <div class="pb-header">
        <div class="pb-kicker">Nene &amp; Natsume Private Atelier</div>
        <h1 class="pb-title">开始绘制</h1>
        <p class="pb-sub">{{ modeDescription }}</p>
      </div>
      <div class="pb-top-actions">
        <div class="director-mode-switch" role="group" aria-label="切换绘图工作模式">
          <button class="director-mode-option" type="button"
            :class="{ active: pb.directorMode === 'basic' }"
            :aria-pressed="pb.directorMode === 'basic'"
            @click="setDirectorMode('basic')">场景模式</button>
          <button class="director-mode-option" type="button"
            :class="{ active: pb.directorMode === 'pro' }"
            :aria-pressed="pb.directorMode === 'pro'"
            @click="setDirectorMode('pro')">专家模式</button>
        </div>
        <button class="focus-mode-btn" type="button"
          :aria-label="pb.focusMode ? '退出专注成片模式' : '进入专注成片模式'"
          :aria-pressed="pb.focusMode"
          @click="pb.focusMode = !pb.focusMode">
          <span class="focus-mode-icon" aria-hidden="true">{{ pb.focusMode ? '↙' : '⛶' }}</span>
          <span class="focus-mode-label">{{ pb.focusMode ? '退出专注' : '专注成片' }}</span>
        </button>
        <div class="api-status">
          <button class="badge" :class="engineOnline ? 'badge-online' : 'badge-offline'" type="button"
            :title="engineOnline ? '点击重新检测' : `${engineStatusText}；点击重新检测`"
            @click="recheckEngineConnection">
            <ArchiveIcon :name="engineOnline ? 'success' : 'warning'" />
            <span>{{ engineOnline ? `${drawEngineLabel} 已连接` : engineStatusText }}</span>
          </button>
          <RouterLink v-if="!engineOnline" class="api-recovery-link" to="/control">控制面板</RouterLink>
        </div>

        <PromptDataTools
          :blueprint-data="currentBlueprintData"
          @flash="pb.flash"
          @load-blueprint="handleLoadBlueprint"
        />
      </div>
    </div>

    <ManagedDrawingRouteCard v-if="managedRoute"
      class="pb-managed-route-banner"
      :route="managedRoute"
      :history="pb.history"
      :subject="pb.subject"
      :expert="pb.directorMode === 'pro'"
      :busy="generationBusy"
      @apply="applyManagedRoute"
      @reuse="reuseSuccessfulRecipe"
    />

    <div class="director-workspace">

      <!-- ─── 左栏：剧本 ──────────────────────────────────── -->
      <div class="director-col col-left">

        <!-- Story -->
        <div class="panel step-panel" id="stepStory">
          <div class="panel-title">故事 · Story</div>
          <textarea class="story-input" v-model="pb.story"
            placeholder="写下一句触动心弦的画面，或是脑海中浮现的相遇瞬间…"
            @input="onStoryInput"></textarea>
          <label class="visual-description-label" for="visualDescription">画面描述 · Visual description</label>
          <textarea id="visualDescription" class="visual-description-input" v-model="pb.visualDescription"
            placeholder="细描角色的神态姿态、服饰光影与环境细节（将由引擎深度解析）…"></textarea>
          <p class="visual-description-hint">该描述将直接传递给生成引擎；故事台词与心理独白由工坊为您智能转化。</p>
          <div v-if="pb.activeScene" class="scene-context">
            <span class="scene-context-title">{{ pb.activeScene.title }}</span>
            <button class="scene-context-detach" type="button" @click="detachScene()">× 脱离</button>
          </div>
          <div class="story-chips">
            <button v-for="s in storyChips" :key="s" type="button" class="story-chip"
              @click="pb.setStory(s)">{{ s }}</button>
          </div>
        </div>

        <!-- Character -->
        <div class="panel step-panel" id="stepChar">
          <div class="panel-title">角色 · Character</div>
          <div class="char-source" role="group" aria-label="角色来源">
            <button type="button" class="char-source-btn" :class="{ active: !pb.isPopular }"
              :aria-pressed="!pb.isPopular" @click="selectPopularSource('studio')">
              <ArchiveIcon name="character" class="char-source-icon" />
              <span>工作室角色</span>
            </button>
            <button type="button" class="char-source-btn" :class="{ active: pb.isPopular }"
              :aria-pressed="pb.isPopular" @click="selectPopularSource('popular')">
              <ArchiveIcon name="spark" class="char-source-icon" />
              <span>热门角色 · 无需 LoRA</span>
            </button>
          </div>

          <template v-if="!pb.isPopular">
            <div class="char-row">
              <button v-for="c in charOptions" :key="c.id"
                class="char-btn" type="button"
                :class="{ active: pb.char === c.id }"
                :aria-pressed="pb.char === c.id"
                @click="pb.setChar(c.id)">
                <ArchiveIcon :name="c.iconName" /> {{ c.label }}
              </button>
            </div>
            <div class="traits-row">
              <button v-for="t in currentTraits" :key="t.tag"
                class="trait-chip"
                :class="{ active: pb.manualTags.has(t.tag) }"
                type="button"
                @click="pb.toggleManualTag(t.tag)">{{ t.label }}</button>
            </div>
          </template>

          <template v-else>
            <PopularCharacterPicker
              v-model:search="popularSearch"
              :characters="pb.popularCharacters"
              :selected-character-id="pb.subject.kind === 'popular' ? pb.subject.characterId : ''"
              :selected-outfit-id="pb.subject.kind === 'popular' ? pb.subject.outfitId : ''"
              @select="selectPopularCharacter"
              @select-outfit="selectPopularOutfit"
            />
          </template>
        </div>

        <!-- Scenes -->
        <div class="panel step-panel" id="stepScene">
          <template v-if="pb.isPopular">
            <div class="panel-title">场景建议 · Blueprint<span class="scene-count-badge">{{ popularBlueprintPool.length }}</span></div>
            <PopularBlueprintPicker
              :pool="popularBlueprintPool"
              :categories="blueprintCategories"
              :recommended="recommendedBlueprints"
              :filtered="filteredPopularBlueprints"
              v-model:category="popularCategory"
              v-model:show-all="showAllBlueprints"
              :data-ready="pb.dataReady"
              :selected-blueprint-id="pb.subject.kind === 'popular' ? pb.subject.blueprintId ?? '' : ''"
              @select="selectBlueprint"
              @rotate="rotateBlueprintSet"
              @toggle="toggleBlueprintList"
            />
          </template>
          <template v-else>
            <div class="panel-title">Scene · <span class="scene-count-badge">{{ availableScenes.length }}</span></div>
            <div class="scene-scope" role="group" aria-label="场景库范围">
              <button type="button" :class="{ active: sceneCollection === 'core' }"
                :aria-pressed="sceneCollection === 'core'"
                @click="setSceneCollection('core')">人设核心 {{ personaCoreCount }}</button>
              <button type="button" :class="{ active: sceneCollection === 'curated' }"
                :aria-pressed="sceneCollection === 'curated'"
                @click="setSceneCollection('curated')">精选 {{ curatedCount }}</button>
              <button type="button" :class="{ active: sceneCollection === 'all' }"
                :aria-pressed="sceneCollection === 'all'"
                @click="setSceneCollection('all')">完整库</button>
            </div>
            <div class="scene-search-wrap">
              <input type="search" class="scene-search" v-model="pb.sceneSearch"
                placeholder="试试：安静的夏目雨夜">
              <button class="scene-search-clear" type="button" aria-label="清空"
                @click="pb.sceneSearch = ''">×</button>
            </div>
            <div class="scene-filter-summary">
              <span class="scene-result-count" role="status" aria-live="polite">
                {{ availableScenes.length }} 个场景
              </span>
              <button class="scene-filter-reset" type="button" @click="pb.sceneSearch = ''; pb.sceneTheme = 'all'">重置筛选</button>
            </div>
            <div class="scene-filter-label advanced-decision">主题</div>
            <div class="scene-cats advanced-decision">
              <button v-for="t in SCENE_THEMES" :key="t.id"
                class="scene-cat-btn" type="button"
                :class="{ active: pb.sceneTheme === t.id }"
                @click="pb.sceneTheme = t.id"><ArchiveIcon :name="t.iconName" /> {{ t.label }}</button>
            </div>
            <div class="scene-list">
              <div v-if="!pb.dataReady" class="scene-loading">正在加载场景库…</div>
              <div v-else-if="!availableScenes.length" class="scene-empty">未找到匹配场景</div>
              <button v-for="scene in visibleScenes" :key="scene.id"
                class="scene-card"
                :class="{ active: pb.sceneId === scene.id }"
                type="button"
                @click="selectScene(scene)">
                <div class="scene-card-title">
                  {{ scene.title }}
                  <span v-if="personaCoreIds.has(scene.id)" class="scene-core-mark">人设核心</span>
                </div>
                <div v-if="scene.story" class="scene-card-story">{{ scene.story }}</div>
                <div class="scene-card-meta">
                  <span v-if="scene.category" class="scene-cat-tag">{{ scene.category }}</span>
                  <span v-if="scene.rating && scene.rating !== 'All'" class="scene-rating-tag">{{ scene.rating }}</span>
                </div>
              </button>
              <button v-if="availableScenes.length > sceneLimit" class="btn btn-ghost scene-more"
                type="button" @click="sceneLimit += 20">
                显示更多 ({{ availableScenes.length - sceneLimit }} 个)
              </button>
            </div>
          </template>
        </div>

        <HistoryPanel class="advanced-decision"
          :history="pb.history"
          @resume="resumeHistory"
          @duplicate="duplicateHistory"
          @delete="deleteHistory"
          @to-shots="handleHistoryToShots"
          @to-shots-batch="handleHistoryToShotsBatch"
        />
      </div>

      <!-- ─── 中栏：监视器 ────────────────────────────────── -->
      <div class="director-col col-center">

        <!-- Stage placeholder -->
        <section
            v-show="!displayResultUrl"
          class="stage-placeholder"
          :class="{
            'is-generating': generationBusy,
            'is-error': !!generationError,
            'is-paused': generationStopped,
          }"
          aria-label="成片监看区"
        >
          <div class="stage-chrome">
            <span>CANVAS</span>
            <span class="stage-ready">
              {{ generationBusy ? 'RENDERING' : (generationError ? 'ATTENTION' : (generationStopped ? 'PAUSED' : 'READY')) }}
            </span>
          </div>
          <CornerFrame />
          <i class="stage-magic-ring" aria-hidden="true"></i>
          <img class="stage-muse nene" :src="stageMuseUrl.nene" alt="" aria-hidden="true" decoding="async">
          <img class="stage-muse natsume" :src="stageMuseUrl.natsume" alt="" aria-hidden="true" decoding="async">
          <div class="stage-message">
            <!-- 生成中：呼吸 + 进度，缓解等待焦虑 -->
            <div v-if="generationBusy" class="stage-generating-copy">
              <div class="stage-generating-title">正在绘制这一张</div>
              <div class="stage-generating-sub">{{ generationStatusText || '模型正在推理…' }}<template v-if="drawEngine === 'sd'"> {{ sd.progress.value }}%</template></div>
              <div class="stage-progress-ring"><i :style="{ '--progress': (drawEngine === 'sd' ? sd.progress.value : 35) + '%' }"></i></div>
            </div>
            <div v-else-if="generationError" class="stage-idle">
              <div class="stage-placeholder-title">这一张没有完成</div>
              <div class="stage-placeholder-copy">{{ generationError }}</div>
              <div class="stage-quick-actions">
                <button class="btn btn-primary" type="button" @click="callGenerate()">重新生成</button>
              </div>
            </div>
            <div v-else-if="generationStopped" class="stage-idle">
              <div class="stage-placeholder-title">生成已停止</div>
              <div class="stage-placeholder-copy">当前画布已安全暂停，可以调整内容后重新生成。</div>
              <div class="stage-quick-actions">
                <button class="btn btn-primary" type="button" @click="callGenerate()">重新生成</button>
              </div>
            </div>
            <div v-else class="stage-idle">
              <div class="stage-placeholder-title">心动成片将在此处呈现</div>
              <div class="stage-quick-actions">
                <button
                  v-if="drawEngine === 'anima'"
                  class="btn btn-ghost"
                  type="button"
                  title="导入任意外部本地图片，进行智能语义识别与局部换装"
                  @click="inpaintOpen = true"
                >
                  <ArchiveIcon name="wardrobe" />
                  <span>导入本地图片换装</span>
                </button>
                <button class="btn btn-ghost" type="button"
                  @click="router.push('/scene-explorer')">
                  探索灵感场景
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Result image -->
        <div v-if="displayResultUrl" class="result-image-wrap archive-canvas">
          <CornerFrame variant="ghost" />
          <!-- 换装前后滑动对比视图 -->
          <ImageSplitCompare
            v-if="inpaintCompareActive && inpaintOriginalUrl"
            :before-src="inpaintOriginalUrl"
            :after-src="displayResultUrl"
            before-label="换装前原图"
            after-label="换装后成片"
          />
          <img v-else class="result-image" :src="displayResultUrl" alt="生成的图片" />
          <div class="result-image-actions">
            <!-- 换装对比切换按钮 -->
            <button
              v-if="inpaintOriginalUrl && displayResultUrl"
              class="btn btn-ghost btn-compare-inpaint"
              :class="{ active: inpaintCompareActive }"
              type="button"
              :title="inpaintCompareActive ? '退出前后对比模式' : '左右滑动对比换装前后效果'"
              @click="inpaintCompareActive = !inpaintCompareActive"
            >
              <ArchiveIcon name="compare" />
              <span>{{ inpaintCompareActive ? '退出对比' : '换装前后对比' }}</span>
            </button>
            <button
              v-if="displayResultUrl && drawEngine === 'anima'"
              class="btn btn-ghost btn-inpaint-action"
              type="button"
              :disabled="generationBusy"
              title="锁定角色与背景，使用 AI 视觉语义识别一键更换服装"
              @click="inpaintOpen = true"
            >
              <ArchiveIcon name="wardrobe" />
              <span>局部换装</span>
            </button>
            <button
              v-if="displayResultUrl && (drawEngine === 'anima' || drawEngine === 'sd')"
              class="btn btn-ghost btn-hires-action"
              type="button"
              :disabled="generationBusy"
              title="使用 2x 潜空间超分放大 (4K 级精修)"
              @click="upscaleCurrentResult"
            >
              <ArchiveIcon name="spark" />
              <span>高清放大 2x (4K)</span>
            </button>
            <button
              v-if="displayResultUrl && (drawEngine === 'anima' || drawEngine === 'sd')"
              class="btn btn-ghost btn-video-action"
              type="button"
              :disabled="generationBusy"
              title="将当前成片作为首帧，到视频页生成短片（场景预设自动转视频提示词）"
              @click="goToVideo"
            >
              <ArchiveIcon name="play" />
              <span>出视频</span>
            </button>
            <button
              v-if="displayResultUrl && (drawEngine === 'anima' || drawEngine === 'sd')"
              class="btn btn-ghost btn-video-action"
              type="button"
              :disabled="generationBusy"
              title="把当前成片作为分镜首帧，攒齐后到「分镜短片」整批生成"
              @click="addToShots"
            >
              <ArchiveIcon name="gallery" />
              <span>加入分镜</span>
            </button>
            <button
              v-if="shotsPending > 0"
              class="btn btn-primary btn-video-action"
              type="button"
              title="到视频页「分镜短片」，生成已加入的镜头"
              @click="goToShots"
            >
              <ArchiveIcon name="play" />
              <span>去分镜短片（{{ shotsPending }}）</span>
            </button>
            <button class="btn btn-ghost" type="button" @click="saveResult">保存快照</button>
            <button class="btn btn-ghost" type="button" :disabled="!prevResult" @click="compareOpen = true">
              与上一张对比
            </button>
            <button class="btn btn-ghost" type="button" @click="clearDisplayedResult">清除</button>
          </div>
        </div>

        <div class="panel step-panel advanced-decision expert-tag-panel" id="stepTags">
          <div class="panel-title expert-tags-header">
            <span>词条工作台 · Tags <small class="expert-tag-count" v-if="pb.manualTags.size">已激活 {{ pb.manualTags.size }} 个</small></span>
            <button v-if="pb.manualTags.size" type="button" class="btn btn-ghost btn-xs clear-tags-btn" @click="pb.manualTags = new Set()">清空词条</button>
          </div>
          <div class="manual-tags" :class="{ empty: !pb.manualTags.size }">
            <span v-for="tag in pb.manualTags" :key="tag" class="manual-tag" :data-weight-tier="tagWeightTier(tag)" :title="tagMeaning(tag)">
              <span class="manual-tag-en">{{ tag }}</span>
              <span v-if="tagLabel(tag)" class="manual-tag-cn">{{ tagLabel(tag) }}</span>
              <button type="button" class="tag-remove" :aria-label="'移除词条 ' + tag" @click="pb.toggleManualTag(tag)">×</button>
            </span>
            <p v-if="!pb.manualTags.size" class="manual-tags-empty-hint">
              暂未激活微调词条。可在下方按分类点选预设、选择官方服装包，或直接搜索/输入 Danbooru 标签回车添加。
            </p>
          </div>
          <div v-if="!pb.isPopular" class="outfit-presets" aria-label="v18 官方服装词包">
            <div class="outfit-presets-head">
              <strong>v18 官方服装词包</strong>
              <span>一键加入训练原词，也可以继续单独选 tag</span>
            </div>
            <div class="outfit-preset-list">
              <button v-for="bundle in visibleOutfitBundles" :key="bundle.id"
                type="button" class="outfit-preset"
                :class="{ selected: bundle.tags.every(tag => pb.manualTags.has(tag)) }"
                :aria-pressed="bundle.tags.every(tag => pb.manualTags.has(tag))"
                @click="toggleOutfitBundle(bundle.tags)">
                <strong>{{ bundle.label }}</strong>
                <small>{{ bundle.tags.slice(0, 4).join(', ') }}{{ bundle.tags.length > 4 ? ' …' : '' }}</small>
              </button>
            </div>
            <div class="r18-controls" aria-label="R18 角色门控词">
              <div class="outfit-presets-head r18-controls-head">
                <strong>R18 角色门控词</strong>
                <span>按角色启用，仅在成人场景中选择</span>
              </div>
              <div class="outfit-preset-list">
              <button v-for="control in visibleR18Controls" :key="control.tag"
                type="button" class="outfit-preset r18-control"
                :class="{ selected: pb.manualTags.has(control.tag) }"
                :aria-pressed="pb.manualTags.has(control.tag)"
                @click="pb.toggleManualTag(control.tag)">
                <strong>{{ control.label }}</strong>
                <small>{{ control.tag }}</small>
              </button>
              </div>
            </div>
          </div>
          <p v-else class="popular-tags-note">热门角色不加载宁宁/夏目 LoRA 控制词；下方词条可直接用于专家模式微调，成人蓝图仅对成年角色可见。</p>
          <div class="tag-browser">
            <input v-model="tagSearch" class="tag-input" type="search" placeholder="搜索中文或 Danbooru 词条" />
            <div class="tag-categories" role="group" aria-label="词条分类">
              <button v-for="cat in tagCategories" :key="cat.id" type="button"
                :class="{ active: tagCategory === cat.id }"
                :aria-pressed="tagCategory === cat.id"
                @click="tagCategory = cat.id">{{ cat.label }}</button>
            </div>
            <div class="tag-results">
              <button v-for="tag in visibleTags" :key="tag.en" type="button"
                :class="{ selected: pb.manualTags.has(tag.en) }"
                :aria-pressed="pb.manualTags.has(tag.en)"
                :title="tagMeaning(tag.en, tag.cn)"
                @click="pb.toggleManualTag(tag.en)">
                <strong>{{ tagMeaning(tag.en, tag.cn) }}</strong><small>{{ tag.en }}</small>
              </button>
            </div>
          </div>
          <input class="tag-input" type="text" placeholder="也可以直接输入 Danbooru 标签后回车"
            @keydown.enter.prevent="addTag($event)" />
        </div>

        <PromptHealthPanel
          class="advanced-decision"
          :prompt="previewPromptView"
          :model-name="modelProfileView?.name"
          :report="reportView"
          :art-violations="artViolationsView"
          :lora-text="pb.isPopular ? '' : loraSpecs.map(s => s.name + ':' + s.weight).join(' · ')"
          :open="pb.directorMode === 'pro'"
          @copy="copyPrompt"
          @save="saveHistory"
        />

        <ArtistStylePicker
          v-if="pb.directorMode === 'pro'"
          :selected="pb.artistStyleIds"
          :engine="drawEngine"
          @update:selected="pb.setArtistStyleIds"
        />

        <!-- SD params -->
        <GenerationParamsPanel v-if="drawEngine === 'sd' && pb.directorMode === 'pro'"
          v-model:params="pb.sdParams"
          :samplers="sd.samplers.value"
          :schedulers="sd.schedulers.value"
          :result-seed="displayResultSeed"
          @touch="pb.markParamTouched"
          @reuse-seed="reuseLastSeed"
        />

        <!-- Result panel -->
        <div class="result-frame step-panel" id="stepResult">
          <div class="panel-title">输出 Result</div>

          <div v-if="pb.directorMode === 'pro'" class="engine-switch" role="group" aria-label="出图引擎">
            <button type="button" class="engine-btn" :class="{ active: drawEngine === 'sd' }"
              :disabled="generationBusy || pb.isPopular"
              :title="pb.isPopular ? '热门角色仅支持 Anima 无 LoRA 或 Krea 2' : undefined"
              @click="setDrawEngine('sd')">
              SD 引擎 <span class="engine-sub">{{ pb.isPopular ? '仅工作室角色' : 'WebUI · v18 LoRA' }}</span>
            </button>
            <button type="button" class="engine-btn" :class="{ active: drawEngine === 'anima' }"
              :disabled="generationBusy || (!pb.isPopular && pb.char === 'triad')" :title="(!pb.isPopular && pb.char === 'triad') ? '双人模式不支持 Anima，请使用 SD 引擎' : undefined"
              @click="setDrawEngine('anima')">
              Anima 引擎 <span class="engine-sub">{{ pb.isPopular ? 'Aesthetic · 无需 LoRA' : 'v20 LoRA' }}</span>
            </button>
            <button type="button" class="engine-btn" :class="{ active: drawEngine === 'krea2' }"
              :disabled="generationBusy || (!pb.isPopular && pb.char === 'triad')" :title="(!pb.isPopular && pb.char === 'triad') ? 'Krea 2 首版暂不支持双角色身份构图，请使用 SD 引擎' : undefined" @click="setDrawEngine('krea2')">
              Krea 2 <span class="engine-sub">{{ pb.isPopular ? '自然语言 · 身份优先' : 'ComfyUI · 自然语言实验' }}</span>
            </button>
          </div>

          <div v-if="pb.directorMode === 'pro'" class="base-model-picker">
            <label for="baseModel">底模</label>
            <select v-if="drawEngine === 'sd'" id="baseModel" v-model="pb.sdModelName" :disabled="generationBusy">
              <option value="">使用 WebUI 当前模型</option>
              <option v-for="model in sd.models.value" :key="model" :value="model">{{ model }}</option>
            </select>
            <select v-else id="baseModel" :value="animaState.modelId" :disabled="generationBusy" @change="selectAnimaModel">
              <option v-for="model in animaState.models" :key="model.id" :value="model.id" :disabled="model.available === false">
                {{ model.label || model.id }}{{ model.available === false ? ' · 资源缺失' : '' }}
              </option>
            </select>
          </div>

          <GenerationOutputControls
            :engine="drawEngine"
            :expert="pb.directorMode === 'pro'"
            :preset-summary="generationPresetSummary"
            v-model:params="pb.sdParams"
            v-model:size="sdSize"
            :vram-hint="vramHint"
            :vram-level="vramLevel"
            :base-resolution-risk="baseResolutionRisk"
            :base-resolution-hint="baseResolutionHint"
            :can-use-face-detailer="canUseFaceDetailer"
            :generating="generationBusy"
            :online="engineOnline"
            :result-seed="displayResultSeed"
            :has-result="Boolean(displayResultUrl)"
            :anima-hires-fix="Boolean(animaState.hiresFix)"
            :queue-available="pb.isPopular ? false : sdQueue.canEnqueue.value"
            @update:anima-hires-fix="patchAnimaState({ hiresFix: $event })"
            @upscale-current="upscaleCurrentResult"
            @touch="pb.markParamTouched"
            @generate="callGenerate"
            @cancel="cancelGeneration"
            @enqueue="enqueueCurrent"
            @enqueue-variants="enqueue3Variants"
            @reuse-seed="reuseLastSeed"
            @reset="resetAll"
          />

          <!-- 多场景批量出图入口 -->
          <div class="batch-entry-row">
            <button
              class="btn btn-ghost"
              type="button"
              :disabled="generationBusy || batchDraw.running.value"
              title="多选场景蓝图一次出齐，结果自动入册历史，可在历史里挑合适的加入分镜"
              @click="batchOpen = true"
            >批量出图 · 多场景</button>
            <span v-if="shotsPending" class="batch-entry-count">
              分镜待带入 {{ shotsPending }} 镜 · <button class="linklike" type="button" @click="goToShots">去分镜短片</button>
            </span>
          </div>

          <!-- Progress -->
          <div v-if="sd.generating.value" class="sd-result-area is-progress">
            <div class="sd-status">{{ sd.statusText.value }}</div>
            <div class="sd-progress"><span class="sd-progress-bar" :style="{ '--progress': sd.progress.value + '%' }"></span></div>
          </div>

          <SDRecoveryPanel :report="sdErrorReport" @recover="runRecovery" @dismiss="dismissError" />
          <GenerationQueuePanel v-if="drawEngine === 'sd'"
            :total="sdQueue.total.value"
            :paused="sdQueue.paused.value"
            :active-job="sdQueue.activeJob.value"
            :queue="sdQueue.queue.value"
            @pause="sdQueue.pause"
            @resume="sdQueue.resume"
            @clear="sdQueue.clear"
            @remove="sdQueue.remove"
          />

          <VoiceStudio
            :key="pb.sceneId || 'freeform'"
            ref="voiceStudioRef"
            :initial-voice="pb.char === 'natsume' ? 'natsume' : 'nene'"
            :suggested-caption="pb.activeScene?.story || pb.story"
          />

          <BatchSceneDrawPanel
            :open="batchOpen"
            :scenes="sceneStore.sceneBlueprints"
            :engine="batchEngine"
            :sd-available="sd.online.value"
            :anima-available="animaState.online"
            :running="batchDraw.running.value"
            :jobs="batchDraw.jobs.value"
            :progress="batchDraw.progress.value"
            @close="batchOpen = false"
            @update:engine="batchEngine = $event"
            @start="onBatchStart"
            @cancel="batchDraw.cancel"
          />
        </div>

        <AnimaQuickPanel v-if="drawEngine !== 'sd' && pb.directorMode === 'pro'"
          :state="animaState"
          :no-lora="animaNoLoraMode"
          @update:state="patchAnimaState"
        />
      </div>

      <!-- ─── 右栏：风格 ───────────────────────────────────── -->
      <div class="director-col col-right">

        <!-- Emotion -->
        <details class="panel step-panel advanced-decision decision-fold" id="stepEmotion">
          <summary class="panel-title decision-summary">
            <span>情绪 · Emotion</span>
            <span class="decision-current">{{ emotionSummary }}</span>
          </summary>
          <div class="emotion-list">
            <button v-for="e in EMOTION" :key="e.id"
              class="option" type="button"
              :class="{ selected: pb.selections.emotion.includes(e.id) }"
              @click="pb.toggleEmotion(e.id)">
              <span class="opt-icon"><ArchiveIcon :name="e.iconName" /></span>
              <span class="opt-name">{{ e.name }}</span>
            </button>
          </div>
        </details>

        <!-- Camera / Shot -->
        <details class="panel step-panel advanced-decision decision-fold" id="stepCamera">
          <summary class="panel-title decision-summary">
            <span>镜头 · Camera</span>
            <span class="decision-current">{{ shotSummary }}</span>
          </summary>
          <div class="camera-list">
            <button v-for="s in SHOT" :key="s.id"
              class="option" type="button"
              :class="{ selected: pb.selections.shot === s.id }"
              @click="pb.setShot(pb.selections.shot === s.id ? null : s.id)">
              <span class="opt-icon"><ArchiveIcon :name="s.iconName" /></span>
              <span class="opt-name">{{ s.name }}</span>
            </button>
          </div>
        </details>

        <!-- Lighting -->
        <details class="panel step-panel advanced-decision decision-fold" id="stepLighting">
          <summary class="panel-title decision-summary">
            <span>光照 · Lighting</span>
            <span class="decision-current">{{ lightingSummary }}</span>
          </summary>
          <div class="lighting-list">
            <button v-for="l in LIGHTING" :key="l.id"
              class="option" type="button"
              :class="{ selected: pb.selections.lighting === l.id }"
              @click="pb.setLighting(pb.selections.lighting === l.id ? null : l.id)">
              <span class="opt-icon"><ArchiveIcon :name="l.iconName" /></span>
              <span class="opt-name">{{ l.name }}</span>
            </button>
          </div>
        </details>

        <!-- Composition -->
        <details class="panel step-panel advanced-decision decision-fold" id="stepComposition">
          <summary class="panel-title decision-summary">
            <span>构图 · Composition</span>
            <span class="decision-current">{{ compositionSummary }}</span>
          </summary>
          <div class="comp-list">
            <button v-for="c in COMPOSITION" :key="c.id"
              class="option" type="button"
              :class="{ selected: pb.selections.composition === c.id }"
              @click="pb.setComposition(pb.selections.composition === c.id ? null : c.id)">
              <span class="opt-icon"><ArchiveIcon :name="c.iconName" /></span>
              <span class="opt-name">{{ c.name }}</span>
            </button>
          </div>
        </details>

        <!-- Color Mood -->
        <details class="panel step-panel advanced-decision decision-fold" id="stepMood">
          <summary class="panel-title decision-summary">
            <span>色彩情调 · Mood</span>
            <span class="decision-current">{{ moodSummary }}</span>
          </summary>
          <div class="mood-grid">
            <button v-for="m in COLOR_MOODS" :key="m.id"
              class="mood-card" type="button"
              :class="{ active: pb.colorMood === m.id }"
              @click="pb.setColorMood(pb.colorMood === m.id ? null : m.id)">
              <span class="mood-icon"><ArchiveIcon :name="m.iconName" /></span>
              <span class="mood-name">{{ m.name }}</span>
              <span class="mood-desc">{{ m.desc }}</span>
            </button>
          </div>
        </details>

      </div>
    </div>

    <!-- Toast -->
    <div v-if="pb.toastMsg" class="pb-toast" role="status" aria-live="polite">{{ pb.toastMsg }}</div>

    <!-- 出图大图对比：上一张 vs 当前 -->
    <Teleport to="body">
      <div v-if="compareOpen && prevResult && lastResult" class="pb-compare-overlay" @click.self="closeCompare">
        <div ref="compareEl" class="pb-compare" role="dialog" aria-modal="true" aria-label="出图对比">
          <div class="pb-compare-head">
            <div>
              <div class="pb-compare-kicker">Result compare</div>
              <h3>与上一张对比</h3>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" @click="closeCompare">关闭</button>
          </div>
          <div class="pb-compare-grid">
            <figure v-for="(snap, index) in [prevResult, lastResult]" :key="index" class="pb-compare-card">
              <div class="pb-compare-visual">
                <img :src="snap.url" :alt="'对比图 ' + (index + 1)" loading="eager" decoding="async" />
                <span class="pb-compare-tag" :class="{ current: index === 1 }">{{ index === 0 ? '上一张' : '当前' }}</span>
              </div>
              <figcaption class="pb-compare-facts">
                <span>Seed {{ snap.seed ?? '随机' }}</span>
                <span>{{ snap.size }}</span>
                <span>{{ snap.sampler }}</span>
                <span>CFG {{ snap.cfg }}</span>
                <span>Steps {{ snap.steps }}</span>
                <span>Hires {{ snap.hires }}</span>
                <span class="pb-compare-time">{{ snap.at }}</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Anima 智能局部换装弹窗 -->
    <Teleport to="body">
      <AnimaInpaintModal
        :open="inpaintOpen"
        :image-url="displayResultUrl"
        :image-blob="animaState.result?.blob"
        :current-prompt="livePrompt"
        :current-negative="negativePrompt"
        :character="inpaintCharacter"
        :adult-enabled="pb.showMatureScenes"
        :seed="displayResultSeed"
        :submitting="generationBusy"
        @close="inpaintOpen = false"
        @submit="handleInpaintSubmit"
      />
    </Teleport>
  </article>
</template>

<script setup lang="ts">
// 导演台专属样式（91.6KB）随本路由块加载，不再进全局包
import '@/assets/css/director.css'
import { ref, computed, nextTick, onMounted, watch, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  usePromptBuilderStore,
  type CharKey,
  type HistoryEntry,
  type Scene,
} from '@/stores/promptBuilderStore'
import { useSceneStore } from '@/stores/sceneStore'
import { usePopularPromptAssembly } from '@/composables/usePopularPromptAssembly'
import { usePromptVideoBridge } from '@/composables/usePromptVideoBridge'
import { usePromptHistoryApply } from '@/composables/usePromptHistoryApply'
import { usePromptBatchRunners } from '@/composables/usePromptBatchRunners'
import { usePromptTagTools } from '@/composables/usePromptTagTools'
import { usePromptDeepLink } from '@/composables/usePromptDeepLink'
import {
  blueprintCategories as collectBlueprintCategories,
  eligibleBlueprints,
  findBlueprint as findPopularBlueprint,
  findCharacter as findPopularCharacter,
  inferBlueprintDecisions,
  recommendBlueprints,
  type PopularCharacter,
  type SceneBlueprint,
} from '@/utils/popularContent'
import type { AnimaResult } from '@/types/anima'
import { useAnimaSession, closestSupportedSize, ANIMA_LORA_BY_CHARACTER, ANIMA_CHARACTER_BY_CHARACTER, type AnimaRequest } from '@/composables/useAnimaSession'
import { useAnimaInpaint } from '@/composables/useAnimaInpaint'
import { useSDGenerate } from '@/composables/useSDGenerate'
import { usePromptAssembly } from '@/composables/usePromptAssembly'
import { EMOTION, SHOT, LIGHTING, COMPOSITION, COLOR_MOODS, SCENE_THEMES } from '@/config/promptConstants'
import { usePromptSdQueue } from '@/composables/usePromptSdQueue'
import { imgGet } from '@/composables/useImageStore'
import { classifySDError, SAFE_SAMPLING, LIGHT_LOAD, type SDErrorReport, type SDRecoveryId } from '@/utils/sdError'
import { useDirectorCatalog } from '@/composables/useDirectorCatalog'
import { useDirectorDerived } from '@/composables/useDirectorDerived'
import { useCompareSnapshots } from '@/composables/useCompareSnapshots'
import { characterParticleTheme } from '@/utils/characterParticleTheme'
// 折叠面板内的重量级组件走异步加载：它们不参与首屏渲染，按需下载可显著
// 降低导演台路由块体积（预算上限 JS 128KB / CSS 100KB）。
const VoiceStudio = defineAsyncComponent(() => import('@/components/VoiceStudio.vue'))
const PromptDataTools = defineAsyncComponent(() => import('@/components/PromptDataTools.vue'))
const PromptHealthPanel = defineAsyncComponent(() => import('@/components/PromptHealthPanel.vue'))
const GenerationQueuePanel = defineAsyncComponent(() => import('@/components/GenerationQueuePanel.vue'))
const GenerationParamsPanel = defineAsyncComponent(() => import('@/components/GenerationParamsPanel.vue'))
const GenerationOutputControls = defineAsyncComponent(() => import('@/components/GenerationOutputControls.vue'))
const SDRecoveryPanel = defineAsyncComponent(() => import('@/components/SDRecoveryPanel.vue'))
const AnimaQuickPanel = defineAsyncComponent(() => import('@/components/AnimaQuickPanel.vue'))
const BatchSceneDrawPanel = defineAsyncComponent(() => import('@/components/BatchSceneDrawPanel.vue'))
const AnimaInpaintModal = defineAsyncComponent(() => import('@/components/AnimaInpaintModal.vue'))
const ArtistStylePicker = defineAsyncComponent(() => import('@/components/ArtistStylePicker.vue'))
const HistoryPanel = defineAsyncComponent(() => import('@/components/HistoryPanel.vue'))
const ManagedDrawingRouteCard = defineAsyncComponent(() => import('@/components/ManagedDrawingRouteCard.vue'))
const ImageSplitCompare = defineAsyncComponent(() => import('@/components/visual/ImageSplitCompare.vue'))
import ArchiveIcon, { type ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'
import CornerFrame from '@/components/visual/CornerFrame.vue'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import { readHiddenScenes, rememberRecent, recordSceneUsage } from '@/utils/sceneUX'
import {
  quickCreateSummary,
  readQuickCreate,
  type QuickCreateSettings,
} from '@/utils/quickCreate'
import {
  DRAW_ENGINE_SETTING,
  settingsRepository,
  type DrawEngine,
} from '@/storage/settingsRepository'
import type { DrawingRouteRecommendation } from '@/utils/drawingRoute'

// 热门角色面板按需懒加载：仅在 isPopular 时渲染，避免常驻占用主 chunk。
const PopularCharacterPicker = defineAsyncComponent(() => import('@/components/popular/PopularCharacterPicker.vue'))
const PopularBlueprintPicker = defineAsyncComponent(() => import('@/components/popular/PopularBlueprintPicker.vue'))

const router = useRouter()
const route = useRoute()
const pb = usePromptBuilderStore()
const sceneStore = useSceneStore()
const sd = useSDGenerate()

const {
  storyChips,
  charOptions,
} = useDirectorCatalog()

// 与 config/characters.ts 共用 Express 服务的同一份角色立绘 URL。
// 之前写成静态 src="/assets/..."，Vite transformAssetUrls 会在构建时把它
// 打包进 dist/_app 生成 hashed 副本 —— 同一张图两套缓存，还多占 ~163KB。
const stageMuseUrl = {
  nene: '/assets/characters/nene-official.webp',
  natsume: '/assets/characters/natsume-official.webp',
}

// ── UI state ──────────────────────────────────────────────────────────────
const sceneLimit = ref(20)
const sdSize = ref('832x1216')
const sceneCollection = ref<'core' | 'curated' | 'all'>('core')
const hiddenSceneIds = ref(readHiddenScenes())
const tagSearch = ref('')
const tagCategory = ref('all')
const voiceStudioRef = ref<{ setSuggestedCaption?: (caption: string) => void } | null>(null)
const DIRECTOR_MODE_KEY = 'aics_pb_director_mode'

const storedDrawEngine = settingsRepository.get(DRAW_ENGINE_SETTING)
const drawEngine = ref<DrawEngine>(storedDrawEngine ?? 'sd')
const animaSession = useAnimaSession({
  getCharacter: () => pb.char,
  isPopular: () => pb.isPopular,
  getFamily: () => drawEngine.value === 'krea2' ? 'krea2' : 'anima',
  getRequest: () => buildAnimaRequest(),
  onResult: result => onAnimaResult(result),
  flash: message => pb.flash(message),
  preferredSize: () => pb.lastRecommendedSize,
})
const {
  state: animaState,
  patchState: patchAnimaState,
  modelId: animaModelId,
  refreshBackend: refreshAnimaBackend,
  syncCharacter: syncAnimaCharacter,
  applyModel,
  generate: generateAnima,
  cancel: cancelAnimaJob,
  clearResult: clearAnimaResult,
  startStatusPolling,
} = animaSession

function selectAnimaModel(event: Event) {
  applyModel((event.target as HTMLSelectElement).value)
}

// ── Derived（场景筛选 / 词条目录 / 摘要 / 显存提示）──────────────────────
const {
  emotionSummary,
  shotSummary,
  lightingSummary,
  compositionSummary,
  moodSummary,
  personaCoreIds,
  availableScenes,
  visibleScenes,
  personaCoreCount,
  curatedCount,
  tagCategories,
  tagCatalog,
  visibleTags,
  visibleOutfitBundles,
  visibleR18Controls,
  modeDescription,
  vramLevel,
  baseResolutionRisk,
  vramHint,
  baseResolutionHint,
  canUseFaceDetailer,
} = useDirectorDerived({
  pb,
  hiddenSceneIds,
  sceneCollection,
  sceneLimit,
  tagSearch,
  tagCategory,
  sdSize,
})

// ── Prompt 组装 ───────────────────────────────────────────────────────────
const {
  currentTraits,
  modelProfile,
  effectiveScene,
  loraSpecs,
  positivePrompt,
  negativePrompt,
  promptReport,
  artViolations,
  previewPrompt,
} = usePromptAssembly(pb, sd.checkpoint, drawEngine, animaModelId, computed(() => animaState.value.loraId))

// 热门角色无 LoRA：与工作室路径正交，绝不流经 pb.charPrompt / characterControlTokens。
const popular = usePopularPromptAssembly(pb, drawEngine, animaModelId)
const livePrompt = computed(() => pb.isPopular ? popular.positivePrompt.value : positivePrompt.value)
const effectiveNegative = computed(() => pb.isPopular ? popular.negativePrompt.value : negativePrompt.value)
const previewPromptView = computed(() => pb.isPopular ? popular.previewPrompt.value : previewPrompt.value)
const modelProfileView = computed(() => pb.isPopular ? popular.profile.value : modelProfile.value)
const reportView = computed(() => pb.isPopular ? popular.promptReport.value : promptReport.value)
const artViolationsView = computed(() => pb.isPopular ? popular.artViolations.value : artViolations.value)

/** 热门角色 Anima 无 LoRA：仅 popular subject + 选中底模的 noLora capability 时成立。 */
const animaNoLoraMode = computed(() => {
  if (!pb.isPopular) return false
  if (animaState.value.family === 'krea2') return false
  const selected = animaState.value.models.find(model => model.id === animaState.value.modelId)
  return selected?.capabilities?.noLora === true
})

// ── 热门角色派生状态 ───────────────────────────────────────────────────────
const popularSearch = ref('')
const popularCategory = ref('all')
const showAllBlueprints = ref(false)
const blueprintCursor = ref(0)
const previousBlueprintIds = ref<string[] | null>(null)

const popularCharacter = computed<PopularCharacter | null>(() => {
  if (pb.subject.kind !== 'popular') return null
  return findPopularCharacter(pb.popularCharacters, pb.subject.characterId)
})
/** 顶部档案条的粒子形状：热门角色跟随她的专属轮廓（与角色场景库/角色档案一致），
    工作室角色按模式区分（专家=spark / 场景=frame）。 */
const archiveBarShape = computed(() => {
  if (pb.isPopular) {
    return popularCharacter.value
      ? characterParticleTheme(popularCharacter.value.id, popularCharacter.value.franchise).shape
      : 'moon' as const
  }
  return pb.directorMode === 'pro' ? 'spark' as const : 'frame' as const
})
const managedRoute = ref<DrawingRouteRecommendation | null>(null)
async function refreshManagedRoute(): Promise<DrawingRouteRecommendation> {
  const { recommendDrawingRoute } = await import('@/utils/drawingRoute')
  const route = recommendDrawingRoute({
    subjectKind: pb.isPopular ? 'popular' : 'studio',
    character: pb.char,
    recommendedModelId: popularCharacter.value?.recommendedEngine,
  })
  managedRoute.value = route
  return route
}
const popularBlueprintPool = computed(() =>
  eligibleBlueprints(pb.sceneBlueprints, popularCharacter.value, { adultEnabled: pb.showMatureScenes }),
)
const filteredPopularBlueprints = computed(() =>
  eligibleBlueprints(pb.sceneBlueprints, popularCharacter.value, {
    adultEnabled: pb.showMatureScenes,
    category: popularCategory.value,
  }),
)
const blueprintCategories = computed(() =>
  collectBlueprintCategories(popularBlueprintPool.value.filter(blueprint => !blueprint.adult || (popularCharacter.value?.adultEligibility === 'adult' && pb.showMatureScenes))),
)
const recommendedBlueprints = computed(() => {
  const pool = popularBlueprintPool.value
  if (!pool.length) return []
  if (pb.subject.kind !== 'popular') return pool.slice(0, 3)
  const key = `${pb.subject.characterId}#${pb.subject.outfitId}`
  return recommendBlueprints(pool, key, blueprintCursor.value, previousBlueprintIds.value, 3)
})

// ── 出图对比：记住上一张结果，生成新图后可并排大图对比 ──────────────
// URL 克隆保活/延迟释放/token 防乱序/焦点陷阱等生命周期归
// useCompareSnapshots（2026-08-21 拆出）；这里只保留业务元数据组装。
interface ResultSnapshot {
  url: string
  seed: number | null
  styleLoraId: string | null
  size: string
  sampler: string
  cfg: number
  steps: number
  hires: string
  at: string
}
const compare = useCompareSnapshots<ResultSnapshot>({
  build: (url) => buildResultSnapshot(url),
})
// 模板沿用原名绑定
const { prevResult, lastResult, compareOpen, compareEl, close: closeCompare } = compare

/** 快照业务字段：URL 已由 composable 克隆保活，这里只读引擎状态组装元数据。 */
function buildResultSnapshot(persistentUrl: string): ResultSnapshot {
  const metadata = animaState.value.result?.metadata
  const isComfy = drawEngine.value !== 'sd'
  return {
    url: persistentUrl,
    seed: displayResultSeed.value ?? (isComfy ? metadata?.seed ?? null : (pb.sdParams.seedLock && pb.sdParams.seed >= 0 ? pb.sdParams.seed : null)),
    styleLoraId: isComfy ? ((metadata?.styleLoraId ?? animaState.value.styleLoraId) || null) : null,
    size: isComfy ? `${metadata?.width ?? animaState.value.width}x${metadata?.height ?? animaState.value.height}` : sdSize.value,
    sampler: isComfy ? (metadata?.sampler ?? animaState.value.sampler) : (pb.sdParams.sampler || sd.samplers.value[0] || '—'),
    cfg: isComfy ? (metadata?.cfg ?? animaState.value.cfg) : pb.sdParams.cfg,
    steps: isComfy ? (metadata?.steps ?? animaState.value.steps) : pb.sdParams.steps,
    hires: isComfy ? '关' : (pb.sdParams.hiresFix ? `×${pb.sdParams.hiresScale ?? 1.5}` : '关'),
    at: new Date().toLocaleTimeString(),
  }
}

// ── Actions ───────────────────────────────────────────────────────────────
function setDirectorMode(mode: 'basic' | 'pro') {
  pb.directorMode = mode
  sceneCollection.value = mode === 'basic' ? 'core' : 'all'
  sceneLimit.value = 20
  syncManagedRoute()
}

function setSceneCollection(collection: 'core' | 'curated' | 'all') {
  if (collection === 'all' && pb.directorMode === 'basic') {
    setDirectorMode('pro')
    return
  }
  sceneCollection.value = collection
  sceneLimit.value = 20
}

function applyRecommendedSize(size: string) {
  const normalized = size.replace('×', 'x')
  sdSize.value = normalized
  const activeModel = animaState.value.models.find(model => model.id === animaState.value.modelId)
  const supported = closestSupportedSize(activeModel, normalized)
  const [width, height] = supported.split('x').map(Number)
  if (Number.isInteger(width) && Number.isInteger(height)) patchAnimaState({ width, height })
}

const currentBlueprintData = computed(() => ({
  char: pb.char,
  sceneId: pb.sceneId,
  story: pb.story,
  manualTags: Array.from(pb.manualTags),
  drawEngine: drawEngine.value,
  sdParams: { ...pb.sdParams },
  size: sdSize.value,
}))

function handleLoadBlueprint(data: Record<string, unknown>) {
  if (data.char && (data.char === 'nene' || data.char === 'natsume' || data.char === 'triad')) {
    pb.setChar(data.char)
  }
  if (typeof data.sceneId === 'string' && data.sceneId) {
    const sc = pb.scenes.find(s => s.id === data.sceneId)
    if (sc) selectScene(sc)
  }
  if (typeof data.story === 'string') {
    pb.story = data.story
  }
  if (Array.isArray(data.manualTags)) {
    pb.manualTags = new Set(data.manualTags.map(String))
  }
  if (typeof data.drawEngine === 'string' && (data.drawEngine === 'anima' || data.drawEngine === 'sd' || data.drawEngine === 'krea2')) {
    setDrawEngine(data.drawEngine as DrawEngine)
  }
  if (data.sdParams && typeof data.sdParams === 'object') {
    Object.assign(pb.sdParams, data.sdParams)
  }
  if (typeof data.size === 'string' && data.size) {
    sdSize.value = data.size
  }
}

async function applyManagedRoute(options: { silent?: boolean } = {}): Promise<void> {
  const route = await refreshManagedRoute()
  if (generationBusy.value) return
  const selectedModel = route.engine === 'sd'
    ? pb.sdModelName || sd.checkpoint.value
    : animaState.value.modelId
  const alreadyApplied = drawEngine.value === route.engine
    && selectedModel.includes(route.modelId)
    && (route.engine === 'sd' || route.engine === 'krea2' || animaState.value.loraId === route.loraId)
  if (alreadyApplied) return
  if (route.engine !== drawEngine.value) setDrawEngine(route.engine)
  if (route.engine === 'sd') {
    const model = sd.models.value.find(item => item.includes(route.modelId))
    if (model) {
      pb.sdModelName = model
      pb.applyModelProfile(model, { applySize: false })
    }
    applyRecommendedSize(pb.lastRecommendedSize)
  } else {
    if (animaState.value.modelId !== route.modelId) applyModel(route.modelId)
    patchAnimaState({ loraId: route.loraId, styleLoraId: '' })
    await refreshAnimaBackend()
  }
  if (!options.silent) pb.flash(`已采用${route.title}`)
}

function syncManagedRoute() {
  void (pb.directorMode === 'basic' ? applyManagedRoute({ silent: true }) : refreshManagedRoute())
}

function selectScene(scene: Scene) {
  if (pb.isPopular) {
    // 热门角色模式直接切到工作室场景（?scene= 深链/左侧场景卡）：立即刷新 Anima
    // 后端白名单，让 studio 的宁宁/夏目模型与 LoRA 立即可选（不等 15s 轮询）；
    // subject 切回 studio 由 loadScene 内部兜底，保证提示词跟随本场景。
    void refreshAnimaBackend()
  }
  pb.loadScene(scene)
  pb.applyModelProfile(pb.sdModelName || sd.checkpoint.value, { applySize: false })
  applyRecommendedSize(pb.lastRecommendedSize)
  patchAnimaState({ styleLoraId: '' })
  voiceStudioRef.value?.setSuggestedCaption?.(scene.story ?? '')
  rememberRecent(scene)
  recordSceneUsage(scene)
  sceneLimit.value = 20
  syncManagedRoute()
}

function detachScene() {
  if (!pb.sceneId) return
  pb.clearScene({ keepStory: true })
  pb.flash('已脱离场景，仅保留故事')
}

// ── 热门角色无 LoRA 模式 ─────────────────────────────────────────────────
function resetBlueprintRotation() {
  blueprintCursor.value = 0
  previousBlueprintIds.value = null
  showAllBlueprints.value = false
  popularCategory.value = 'all'
}

/** 按角色推荐引擎切 drawEngine；角色切回/切换后立即恢复正确的 model/lora 列表。 */
function applyRecommendedEngine(character: PopularCharacter | null) {
  const target = character?.recommendedEngine === 'krea2-turbo-fp8' ? 'krea2' : 'anima'
  if (drawEngine.value !== target) setDrawEngine(target)
}

function selectPopularSource(source: 'studio' | 'popular') {
  if (source === 'studio' && pb.isPopular) {
    pb.clearScene({ keepStory: true })
    pb.setStudioSubject()
    // 立即恢复 nene/natsume 的 model/lora 白名单，不等 15s 状态轮询。
    void refreshAnimaBackend()
    syncManagedRoute()
    pb.flash('已切回工作室角色（宁宁 / 夏目 LoRA 路径）')
    return
  }
  if (source === 'popular' && !pb.isPopular) {
    // 进入热门模式：整体清空工作室场景、词条、画面描述与故事。热门组装不读
    // story，且故事属于 studio 场景/蓝图的上下文——不清的话故事框会残留上一个
    // 宁宁/夏目场景的故事（裸 ?popular= 深链/页内切换均可见）。选中蓝图后故事
    // 由 selectBlueprint 写回蓝图的 description。
    pb.clearScene()
    resetBlueprintRotation()
    if (pb.popularCharacters.length) {
      const first = pb.popularCharacters[0]
      pb.setPopularSubject(first.id, first.outfits.find(o => o.default)?.id ?? first.outfits[0].id, null)
      patchAnimaState({ modelId: first.recommendedEngine })
      applyRecommendedEngine(first)
    } else {
      pb.setPopularSubject('', '')
    }
    void refreshAnimaBackend()
    syncManagedRoute()
    pb.flash('已切换到热门角色：默认 Anima Aesthetic 无 LoRA，可改 Krea 2')
  }
}

function selectPopularCharacter(character: PopularCharacter) {
  if (pb.subject.kind !== 'popular' || pb.subject.characterId === character.id) return
  const outfitId = character.outfits.find(o => o.default)?.id ?? character.outfits[0].id
  pb.setPopularSubject(character.id, outfitId, null)
  pb.visualDescription = ''
  resetBlueprintRotation()
  // recommendedEngine 为 Krea 时直接切 krea2 引擎（当前数据全 aesthetic，仍保留分支防死字段）。
  applyRecommendedEngine(character)
  patchAnimaState({ modelId: character.recommendedEngine })
  syncManagedRoute()
  if (pb.directorMode === 'pro') void refreshAnimaBackend()
}

function selectPopularOutfit(outfitId: string) {
  if (pb.subject.kind !== 'popular') return
  pb.setPopularSubject(pb.subject.characterId, outfitId, pb.subject.blueprintId)
  patchAnimaState({ styleLoraId: '' })
  resetBlueprintRotation()
}

function selectBlueprint(blueprint: SceneBlueprint) {
  if (pb.subject.kind !== 'popular') return
  // 若蓝图本身绑定了专属服装形态（如泳池蓝图绑定 summer_swimsuit_night），
  // 则自动将当前角色的服装同步切换到该形态，确保生图与故事描述 100% 一致。
  const targetOutfitId = blueprint.outfitId || pb.subject.outfitId
  pb.setPopularSubject(pb.subject.characterId, targetOutfitId, blueprint.id)
  const decision = inferBlueprintDecisions(blueprint)
  if (decision.shot) pb.setShot(decision.shot)
  if (decision.lighting) pb.setLighting(decision.lighting)
  pb.setComposition(decision.composition)
  pb.setColorMood(decision.colorMood)
  // 蓝图推荐尺寸必须收敛到当前底模白名单：Krea 已激活时 832x1216 会让
  // 服务端 400 INVALID_PARAMETER。
  applyRecommendedSize(decision.size)
  patchAnimaState({ styleLoraId: '' })
  pb.visualDescription = ''
  // 场景故事跟随所选蓝图（与工作室 selectScene → loadScene 写 story 对齐）：
  // 否则从工作室切热门后 story 框会残留上一个场景的故事。
  pb.setStory(blueprint.description)
  pb.flash(`已选用场景「${blueprint.title}」，服装/镜头/光照已自动适配`)
}

function rotateBlueprintSet() {
  previousBlueprintIds.value = recommendedBlueprints.value.map(blueprint => blueprint.id)
  blueprintCursor.value += 1
}

function toggleBlueprintList() {
  showAllBlueprints.value = !showAllBlueprints.value
}

function onStoryInput() {
  // Clear scene context if user edits story away from scene's default
  if (pb.sceneId && pb.story !== pb.sceneBaseStory) {
    detachScene()
  }
}

// ── 出图 + 队列 + 错误恢复 ──────────────────────────────────────────────────
// 引擎统一结果：Anima 结果带不可变 job metadata，历史不再读取当前面板状态。
// 会话（useAnimaSession）已写入 result/job/phase；这里只做跨引擎互斥协调。
function onAnimaResult(_result: AnimaResult) {
  sd.clearResult()
}
function clearDisplayedResult() {
  if (drawEngine.value === 'sd') sd.clearResult()
  else clearAnimaResult()
}
const displayResultUrl = computed(() => drawEngine.value !== 'sd' ? (animaState.value.result?.url ?? '') : sd.resultUrl.value)
const displayResultSeed = computed(() => drawEngine.value !== 'sd' ? animaState.value.result?.metadata.seed ?? null : sd.resultSeed.value)

// 新一轮生成开始时结果会被清空，完成后再写入新值；
// 因此只在"有值且与上一张不同"时轮转快照（SD 与 Anima 结果共用）。
// 快照 blob 克隆保活与 token 防乱序在 useCompareSnapshots 内部处理。
watch(displayResultUrl, (url, oldUrl) => {
  if (!url || url === oldUrl) return
  compare.rotate(url)
})

function setDrawEngine(v: DrawEngine) {
  if (v === 'sd' && pb.isPopular) {
    pb.flash('热门角色仅支持 Anima 无 LoRA 或 Krea 2，请保留 Comfy 引擎')
    return
  }
  if (v !== 'sd' && pb.char === 'triad' && !pb.isPopular) {
    pb.flash(v === 'krea2' ? 'Krea 2 首版暂不支持双角色身份构图，请使用 SD 引擎' : 'Anima 首版暂不支持双角色身份构图，请使用 SD 引擎')
    return
  }
  if (drawEngine.value === v) {
    return
  }
  try {
    settingsRepository.set(DRAW_ENGINE_SETTING, v)
  } catch {
    pb.flash('绘图引擎设置保存失败')
    return
  }
  drawEngine.value = v
  patchAnimaState({ styleLoraId: '' })
  if (v !== 'sd') {
    syncAnimaCharacter(pb.char)
    void refreshAnimaBackend()
  }
  pb.flash(v === 'anima'
    ? (pb.isPopular ? '已切换到 Anima Aesthetic（无 LoRA 热门角色模式）' : '已切换到 Anima 引擎（ComfyUI + 角色 LoRA）')
    : v === 'krea2' ? '已切换到 Krea 2（自然语言、无角色 LoRA，身份不保证）' : '已切换到 SD 引擎（WebUI）')
}

// Anima 模式下生成按钮的可用性取决于 ComfyUI 在线状态，而不是 SD WebUI。
const engineOnline = computed(() => {
  if (drawEngine.value === 'anima') {
    if (pb.isPopular) {
      return animaState.value.online
        && animaState.value.models.some(model => model.id === animaState.value.modelId && model.available !== false)
    }
    return pb.char !== 'triad' && Boolean(animaState.value.loraId) && animaState.value.online
      && animaState.value.models.some(model => model.id === animaState.value.modelId && model.available !== false)
      && animaState.value.loras.some(lora => lora.id === animaState.value.loraId && lora.available !== false)
  }
  if (drawEngine.value === 'krea2') return animaState.value.online
    && animaState.value.models.some(model => model.id === animaState.value.modelId && model.available !== false)
  return sd.online.value
})
const generationBusy = computed(() => sd.generating.value || ['submitting', 'running', 'cancelling'].includes(animaState.value.phase))
const drawEngineLabel = computed(() => drawEngine.value === 'sd' ? 'SD' : drawEngine.value === 'anima' ? 'Anima' : 'Krea 2')
const generationStatusText = computed(() => drawEngine.value === 'sd' ? sd.statusText.value : animaState.value.statusText)
const generationError = computed(() => drawEngine.value === 'sd' ? sd.errorMsg.value : animaState.value.errorMsg)
const generationStopped = computed(() => drawEngine.value === 'sd'
  ? sd.statusText.value === '已停止'
  : animaState.value.phase === 'cancelled')
const engineStatusText = computed(() => {
  if (drawEngine.value === 'sd') return 'SD 未连接'
  return animaState.value.checkMsg || `${drawEngineLabel.value} 未连接`
})

async function recheckEngineConnection() {
  if (drawEngine.value === 'sd') {
    const ok = await sd.checkStatus()
    pb.flash(ok ? 'SD 已重新连接' : 'SD 仍未连接，请检查控制面板')
    return
  }
  await refreshAnimaBackend()
  pb.flash(animaState.value.checkMsg)
}
const generationPresetSummary = computed(() => {
  if (drawEngine.value === 'sd') {
    const upscaler = pb.sdParams.hiresUpscaler === 'Auto' ? 'Auto Anime6B/Latent' : pb.sdParams.hiresUpscaler
    const hires = pb.sdParams.hiresFix
      ? ` · Hires ${upscaler} ${pb.sdParams.hiresScale}× / ${pb.sdParams.hiresSteps} steps / ${pb.sdParams.hiresDenoise}`
      : ''
    return `${pb.sdParams.steps} steps · CFG ${pb.sdParams.cfg} · ${pb.sdParams.sampler || '自动采样'} · ${sdSize.value}${hires}`
  }
  return `${animaState.value.steps} steps · CFG ${animaState.value.cfg} · ${animaState.value.sampler} / ${animaState.value.scheduler} · ${animaState.value.width}×${animaState.value.height}`
})

function cancelGeneration() {
  if (drawEngine.value === 'sd') sd.cancel()
  else void cancelAnimaJob()
}

// ── SD 出图任务执行 + 队列（已下沉 usePromptSdQueue）──────────────────────
// 一条 runJob 路径三处消费：直出 callGenerate / 队列串行 / 批量 runners 注入。
const {
  sdErrorReport,
  dismissError,
  captureJob,
  historyGenerationFields,
  runJob,
  sdQueue,
  enqueueCurrent,
  enqueue3Variants,
} = usePromptSdQueue({
  pb,
  sd,
  sdSize,
  drawEngine,
  livePrompt,
  negativePrompt,
  effectiveScene,
  loraSpecs,
  modelProfile,
  animaState,
  displayResultSeed,
})

function updateAnimaPromptState() {
  patchAnimaState({
    prompt: livePrompt.value,
    negative: effectiveNegative.value,
  })
}

function buildAnimaRequest(): AnimaRequest | null {
  if (pb.isPopular) {
    return buildPopularRequest()
  }
  const profile = modelProfile.value
  if (pb.char === 'triad') {
    pb.flash(animaState.value.family === 'krea2' ? 'Krea 2 首版暂不支持双角色身份构图，请使用 SD 引擎' : 'Anima 首版暂不支持双角色身份构图，请使用 SD 引擎')
    return null
  }
  if (!profile || profile.engine !== animaState.value.family || profile.model_id !== animaState.value.modelId) {
    pb.flash('当前底模没有匹配的模型 profile，已拒绝生成')
    return null
  }
  const expectedLoraId = ANIMA_LORA_BY_CHARACTER[pb.char]
  if (animaState.value.family !== 'krea2' && (animaState.value.loraId !== expectedLoraId || !animaState.value.loras.some(lora => lora.id === expectedLoraId && lora.available !== false))) {
    pb.flash('Anima 底模尚未从服务端白名单发现')
    return null
  }
  updateAnimaPromptState()
  return {
    prompt: livePrompt.value,
    negative: effectiveNegative.value,
    profileId: profile.id || '',
    modelId: animaState.value.modelId,
    loraId: animaState.value.family === 'krea2' ? null : animaState.value.loraId,
    loraStrength: animaState.value.family === 'krea2' ? null : animaState.value.loraStrength,
    width: animaState.value.width,
    height: animaState.value.height,
    steps: animaState.value.steps,
    cfg: animaState.value.cfg,
    ...(animaState.value.seed == null ? {} : { seed: animaState.value.seed }),
    character: animaState.value.family === 'krea2' ? null : ANIMA_CHARACTER_BY_CHARACTER[pb.char],
    hiresFix: Boolean(animaState.value.hiresFix),
    hiresScale: animaState.value.hiresScale,
    hiresDenoise: animaState.value.hiresDenoise,
    teaCache: animaState.value.teaCache !== false,
    teaCacheThresh: animaState.value.teaCacheThresh,
  }
}

/** 热门角色无 LoRA 出图：Anima 只允许服务端声明的 noLora capability 底模；Krea 家族天然无 LoRA。 */
function buildPopularRequest(): AnimaRequest | null {
  const profile = popular.profile.value
  if (!profile || profile.engine !== animaState.value.family || profile.model_id !== animaState.value.modelId) {
    pb.flash('当前底模没有匹配的模型 profile，已拒绝生成')
    return null
  }
  if (animaState.value.family === 'anima') {
    const selectedModel = animaState.value.models.find(model => model.id === animaState.value.modelId)
    if (!selectedModel || selectedModel.capabilities?.noLora !== true) {
      pb.flash('当前底模不支持无 LoRA 热门角色创作')
      return null
    }
  }
  updateAnimaPromptState()
  return {
    prompt: livePrompt.value,
    negative: effectiveNegative.value,
    profileId: profile.id || '',
    modelId: animaState.value.modelId,
    loraId: null,
    loraStrength: null,
    width: animaState.value.width,
    height: animaState.value.height,
    steps: animaState.value.steps,
    cfg: animaState.value.cfg,
    ...(animaState.value.seed == null ? {} : { seed: animaState.value.seed }),
    character: null,
    hiresFix: Boolean(animaState.value.hiresFix),
    hiresScale: animaState.value.hiresScale,
    hiresDenoise: animaState.value.hiresDenoise,
    teaCache: animaState.value.teaCache !== false,
    teaCacheThresh: animaState.value.teaCacheThresh,
  }
}

// ── 多场景批量出图（runners 已下沉 usePromptBatchRunners）─────────────────
// 选 N 个场景蓝图 → 逐张串行出图（SD 走 runJob 同路径 / Anima 直接提交
// ComfyUI 任务）→ 每张自动入册历史 → 在历史里挑合适的「加入分镜」。
const { batchOpen, batchEngine, batchDraw, onBatchStart } = usePromptBatchRunners({
  pb,
  sd,
  sdSize,
  negativePrompt,
  loraSpecs,
  modelProfile,
  animaState,
  runJob,
  historyGenerationFields,
  sceneBlueprints: () => sceneStore.sceneBlueprints,
})

async function callGenerate(opts: { disableLora?: boolean } = {}) {
  if (pb.directorMode === 'basic') {
    await applyManagedRoute({ silent: true })
  }
  if (pb.isPopular && drawEngine.value === 'sd') {
    pb.flash('热门角色仅支持 Anima 无 LoRA 或 Krea 2')
    return
  }
  if (!livePrompt.value) { pb.flash('请先选择场景或填写故事'); return }
  if (drawEngine.value !== 'sd') {
    if (opts.disableLora && drawEngine.value === 'anima' && !pb.isPopular) { pb.flash('Anima 引擎固定使用角色 LoRA，无法跳过') }
    await generateAnima()
    return
  }
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
  try { await navigator.clipboard.writeText(previewPromptView.value); pb.flash('Prompt 已复制') }
  catch { pb.flash('复制失败，请手动选取') }
}

async function saveHistory() {
  try {
    const url = displayResultUrl.value
    if (!url) { pb.flash('暂无可保存的成片'); return }
    let blob: Blob
    let prompt = livePrompt.value
    let negative = negativePrompt.value
    if (drawEngine.value !== 'sd') {
      const result = animaState.value.result
      if (!result) { pb.flash('成片数据已失效，请重新生成'); return }
      blob = result.blob
      prompt = result.metadata.prompt
      negative = result.metadata.negative
    } else {
      // SD blob URL 仍由浏览器生成，写入 IndexedDB 前检查响应类型。
      const response = await fetch(url, { cache: 'no-store' })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.startsWith('image/')) {
        pb.flash('成片响应无效，请重新生成')
        return
      }
      blob = await response.blob()
      // 按图取词：SD 结果记录的是提交时实际使用的提示词，面板后续修改不漂移。
      prompt = sd.resultPrompt.value || prompt
    }
    // 空 blob 会入册成一条打不开的记录，宁可报错
    if (!blob.size) { pb.flash('成片数据已失效，请重新生成'); return }
    const entry = await pb.commitHistoryEntry({
      blob,
      seed: displayResultSeed.value ?? undefined,
      size: sdSize.value,
      negative,
      prompt,
      ...historyGenerationFields(),
    })
    if (entry) pb.flash('快照已存入本地作品册')
    else pb.flash('保存失败')
  } catch (e) { pb.flash('保存失败'); console.warn(e) }
}


// ── 出视频 / 分镜短片（编排已下沉 usePromptVideoBridge）──────────────────
const {
  videoTargetData,
  goToVideo: goVideoBridge,
  shotsPending,
  refreshShotsPending,
  addToShots,
  goToShots: goShotsNav,
  handleHistoryToShots,
  handleHistoryToShotsBatch,
} = usePromptVideoBridge({
  displayResultUrl,
  drawEngine,
  livePrompt,
  sdResultPrompt: sd.resultPrompt,
  animaState,
  story: () => pb.story,
  sceneId: () => pb.sceneId,
  subject: () => pb.subject,
  flash: message => pb.flash(message),
})
async function goToVideo() { await goVideoBridge(path => router.push(path)) }
async function goToShots() { await goShotsNav(path => router.push(path)) }


function saveResult() { saveHistory() }

async function upscaleCurrentResult() {
  if (drawEngine.value === 'anima') {
    const currentResult = animaState.value.result
    const baseSeed = currentResult?.metadata?.seed ?? animaState.value.seed
    if (baseSeed == null || baseSeed < 0) {
      pb.flash('当前图片缺少 Seed 信息，无法执行精准超分')
      return
    }
    // 锁定当前图的 seed 进行 2.0x 潜空间重绘放大
    patchAnimaState({ seed: baseSeed })
    pb.flash('正在使用当前 Seed 执行 2x 高清超分精修…')
    await generateAnima({ hiresFix: true, hiresScale: 2.0, hiresDenoise: 0.35 })
    return
  }
  if (drawEngine.value === 'sd') {
    const seed = displayResultSeed.value ?? pb.lastSeed
    if (seed != null && seed >= 0) {
      pb.sdParams.seed = seed
      pb.sdParams.seedLock = true
    }
    pb.sdParams.hiresFix = true
    pb.sdParams.hiresScale = 2.0
    pb.sdParams.hiresDenoise = 0.35
    pb.markParamTouched('hiresFix')
    pb.markParamTouched('hiresScale')
    pb.markParamTouched('hiresDenoise')
    pb.flash('正在使用当前 Seed 执行 SD 2x 高清修复…')
    await callGenerate()
  }
}

// ── Anima 智能局部换装（编排已下沉 useAnimaInpaint）───────────────────────
const {
  inpaintOpen,
  inpaintOriginalUrl,
  inpaintCompareActive,
  inpaintCharacter,
  handleInpaintSubmit,
} = useAnimaInpaint({
  pb,
  drawEngine,
  animaState,
  displayResultUrl,
  generateAnima,
})

function reuseLastSeed() {
  const seed = displayResultSeed.value ?? pb.lastSeed
  if (seed == null || seed < 0) { pb.flash('还没有可复用的 seed'); return }
  pb.sdParams.seed = seed
  pb.sdParams.seedLock = true
  pb.flash(`已锁定 seed ${seed}`)
}

function applyQuickCreateSettings(settings: QuickCreateSettings | null) {
  if (!settings) return
  // 快速出图参数等同于用户已经确认过的参数。先标记 touched，避免 checkpoint
  // 变更触发的异步 watcher 再用 model profile 覆盖刚恢复的值。
  ;['sampler', 'scheduler', 'cfg', 'steps', 'size', 'hiresFix', 'hiresUpscaler', 'hiresScale']
    .forEach(key => pb.markParamTouched(key))
  if (settings.checkpoint && sd.models.value.includes(settings.checkpoint)) {
    pb.sdModelName = settings.checkpoint
    pb.applyModelProfile(settings.checkpoint)
  }
  if (settings.sampler && sd.samplers.value.includes(settings.sampler)) pb.sdParams.sampler = settings.sampler
  if (!settings.scheduler || sd.schedulers.value.includes(settings.scheduler)) pb.sdParams.scheduler = settings.scheduler
  if (settings.cfg > 0) pb.sdParams.cfg = settings.cfg
  if (settings.steps > 0) pb.sdParams.steps = settings.steps
  if (settings.size) sdSize.value = settings.size.replace('×', 'x')
  pb.sdParams.hiresFix = settings.hiresFix
  if (settings.hiresUpscaler && sd.upscalers.value.includes(settings.hiresUpscaler)) {
    pb.sdParams.hiresUpscaler = settings.hiresUpscaler
  }
  if (settings.hiresScale > 0) pb.sdParams.hiresScale = settings.hiresScale
}

// ── 历史应用（恢复/复制/删除/复用配方）已下沉 usePromptHistoryApply ────────
const {
  applyHistory,
  reuseSuccessfulRecipe,
  resumeHistory,
  duplicateHistory,
  deleteHistory,
} = usePromptHistoryApply({
  pb,
  animaState,
  patchAnimaState,
  clearAnimaResult,
  refreshAnimaBackend,
  setDrawEngine,
  resetBlueprintRotation,
  sdSize,
})

/** 「清空并重来」：会清空故事、场景关联、全部词条与导演决策，先确认再执行 */
function resetAll() {
  if (!confirm('清空当前故事、场景与全部词条，重新开始？此操作不可撤销。')) return
  if (pb.isPopular) {
    pb.setStudioSubject()
    pb.manualTags = new Set()
  }
  pb.setArtistStyleIds([])
  pb.clearScene()
  resetBlueprintRotation()
  pb.flash('已清空，可以开始新的一幅')
}

// ── 词条工作台工具（释义字典懒加载已随簇下沉 usePromptTagTools）──────────
const { addTag, tagMeaning, tagLabel, tagWeightTier, toggleOutfitBundle } = usePromptTagTools(pb)

// ── 深链参数应用（已下沉 usePromptDeepLink）───────────────────────────────
// onMounted 首放 + watch(route.query) 按 deepLinkNeeded 条件重放：
// 组件复用 / 后退恢复（bfcache）时组件不会重挂载、onMounted 不重跑，
// URL 变了状态却不更新——按「URL 与当前选中不一致」重放，保证
// 「点场景卡片后提示词跟随新场景」。八类参数全部走视图注入的同一路径动作。
const { applyDeepLink, deepLinkNeeded } = usePromptDeepLink({
  pb,
  sdSize,
  patchAnimaState,
  showAllBlueprints,
  selectPopularSource,
  selectBlueprint,
  selectScene,
  applyRecommendedEngine,
  setDirectorMode,
  applyHistory,
})

// 组件复用 / 后退恢复（bfcache）时 onMounted 不重跑：URL 场景参数变化但组件还是旧实例，
// 这里按「状态与 URL 不一致」重放深链，让场景与提示词跟随新选择。
watch(() => route.query, (q) => {
  if (!deepLinkNeeded(q)) return
  if (applyDeepLink(q) && !generationBusy.value) {
    if (pb.directorMode === 'basic') void applyManagedRoute({ silent: true })
    else void refreshManagedRoute()
  }
})

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  void refreshShotsPending()
  void refreshAnimaBackend()
  // Anima 后端只在引擎激活时轮询：SD 引擎下每 15s 打一次 /api/creative/status
  // 会让网关反复探测 ComfyUI（2.5s 超时 + 磁盘资源检查），纯属浪费。
  if (drawEngine.value !== 'sd') startStatusPolling()
  const savedMode = localStorage.getItem(DIRECTOR_MODE_KEY)
  if (savedMode === 'pro' || savedMode === 'basic') {
    pb.directorMode = savedMode
    sceneCollection.value = savedMode === 'pro' ? 'all' : 'core'
  }
  await pb.loadData()
  await refreshAnimaBackend()
  await sd.checkStatus()
  // 拿到 WebUI 真实 checkpoint 后，再按对应 model profile 填参数
  pb.applyModelProfile(pb.sdModelName || sd.checkpoint.value)
  // 历史载入（IndexedDB）
  await pb.loadHistory()

  // 深链参数恢复（?scene / ?char / ?mood / ?scenario / ?regen / ?resume / ?quick / ?variant / ?generate）
  const handledDeepLink = applyDeepLink(route.query)
  if (!handledDeepLink) pb.restoreDraft()
  // 推荐尺寸同步到出图选择
  if (pb.lastRecommendedSize) sdSize.value = pb.lastRecommendedSize
  if (pb.directorMode === 'basic') await applyManagedRoute({ silent: true })
  else await refreshManagedRoute()

  // 热门角色草稿恢复：同步无 LoRA 底模与蓝图尺寸/导演决策，并立即刷新 backend，
  // 让面板的 model/lora 列表立刻收敛到热门角色（不等 15s 轮询）。
  if (pb.isPopular && pb.subject.kind === 'popular') {
    const recommendedEngine = popularCharacter.value?.recommendedEngine === 'krea2-turbo-fp8' ? 'krea2-turbo-fp8' : 'anima-aesthetic-v1.1'
    if (animaState.value.models.some(model => model.id === recommendedEngine)) {
      patchAnimaState({ modelId: recommendedEngine })
    }
    if (pb.subject.blueprintId) {
      const restoredBlueprint = findPopularBlueprint(pb.sceneBlueprints, pb.subject.blueprintId)
      if (restoredBlueprint) {
        const decision = inferBlueprintDecisions(restoredBlueprint)
        let restoredSize = decision.size
        const activeModel = animaState.value.models.find(model => model.id === animaState.value.modelId)
        if (activeModel && Array.isArray(activeModel.sizes) && activeModel.sizes.length
          && !activeModel.sizes.includes(restoredSize)) {
          restoredSize = activeModel.sizes[0]
        }
        sdSize.value = restoredSize
        const [blueprintWidth, blueprintHeight] = restoredSize.split('x').map(Number)
        if (Number.isInteger(blueprintWidth) && Number.isInteger(blueprintHeight)) patchAnimaState({ width: blueprintWidth, height: blueprintHeight })
      }
    }
    applyRecommendedEngine(popularCharacter.value)
    void refreshAnimaBackend()
  }

  if (route.query.quick === '1') {
    const savedQuick = readQuickCreate()
    applyQuickCreateSettings(savedQuick)
    // 快速出图深链：Anima 引擎必须收敛到受控路线推荐的底模（工作室角色 → Aesthetic v1.1），
    // pro 模式不会走 applyManagedRoute，这里显式对齐，避免落到 anima-base-v1.0。
    if (drawEngine.value !== 'sd' && !pb.isPopular) {
      const route = await refreshManagedRoute()
      if ((route.engine === 'anima' || route.engine === 'krea2')
        && animaState.value.modelId !== route.modelId
        && animaState.value.models.some(model => model.id === route.modelId)) {
        patchAnimaState({ modelId: route.modelId })
      }
    }
    await nextTick()
    if (!engineOnline.value) {
      pb.flash('快速出图未启动：SD WebUI 当前未连接，Prompt 已保留')
    } else if (livePrompt.value) {
      const reused = quickCreateSummary(savedQuick)
      pb.flash(reused ? `正在快速出图 · ${reused}` : '正在使用当前推荐参数快速出图')
      await callGenerate()
    }
  } else if (route.query.generate === '1') {
    // 样张/场景抽屉的「调整后生成」：场景与词条已在上面载入，这里直接出图
    await nextTick()
    if (!engineOnline.value) {
       pb.flash(`${drawEngine.value === 'anima' ? 'Anima' : drawEngine.value === 'krea2' ? 'Krea 2' : 'SD WebUI'} 未连接，场景与词条已就位，可稍后生成`)
    } else if (livePrompt.value) {
      pb.flash('正在按调整后的场景生成')
      await callGenerate()
    }
  }
})
// 离开导演台时的 Anima 会话清理（轮询停止、在途任务取消、结果 URL 释放）
// 由 useAnimaSession 的自动 onUnmounted(dispose) 承担。

// Autosave draft
watch([() => pb.story, () => pb.visualDescription, () => pb.char, () => pb.sceneId, () => pb.selections, () => pb.manualTags, () => pb.artistStyleIds, () => pb.colorMood, () => pb.subject], () => {
  pb.saveDraft?.()
}, { deep: true })

watch([livePrompt, effectiveNegative], () => updateAnimaPromptState(), { immediate: true })

watch(() => pb.directorMode, mode => {
  localStorage.setItem(DIRECTOR_MODE_KEY, mode)
})

// 热门角色恢复草稿/历史后保证引擎不是 SD（SD 已对热门角色禁用）。
watch(() => pb.subject, subject => {
  if (subject.kind === 'popular' && drawEngine.value === 'sd') {
    setDrawEngine('anima')
  }
  syncManagedRoute()
})

// 角色变化 / 成熟内容开关变化后，若当前 category 已无合格蓝图（如"成人"），
// 自动回到"全部"并触发推荐重算，避免空面板。
watch([popularBlueprintPool, () => pb.showMatureScenes, () => pb.isPopular], () => {
  const categories = blueprintCategories.value
  if (popularCategory.value !== 'all' && !categories.includes(popularCategory.value)) {
    popularCategory.value = 'all'
  }
})

watch(() => pb.char, char => {
  if (pb.isPopular) return
  if (pb.directorMode === 'basic') {
    syncManagedRoute()
  } else if (drawEngine.value !== 'sd') {
    void refreshManagedRoute()
    syncAnimaCharacter(char)
    void refreshAnimaBackend()
    if (char === 'triad') {
      setDrawEngine('sd')
       pb.flash('Anima 与 Krea 2 首版暂不支持双角色身份构图，已切回 SD')
     }
  } else void refreshManagedRoute()
})

watch([() => pb.char, () => pb.sceneSearch, () => pb.sceneTheme, sceneCollection], () => {
  sceneLimit.value = 20
})

// 切换 SD 模型时重新套用对应 profile 的推荐参数
watch(() => pb.sdModelName, (name) => {
  const sceneSize = pb.activeScene ? pb.lastRecommendedSize : ''
  const profile = pb.applyModelProfile(name || sd.checkpoint.value, { applySize: !sceneSize })
  const targetSize = sceneSize || String(profile?.size || '').replace('×', 'x')
  if (targetSize) applyRecommendedSize(targetSize)
})

// Anima 状态轮询跟随激活引擎：SD 引擎下停止，切到 Anima/Krea 恢复。
// 切换动作本身会触发一次 refreshAnimaBackend，这里只管理周期轮询。
watch(() => drawEngine.value, engine => {
  if (engine === 'sd') animaSession.stopStatusPolling()
  else animaSession.startStatusPolling()
})
</script>

<style scoped>
/* 多场景批量出图入口行 */
.batch-entry-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-3); margin: var(--s-2) 0; }
.batch-entry-count { color: var(--text-secondary); font-size: var(--fs-label-xs); }
.linklike { border: 0; padding: 0; background: none; color: var(--accent); font: inherit; text-decoration: underline; cursor: pointer; }
.pb {
  --pb-active: var(--mood-love);
  --pb-active-text: var(--mood-love-text);
  --pb-active-grad: var(--mood-tension);
  --pb-badge-blue: var(--info);
  --pb-badge-green: var(--success);
  /* 2026-08-15 rella 化：导演台静态夜空衬底（工作台不浮动，只留静谧辉光） */
  position: relative;
  isolation: isolate;
}
.pb::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: var(--z-below);
  pointer-events: none;
  background:
    radial-gradient(30rem 20rem at 92% -6%, var(--rella-glow-cyan), transparent 64%),
    radial-gradient(26rem 18rem at -4% 88%, var(--rella-glow-violet), transparent 62%);
}
.engine-switch {
  --engine-active-border: var(--mood-love);
  --engine-active-text: var(--mood-love-text);
  display: flex;
  gap: 8px;
  margin: 4px 0 10px;
  flex-wrap: wrap;
}
.engine-btn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
  padding: 7px 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-soft);
  background: var(--glass-fill);
  color: inherit;
  font-size: var(--fs-label);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.engine-btn.active {
  border-color: var(--engine-active-border);
  background: color-mix(in srgb, var(--mood-love) 14%, transparent);
  color: var(--engine-active-text);
}
.engine-sub {
  font-size: var(--fs-mono-sm);
  opacity: 0.6;
}
.base-model-picker {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin: 0 0 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: var(--bg-deep);
}
.base-model-picker label { color: var(--text-muted); font-size: var(--fs-label-xs); font-weight: 700; }
.base-model-picker select {
  width: 100%;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-sm);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: var(--fs-label-sm);
}

/* ── 热门角色无 LoRA 创作模式 ─────────────────────────────────────────── */
.char-source {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.char-source-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border-strong);
  background: var(--glass-fill);
  color: inherit;
  font-size: var(--fs-label-sm);
  cursor: pointer;
}
.char-source-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  color: currentColor;
  opacity: 0.85;
}
.char-source-btn.active {
  border-color: var(--pb-active);
  background: color-mix(in srgb, var(--mood-love) 16%, transparent);
  color: var(--pb-active-text);
}
.popular-tags-note {
  font-size: var(--fs-mono-sm);
  opacity: 0.6;
  margin: var(--s-2) 0;
}
.btn-video-action {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-soft));
  background: color-mix(in srgb, var(--accent-soft) 30%, transparent);
}
.btn-video-action:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.btn-video-action .archive-icon {
  width: 1rem;
}
</style>
