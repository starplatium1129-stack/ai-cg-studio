import { computed, ref, type Ref } from 'vue'
import type { Scene } from '@/stores/promptBuilderStore'
import { useDirectorDerived } from '@/composables/scene/useDirectorDerived'
import { useDirectorPopular, type UseDirectorPopularInput } from '@/composables/scene/useDirectorPopular'
import { readHiddenScenes, recordSceneUsage, rememberRecent } from '@/utils/sceneUX'

export type SceneCollection = 'core' | 'curated' | 'all'
export type VoiceStudioHandle = { setSuggestedCaption?: (caption: string) => void }

interface PromptMaterialsInput extends UseDirectorPopularInput {
  voiceStudioRef: Ref<VoiceStudioHandle | null>
}

/** Owns material browsing and selection; scene/character business state stays in the store. */
export function usePromptMaterials(input: PromptMaterialsInput) {
  const { pb, sd, sdSize, drawEngine, setDrawEngine, applyRecommendedSize, patchAnimaState, refreshAnimaBackend, voiceStudioRef } = input
  const sceneLimit = ref(20)
  const sceneCollection = ref<SceneCollection>('core')
  const hiddenSceneIds = ref(readHiddenScenes())
  const derived = useDirectorDerived({ pb, hiddenSceneIds, sceneCollection, sceneLimit, sdSize })
  const popular = useDirectorPopular(input)

  function setDirectorMode(mode: 'basic' | 'pro') {
    pb.directorMode = mode
    sceneCollection.value = mode === 'basic' ? 'core' : 'all'
    sceneLimit.value = 20
    popular.syncManagedRoute()
  }
  function setSceneCollection(collection: SceneCollection) {
    if (collection === 'all' && pb.directorMode === 'basic') {
      setDirectorMode('pro')
      return
    }
    sceneCollection.value = collection
    sceneLimit.value = 20
  }
  function selectScene(scene: Scene) {
    // Refresh the studio model whitelist immediately when leaving a popular character.
    if (pb.isPopular) void refreshAnimaBackend()
    pb.loadScene(scene)
    pb.applyModelProfile(pb.sdModelName || sd.checkpoint.value, { applySize: false })
    applyRecommendedSize(pb.lastRecommendedSize)
    patchAnimaState({ styleLoraId: '' })
    voiceStudioRef.value?.setSuggestedCaption?.(scene.story ?? '')
    rememberRecent(scene)
    recordSceneUsage(scene)
    sceneLimit.value = 20
    popular.syncManagedRoute()
  }
  const currentBlueprintData = computed(() => ({
    char: pb.char, sceneId: pb.sceneId, story: pb.story,
    manualTags: Array.from(pb.manualTags), drawEngine: drawEngine.value,
    sdParams: { ...pb.sdParams }, size: sdSize.value,
  }))
  async function handleLoadBlueprint(data: Record<string, unknown>) {
    const { loadBlueprint } = await import('./promptBlueprintActions')
    loadBlueprint(data, { pb, selectScene, setDrawEngine, sdSize })
  }

  return {
    derived, popular, sceneLimit, sceneCollection,
    setDirectorMode, setSceneCollection, selectScene, currentBlueprintData, handleLoadBlueprint,
  }
}
