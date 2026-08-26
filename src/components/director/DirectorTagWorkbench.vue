<template>
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
import { usePromptBuilderStore } from '@/stores/promptBuilderStore'
import { usePromptTagTools } from '@/composables/usePromptTagTools'
import {
  OUTFIT_BUNDLES,
  OUTFIT_TAG_LABELS,
  R18_CONTROLS,
  TAG_CATEGORY_LABELS,
  NON_MANUAL_TAGS,
  normalizeCatalogKey,
} from '@/composables/useDirectorCatalog'

const pb = usePromptBuilderStore()
const { tagMeaning, tagLabel, tagWeightTier, toggleOutfitBundle, addTag } = usePromptTagTools(pb)

const tagSearch = ref('')
const tagCategory = ref('all')

const tagCatalog = computed(() => {
  const merged = new Map(pb.tags.filter(tag => (tag as any).cat !== 'Quality' && !NON_MANUAL_TAGS.has(normalizeCatalogKey((tag as any).en))).map(tag => [(tag as any).en, tag as any]))
  const addSceneTag = (raw: unknown) => {
    const source = String(raw || '').trim()
    if (!source || /^<lora:/i.test(source) || /^break$/i.test(source)) return
    const en = normalizeCatalogKey(source)
    if (!en || en.length > 64 || NON_MANUAL_TAGS.has(en) || merged.has(en)) return
    const mature = /(?:^|_)(?:r18|adult|nsfw|nude|topless|nipples|explicit|pussy|penis|sex|lingerie)(?:_|$)/i.test(en)
    const official = Boolean((OUTFIT_TAG_LABELS as Record<string,string>)[en])
    merged.set(en, {
      en,
      cn: (OUTFIT_TAG_LABELS as Record<string,string>)[en] || (mature ? '场景成人词' : '场景词条'),
      cat: official ? 'Official Outfit' : (mature ? 'Mature' : 'Scene'),
    })
  }
  pb.scenes.forEach(scene => {
    ;((scene as any).tags || []).forEach(addSceneTag)
    String((scene as any).prompt || '').split(',').forEach(addSceneTag)
  })
  OUTFIT_BUNDLES.forEach(bundle => bundle.tags.forEach(en => {
    if (!merged.has(en)) merged.set(en, {
      en,
      cn: (OUTFIT_TAG_LABELS as Record<string,string>)[en] || 'v18 训练服装词',
      cat: 'Official Outfit',
    })
  }))
  return [...merged.values()]
})

const tagCategories = computed(() => {
  const found = new Set(tagCatalog.value.map((tag: any) => tag.cat).filter(Boolean))
  return ['all', ...found].map(id => ({ id, label: (TAG_CATEGORY_LABELS as Record<string,string>)[id] || id }))
})

const visibleTags = computed(() => {
  const q = tagSearch.value.trim().toLowerCase()
  return tagCatalog.value
    .filter((tag: any) => tagCategory.value === 'all' || tag.cat === tagCategory.value)
    .filter((tag: any) => !q || tag.en.toLowerCase().includes(q) || tag.cn.toLowerCase().includes(q))
    .sort((a: any, b: any) => Number(pb.manualTags.has(b.en)) - Number(pb.manualTags.has(a.en)))
    .slice(0, 72)
})

const visibleOutfitBundles = computed(() =>
  OUTFIT_BUNDLES.filter(bundle => pb.char === 'triad' || (bundle as any).character === pb.char),
)

const visibleR18Controls = computed(() =>
  R18_CONTROLS.filter(control => pb.char === 'triad' || (control as any).character === pb.char),
)
</script>
