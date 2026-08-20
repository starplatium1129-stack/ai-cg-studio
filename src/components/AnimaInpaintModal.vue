<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ArchiveIcon, { type ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'
import CornerFrame from '@/components/visual/CornerFrame.vue'
import { useFocusTrap } from '@/composables/useFocusTrap'

export interface InpaintSubmitPayload {
  imageBlob: Blob
  maskPrompt: string
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
  seed?: number | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: InpaintSubmitPayload): void
}>()

const modalEl = ref<HTMLElement | null>(null)
useFocusTrap(modalEl, () => props.open, { onEscape: () => emit('close') })

// External / Uploaded Image State
const uploadedBlob = ref<Blob | null>(null)
const uploadedUrl = ref<string>('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

// Character LoRA Selection
const characterMode = ref<'auto' | 'nene' | 'natsume' | 'none'>('auto')

// Active Image Computation
const activeImageUrl = computed(() => uploadedUrl.value || props.imageUrl || '')

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    uploadedBlob.value = null
    uploadedUrl.value = ''
    characterMode.value = 'auto'
  }
})

function triggerUpload() {
  fileInputRef.value?.click()
}

function processUploadedFile(file: File) {
  if (!file.type.startsWith('image/')) {
    alert('请选择有效的图片文件 (PNG, JPG, WebP)')
    return
  }
  uploadedBlob.value = file
  if (uploadedUrl.value) {
    URL.revokeObjectURL(uploadedUrl.value)
  }
  uploadedUrl.value = URL.createObjectURL(file)
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processUploadedFile(file)
  }
  target.value = ''
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    processUploadedFile(file)
  }
}

interface OutfitPreset {
  id: string
  label: string
  icon: ArchiveIconName
  isNsfw?: boolean
  description: string
  prompt: string
  negativeAdd?: string
}

const OUTFIT_PRESETS: OutfitPreset[] = [
  {
    id: 'bikini_white',
    label: '夏日比基尼',
    icon: 'bikini',
    description: '白色荷叶边系带比基尼泳装，清爽夏日风',
    prompt: 'wearing white frilled bikini, swimsuit, halterneck bikini top, side-tie bikini bottoms, bare navel, smooth skin',
    negativeAdd: 'heavy clothes, long sleeves, jacket, coat',
  },
  {
    id: 'nude_pure',
    label: '私密纯粹形态',
    icon: 'lock',
    isNsfw: true,
    description: '完全剥离衣物，纯粹原生肌肤形态',
    prompt: 'completely naked, full body bare, natural skin, without clothes, bare chest, exposed skin',
    negativeAdd: 'clothes, clothing, shirt, dress, sleeves, bra, panties, fabric, robe, towel',
  },
  {
    id: 'evening_dress',
    label: '纯白晚礼服',
    icon: 'dress',
    description: '优雅露肩丝绸晚礼服，华丽高贵',
    prompt: 'wearing elegant off-shoulder white evening gown, silk dress, sweetheart neckline, delicate lace trim',
    negativeAdd: 'casual clothes, swimsuit, bikini',
  },
  {
    id: 'bunny_girl',
    label: '性感兔女郎',
    icon: 'bunny',
    isNsfw: true,
    description: '漆皮紧身兔女郎服，兔耳与领结',
    prompt: 'wearing glossy black bunny suit, strapless leotard, bunny ears, collar with black bow tie, white wrist cuffs',
    negativeAdd: 'coat, casual shirt, dress',
  },
  {
    id: 'maid_classic',
    label: '古典女仆装',
    icon: 'coffee',
    description: '黑白荷叶边围裙女仆装与女仆发箍',
    prompt: 'wearing classic black and white maid uniform, frilled white apron, maid headdress, puffy short sleeves',
    negativeAdd: 'bikini, modern jacket',
  },
  {
    id: 'casual_trench',
    label: '秋日风衣私服',
    icon: 'coat',
    description: '米色休闲风衣与针织打底，温柔日常',
    prompt: 'wearing stylish beige open trench coat over a soft knit sweater, casual chic outfit',
    negativeAdd: 'swimsuit, bikini, bare skin',
  },
  {
    id: 'sailor_uniform',
    label: '清爽水手服',
    icon: 'school',
    description: '绀色百褶裙日系水手校服',
    prompt: 'wearing navy blue sailor uniform, white collar with red neckerchief, pleated navy skirt',
    negativeAdd: 'swimsuit, bikini, fantasy armor',
  },
  {
    id: 'yukata_floral',
    label: '和风碎花浴衣',
    icon: 'kimono',
    description: '传统日式花纹浴衣与宽腰带',
    prompt: 'wearing traditional floral patterned yukata, colorful kimono dress, decorative wide obi sash, elegant drape',
    negativeAdd: 'bikini, modern clothes',
  },
  {
    id: 'silk_nightgown',
    label: '丝绸吊带睡衣',
    icon: 'ribbon',
    description: '慵懒蕾丝边吊带睡裙',
    prompt: 'wearing silky lace-trimmed camisole nightgown, thin shoulder straps, delicate satin sleepwear',
    negativeAdd: 'heavy jacket, school uniform',
  },
]

const selectedPresetId = ref<string>('bikini_white')
const customPrompt = ref<string>('')
const maskPrompt = ref<string>('clothing | clothes | outfit | dress | shirt | sweater | blouse | jacket | cardigan | coat | top | uniform | skirt | pants | shorts | sleeves | collar | costume | garment | fabric | bra | panties | underwear | swimsuit | bikini')
const denoisingStrength = ref<number>(0.85)
const growMaskBy = ref<number>(8)
const preserveSeed = ref<boolean>(true)

const currentPreset = computed(() => OUTFIT_PRESETS.find(p => p.id === selectedPresetId.value))

watch(selectedPresetId, (newId) => {
  if (newId !== 'custom') {
    const preset = OUTFIT_PRESETS.find(p => p.id === newId)
    if (preset) {
      customPrompt.value = preset.prompt
      if (preset.id === 'nude_pure') {
        denoisingStrength.value = 0.95
        growMaskBy.value = 16
      } else {
        denoisingStrength.value = 0.85
        growMaskBy.value = 8
      }
    }
  }
}, { immediate: true })

async function getBlob(): Promise<Blob | null> {
  if (uploadedBlob.value) {
    return uploadedBlob.value
  }
  if (props.imageBlob && props.imageBlob.size > 0) {
    return props.imageBlob
  }
  if (activeImageUrl.value) {
    try {
      const res = await fetch(activeImageUrl.value, { cache: 'no-store' })
      if (!res.ok) return null
      return await res.blob()
    } catch {
      return null
    }
  }
  return null
}

// Track image aspect ratio and optimal generation resolution
const detectedResolution = ref<{ width: number; height: number } | null>(null)

watch(activeImageUrl, (url) => {
  if (!url) {
    detectedResolution.value = null
    return
  }
  const img = new Image()
  img.onload = () => {
    const ratio = img.naturalWidth / img.naturalHeight
    if (ratio >= 1.2) {
      // 横屏图
      detectedResolution.value = { width: 1216, height: 832 }
    } else if (ratio <= 0.8) {
      // 竖屏图
      detectedResolution.value = { width: 832, height: 1216 }
    } else {
      // 方图或接近方图
      detectedResolution.value = { width: 1024, height: 1024 }
    }
  }
  img.src = url
}, { immediate: true })

async function handleStart() {
  const blob = await getBlob()
  if (!blob) {
    alert('请先上传或选择需要换装的图片')
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
    : (characterMode.value === 'none' ? null : characterMode.value)

  emit('submit', {
    imageBlob: blob,
    maskPrompt: maskPrompt.value.trim() || 'clothing | clothes | outfit',
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
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div ref="modalEl" class="modal-card inpaint-modal" role="dialog" aria-modal="true" aria-label="智能局部换装">
      <CornerFrame variant="ghost" />

      <!-- Hidden file input for uploading external image -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style="display: none"
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
        支持对项目生成图或<b>外部手动导入的本地图片</b>进行智能换装。通过 CLIPSeg 自动锁定服装区域，精准重绘！
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
              <img class="preview-thumb" :src="activeImageUrl" alt="换装基准图" />
              <div class="preview-overlay-tag">
                <ArchiveIcon name="spark" />
                <span>锁定面部 & 背景</span>
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
            <label class="field-label" for="maskPromptInput">
              <span class="field-label-text">
                <ArchiveIcon name="wand" />
                <span>智能识别区域 (语义遮罩)</span>
              </span>
            </label>
            <input
              id="maskPromptInput"
              v-model="maskPrompt"
              class="input input-sm"
              placeholder="clothing | clothes | outfit | dress | shirt..."
            />
            <span class="field-hint">自动定位并重绘被识别的部位（用 | 分隔）</span>
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
                v-for="p in OUTFIT_PRESETS"
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
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 1000);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  padding: var(--s-4);
  animation: fadeIn 0.2s ease-out;
}

.modal-card.inpaint-modal {
  position: relative;
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  background: var(--bg-surface-elevated, #161822);
  border: 1px solid var(--border-soft, rgba(255, 255, 255, 0.12));
  border-radius: var(--r-xl, 16px);
  padding: var(--s-6);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  color: var(--text-primary, #fff);
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
  color: var(--text-primary, #fff);
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-close {
  padding: 6px;
  border-radius: 8px;
}

.modal-intro {
  font-size: var(--fs-body-sm, 0.85rem);
  color: var(--text-muted, rgba(255, 255, 255, 0.65));
  margin: 0 0 var(--s-4) 0;
  line-height: 1.5;
}

.modal-intro b {
  color: var(--accent, #38bdf8);
}

.inpaint-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--s-6);
  align-items: start;
}

@media (max-width: 768px) {
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
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  transition: all 0.2s ease;
}

.preview-card.is-dragover {
  border-color: var(--accent, #38bdf8);
  background: rgba(56, 189, 248, 0.08);
}

.preview-label {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  z-index: 2;
}

.preview-thumb {
  width: 100%;
  height: auto;
  max-height: 260px;
  object-fit: cover;
  display: block;
}

.preview-overlay-tag {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.75);
  color: #38bdf8;
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
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 0.75rem;
  border-radius: 6px;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.btn-upload-overlay:hover {
  background: var(--accent, #38bdf8);
  color: #000;
  border-color: var(--accent, #38bdf8);
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
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  width: 100%;
  height: 100%;
}

.dropzone-empty:hover {
  border-color: var(--accent, #38bdf8);
  background: rgba(56, 189, 248, 0.05);
}

.dropzone-icon {
  font-size: 2rem;
  color: var(--accent, #38bdf8);
}

.dropzone-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary, #eee);
}

.dropzone-hint {
  font-size: 0.72rem;
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
}

.char-mode-box,
.segment-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: var(--s-3);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}

.char-select {
  width: 100%;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.8rem;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary, #eee);
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
  font-size: 0.72rem;
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
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
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary, #eee);
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
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--text-secondary, #ccc);
  text-align: left;
}

.preset-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.preset-card.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: #38bdf8;
  color: #fff;
}

.preset-card.is-nsfw {
  border-left: 2px solid #f43f5e;
}

.preset-icon {
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
  color: var(--accent, #38bdf8);
}

.preset-title {
  font-size: 0.8rem;
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
  font-size: 0.72rem;
  color: #38bdf8;
  font-weight: 400;
}

.prompt-textarea {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.82rem;
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
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-secondary, #ccc);
}

.param-value {
  color: #38bdf8;
  font-weight: 600;
}

.slider {
  width: 100%;
  accent-color: #38bdf8;
  cursor: pointer;
}

.slider-hint {
  font-size: 0.7rem;
  color: var(--text-muted, rgba(255, 255, 255, 0.45));
}

.seed-option-row {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--text-secondary, #ccc);
  cursor: pointer;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--s-3);
  margin-top: var(--s-6);
  padding-top: var(--s-4);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-submit-inpaint {
  padding: 8px 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
