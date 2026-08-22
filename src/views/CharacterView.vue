<template>
  <article class="page character-page" style="--page-max:1100px">
    <ArchivePageHero
      chapter="03"
      section="Identity file"
      :shape="heroTheme.shape"
      :portrait-id="current?.id || ''"
      :label="`${current?.name || '角色'}的人物剪影粒子标记`"
      caption="PERSONA 03 / 08"
      compact
      :style="{ '--archive-blue': heroTheme.accent, '--character-aura': heroTheme.aura }"
    >
      <div class="page-kicker">Character routes</div>
      <h1 class="title">角色档案</h1>
      <p class="subtitle">视觉特征、性格轨迹与专属模型——珍藏她们在绘境工坊中的每一缕灵动设定。</p>
      <template #meta>
        <span class="archive-status">LOCAL PROFILE</span>
        <span class="archive-status">{{ characters.length || '—' }} SUBJECTS</span>
      </template>
    </ArchivePageHero>

    <ArchiveStatePanel
      v-if="loading"
      kind="loading"
      title="正在读取角色档案"
      message="身份资料、绑定模型与视觉特征正在从本机载入。"
    />
    <ArchiveStatePanel
      v-else-if="loadError"
      kind="error"
      title="角色档案读取失败"
      message="本地角色资料暂时无法读取，请稍后重试。"
    >
      <button class="btn btn-primary" type="button" @click="loadProfiles">重新读取</button>
    </ArchiveStatePanel>
    <ArchiveStatePanel
      v-else-if="!characters.length"
      kind="empty"
      title="角色档案暂未收录"
      message="本地角色资料已就绪，当前暂无可浏览的角色记录。"
    />
    <template v-else>
      <!-- 2026-08-15：35 角色全量浏览——作品筛选条 + 分区网格 + 搜索；选中后下方展示档案 -->
      <div class="character-browse" data-reveal>
        <div class="cb-search-wrap">
          <ArchiveIcon name="search" class="cb-search-icon" />
          <input v-model="search" class="cb-search" type="search"
            placeholder="搜索角色名或作品，如 宁宁 / Surtr / Fate" aria-label="搜索角色" />
        </div>
        <div v-if="!search.trim()" class="cb-franchises" role="group" aria-label="按作品筛选">
          <button type="button" class="cb-franchise" :class="{ active: activeFranchise === '' }"
            :aria-pressed="activeFranchise === ''" @click="activeFranchise = ''">
            全部 <span class="cb-count">{{ characters.length }}</span>
          </button>
          <button v-for="f in majorFranchises" :key="f.source" type="button"
            class="cb-franchise" :class="{ active: activeFranchise === f.source }"
            :aria-pressed="activeFranchise === f.source" @click="activeFranchise = f.source">
            {{ f.label }} <span class="cb-count">{{ f.count }}</span>
          </button>
          <!-- 单角色作品（count=1）收进折叠，避免 pill 条被低频项占满两行 -->
          <template v-if="minorFranchises.length">
            <template v-for="f in minorFranchises" :key="f.source">
              <button v-if="showMinorFranchises || activeFranchise === f.source" type="button"
                class="cb-franchise cb-franchise-minor" :class="{ active: activeFranchise === f.source }"
                :aria-pressed="activeFranchise === f.source" @click="activeFranchise = f.source">
                {{ f.label }} <span class="cb-count">{{ f.count }}</span>
              </button>
            </template>
            <button type="button" class="cb-franchise cb-franchise-toggle"
              :aria-expanded="showMinorFranchises ? 'true' : 'false'"
              @click="showMinorFranchises = !showMinorFranchises">
              {{ showMinorFranchises ? '收起' : `更多单角色作品 ${minorFranchises.length}` }}<span class="cb-caret" aria-hidden="true">{{ showMinorFranchises ? '▴' : '▾' }}</span>
            </button>
          </template>
        </div>

        <div v-if="grouped" class="cb-groups" role="group" aria-label="角色">
          <section v-for="group in grouped" :key="group.label" class="cb-group">
            <h4 class="cb-group-head">{{ group.label }}<span class="cb-group-count">{{ group.members.length }}</span></h4>
            <div class="cb-grid">
              <button v-for="c in group.members" :key="c.id" type="button" class="cb-card"
                :class="{ active: current?.id === c.id }"
                :aria-pressed="current?.id === c.id" @click="selectCharacter(c.id)">
                <span class="cb-avatar">
                  <img v-if="c.portrait?.image && !brokenPortraits.has(c.id)"
                    :src="c.portrait.image" :alt="c.name" loading="lazy" decoding="async"
                    @error="markPortraitBroken(c.id)" />
                  <span v-else class="cb-avatar-fallback" :style="{ '--avatar-a': avatarGradient(c.id)[0], '--avatar-b': avatarGradient(c.id)[1] }">{{ c.name.charAt(0) }}</span>
                </span>
                <span class="cb-name">{{ c.name }}</span>
                <span v-if="group.merged" class="cb-original">{{ franchiseLabel(c.source) }}</span>
              </button>
            </div>
          </section>
        </div>
        <div v-else class="cb-grid" role="group" aria-label="角色">
          <button v-for="c in filtered" :key="c.id" type="button" class="cb-card"
            :class="{ active: current?.id === c.id }"
            :aria-pressed="current?.id === c.id" @click="selectCharacter(c.id)">
            <span class="cb-avatar">
              <img v-if="c.portrait?.image && !brokenPortraits.has(c.id)"
                :src="c.portrait.image" :alt="c.name" loading="lazy" decoding="async"
                @error="markPortraitBroken(c.id)" />
              <span v-else class="cb-avatar-fallback" :style="{ '--avatar-a': avatarGradient(c.id)[0], '--avatar-b': avatarGradient(c.id)[1] }">{{ c.name.charAt(0) }}</span>
            </span>
            <span class="cb-name">{{ c.name }}</span>
            <span class="cb-original">{{ franchiseLabel(c.source) }}</span>
          </button>
        </div>
        <div v-if="!filtered.length" class="cb-empty">
          <p>没有匹配的角色，换个关键词或作品试试。</p>
          <button class="btn btn-ghost" type="button" @click="search = ''; activeFranchise = ''">重置筛选</button>
        </div>
      </div>

      <section v-if="current" ref="profileAnchor" class="character-hero card-direct card-level-3" data-reveal data-reveal-delay="1">
        <div class="portrait" :class="{ natsume: current.id === 'natsume' }">
          <img v-if="current.portrait?.image && !brokenPortraits.has(current.id)" class="portrait-image"
            :src="current.portrait.image" :alt="current.portrait.alt || current.name"
            loading="eager" decoding="async"
            @error="markPortraitBroken(current.id)" />
          <span class="portrait-badge"><ArchiveIcon :name="current.id === 'natsume' ? 'natsume' : 'nene'" /> 官方角色立绘</span>
          <span class="portrait-source">{{ current.source }}</span>
        </div>
        <div>
          <h2 class="character-name">{{ current.name }}</h2>
          <div v-if="hasIdentity" class="identity-row">
            <span v-if="current.identity?.role" class="item role">{{ current.identity.role }}</span>
            <span v-if="current.identity?.age" class="item">{{ current.identity.age }}</span>
            <span v-if="current.identity?.occupation" class="item">{{ current.identity.occupation }}</span>
          </div>
          <div v-if="current.alias?.length" class="character-alias">{{ current.alias.join(' / ') }}</div>
          <div v-if="current.voice" class="voice-block">
            <span class="voice-label">语气示例</span>{{ current.voice }}
          </div>
          <div class="tags-grid">
            <span v-for="(t,i) in current.tags" :key="t" class="tag-chip" :class="tagClass(i)">{{ t }}</span>
          </div>
          <div class="character-actions" aria-label="角色快捷操作">
            <RouterLink v-if="!isPopular" class="btn btn-primary" :to="`/chat?character=${encodeURIComponent(current.id)}`">进入她的房间</RouterLink>
            <RouterLink class="btn btn-primary" :to="isPopular
              ? `/prompt-builder?popular=${encodeURIComponent(current.id)}`
              : `/prompt-builder?char=${encodeURIComponent(current.id)}`">以她开始绘制</RouterLink>
            <RouterLink class="btn btn-ghost" :to="isPopular
              ? `/prompt-builder?popular=${encodeURIComponent(current.id)}`
              : `/scene-explorer?character=${encodeURIComponent(current.id)}`">{{ isPopular ? '看原型场景' : '看核心场景' }}</RouterLink>
          </div>
          <!-- 简介被 CSS 截断（max-height），展开是真的在露出内容，
           所以必须是可聚焦控件并汇报 aria-expanded；原先只有 @click -->
      <button
        v-if="current.bg_story"
        type="button"
        class="bg-story"
        :class="{ expanded: bgExpanded }"
        :aria-expanded="bgExpanded"
        @click="bgExpanded=!bgExpanded"
      >{{ current.bg_story }}</button>
          <div class="detail-grid">
            <section class="detail-section"><div class="lab">性格标签</div><div class="chips"><span v-for="p in current.personality" :key="p" class="chip trait">{{ p }}</span></div></section>
            <section class="detail-section"><div class="lab">喜欢的事</div><div class="chips"><span v-for="l in current.likes" :key="l" class="chip">{{ l }}</span></div></section>
            <section v-if="current.lora" class="detail-section wide">
              <div class="lab">绑定 LoRA</div>
              <div class="char-lora">触发词：<code>{{ (current.lora.trigger_words||[]).join(', ') }}</code></div>
            </section>
          </div>
        </div>
      </section>

      <section v-if="characterReferences" class="char-reference-section card-direct card-level-2" data-reveal data-reveal-delay="1.5">
        <div class="recommend-head">
          <div>
            <div class="page-kicker">Cinematic Bible</div>
            <h2 class="recommend-title">短剧 4 视角标准参考基准</h2>
            <p>基于 Anima 真实渲染锁定的影视级基准参考库（锁死五官、发型、服装与身材比例，跨镜一致性核心保障）。</p>
          </div>
          <RouterLink class="btn btn-primary btn-sm" :to="`/video-studio?mode=shots&character=${encodeURIComponent(current?.id || '')}&outfit=${encodeURIComponent(activeOutfit?.outfitId || '')}`">
            去分镜短片创作 ↗
          </RouterLink>
        </div>

        <!-- 多服装 / 形态切换器 -->
        <div v-if="characterReferences.outfits.length > 1" class="char-outfit-tabs" aria-label="角色服装与形态切换">
          <button
            v-for="outfit in characterReferences.outfits"
            :key="outfit.outfitId"
            type="button"
            class="char-outfit-tab"
            :class="{ active: activeOutfit?.outfitId === outfit.outfitId, 'tab-nsfw': outfit.isNsfw }"
            @click="selectedOutfitId = outfit.outfitId"
          >
            <ArchiveIcon :name="outfit.isNsfw ? 'lock' : 'wardrobe'" class="outfit-tab-icon" />
            <span class="outfit-tab-name">{{ outfit.outfitName }}</span>
          </button>
        </div>

        <div v-if="activeOutfit" class="char-reference-grid">
          <div
            v-for="(refItem, idx) in activeOutfit.references"
            :key="refItem.id"
            class="char-ref-card"
            role="button"
            tabindex="0"
            :aria-label="`查看 ${refItem.name} 高清大图`"
            @click="openRefViewer(idx)"
            @keydown.enter="openRefViewer(idx)"
            @keydown.space.prevent="openRefViewer(idx)"
          >
            <div class="char-ref-image-wrap">
              <img
                :src="`${refItem.url}?t=${refVersion}`"
                :alt="refItem.name"
                class="char-ref-image"
                loading="lazy"
              />
              <span class="char-ref-badge">{{ refItem.shotType }}</span>
              <div class="char-ref-hover-hint"><ArchiveIcon name="spark" /> 点击放大审查</div>
            </div>
            <div class="char-ref-info">
              <h3 class="char-ref-title">{{ refItem.name }}</h3>
              <p class="char-ref-lens"><code>{{ refItem.lens }}</code></p>
              <p class="char-ref-desc">锁死 {{ current?.name }} · {{ activeOutfit.outfitName }} 的{{ refItem.name }}特征。</p>
              <div class="char-ref-usages">
                <span v-for="usage in refItem.targetUsage" :key="usage" class="char-ref-tag">{{ usage }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4 视角参考基准高清放大审查灯箱 -->
      <Teleport to="body">
        <dialog
          ref="refDialogEl"
          class="char-ref-modal"
          aria-label="4 视角标准参考基准审查"
          @click.self="closeRefViewer"
          @cancel.prevent="closeRefViewer"
        >
          <div v-if="activeRefModal" class="ref-modal-layout">
            <div class="ref-modal-art">
              <ZoomableImageViewer
                :src="`${activeRefModal.url}?t=${refVersion}`"
                :alt="activeRefModal.name"
              >
                <template #fallback>
                  <div class="ref-fallback">参考图暂时无法读取</div>
                </template>
              </ZoomableImageViewer>
            </div>
            <div class="ref-modal-copy">
              <button class="ref-modal-close" type="button" aria-label="关闭审查" @click="closeRefViewer">
                <ArchiveIcon name="close" />
              </button>
              <div class="ref-modal-kicker">Cinematic 4-View Bible</div>
              <h2>{{ current?.name }} · {{ activeRefModal.name }}</h2>
              <div class="ref-modal-meta">
                <span class="ref-badge-tag">{{ activeRefModal.shotType }}</span>
                <span><code>{{ activeRefModal.lens }}</code></span>
                <span v-if="activeOutfit">{{ activeOutfit.outfitName }}</span>
              </div>
              <p class="ref-modal-desc">
                锁死五官轮廓、发丝高光、服饰缝线与身材比例。支持滚轮 100%~400% 缩放与抓手平移，严密审查跨镜一致性。
              </p>
              <div class="ref-modal-usages">
                <span class="usages-title">标准适用阶段：</span>
                <div class="usages-chips">
                  <span v-for="u in activeRefModal.targetUsage" :key="u" class="usage-chip">{{ u }}</span>
                </div>
              </div>
              <div class="ref-modal-actions">
                <button class="btn btn-ghost btn-sm" type="button" :disabled="activeRefIndex <= 0" title="上一视角 (键盘 ←)" @click="moveRef(-1)">
                  ← <kbd>←</kbd>
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  :disabled="!activeOutfit || activeRefIndex >= activeOutfit.references.length - 1"
                  title="下一视角 (键盘 →)"
                  @click="moveRef(1)"
                >
                  <kbd>→</kbd> →
                </button>
                <RouterLink
                  class="btn btn-primary btn-sm"
                  :to="`/video-studio?mode=shots&character=${encodeURIComponent(current?.id || '')}&outfit=${encodeURIComponent(activeOutfit?.outfitId || '')}`"
                >
                  去分镜短片创作 ↗
                </RouterLink>
              </div>
            </div>
          </div>
        </dialog>
      </Teleport>

      <section v-if="recommendations.length" class="recommend-section" data-reveal data-reveal-delay="2">
        <div class="recommend-head">
          <div>
            <div class="page-kicker">Persona core</div>
            <h2 class="recommend-title">人设核心场景</h2>
            <p>先从最像她的瞬间开始；其他换装、AU 与成人向变体仍可在完整场景库中找到。</p>
          </div>
          <a v-if="officialProfileUrl" class="official-link" :href="officialProfileUrl" target="_blank" rel="noreferrer">查看官方人设依据 ↗</a>
        </div>
        <div class="recommend-grid">
          <RouterLink v-for="s in recommendations" :key="s.id" class="card-direct"
            :to="isPopular && current
              ? `/prompt-builder?popular=${encodeURIComponent(current.id)}&blueprint=${encodeURIComponent(s.id)}`
              : '/prompt-builder?scene='+encodeURIComponent(s.id)">
            <div class="cg-title">{{ s.title }}</div>
            <div v-if="recommendationReason(s.id)" class="cg-reason">{{ recommendationReason(s.id) }}</div>
            <div class="cg-story">{{ s.story }}</div>
          </RouterLink>
        </div>
      </section>
    </template>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useSceneStore } from '@/stores/sceneStore'
import ArchivePageHero from '@/components/visual/ArchivePageHero.vue'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import ZoomableImageViewer from '@/components/visual/ZoomableImageViewer.vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { franchiseLabel } from '@/utils/franchiseLabel'
import { characterParticleTheme } from '@/utils/characterParticleTheme'
import { ensureCharacterReferencesLoaded, getCharacterReferences } from '@/utils/characterReferenceData'
import {
  parseCharacterProfiles,
  parseCharacterScenes,
  type CharacterProfile,
  type CharacterScene,
} from '@/utils/characterProfiles'

const sceneStore = useSceneStore()
const route = useRoute()
const characters = ref<CharacterProfile[]>([])
const scenes = ref<CharacterScene[]>([])
const loading = ref(true)
const current = ref<CharacterProfile | null>(null)
const bgExpanded = ref(false)
useScrollReveal()

// 2026-08-15：全量 35 角色浏览——作品筛选 + 搜索 + 分组网格（heroine 与 popular 同台）。
const search = ref('')
const activeFranchise = ref('')

/** 作品展示名：映射表优先 → 《》内纯汉字段 → 《》内 CJK 段 → 原文（见 utils/franchiseLabel.ts）。 */

const keyword = computed(() => search.value.trim().toLowerCase())
/** 搜索优先于作品筛选：有关键词时全量匹配，无关键词时按作品收敛 */
const filtered = computed(() => {
  if (keyword.value) {
    return characters.value.filter(c =>
      [c.name, ...(c.alias || []), String(c.source || '')]
        .some(text => text.toLowerCase().includes(keyword.value)),
    )
  }
  if (activeFranchise.value) {
    return characters.value.filter(c => c.source === activeFranchise.value)
  }
  return characters.value
})

const franchises = computed(() => {
  const seen = new Map<string, number>()
  for (const c of characters.value) {
    seen.set(c.source, (seen.get(c.source) ?? 0) + 1)
  }
  return [...seen.entries()]
    .map(([source, count]) => ({ source, label: franchiseLabel(source), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
})

/** pill 条降噪：≥2 人的作品外露，单角色作品收进「更多」折叠（与分组网格的 MIN_GROUP_SIZE 同口径）。 */
const showMinorFranchises = ref(false)
const majorFranchises = computed(() => franchises.value.filter(f => f.count >= MIN_GROUP_SIZE))
const minorFranchises = computed(() => franchises.value.filter(f => f.count < MIN_GROUP_SIZE))

/** 无搜索时按作品分组；搜索/筛选时平铺。
 *  2人及以上同一作品的角色单独成组展示（如明日方舟、Fate 系列、葬送的芙莉莲、电锯人、春物、无职转生等）；
 *  仅 1 人的独立作品合并为「更多经典作品」。 */
interface CharacterGroup {
  source: string
  label: string
  members: CharacterProfile[]
  merged: boolean
}
const MIN_GROUP_SIZE = 2
const grouped = computed<CharacterGroup[] | null>(() => {
  if (keyword.value || activeFranchise.value) return null
  const groups: CharacterGroup[] = []
  const minor: CharacterProfile[] = []
  for (const f of franchises.value) {
    const members = characters.value.filter(c => c.source === f.source)
    if (!members.length) continue
    if (members.length >= MIN_GROUP_SIZE) {
      groups.push({ source: f.source, label: f.label, members, merged: false })
    } else {
      minor.push(...members)
    }
  }
  if (minor.length) groups.push({ source: '', label: '更多作品', members: minor, merged: true })
  return groups
})

/** 粒子主题随当前角色切换（形状+主色），与角色场景库共享同一映射。 */
const heroTheme = computed(() => characterParticleTheme(current.value?.id || '', current.value?.source))

/** 缺头像的角色不再裸白圆：按 id 稳定取一组中饱和渐变做占位底（白色首字可读）。 */
const AVATAR_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#8b6fd6', '#e08fb8'],
  ['#4f7ddb', '#5bc3d9'],
  ['#4dbfa8', '#8fd9a0'],
  ['#e0b055', '#e88a72'],
  ['#a37fe0', '#7fa8f0'],
  ['#e08a94', '#f0a8c4'],
  ['#7a68d9', '#b49ae8'],
  ['#54a8d9', '#8fc0e8'],
]
function avatarGradient(id: string): readonly [string, string] {
  let hash = 5381
  for (let index = 0; index < id.length; index += 1) hash = (hash * 33) ^ id.charCodeAt(index)
  return AVATAR_GRADIENTS[(hash >>> 0) % AVATAR_GRADIENTS.length]
}

/** 数据里人人都有 portrait 路径，但多数 popular-<id>.png 实际不存在；
 *  加载失败时记入集合，用渐变首字占位替换破碎 <img>。 */
const brokenPortraits = ref(new Set<string>())
function markPortraitBroken(id: string) {
  if (brokenPortraits.value.has(id)) return
  brokenPortraits.value = new Set(brokenPortraits.value).add(id)
}

const profileAnchor = ref<HTMLElement | null>(null)
function selectCharacter(id: string) {
  const found = characters.value.find(c => String(c.id) === id)
  if (!found) return
  current.value = found
  selectedOutfitId.value = ''
  bgExpanded.value = false
  // 点击卡片联动档案大卡：档案区不在视口内才平滑滚过去（已在视野内不打扰浏览）
  void nextTick(() => {
    const anchor = profileAnchor.value
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const inView = rect.top < window.innerHeight * 0.9 && rect.bottom > 0
    if (inView) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    anchor.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  })
}
function tagClass(index: unknown) { return 'm' + (Number(index) % 6) }

const characterReferences = computed(() => {
  if (!current.value) return undefined
  return getCharacterReferences(current.value.id)
})
const selectedOutfitId = ref<string>('')
const activeOutfit = computed(() => {
  if (!characterReferences.value?.outfits?.length) return undefined
  if (selectedOutfitId.value) {
    const found = characterReferences.value.outfits.find(o => o.outfitId === selectedOutfitId.value)
    if (found) return found
  }
  return characterReferences.value.outfits.find(o => o.isDefault) || characterReferences.value.outfits[0]
})
const refVersion = ref(Date.now())

const refDialogEl = ref<HTMLDialogElement | null>(null)
const activeRefIndex = ref(-1)
const activeRefModal = computed(() => {
  if (activeRefIndex.value < 0 || !activeOutfit.value?.references) return null
  return activeOutfit.value.references[activeRefIndex.value] ?? null
})

function openRefViewer(index: number) {
  activeRefIndex.value = index
  nextTick(() => {
    refDialogEl.value?.showModal()
  })
}

function closeRefViewer() {
  refDialogEl.value?.close()
  activeRefIndex.value = -1
}

function moveRef(delta: number) {
  if (!activeOutfit.value?.references.length) return
  const len = activeOutfit.value.references.length
  const next = activeRefIndex.value + delta
  if (next >= 0 && next < len) {
    activeRefIndex.value = next
  }
}

const hasIdentity = computed(() => {
  const id = current.value?.identity || {}
  return id.role || id.age || id.occupation || id.faction
})
const isPopular = computed(() => current.value?.type === 'popular')
const recommendations = computed(() => {
  if (!current.value) return []
  if (current.value.type === 'popular') {
    // 热门角色：人设核心场景 = 该角色的原型场景（scene-blueprints 按 characterId）
    return sceneStore.sceneBlueprints
      .filter(bp => bp.characterId === current.value?.id)
      .slice(0, 6)
      .map(bp => ({
        id: bp.id,
        title: bp.title,
        story: bp.description,
        char: current.value?.id ?? '',
      }))
  }
  const core = sceneStore.curation.personaCoreSceneIds
  const ids = Array.isArray(core) && core.length ? core : current.value.lora?.recommended_scene
  if (!Array.isArray(ids)) return []
  return ids
    .map((id: string) => scenes.value.find(s => s.id === id))
    .filter((scene): scene is CharacterScene =>
      Boolean(scene && [current.value?.id, 'triad', 'both'].includes(scene.char)))
    .slice(0, 6)
})
const officialProfileUrl = computed(() => current.value?.id === 'nene'
  ? 'https://www.yuzu-soft.com/products/sothewitch/character.html'
  : current.value?.id === 'natsume'
    ? 'https://www.yuzu-soft.com/products/stella/character.html'
    : '')
function recommendationReason(id: string) {
  return sceneStore.curation.personaCoreReasons?.[id] || ''
}

const loadError = ref('')

async function loadProfiles() {
  loading.value = true
  loadError.value = ''
  try {
    await sceneStore.load()
    characters.value = parseCharacterProfiles(sceneStore.characters)
    scenes.value = parseCharacterScenes(sceneStore.scenes)
    const requested = typeof route.query.character === 'string' ? route.query.character : ''
    current.value = characters.value.find(c => c.id === requested) || characters.value[0] || null
  } catch (e) {
    console.warn('character data load failed', e)
    loadError.value = String(e instanceof Error ? e.message : e)
  }
  loading.value = false
}

onMounted(() => {
  void loadProfiles()
  // 参考档案为运行时 JSON：挂载即预取；shallowRef 到达后 computed 自动重算
  void ensureCharacterReferencesLoaded().catch(() => undefined)
})
</script>

<style scoped>
.archive-status { padding:4px 9px; border:1px solid var(--border-soft); color:var(--text-muted); font:700 var(--fs-mono-xs) var(--font-mono); letter-spacing:.1em; }
/* 2026-08-15：全量角色浏览区——作品筛选 + 分组网格卡片 */
.character-browse { margin-bottom: var(--s-6); }
.cb-search-wrap { position: relative; margin-bottom: var(--s-3); }
.cb-search-icon { position: absolute; left: 12px; top: 50%; width: 15px; height: 15px; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.cb-search { width: 100%; padding: var(--s-3) var(--s-4) var(--s-3) 38px; background: var(--bg-deep); border: 1px solid var(--border-soft); border-radius: var(--r-lg); color: var(--text-primary); font-size: var(--fs-body); outline: none; }
.cb-search:focus { border-color: var(--accent); }
.cb-franchises { display: flex; flex-wrap: wrap; gap: var(--s-2); margin-bottom: var(--s-4); padding: var(--s-3); border: 1px solid color-mix(in srgb, var(--archive-blue) 22%, var(--border-soft)); border-radius: var(--r-dossier); background: color-mix(in srgb, var(--bg-surface) 62%, transparent); }
.cb-franchise { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border: 1px solid var(--border-soft); border-radius: var(--r-pill); background: var(--bg-surface); color: var(--text-secondary); font-size: var(--fs-label-sm); font-weight: 600; cursor: pointer; transition: border-color var(--t-fast), color var(--t-fast), background var(--t-fast); }
.cb-franchise:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border-soft)); }
.cb-franchise.active { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
/* 单角色作品折叠项与「更多」开关：弱化层级，不与高频作品抢注意力 */
.cb-franchise-minor { border-style: dashed; opacity: .88; }
.cb-franchise-toggle { color: var(--text-muted); background: transparent; border-color: var(--border-soft); }
.cb-franchise-toggle:hover { color: var(--accent); }
.cb-franchise .cb-caret { font-size: var(--fs-mono-xs); line-height: 1; opacity: .7; }
.cb-count { font: 650 var(--fs-mono-xs) var(--font-mono); opacity: .7; }
.cb-groups { display: grid; gap: var(--s-5); }
.cb-group-head { display: flex; align-items: baseline; gap: var(--s-2); margin: 0 0 var(--s-2); font-size: var(--fs-title-xs); color: var(--text-secondary); }
.cb-group-count { font: 650 var(--fs-mono-xs) var(--font-mono); color: var(--accent); }
.cb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: var(--s-2); }
.cb-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: var(--s-3) var(--s-2) var(--s-2);
  border: 1px solid var(--border-soft); border-radius: var(--r-lg); background: var(--bg-surface);
  color: var(--text-secondary); cursor: pointer;
  transition: border-color var(--t-fast), background var(--t-fast), color var(--t-fast), transform var(--t-fast) var(--ease-out);
  /* 离屏卡片跳过布局/绘制，35 角色长列表滚动满帧 */
  content-visibility: auto;
  contain-intrinsic-size: auto 150px;
}
.cb-card:active { transform: translateY(1px) scale(.98); }
.cb-card:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border-soft)); transform: translateY(-1px); }
.cb-card.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--bg-surface)); }
.cb-avatar { position: relative; width: 64px; height: 64px; border-radius: 50%; overflow: hidden; border: 1px solid var(--border-soft); background: var(--bg-deep); display: grid; place-items: center; }
.cb-card.active .cb-avatar { border-color: var(--accent); }
.cb-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cb-avatar-fallback {
  width: 100%; height: 100%;
  display: grid; place-items: center;
  font-size: var(--fs-title-sm); font-weight: 800;
  color: color-mix(in srgb, white 94%, transparent);
  text-shadow: 0 1px 4px color-mix(in srgb, #000 34%, transparent);
  background: linear-gradient(135deg, var(--avatar-a, #77717f), var(--avatar-b, #4a4553));
}
.cb-name { font-size: var(--fs-label-sm); font-weight: 700; color: var(--text-primary); text-align: center; line-height: 1.3; }
.cb-original { font-size: var(--fs-mono-xs); color: var(--text-muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cb-empty { padding: var(--s-5); text-align: center; color: var(--text-muted); border: 1px dashed var(--border-soft); border-radius: var(--r-lg); }
.cb-empty .btn { margin-top: var(--s-3); }
.character-hero { position:relative; overflow:hidden; display:grid; grid-template-columns:320px 1fr; gap:var(--s-6); padding:var(--s-6); }
.character-hero::before { content:""; position:absolute; top:-1px; left:var(--s-6); width:42px; height:1px; background:var(--archive-blue); opacity:.86; }
/* 立绘按"画框里的展品"处理：底光 + 顶部渐隐 + 轻微入场位移，
   与作品册的画框语言保持一致。
   2026-08-15 用户反馈：框高度改为自适应图片（图片铺满宽度，高度按比例，
   框随图收缩，消除固定 min-height 造成的顶部留白）。
   2026-08-15 二次修复：grid 行高会被右侧内容撑高，.portrait 默认 stretch
   拉伸到行高，立绘贴底后框内顶部留大片空白——加 align-self:start 让框
   高度只跟随立绘本身，不再随行拉伸。 */
.portrait {
  position:relative;
  border-radius:var(--r-stage);
  overflow:hidden;
  isolation:isolate;
  border:1px solid var(--on-art-line);
  background:
    radial-gradient(circle at 50% 22%, color-mix(in srgb,var(--nene-violet) 22%,transparent), transparent 58%),
    var(--stage-violet);
  box-shadow:inset 0 1px 0 var(--on-art-line), var(--shadow-lg);
  min-height:0;
  align-self:start;
  display:flex;
  flex-direction:column;
  justify-content:flex-end;
  align-items:center;
}
.portrait.natsume {
  background:
    radial-gradient(circle at 50% 22%, color-mix(in srgb,var(--natsume-amber) 20%,transparent), transparent 58%),
    var(--stage-amber);
}
/* 脚下地台光：让人物"站"在画面里而不是漂着 */
.portrait::before {
  content:''; position:absolute; z-index:var(--z-below); inset:auto 14% 0; height:34%;
  border-radius:50% 50% 0 0; filter:blur(18px);
  background:radial-gradient(ellipse at center bottom, color-mix(in srgb,var(--accent) 26%,transparent), transparent 68%);
}
.portrait-image {
  position:relative;
  width:100%;
  height:auto;
  max-height:calc(100vh - 360px);
  object-fit:contain;
  display:block;
  filter:drop-shadow(0 22px 34px color-mix(in srgb,var(--bg-deep) 42%,transparent));
  animation:portraitRise .55s var(--ease-out) both;
}
@keyframes portraitRise {
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:translateY(0); }
}
@media (prefers-reduced-motion:reduce) { .portrait-image { animation:none; } }
.portrait-badge,.portrait-source {
  position:absolute; z-index:var(--z-raised);
  font-size:var(--fs-mono-xs); color:var(--on-art-secondary);
}
.portrait-badge { top:var(--s-3); left:var(--s-3); }
.portrait-source { bottom:var(--s-3); right:var(--s-3); }
.character-name { font-size:clamp(1.6rem,3vw,2.4rem); font-weight:800; margin-bottom:var(--s-2); }
.identity-row { display:flex; flex-wrap:wrap; gap:var(--s-2); margin-bottom:var(--s-3); }
.identity-row .item { padding:3px var(--s-3); border:1px solid var(--border-soft); border-radius:var(--r-pill); font-size:var(--fs-label-sm); color:var(--text-secondary); }
.identity-row .item.role { color:var(--accent); border-color:var(--accent); background:var(--accent-soft); }
.character-alias { color:var(--text-muted); font-size:var(--fs-label-sm); margin-bottom:var(--s-3); }
.voice-block { margin:var(--s-3) 0; padding:var(--s-2) var(--s-3); border-left:3px solid var(--accent); background:var(--accent-soft); color:var(--text-secondary); font-size:var(--fs-body); font-style:italic; }
.voice-label { display:block; margin-bottom:2px; color:var(--accent); font-size:var(--fs-mono-xs); font-style:normal; letter-spacing:.08em; text-transform:uppercase; }
.tags-grid { display:flex; flex-wrap:wrap; gap:var(--s-2); margin-bottom:var(--s-3); }
.character-actions { display:flex; flex-wrap:wrap; gap:var(--s-2); margin:var(--s-4) 0; }
.character-actions .btn { justify-content:center; }
/* 视觉特征标签：原来直接用 mood 原色做实心底（那是给色块调的高饱和值），
   六个彩色胶囊在紫黑档案页里像贴纸。改成同色系描边 + 极淡底，
   保留可区分度但回到画册气质。 */
.tag-chip {
  padding:var(--s-1) var(--s-3); border-radius:var(--r-pill);
  font-size:var(--fs-label-sm); font-weight:600;
  color:var(--chip-tone, var(--text-secondary));
  background:color-mix(in srgb, var(--chip-tone, var(--text-muted)) 12%, transparent);
  border:1px solid color-mix(in srgb, var(--chip-tone, var(--text-muted)) 30%, transparent);
}
.tag-chip.m0 { --chip-tone:var(--mood-joy-text); }
.tag-chip.m1 { --chip-tone:var(--mood-love-text); }
.tag-chip.m2 { --chip-tone:var(--mood-calm-text); }
.tag-chip.m3 { --chip-tone:var(--mood-sad-text); }
.tag-chip.m4 { --chip-tone:var(--mood-tension-text); }
.tag-chip.m5 { --chip-tone:var(--mood-warmth-text); }
/* 现在是 <button>：重置默认样式，保留原来的截断+展开观感 */
.bg-story { display:block; width:100%; text-align:left; border:none; background:none; font-family:inherit; position:relative; max-height:80px; overflow:hidden; color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.7; cursor:pointer; transition:max-height var(--t-base); }
.bg-story.expanded { max-height:500px; }
.bg-story::after { content:'展开'; position:absolute; right:0; bottom:0; padding-left:var(--s-6); background:linear-gradient(90deg,transparent,var(--bg-surface)); color:var(--accent); font-size:var(--fs-label-xs); }
.bg-story.expanded::after { content:none; }
.detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--s-3); }
.detail-section { padding:var(--s-3); border-radius:var(--r-md); background:var(--bg-deep); }
.detail-section.wide { grid-column:1/-1; }
.lab { margin-bottom:var(--s-2); color:var(--text-muted); font-size:var(--fs-mono-sm); font-weight:700; letter-spacing:.07em; text-transform:uppercase; }
.chips { display:flex; flex-wrap:wrap; gap:var(--s-2); }
.chips .chip { padding:var(--s-1) var(--s-3); font-size:var(--fs-label-sm); cursor:default; }
.chips .chip.trait { border-color:var(--border-soft); background:var(--bg-surface); color:var(--text-primary); }
.char-lora { color:var(--text-secondary); font-size:var(--fs-body-sm); }
.char-lora code { color:var(--accent); font-family:var(--font-mono); }
.recommend-section { position:relative; margin-top:var(--s-7); padding-top:var(--s-5); border-top:1px solid var(--border-soft); }
.recommend-section::before { content:"02 / PERSONA CORE"; position:absolute; top:-.55em; left:0; padding-right:var(--s-2); background:var(--bg-base); color:var(--archive-blue); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.1em; }
.recommend-head { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--s-4); margin-bottom:var(--s-3); }
.recommend-head p { max-width:680px; margin:var(--s-1) 0 0; color:var(--text-muted); font-size:var(--fs-body-sm); }
.recommend-title { margin:0 0 var(--s-3); font-size:var(--fs-title-sm); }
.recommend-head .recommend-title { margin-bottom:0; }
.official-link { flex:0 0 auto; color:var(--accent); font-size:var(--fs-label-sm); text-decoration:none; }
.official-link:hover { text-decoration:underline; }
.recommend-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:var(--s-3); }
.cg-title { margin-bottom:var(--s-1); font-size:var(--fs-title-xs); font-weight:800; }
.cg-reason { margin-bottom:var(--s-2); color:var(--accent); font-size:var(--fs-label-sm); line-height:1.55; }
.cg-story { color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.65; }

/* 短剧 4 视角标准参考资产卡 */
.char-reference-section {
  position: relative;
  margin-top: var(--s-7);
  padding: var(--s-5);
  background: var(--bg-surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-xl);
}
.char-outfit-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-top: var(--s-3);
  padding-bottom: var(--s-2);
  border-bottom: 1px dashed var(--border-soft);
}
.char-outfit-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px var(--s-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-pill);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: var(--fs-label-sm);
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--motion-hover), background var(--motion-hover), color var(--motion-hover);
}
.char-outfit-tab:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}
.char-outfit-tab.active {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--text-inverse);
}
.char-outfit-tab.tab-nsfw {
  border-color: color-mix(in srgb, var(--danger) 40%, var(--border-soft));
}
.char-outfit-tab.tab-nsfw.active {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}
.outfit-tab-icon {
  font-size: var(--fs-body-sm);
}
.char-reference-section::before {
  content: "02 · CINEMATIC BIBLE";
  position: absolute;
  top: -0.55em;
  left: var(--s-4);
  padding: 0 var(--s-2);
  background: var(--bg-base);
  color: var(--archive-blue);
  font: 650 var(--fs-mono-xs) var(--font-mono);
  letter-spacing: 0.1em;
}
.char-reference-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--s-4);
  margin-top: var(--s-4);
}
.char-ref-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-lg);
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition: transform var(--t-fast), border-color var(--t-fast), box-shadow var(--t-fast);
}
.char-ref-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
  box-shadow: 0 8px 24px color-mix(in srgb, black 30%, transparent);
}
.char-ref-hover-hint {
  position: absolute;
  bottom: var(--s-2);
  right: var(--s-2);
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: color-mix(in srgb, black 70%, transparent);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: var(--fs-label-xs);
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity var(--t-fast), transform var(--t-fast);
}
.char-ref-card:hover .char-ref-hover-hint {
  opacity: 1;
  transform: translateY(0);
}
.char-ref-image-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 832 / 1216;
  background: var(--bg-deep);
  overflow: hidden;
}
.char-ref-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform var(--t-base);
}
.char-ref-card:hover .char-ref-image {
  transform: scale(1.03);
}
.char-ref-badge {
  position: absolute;
  top: var(--s-2);
  left: var(--s-2);
  padding: 2px var(--s-2);
  border-radius: var(--r-pill);
  background: color-mix(in srgb, black 65%, transparent);
  backdrop-filter: blur(4px);
  color: #fff;
  font: 600 var(--fs-mono-xs) var(--font-mono);
}
.char-ref-info {
  padding: var(--s-3);
  display: flex;
  flex-direction: column;
  flex: 1;
}
.char-ref-title {
  margin: 0 0 4px;
  font-size: var(--fs-body-sm);
  font-weight: 700;
  color: var(--text-primary);
}
.char-ref-lens {
  margin: 0 0 var(--s-2);
}
.char-ref-lens code {
  color: var(--accent);
  font-size: var(--fs-label-xs);
  padding: 1px 4px;
  border-radius: var(--r-terminal);
  background: var(--accent-soft);
}
.char-ref-desc {
  margin: 0 0 var(--s-3);
  font-size: var(--fs-label-xs);
  color: var(--text-secondary);
  line-height: 1.45;
  flex: 1;
}
.char-ref-usages {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.char-ref-tag {
  padding: 2px 6px;
  border-radius: var(--r-pill);
  font-size: var(--fs-label-xs);
  background: var(--bg-surface);
  border: 1px solid var(--border-soft);
  color: var(--text-muted);
}
@media (max-width: 900px) {
  .char-reference-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .char-reference-grid {
    grid-template-columns: 1fr;
  }
}

/* 4 视角参考基准放大审查模态框 */
.char-ref-modal {
  border: none;
  background: transparent;
  padding: 0;
  max-width: min(92vw, 1100px);
  max-height: min(90vh, 860px);
  width: 100%;
  color: var(--text-primary);
}
.char-ref-modal::backdrop {
  background: color-mix(in srgb, black 82%, transparent);
  backdrop-filter: blur(12px);
}
.ref-modal-layout {
  display: grid;
  grid-template-columns: minmax(320px, 1.2fr) minmax(300px, 1fr);
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-soft);
  border-radius: var(--r-xl);
  overflow: hidden;
  box-shadow: 0 24px 64px color-mix(in srgb, black 65%, transparent);
}
.ref-modal-art {
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 480px;
  max-height: min(88vh, 820px);
}
.ref-modal-copy {
  padding: var(--s-6);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-y: auto;
}
.ref-modal-close {
  position: absolute;
  top: var(--s-4);
  right: var(--s-4);
  border: 0;
  background: var(--bg-surface);
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color var(--motion-hover), background var(--motion-hover), color var(--motion-hover);
}
.ref-modal-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.ref-modal-kicker {
  font: 600 var(--fs-mono-xs) var(--font-mono);
  color: var(--archive-blue);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: var(--s-2);
}
.ref-modal-copy h2 {
  margin: 0 0 var(--s-3);
  font-size: var(--fs-title-sm);
  color: var(--text-primary);
}
.ref-modal-meta {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin-bottom: var(--s-4);
  font-size: var(--fs-body-sm);
  color: var(--text-secondary);
}
.ref-badge-tag {
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: var(--archive-blue);
  font: 600 var(--fs-mono-xs) var(--font-mono);
}
.ref-modal-desc {
  font-size: var(--fs-body-sm);
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0 0 var(--s-4);
}
.ref-modal-usages {
  margin-bottom: var(--s-6);
}
.usages-title {
  font-size: var(--fs-label-xs);
  color: var(--text-muted);
  display: block;
  margin-bottom: var(--s-2);
}
.usages-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.usage-chip {
  padding: 3px 8px;
  border-radius: var(--r-pill);
  font-size: var(--fs-label-xs);
  background: var(--bg-surface);
  border: 1px solid var(--border-soft);
  color: var(--text-primary);
}
.ref-modal-actions {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding-top: var(--s-4);
  border-top: 1px solid var(--border-soft);
}

@media (max-width: 768px) {
  .ref-modal-layout {
    grid-template-columns: 1fr;
  }
  .ref-modal-art {
    min-height: 320px;
    max-height: 420px;
  }
}

@media(max-width:700px){.character-hero{grid-template-columns:1fr}.portrait{min-height:0}.detail-grid{grid-template-columns:1fr}.recommend-head{align-items:flex-start;flex-direction:column}.character-actions .btn{flex:1 1 100%}}
</style>
