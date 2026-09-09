import type { Ref } from 'vue'
import type { usePromptBuilderStore, Scene } from '@/stores/promptBuilderStore'
import type { DrawEngine } from '@/storage/settingsRepository'
interface BlueprintContext { pb: ReturnType<typeof usePromptBuilderStore>; selectScene: (scene: Scene) => void; setDrawEngine: (engine: DrawEngine) => void; sdSize: Ref<string> }
export function loadBlueprint(data: Record<string, unknown>, { pb, selectScene, setDrawEngine, sdSize }: BlueprintContext): void {
        if (data.char && (data.char === 'nene' || data.char === 'natsume' || data.char === 'triad')) {
            pb.setChar(data.char);
        }
        if (typeof data.sceneId === 'string' && data.sceneId) {
            const sc = pb.scenes.find(s => s.id === data.sceneId);
            if (sc)
                selectScene(sc);
        }
        if (typeof data.story === 'string') {
            pb.story = data.story;
        }
        if (Array.isArray(data.manualTags)) {
            pb.manualTags = new Set(data.manualTags.map(String));
        }
        if (typeof data.drawEngine === 'string' && (data.drawEngine === 'anima' || data.drawEngine === 'sd' || data.drawEngine === 'krea2')) {
            setDrawEngine(data.drawEngine as DrawEngine);
        }
        if (data.sdParams && typeof data.sdParams === 'object') {
            Object.assign(pb.sdParams, data.sdParams);
        }
        if (typeof data.size === 'string' && data.size) {
            sdSize.value = data.size;
        }
    }
