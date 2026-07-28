<template>
  <section class="voice-studio" aria-label="成片配音">
    <div class="voice-head">
      <div>
        <div class="voice-title">成片配音</div>
        <div class="voice-sub">中文字幕可单独保留；日文配音稿用于 GPT-SoVITS。</div>
      </div>
      <span class="voice-state" :class="voiceStateKind">{{ voiceStateLabel }}</span>
    </div>
    <div class="voice-controls">
      <label class="voice-field">角色
        <select v-model="voiceChar">
          <option value="nene">宁宁</option>
          <option value="natsume">夏目</option>
        </select>
      </label>
      <label class="voice-field">语言
        <select v-model="voiceLang">
          <option value="ja">日语配音</option>
          <option value="zh">中文配音</option>
        </select>
      </label>
      <label class="voice-field">情绪
        <select v-model="voiceEmotion">
          <option v-for="e in VOICE_EMOTIONS" :key="e.id" :value="e.id">{{ e.label }}</option>
        </select>
      </label>
      <label class="voice-field">语速
        <select v-model.number="voiceSpeed">
          <option :value="0.85">慢 0.85×</option>
          <option :value="1">正常 1.0×</option>
          <option :value="1.15">快 1.15×</option>
        </select>
      </label>
    </div>
    <div class="voice-copy">
      <div class="voice-copy-head">
        <span class="voice-copy-title">中文字幕</span>
        <span class="voice-copy-note">画面旁白 / 台词</span>
      </div>
      <textarea class="voice-text voice-caption-text" v-model="voiceCaption" rows="3" placeholder="写下要配的中文台词或旁白…"></textarea>
    </div>
    <details class="voice-script-details" :open="voiceLang === 'ja'">
      <summary>日文 / 实际配音稿</summary>
      <textarea class="voice-text" v-model="voiceScript" rows="3" placeholder="日文配音稿；可从中文一键翻译"></textarea>
    </details>
    <div class="voice-actions">
      <button class="btn btn-ghost" type="button" :disabled="voiceBusy || !voiceCaption.trim() || voiceLang !== 'ja'" @click="translateVoice">翻译成日文</button>
      <button class="btn btn-ghost" type="button" :disabled="!voicePlayText" @click="previewVoice">系统试听</button>
      <button class="btn btn-primary" type="button" :disabled="voiceBusy || !voicePlayText" @click="generateVoice">
        {{ voiceBusy ? '生成中…' : '生成 AI 声线' }}
      </button>
      <button v-if="!voiceOnline" class="btn btn-ghost" type="button" :disabled="voiceBusy" @click="refreshVoiceStatus">重新检测</button>
    </div>
    <div class="voice-status">{{ voiceStatus }}</div>
    <RouterLink v-if="!voiceOnline" class="voice-recovery" to="/control">→ 到控制面板启动语音服务</RouterLink>
    <audio v-if="voiceAudioUrl" class="voice-audio show" :src="voiceAudioUrl" controls></audio>
    <a v-if="voiceAudioUrl" class="btn btn-ghost voice-download show" :href="voiceAudioUrl" :download="voiceDownloadName">下载 WAV</a>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  /** 导演台角色切换时同步默认声线；用户仍可在本组件内手动改回来。 */
  initialVoice: 'nene' | 'natsume'
  /** 只在字幕为空时填入，绝不覆盖用户已经写好的配音稿。 */
  suggestedCaption?: string
}>()

const toast = useToast()
const voiceChar = ref<'nene' | 'natsume'>(props.initialVoice)
const voiceLang = ref<'ja' | 'zh'>('ja')
const voiceCaption = ref('')
const voiceScript = ref('')
const voiceStatus = ref('选择角色并写下中文字幕后，可翻译或直接生成声线。')
const voiceBusy = ref(false)
const voiceOnline = ref(false)
const voiceConfigured = ref(false)
const voiceAudioUrl = ref('')
let voiceObjectUrl = ''

const voiceEmotion = ref('neutral')
const voiceSpeed = ref(1)
const VOICE_EMOTIONS = [
  { id: 'neutral', label: '平静' }, { id: 'gentle', label: '温柔' },
  { id: 'happy', label: '开心' }, { id: 'shy', label: '害羞' },
  { id: 'serious', label: '认真' }, { id: 'sad', label: '难过' },
]

const voicePlayText = computed(() => (voiceLang.value === 'ja' ? voiceScript.value : voiceCaption.value).trim())
const voiceStateKind = computed(() => voiceBusy.value ? 'warn' : (voiceOnline.value && voiceConfigured.value ? 'ready' : 'warn'))
const voiceStateLabel = computed(() => {
  if (voiceBusy.value) return '生成中'
  if (voiceOnline.value && voiceConfigured.value) return 'AI 声线就绪'
  if (voiceOnline.value) return '声线未配置'
  return '语音未启动'
})
const voiceDownloadName = computed(() => `aics_voice_${voiceChar.value}_${voiceLang.value}_${Date.now()}.wav`)

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return String(error ?? '').trim() || fallback
}

async function refreshVoiceStatus() {
  try {
    const response = await fetch('/api/tts-status', { cache: 'no-store' })
    if (!response.ok) throw new Error(`状态接口返回 ${response.status}`)
    const data = await response.json() as { online?: boolean; voices?: Record<string, boolean> }
    voiceOnline.value = Boolean(data.online)
    voiceConfigured.value = Boolean(data.voices?.[voiceChar.value])
    if (voiceOnline.value && voiceConfigured.value) {
      voiceStatus.value = 'GPT-SoVITS 已连接；可翻译或生成角色声线。'
      // 预热是 best-effort：失败只让首次合成稍慢，真实错误会在生成时展示。
      fetch('/api/voice/prepare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voiceChar.value, translation: voiceLang.value === 'ja' }),
      }).catch(() => {})
    } else if (voiceOnline.value) {
      voiceStatus.value = '语音服务在线，但当前角色参考音频尚未配置。'
    } else {
      voiceStatus.value = '语音服务未启动。可到控制面板启动 GPT-SoVITS。'
    }
  } catch {
    voiceOnline.value = false
    voiceConfigured.value = false
    voiceStatus.value = '无法读取语音状态。'
  }
}

function clearVoiceAudio() {
  if (voiceObjectUrl) { URL.revokeObjectURL(voiceObjectUrl); voiceObjectUrl = '' }
  voiceAudioUrl.value = ''
}

async function translateVoice() {
  const text = voiceCaption.value.trim()
  if (!text) { toast.warning('请先写下中文字幕'); return }
  voiceBusy.value = true
  voiceStatus.value = '正在本机翻译成日语…'
  try {
    const response = await fetch('/api/translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
    })
    const data = await response.json().catch(() => ({})) as { error?: string; translation?: string }
    if (!response.ok) throw new Error(data.error || '日语翻译失败')
    const translation = String(data.translation || '').trim()
    if (!translation) throw new Error('没有得到可用的日语译文')
    voiceScript.value = translation
    voiceStatus.value = '已生成日语配音稿；可直接生成角色语音，也可以先微调。'
  } catch (error) {
    voiceStatus.value = errorMessage(error, '翻译失败')
    toast.error(voiceStatus.value)
  } finally { voiceBusy.value = false }
}

function previewVoice() {
  if (!voicePlayText.value) { toast.warning('请先准备配音文本'); return }
  if (!('speechSynthesis' in window)) { voiceStatus.value = '当前浏览器没有系统语音朗读能力'; return }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(voicePlayText.value)
  utterance.lang = voiceLang.value === 'ja' ? 'ja-JP' : 'zh-CN'
  utterance.rate = 1
  utterance.pitch = voiceChar.value === 'nene' ? 1.08 : 0.95
  utterance.onstart = () => { voiceStatus.value = '正在用本机系统声音试听（仅检查语速与文本）' }
  utterance.onend = () => { voiceStatus.value = '试听结束。满意后可生成 AI 角色声线。' }
  window.speechSynthesis.speak(utterance)
}

async function generateVoice() {
  const text = voicePlayText.value
  if (!text) { toast.warning('请先准备配音文本'); return }
  clearVoiceAudio()
  voiceBusy.value = true
  voiceStatus.value = '正在生成 AI 角色声线…'
  try {
    await refreshVoiceStatus()
    if (!voiceConfigured.value) throw new Error('当前角色还没配置参考音频，请到控制面板的「角色声线配置」填写。')
    // 同上：预热失败不阻断合成，/api/tts 会返回可读的真实失败原因。
    await fetch('/api/voice/prepare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice: voiceChar.value, translation: voiceLang.value === 'ja' }),
    }).catch(() => {})
    const response = await fetch('/api/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice: voiceChar.value, text, language: voiceLang.value, emotion: voiceEmotion.value,
        referenceEmotion: voiceEmotion.value === 'neutral' ? 'gentle' : voiceEmotion.value,
        consistency: 'locked', speed: voiceSpeed.value,
      }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: string; detail?: string }
      const detail = String(error.detail || '')
      if (response.status === 502 && /ECONNREFUSED|9880/.test(detail)) {
        throw new Error('GPT-SoVITS 未启动（127.0.0.1:9880 拒绝连接）。到控制面板点「启动语音」。')
      }
      throw new Error([error.error, detail].filter(Boolean).join('：') || `语音生成失败 (${response.status})`)
    }
    const blob = await response.blob()
    if (!blob.size) throw new Error('语音服务返回了空音频')
    voiceObjectUrl = URL.createObjectURL(blob)
    voiceAudioUrl.value = voiceObjectUrl
    const wait = response.headers.get('X-Voice-Queue-Wait')
    voiceStatus.value = 'AI 声线已生成，可试听或下载 WAV。' + (wait && Number(wait) > 0 ? `（排队 ${Math.round(Number(wait) / 100) / 10}s）` : '')
    toast.success('配音已生成')
  } catch (error) {
    voiceStatus.value = errorMessage(error, '语音生成失败')
    toast.error(voiceStatus.value)
  } finally { voiceBusy.value = false }
}

watch(() => props.initialVoice, voice => { voiceChar.value = voice; void refreshVoiceStatus() })
watch(() => props.suggestedCaption, caption => {
  if (caption?.trim() && !voiceCaption.value.trim()) voiceCaption.value = caption.trim()
}, { immediate: true })
watch(voiceChar, () => { void refreshVoiceStatus() })
onMounted(() => { void refreshVoiceStatus() })
onUnmounted(clearVoiceAudio)
</script>
