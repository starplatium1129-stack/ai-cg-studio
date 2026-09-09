import { onUnmounted, ref } from 'vue'
import { hydrateTasks, updateTask, useTaskCenter } from '@/composables/useTaskCenter'
import { cancelRecoveredTask, queryTask } from './taskRecovery'

export function useTaskRecovery() {
  const center = useTaskCenter()
  const refreshing = ref(false)
  const error = ref('')
  let controller: AbortController | undefined
  const cancellations = new Set<AbortController>()
  async function refresh() {
    if (refreshing.value) return
    refreshing.value = true
    error.value = ''
    controller = new AbortController()
    const signal = controller.signal
    try {
      await hydrateTasks()
      // Serial requests bound gateway load; active workspace owners already poll.
      for (const task of center.tasks.value) {
        if (signal.aborted) break
        if (!task.backend || center.controls(task.id) || !['running', 'interrupted'].includes(task.status)) continue
        const revision = task.updatedAt
        try {
          const patch = await queryTask(task, signal)
          if (!signal.aborted && !center.controls(task.id) && task.updatedAt === revision) updateTask(task.id, patch)
        } catch {
          if (!signal.aborted) error.value = '部分任务状态暂时无法查询，请重试；不会自动重新提交任务。'
        }
      }
    } catch { error.value = '任务记录读取失败，请重试。' }
    finally { refreshing.value = false }
  }
  async function cancel(id: string) {
    const task = center.tasks.value.find(item => item.id === id)
    if (!task?.backend) return
    const request = new AbortController()
    cancellations.add(request)
    const revision = task.updatedAt
    try {
      await cancelRecoveredTask(task, request.signal)
      // Cancellation is a request, not confirmation; read the backend outcome.
      const patch = await queryTask(task, request.signal)
      if (!request.signal.aborted && !center.controls(id) && task.updatedAt === revision) updateTask(id, patch)
    } finally { cancellations.delete(request) }
  }
  onUnmounted(() => { controller?.abort(); cancellations.forEach(request => request.abort()) })
  return { refreshing, error, refresh, cancel }
}
