<template>
  <div class="panel step-panel advanced-decision expert-tag-panel" id="stepTags">
    <div class="panel-title expert-tags-header">
      <span>词条工作台 · Tags <small class="expert-tag-count" v-if="pb.manualTags.size">已激活 {{ pb.manualTags.size }} 个</small></span>
      <div class="expert-tags-actions">
        <button type="button" class="btn btn-ghost btn-xs" :disabled="interrogateBusy" title="上传图片本地反推为 Tag（WD14 真实模型），可切人直出" @click="triggerInterrogatePick">
          <ArchiveIcon name="search" class="search-icon" />{{ interrogateBusy ? '反推中…' : '本地反推' }}
        </button>
        <span v-if="interrogateMeta" class="tag-interrogate-engine" :class="{ 'is-fallback': interrogateMeta.fallback }" :title="interrogateMeta.title">{{ interrogateMeta.label }}</span>
        <button v-if="pb.manualTags.size" type="button" class="btn btn-ghost btn-xs clear-tags-btn" @click="pb.manualTags = new Set()">清空词条</button>
      </div>
      <input ref="interrogateInputRef" class="sr-only" type="file" accept="image/*" @change="onInterrogateFile" />
    </div>
    <div v-if="interrogateError" class="tag-interrogate-error" role="alert">{{ interrogateError }}</div>
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
    <div v-if="!pb.isPopular" class="outfit-presets" aria-label="官方服装词包">
      <div class="outfit-presets-head">
        <strong>官方服装词包</strong>
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
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePromptBuilderStore, type Scene } from '@/stores/promptBuilderStore'
import { usePromptTagTools } from '@/composables/prompt/usePromptTagTools'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { useInterrogate } from '@/composables/useInterrogate'
import { defaultOutfit, findBlueprint, findCharacter, findOutfit } from '@/utils/popularContent'
import { characterConflictNote, collectInterrogateContext, mergeInterrogatedTags } from '@/utils/interrogateMerge'
import {
  OUTFIT_BUNDLES,
  OUTFIT_TAG_LABELS,
  R18_CONTROLS,
  TAG_CATEGORY_LABELS,
  NON_MANUAL_TAGS,
  normalizeCatalogKey,
} from '@/composables/scene/useDirectorCatalog'
import '@/assets/css/director/components/DirectorTagWorkbench.css'

interface TagEntry { en: string; cn: string; cat: string }

const pb = usePromptBuilderStore()
const { tagMeaning, tagLabel, tagWeightTier, toggleOutfitBundle, addTag } = usePromptTagTools(pb)

const tagSearch = ref('')
const tagCategory = ref('all')

// 本地反推（Tag → manualTags / Caption → visualDescription，切人保留）
const interrogateInputRef = ref<HTMLInputElement | null>(null)
const { busy: interrogateBusy, error: interrogateErrorRaw, interrogate } = useInterrogate()
const interrogateError = computed(() => interrogateErrorRaw.value)
// 反推引擎徽标：真实模型（wd14）高亮，启发式兜底置灰并如实标注
const interrogateMeta = ref<{ label: string; title: string; fallback: boolean } | null>(null)
function triggerInterrogatePick() { interrogateInputRef.value?.click() }
async function onInterrogateFile(e: Event) {
  var input = e.target as HTMLInputElement
  var file = input.files && input.files[0]
  if (!file) return
  input.value = ''
  try {
    var result = await interrogate(file, 'tag', 0.35)
    if (!result) return
    if (result.engine === 'wd14') {
      interrogateMeta.value = {
        label: `WD14 · ${result.model || 'wd14'}`,
        title: `真实反推模型（本地 ONNX，零网络）。角色：${(result.characterTags || []).join(', ') || '未识别'}`,
        fallback: false,
      }
    } else if (result.engine === 'heuristic') {
      interrogateMeta.value = { label: '启发式兜底', title: result.warning || '未找到真实反推模型，当前为演示标签', fallback: true }
    } else {
      interrogateMeta.value = { label: result.engine, title: `引擎：${result.engine}`, fallback: false }
    }
    if (result.mode === 'caption' && result.caption) {
      pb.visualDescription = result.caption
      pb.flash('已反推为自然语言，已填入画面描述（Krea2）')
      return
    }
    // 三重去重（manualTags/身份行/场景行）+ 身份域冲突消解，识别出的角色名单独提示
    const subject = pb.subject
    const popularChar = subject.kind === 'popular' ? findCharacter(pb.popularCharacters, subject.characterId) : null
    const context = collectInterrogateContext(subject.kind === 'popular'
      ? {
          kind: 'popular',
          character: popularChar
            ? {
                identityTokens: popularChar.identityTokens,
                exactTokens: popularChar.exactTokens,
                outfitTokens: (findOutfit(popularChar, subject.outfitId) ?? defaultOutfit(popularChar))?.tokens,
              }
            : null,
          blueprintTokens: subject.blueprintId ? findBlueprint(pb.sceneBlueprints, subject.blueprintId)?.promptTokens ?? [] : [],
        }
      : {
          kind: 'studio',
          charPrompt: pb.charPrompt,
          scenePrompt: pb.activeScene?.prompt,
          sceneTags: pb.activeScene?.tags,
        })
    const merged = mergeInterrogatedTags({
      tags: result.tags || [],
      manualTags: pb.manualTags,
      identityTokens: context.identityTokens,
      sceneTokens: context.sceneTokens,
    })
    for (const tag of merged.accepted) pb.toggleManualTag(tag)
    const note = characterConflictNote(result.characterTags, context.identityTokens)
    const parts: string[] = []
    if (merged.accepted.length) parts.push(`本地反推已叠加 ${merged.accepted.length} 个词条${result.model ? '（' + result.model + '）' : ''}`)
    if (merged.duplicates.length) parts.push(`跳过已有词条 ${merged.duplicates.length} 个`)
    if (merged.conflicts.length) {
      const shown = merged.conflicts.slice(0, 3).map(item => item.tag).join('、')
      parts.push(`跳过身份冲突 ${merged.conflicts.length} 个（${shown}${merged.conflicts.length > 3 ? ' 等' : ''}）`)
    }
    if (note) parts.push(note)
    pb.flash(parts.length ? parts.join('；') : '反推完成，无新增词条')
    const warning = result.warning
    if (warning) setTimeout(() => pb.flash(warning), 2600)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    pb.flash('反推失败：' + msg)
    console.warn('[interrogate]', msg)
  }
}

const tagCatalog = computed<TagEntry[]>(() => {
  const merged = new Map<string, TagEntry>(
    pb.tags
      .filter((tag): tag is TagEntry => typeof tag.en === 'string' && tag.cat !== 'Quality' && !NON_MANUAL_TAGS.has(normalizeCatalogKey(tag.en)))
      .map(tag => [tag.en, tag]),
  )
  const addSceneTag = (raw: unknown) => {
    const source = String(raw || '').trim()
    if (!source || /^<lora:/i.test(source) || /^break$/i.test(source)) return
    const en = normalizeCatalogKey(source)
    if (!en || en.length > 64 || NON_MANUAL_TAGS.has(en) || merged.has(en)) return
    const mature = /(?:^|_)(?:r18|adult|nsfw|nude|topless|nipples|explicit|pussy|penis|sex|lingerie)(?:_|$)/i.test(en)
    const official = Boolean(OUTFIT_TAG_LABELS[en])
    merged.set(en, {
      en,
      cn: OUTFIT_TAG_LABELS[en] || (mature ? '场景成人词' : '场景词条'),
      cat: official ? 'Official Outfit' : (mature ? 'Mature' : 'Scene'),
    })
  }
  pb.scenes.forEach((scene: Scene) => {
    ;(scene.tags || []).forEach(addSceneTag)
    String(scene.prompt || '').split(',').forEach(addSceneTag)
  })
  OUTFIT_BUNDLES.forEach(bundle => bundle.tags.forEach(en => {
    if (!merged.has(en)) merged.set(en, {
      en,
      cn: OUTFIT_TAG_LABELS[en] || 'v18 训练服装词',
      cat: 'Official Outfit',
    })
  }))
  return [...merged.values()]
})

const tagCategories = computed(() => {
  const found = new Set(tagCatalog.value.map(tag => tag.cat).filter(Boolean))
  return ['all', ...found].map(id => ({ id, label: TAG_CATEGORY_LABELS[id] || id }))
})

const visibleTags = computed(() => {
  const q = tagSearch.value.trim().toLowerCase()
  return tagCatalog.value
    .filter(tag => tagCategory.value === 'all' || tag.cat === tagCategory.value)
    .filter(tag => !q || tag.en.toLowerCase().includes(q) || tag.cn.toLowerCase().includes(q))
    .sort((a, b) => Number(pb.manualTags.has(b.en)) - Number(pb.manualTags.has(a.en)))
    .slice(0, 72)
})

const visibleOutfitBundles = computed(() =>
  OUTFIT_BUNDLES.filter(bundle => pb.char === 'triad' || bundle.character === pb.char),
)

const visibleR18Controls = computed(() =>
  R18_CONTROLS.filter(control => pb.char === 'triad' || control.character === pb.char),
)
</script>
