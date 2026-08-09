/**
 * 场景管理 · 样张与首页主视觉上传（从 SceneManagerView.vue 拆出）。
 *
 * 所有权：图片预览、JPEG 归一化、样张与首页主视觉的上传/恢复生命周期。
 */

import { ref, computed, watch } from 'vue'
import { maintenanceApi, maintenanceFailure } from '../api/maintenanceApi.ts'
import type { HomeHeroCharacter, SceneDraft } from '@/types/api'

const IMAGE_PAGE_SIZE = 60

export interface HeroEntry {
  id: HomeHeroCharacter
  title: string
  updatedAt: string
}

interface UploadHooks {
  scenes: { value: SceneDraft[] }
  errorMessage: (error: unknown, fallback: string) => string
}

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

function readFileAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('无法解析这张图片'))
      img.src = String(reader.result || '')
    }
    reader.onerror = () => reject(new Error('无法读取这张图片'))
    reader.readAsDataURL(file)
  })
}

export function useSceneShowcaseUpload({ scenes, errorMessage }: UploadHooks) {
  const imageSearch = ref('')
  const imagePage = ref(1)
  const selectedImageId = ref('')
  const selectedImageTitle = ref('')
  const showcaseFeedback = ref('')
  const showcaseError = ref(false)
  const showcaseVersion = ref(Date.now())
  const uploadBusy = ref(false)
  const showcaseFileEl = ref<HTMLInputElement | null>(null)
  const heroFileEl = ref<HTMLInputElement | null>(null)
  const selectedHeroId = ref<HomeHeroCharacter | ''>('')
  const selectedHeroTitle = ref('')
  const homeHeroVersion = ref(Date.now())
  const homeHeroes = ref<HeroEntry[]>([
    { id: 'nene', title: '宁宁', updatedAt: '' },
    { id: 'natsume', title: '夏目', updatedAt: '' },
  ])

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
  const heroUrl = computed(() => selectedHeroId.value
    ? `/scene-showcase/home/${selectedHeroId.value}.jpg?v=${homeHeroVersion.value}`
    : '')

  function previewImage(s: SceneDraft) {
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
  function previewHero(hero: HeroEntry) {
    selectedHeroId.value = hero.id
    selectedHeroTitle.value = hero.title
    showcaseError.value = false
    homeHeroVersion.value = Date.now()
    showcaseFeedback.value = '支持 PNG / JPEG / WebP，最大 15MB；仅本机可替换。'
  }
  function pickHero() { heroFileEl.value?.click() }

  function uploadErrorMessage(error: unknown, fallback: string): string {
    const failure = maintenanceFailure(error)
    const message = errorMessage(error, fallback)
    return failure?.recovery && !message.includes(failure.recovery)
      ? `${message}；${failure.recovery}`
      : message
  }

  async function loadHomeHeroes() {
    try {
      const data = await maintenanceApi.getHomeHero()
      homeHeroes.value = homeHeroes.value.map(hero => {
        const updatedAt = data.entries[hero.id]?.updatedAt
        return { ...hero, updatedAt: updatedAt ? new Date(updatedAt).toLocaleString('zh-CN') : '' }
      })
    } catch {}
  }

  async function resetHero() {
    if (!selectedHeroId.value || !confirm(`恢复${selectedHeroTitle.value}的内置首页图？`)) return
    const character = selectedHeroId.value
    uploadBusy.value = true
    try {
      const data = await maintenanceApi.resetHomeHero(character)
      showcaseFeedback.value = data.message || '已恢复内置图'
      homeHeroVersion.value = Date.now()
      await loadHomeHeroes()
    } catch (err) {
      showcaseError.value = true
      showcaseFeedback.value = '未能恢复：' + uploadErrorMessage(err, '请确认通过本机控制面板打开网站')
    } finally { uploadBusy.value = false }
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
      const image = await readFileAsImage(file)
      if (image.naturalWidth * image.naturalHeight > 60_000_000) {
        throw new Error('图片像素过大，请使用不超过 6000 万像素的版本')
      }
      const normalized = jpegAtWidth(image, 4096, 0.94)
      const thumbnail = jpegAtWidth(image, 560, 0.86)
      const data = await maintenanceApi.saveShowcase({
        id: selectedImageId.value,
        image: normalized,
        thumbnail,
      })
      showcaseFeedback.value = data.message || '样张已保存'
      showcaseVersion.value = Date.now()
    } catch (err) {
      showcaseError.value = true
      showcaseFeedback.value = '未能保存：' + uploadErrorMessage(err, '请确认通过本机控制面板打开网站')
    } finally {
      uploadBusy.value = false
      input.value = ''
    }
  }

  async function onHeroPicked(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file || !selectedHeroId.value) return
    const character = selectedHeroId.value
    showcaseError.value = false
    uploadBusy.value = true
    showcaseFeedback.value = '正在保存首页主视觉…'
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('图片超过 15MB，请先压缩')
      const image = await readFileAsImage(file)
      if (image.naturalWidth * image.naturalHeight > 60_000_000) throw new Error('图片像素过大，请使用不超过 6000 万像素的版本')
      const normalized = jpegAtWidth(image, 4096, 0.94)
      const data = await maintenanceApi.saveHomeHero(character, normalized)
      showcaseFeedback.value = data.message || '首页主视觉已保存'
      homeHeroVersion.value = Date.now()
      await loadHomeHeroes()
    } catch (err) {
      showcaseError.value = true
      showcaseFeedback.value = '未能保存：' + uploadErrorMessage(err, '请确认通过本机控制面板打开网站')
    } finally { uploadBusy.value = false; input.value = '' }
  }

  return {
    imageSearch, imagePage, selectedImageId, selectedImageTitle,
    showcaseFeedback, showcaseError, showcaseVersion, uploadBusy,
    showcaseFileEl, heroFileEl, selectedHeroId, selectedHeroTitle, homeHeroVersion, homeHeroes,
    filteredImageScenes, imageTotalPages, pagedImageScenes, showcaseUrl, heroUrl,
    previewImage, onShowcaseMissing, pickShowcase, previewHero, pickHero,
    loadHomeHeroes, resetHero, onShowcasePicked, onHeroPicked,
  }
}
