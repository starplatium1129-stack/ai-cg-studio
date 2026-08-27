<template>
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
</template>

<script setup lang="ts">
import { usePromptBuilderStore } from '@/stores/promptBuilderStore'
import { useDirectorCatalog } from '@/composables/scene/useDirectorCatalog'
import '@/assets/css/director/components/DirectorStoryPanel.css'

const pb = usePromptBuilderStore()
const { storyChips } = useDirectorCatalog()

function detachScene() {
  if (!pb.sceneId) return
  pb.clearScene({ keepStory: true })
  pb.flash('已脱离场景，仅保留故事')
}

function onStoryInput() {
  if (pb.sceneId && pb.story !== pb.sceneBaseStory) {
    detachScene()
  }
}
</script>
