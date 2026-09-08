import { useTrackedTask, type TaskStatus } from '@/composables/useTaskCenter'
import type { useAnimaSession } from './useAnimaSession'
import type { useSDGenerate } from './useSDGenerate'

export function useDrawingTaskTracking(sd: ReturnType<typeof useSDGenerate>, anima: ReturnType<typeof useAnimaSession>) {
  useTrackedTask(() => {
    const state = anima.state.value
    const phase = state.phase
    const status: TaskStatus = ['submitting', 'running', 'cancelling'].includes(phase) ? 'running' : phase === 'failed' ? 'failed' : phase === 'cancelled' ? 'cancelled' : state.result ? 'succeeded' : 'idle'
    return { kind: 'image', title: state.family === 'krea2' ? 'Krea 2 绘图' : 'Anima 绘图', status, route: '/prompt-builder', resultRoute: state.result ? '/prompt-builder' : undefined, message: state.errorMsg || state.statusText, progress: state.progress == null ? null : state.progress * 100 }
  }, { cancel: anima.cancel })
  useTrackedTask(() => ({ kind: 'image', title: 'SD 绘图', route: '/prompt-builder', resultRoute: sd.resultUrl.value ? '/prompt-builder' : undefined, status: sd.generating.value ? 'running' : sd.errorMsg.value ? 'failed' : sd.statusText.value.includes('取消') ? 'cancelled' : sd.resultUrl.value ? 'succeeded' : 'idle', message: sd.errorMsg.value || sd.statusText.value, progress: sd.progress.value }), { cancel: sd.cancel })
}
