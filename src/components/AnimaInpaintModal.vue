<script setup lang="ts">
import { ref } from 'vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import CornerFrame from '@/components/visual/CornerFrame.vue'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useInpaintMaskCanvas } from './inpaint/useInpaintMaskCanvas'
import { useInpaintImageSource } from './inpaint/useInpaintImageSource'
import { useInpaintOutfitPresets } from './inpaint/useInpaintOutfitPresets'

export interface InpaintSubmitPayload {
  imageBlob: Blob
  maskBlob: Blob | null
  maskPrompt: string
  maskThreshold: number
  newOutfitPrompt: string
  negativePrompt: string
  denoisingStrength: number
  growMaskBy: number
  seed: number | null
  characterOverride?: 'nene' | 'natsume' | 'triad' | 'none' | null
  targetWidth?: number
  targetHeight?: number
}

const props = defineProps<{
  open: boolean
  imageUrl?: string | null
  imageBlob?: Blob | null
  currentPrompt?: string
  currentNegative?: string
  character?: 'nene' | 'natsume' | 'triad' | null
  adultEnabled?: boolean
  seed?: number | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: InpaintSubmitPayload): void
}>()

const modalEl = ref<HTMLElement | null>(null)
useFocusTrap(modalEl, () => props.open, { onEscape: () => emit('close') })

const previewImageEl = ref<HTMLImageElement | null>(null)

// ── 手绘遮罩引擎（笔划/擦除/撤销/笔刷光标/空遮罩检测）已下沉
//    useInpaintMaskCanvas；Ctrl+Z 与 Alt+滚轮监听自持。──
const {
  maskCanvasEl,
  maskMode,
  brushSize,
  cursorVisible,
  brushCursorStyle,
  maskHistory,
  clearMask,
  undoMask,
  handleCanvasWheel,
  syncMaskCanvas,
  startMaskPaint,
  continueMaskPaint,
  stopMaskPaint,
  maskBlob,
} = useInpaintMaskCanvas({
  active: () => props.open,
  imageEl: previewImageEl,
  resolution: () => detectedResolution.value,
})

// ── 图片源（上传/拖拽/blob 直通/URL 兜底）与画幅探测已下沉
//    useInpaintImageSource；blob URL 生命周期自持。──
const {
  activeImageUrl,
  previewSurfaceStyle,
  detectedResolution,
  uploadedBlob,
  fileInputRef,
  isDragging,
  triggerUpload,
  onFileChange,
  onDrop,
  getBlob,
} = useInpaintImageSource({
  open: () => props.open,
  imageUrl: () => props.imageUrl,
  imageBlob: () => props.imageBlob,
  clearMask,
  syncMaskCanvas,
})

// ── 服装预设（NSFW fail-closed）与 CLIPSeg/换装参数已下沉
//    useInpaintOutfitPresets。──
const {
  presets,
  visiblePresets,
  currentPreset,
  selectedPresetId,
  customPrompt,
  maskPrompt,
  maskThreshold,
  denoisingStrength,
  growMaskBy,
  preserveSeed,
  characterMode,
} = useInpaintOutfitPresets({
  adultEnabled: () => props.adultEnabled,
  open: () => props.open,
})

async function handleStart() {
  const blob = await getBlob()
  if (!blob) {
    alert('请先上传或选择需要换装的图片')
    return
  }

  const selectedMaskBlob = await maskBlob()
  if (maskMode.value === 'paint' && !selectedMaskBlob) {
    alert('请先在图片上涂出需要换装的区域，按住 Shift 或右键可擦除保护区')
    return
  }

  const selectedPreset = presets.find(preset => preset.id === selectedPresetId.value)
  if (selectedPreset?.isNsfw && !props.adultEnabled) {
    alert('请先在导演台开启成人内容，才能使用该服装预设')
    return
  }

  const newPrompt = customPrompt.value.trim()
  if (!newPrompt) {
    alert('请输入或选择目标服装描述')
    return
  }

  const negative = props.currentNegative || 'worst quality, low quality'
  const finalNegative = currentPreset.value?.negativeAdd
    ? `${negative}, ${currentPreset.value.negativeAdd}`
    : negative

  const charOverride = characterMode.value === 'auto'
    ? (props.character ?? null)
    : characterMode.value

  emit('submit', {
    imageBlob: blob,
    maskBlob: selectedMaskBlob,
    maskPrompt: maskPrompt.value.trim() || 'clothing | clothes | outfit',
    maskThreshold: maskThreshold.value,
    newOutfitPrompt: newPrompt,
    negativePrompt: finalNegative,
    denoisingStrength: denoisingStrength.value,
    growMaskBy: growMaskBy.value,
    seed: preserveSeed.value ? (props.seed ?? null) : null,
    characterOverride: charOverride,
    targetWidth: detectedResolution.value?.width,
    targetHeight: detectedResolution.value?.height,
  })
}
</script>

<template>
  <Transition name="layer-pop">
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div ref="modalEl" class="modal-card inpaint-modal" role="dialog" aria-modal="true" aria-label="智能局部换装">
      <CornerFrame variant="ghost" />

      <!-- Hidden file input for uploading external image -->
      <input
        ref="fileInputRef"
        type="file"
        class="hidden-file-input"
        accept="image/png,image/jpeg,image/webp"
        @change="onFileChange"
      />

      <header class="modal-header">
        <div class="header-title">
          <span class="header-badge">
            <ArchiveIcon name="lightning" />
            <span>TeaCache 加速</span>
          </span>
          <h2>
            <ArchiveIcon name="wardrobe" />
            <span>智能视觉换装 (AI Inpaint)</span>
          </h2>
        </div>
        <button class="btn btn-ghost btn-xs btn-close" type="button" aria-label="关闭" @click="emit('close')">
          <ArchiveIcon name="close" />
        </button>
      </header>

      <p class="modal-intro">
        支持对项目生成图或<b>外部本地图片</b>手绘精确遮罩换装；自动识别仅作为快速模式。
      </p>

      <div class="inpaint-layout">
        <!-- 左侧：原图预览与智能遮罩提示 -->
        <div class="inpaint-preview-col">
          <div
            class="preview-card"
            :class="{ 'is-dragover': isDragging, 'has-image': !!activeImageUrl }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
          >
            <template v-if="activeImageUrl">
              <span class="preview-label">
                {{ uploadedBlob ? '已导入外部图片' : '原图基准' }}
              </span>
              <div
                class="preview-surface"
                :style="previewSurfaceStyle"
              >
                <img ref="previewImageEl" class="preview-thumb" :src="activeImageUrl" alt="换装基准图" @load="syncMaskCanvas" />
                <canvas
                  ref="maskCanvasEl"
                  class="mask-canvas"
                  :class="{ hidden: maskMode !== 'paint' }"
                  aria-label="换装区域遮罩画布"
                  @contextmenu.prevent
                  @pointerenter="cursorVisible = true"
                  @pointerleave="cursorVisible = false; stopMaskPaint()"
                  @pointerdown="startMaskPaint"
                  @pointermove="continueMaskPaint"
                  @pointerup="stopMaskPaint"
                  @pointercancel="stopMaskPaint"
                  @wheel="handleCanvasWheel"
                ></canvas>
                <!-- 笔刷尺寸跟随光标圈 -->
                <div
                  v-if="maskMode === 'paint' && cursorVisible"
                  class="brush-cursor-indicator"
                  :style="brushCursorStyle"
                ></div>
              </div>
              <div class="preview-overlay-tag">
                <ArchiveIcon name="spark" />
                <span>{{ maskMode === 'paint' ? '涂白换装，Shift/右键保护' : '自动识别服装区域' }}</span>
              </div>
              <button
                class="btn btn-xs btn-upload-overlay"
                type="button"
                title="选择或拖入其他本地图片"
                @click="triggerUpload"
              >
                <ArchiveIcon name="upload" />
                <span>更换外部图片</span>
              </button>
            </template>

            <template v-else>
              <div class="dropzone-empty" @click="triggerUpload">
                <ArchiveIcon name="upload" class="dropzone-icon" />
                <span class="dropzone-title">点击或拖拽上传本地图片</span>
                <span class="dropzone-hint">支持 PNG / JPG / WebP 任意动漫图像</span>
              </div>
            </template>
          </div>

          <!-- 角色 LoRA 辅助模式 -->
          <div class="char-mode-box">
            <label class="field-label" for="charModeSelect">
              <span class="field-label-text">
                <ArchiveIcon name="character" />
                <span>角色模型辅助 (LoRA)</span>
              </span>
            </label>
            <select id="charModeSelect" v-model="characterMode" class="input input-sm char-select">
              <option value="auto">自动跟随当前角色 ({{ character || '通用' }})</option>
              <option value="none">通用模式 (无 LoRA / 任意第三方动漫图)</option>
              <option value="nene">绫地宁宁专属 LoRA (Ayachi Nene)</option>
              <option value="natsume">四季夏目专属 LoRA (Shiki Natsume)</option>
            </select>
          </div>

          <div class="segment-box">
            <label class="field-label">
              <span class="field-label-text">
                <ArchiveIcon name="wand" />
                <span>重绘区域</span>
              </span>
            </label>
            <div class="mask-mode-switch" role="group" aria-label="遮罩模式">
              <button type="button" :class="{ active: maskMode === 'paint' }" @click="maskMode = 'paint'">手绘精确遮罩</button>
              <button type="button" :class="{ active: maskMode === 'auto' }" @click="maskMode = 'auto'">自动识别</button>
            </div>
            <template v-if="maskMode === 'paint'">
              <div class="brush-size-header">
                <label class="field-label" for="brushSizeInput">画笔大小 <span class="param-value">{{ brushSize }} px</span></label>
                <span class="wheel-shortcut-hint">Alt+滚轮缩放</span>
              </div>
              <input id="brushSizeInput" v-model.number="brushSize" class="slider" type="range" min="8" max="96" step="4" />
              <div class="mask-action-btns">
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  :disabled="maskHistory.length === 0"
                  title="撤销上一步笔画 (Ctrl+Z)"
                  @click="undoMask"
                >
                  <ArchiveIcon name="refresh" />
                  <span>撤销 <kbd>Ctrl+Z</kbd></span>
                </button>
                <button type="button" class="btn btn-ghost btn-xs btn-clear-mask" @click="clearMask">清空遮罩</button>
              </div>
              <span class="field-hint">
                涂白服装区域（支持 <kbd>Alt</kbd>+<kbd>滚轮</kbd> 调粗细；按住 <kbd>Shift</kbd> 或右键擦除保护五官手脚）。
              </span>
            </template>
            <template v-else>
              <label class="field-label" for="maskPromptInput">自动识别区域</label>
              <input id="maskPromptInput" v-model="maskPrompt" class="input input-sm" placeholder="clothing | clothes | outfit | dress | shirt..." />
              <div class="param-slider-group">
                <div class="param-header">
                  <span>识别灵敏度</span>
                  <span class="param-value">{{ maskThreshold.toFixed(2) }}</span>
                </div>
                <input
                  v-model.number="maskThreshold"
                  type="range"
                  min="0.20"
                  max="0.80"
                  step="0.05"
                  class="slider"
                  aria-label="自动识别阈值，越低识别区域越大"
                />
                <span class="slider-hint">偏低会误把身体/背景划进重绘区；推荐 0.45 ~ 0.60</span>
              </div>
              <span class="field-hint">仅作为快速起点。高质量换装建议使用手绘精确遮罩。</span>
            </template>
          </div>
        </div>

        <!-- 右侧：衣橱预设与参数设置 -->
        <div class="inpaint-options-col">
          <div class="presets-section">
            <span class="section-title">
              <ArchiveIcon name="wardrobe" />
              <span>选择目标服装形态</span>
            </span>

            <div class="preset-grid">
              <button
                v-for="p in visiblePresets"
                :key="p.id"
                type="button"
                class="preset-card"
                :class="{ active: selectedPresetId === p.id, 'is-nsfw': p.isNsfw }"
                @click="selectedPresetId = p.id"
              >
                <ArchiveIcon :name="p.icon" class="preset-icon" />
                <span class="preset-title">{{ p.label }}</span>
              </button>
              <button
                type="button"
                class="preset-card custom-card"
                :class="{ active: selectedPresetId === 'custom' }"
                @click="selectedPresetId = 'custom'"
              >
                <ArchiveIcon name="palette" class="preset-icon" />
                <span class="preset-title">自由定制</span>
              </button>
            </div>
          </div>

          <div class="field-block">
            <label class="field-label" for="promptDesc">
              <span>新服装描述词 (Prompt)</span>
              <small v-if="currentPreset" class="preset-desc-badge">{{ currentPreset.description }}</small>
            </label>
            <textarea
              id="promptDesc"
              v-model="customPrompt"
              class="textarea prompt-textarea"
              rows="3"
              placeholder="例如：wearing white frilled bikini, swimsuit..."
            ></textarea>
          </div>

          <div class="params-row">
            <div class="param-slider-group">
              <div class="param-header">
                <span>重绘去噪幅度 (Denoise)</span>
                <span class="param-value">{{ denoisingStrength.toFixed(2) }}</span>
              </div>
              <input
                v-model.number="denoisingStrength"
                type="range"
                min="0.50"
                max="0.98"
                step="0.02"
                class="slider"
              />
              <span class="slider-hint">越高换装越彻底（推荐 0.85 ~ 0.95）</span>
            </div>

            <div class="param-slider-group">
              <div class="param-header">
                <span>遮罩边缘羽化外扩 (Grow)</span>
                <span class="param-value">{{ growMaskBy }} px</span>
              </div>
              <input
                v-model.number="growMaskBy"
                type="range"
                min="0"
                max="24"
                step="2"
                class="slider"
              />
              <span class="slider-hint">防止衣物边缘与皮肤交界处出现硬边缝隙</span>
            </div>
          </div>

          <div class="seed-option-row">
            <label class="checkbox-label">
              <input v-model="preserveSeed" type="checkbox" />
              <span>锁定原图 Seed ({{ seed ?? '随机' }}) 保持光影与环境色调高度一致</span>
            </label>
          </div>
        </div>
      </div>

      <footer class="modal-footer">
        <button class="btn btn-ghost" type="button" :disabled="submitting" @click="emit('close')">
          取消
        </button>
        <button class="btn btn-primary btn-submit-inpaint" type="button" :disabled="submitting || !activeImageUrl" @click="handleStart">
          <ArchiveIcon name="lightning" />
          <span>{{ submitting ? '正在换装中…' : '开始智能换装 (~6秒)' }}</span>
        </button>
      </footer>
    </div>
  </div>
  </Transition>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 1000);
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, black 75%, transparent);
  backdrop-filter: blur(8px);
  padding: var(--s-4);
  /* 2026-08-22 动效审计 #7：遮罩淡入淡出改由外层 <Transition name="layer-pop">
     统一驱动（原 fadeIn 动画名无效，从未生效过）。 */
}

.modal-card.inpaint-modal {
  position: relative;
  width: 100%;
  max-width: 1200px;
  max-height: 94vh;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-soft, color-mix(in srgb, white 12%, transparent));
  border-radius: var(--r-xl, 16px);
  padding: var(--s-5) var(--s-6);
  box-shadow: 0 20px 50px color-mix(in srgb, black 60%, transparent);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  color: var(--text-primary);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--s-2);
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.header-title h2 {
  margin: 0;
  font-size: var(--fs-title-sm, 1.25rem);
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-badge {
  font-size: var(--fs-label-sm);
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: rgba(56, 189, 248, 0.15);
  color: var(--archive-blue);
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-close {
  padding: 6px;
  border-radius: var(--r-sm);
}

.modal-intro {
  font-size: var(--fs-body-sm, 0.85rem);
  color: var(--text-muted, color-mix(in srgb, white 65%, transparent));
  margin: 0 0 var(--s-4) 0;
  line-height: 1.5;
}

.modal-intro b {
  color: var(--accent);
}

.inpaint-layout {
  display: grid;
  grid-template-columns: minmax(500px, 1.35fr) minmax(360px, 1fr);
  gap: var(--s-6);
  align-items: start;
}

@media (max-width: 960px) {
  .inpaint-layout {
    grid-template-columns: 1fr;
  }
}

.inpaint-preview-col {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}

.preview-card {
  position: relative;
  border-radius: var(--r-lg);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, white 12%, transparent);
  background: color-mix(in srgb, black 30%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 440px;
  transition: border-color var(--motion-hover) var(--ease-out), background var(--motion-hover) var(--ease-out);
}

.preview-card.is-dragover {
  border-color: var(--accent);
  background: rgba(56, 189, 248, 0.08);
}

.preview-label {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: var(--fs-label-xs);
  padding: 2px 8px;
  border-radius: var(--r-xs);
  background: color-mix(in srgb, black 60%, transparent);
  color: color-mix(in srgb, white 85%, transparent);
  backdrop-filter: blur(4px);
  z-index: var(--z-canvas);
}

.preview-surface {
  position: relative;
  width: 100%;
  max-height: 600px;
  min-height: 380px;
  overflow: hidden;
  background: #000;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: var(--preview-ratio, auto);
}

.preview-thumb {
  width: 100%;
  height: 100%;
  max-height: 600px;
  object-fit: contain;
  display: block;
}

.mask-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: none;
  touch-action: none;
  z-index: var(--z-base);
}

.brush-cursor-indicator {
  position: absolute;
  left: var(--cursor-x, -100px);
  top: var(--cursor-y, -100px);
  width: var(--brush-diameter, 32px);
  height: var(--brush-diameter, 32px);
  pointer-events: none;
  border: 1.5px solid color-mix(in srgb, white 90%, transparent);
  background: rgba(56, 189, 248, 0.25);
  box-shadow: 0 0 4px color-mix(in srgb, black 60%, transparent), inset 0 0 2px rgba(56, 189, 248, 0.5);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: var(--z-raised);
  /* 遮罩光标点的跟手微过渡：80ms 是刻意的快速档（不套 --motion-press 的 120ms），
     仅把裸 ease 换成 token 曲线。 */
  transition: width 0.08s var(--ease-out), height 0.08s var(--ease-out);
}

.hidden-file-input {
  display: none;
}

.brush-size-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.wheel-shortcut-hint {
  font-size: var(--fs-mono-sm);
  color: var(--text-tertiary);
}

.mask-action-btns {
  display: flex;
  gap: var(--s-2);
  margin-top: 4px;
}

.mask-action-btns .btn {
  flex: 1;
}

.mask-canvas.hidden {
  display: none;
}

.mask-mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.mask-mode-switch button {
  min-height: 30px;
  border: 1px solid color-mix(in srgb, white 12%, transparent);
  background: color-mix(in srgb, black 28%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
}

.mask-mode-switch button.active {
  border-color: var(--archive-blue);
  color: #fff;
  background: rgba(56, 189, 248, 0.14);
}

.preview-overlay-tag {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-mono-sm);
  padding: 3px 8px;
  border-radius: var(--r-pill);
  background: color-mix(in srgb, black 75%, transparent);
  color: var(--archive-blue);
  border: 1px solid rgba(56, 189, 248, 0.3);
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

.btn-upload-overlay {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid color-mix(in srgb, white 20%, transparent);
  color: #fff;
  font-size: var(--fs-label-sm);
  border-radius: var(--r-terminal);
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.btn-upload-overlay:hover {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}

.dropzone-empty {
  padding: var(--s-6) var(--s-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  gap: var(--s-2);
  border: 2px dashed color-mix(in srgb, white 20%, transparent);
  border-radius: var(--r-lg);
  width: 100%;
  height: 100%;
}

.dropzone-empty:hover {
  border-color: var(--accent);
  background: rgba(56, 189, 248, 0.05);
}

.dropzone-icon {
  font-size: var(--fs-glyph);
  color: var(--accent);
}

.dropzone-title {
  font-size: var(--fs-body-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.dropzone-hint {
  font-size: var(--fs-label-xs);
  color: var(--text-muted, color-mix(in srgb, white 50%, transparent));
}

.char-mode-box,
.segment-box {
  background: color-mix(in srgb, white 3%, transparent);
  border: 1px solid color-mix(in srgb, white 8%, transparent);
  border-radius: var(--r-sm);
  padding: var(--s-3);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.char-select {
  width: 100%;
  background: color-mix(in srgb, black 40%, transparent);
  color: #fff;
  border: 1px solid color-mix(in srgb, white 15%, transparent);
  border-radius: var(--r-terminal);
  padding: 4px 8px;
  font-size: var(--fs-label-sm);
}

.field-label {
  font-size: var(--fs-label);
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-label-text {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-hint {
  font-size: var(--fs-label-xs);
  color: var(--text-muted, color-mix(in srgb, white 50%, transparent));
}

.inpaint-options-col {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
}

.presets-section {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.section-title {
  font-size: var(--fs-body-sm);
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--s-2);
}

.preset-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: color-mix(in srgb, white 4%, transparent);
  border: 1px solid color-mix(in srgb, white 8%, transparent);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: border-color var(--motion-hover) var(--ease-out), background var(--motion-hover) var(--ease-out), color var(--motion-hover) var(--ease-out);
  color: var(--text-secondary);
  text-align: left;
}

.preset-card:hover {
  background: color-mix(in srgb, white 8%, transparent);
  border-color: color-mix(in srgb, white 20%, transparent);
}

.preset-card.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: var(--archive-blue);
  color: #fff;
}

.preset-card.is-nsfw {
  border-left: 2px solid var(--danger);
}

.preset-icon {
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
  color: var(--accent);
}

.preset-title {
  font-size: var(--fs-label-sm);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.preset-desc-badge {
  font-size: var(--fs-label-xs);
  color: var(--archive-blue);
  font-weight: 400;
}

.prompt-textarea {
  background: color-mix(in srgb, black 30%, transparent);
  border: 1px solid color-mix(in srgb, white 10%, transparent);
  border-radius: var(--r-sm);
  padding: 8px 12px;
  font-size: var(--fs-label);
  color: #fff;
  resize: vertical;
  line-height: 1.4;
}

.params-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-4);
}

@media (max-width: 600px) {
  .params-row {
    grid-template-columns: 1fr;
  }
}

.param-slider-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-header {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-label-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.param-value {
  color: var(--archive-blue);
  font-weight: 600;
}

.slider {
  width: 100%;
  accent-color: var(--archive-blue);
  cursor: pointer;
}

.slider-hint {
  font-size: var(--fs-mono-sm);
  color: var(--text-muted, color-mix(in srgb, white 45%, transparent));
}

.seed-option-row {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-label-sm);
  color: var(--text-secondary);
  cursor: pointer;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--s-3);
  margin-top: var(--s-6);
  padding-top: var(--s-4);
  border-top: 1px solid color-mix(in srgb, white 8%, transparent);
}

.btn-submit-inpaint {
  padding: 8px 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
