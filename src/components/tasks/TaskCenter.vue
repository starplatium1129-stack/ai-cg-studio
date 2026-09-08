<template>
  <Teleport to="body"><dialog ref="dialog" class="task-center" aria-labelledby="task-center-title" @close="opened = false">
    <header><div><h2 id="task-center-title">任务中心</h2><p>{{ activeCount ? `${activeCount} 项正在处理，切换工作区可继续查看进度。` : '创作进度与最近完成的任务都在这里。' }}</p></div><button class="btn btn-ghost" type="button" aria-label="关闭任务中心" @click="opened = false"><ArchiveIcon name="close" /></button></header>
    <nav aria-label="任务筛选"><button v-for="filter in filters" :key="filter.id" class="btn btn-ghost" type="button" :aria-pressed="selected === filter.id" @click="selected = filter.id">{{ filter.label }}</button><button class="btn btn-ghost" type="button" @click="clearCompleted">清理完成记录</button></nav>
    <p v-if="storageError" role="status">{{ storageError }}</p><p v-if="feedback" role="status">{{ feedback }}</p>
    <div class="task-list"><article v-for="task in visible" :key="task.id" class="task-card" :data-state="task.status"><div class="task-card-title"><strong>{{ task.title }}</strong><span>{{ labels[task.status] || '待检查' }}</span></div><p>{{ task.message }}</p><progress v-if="task.status === 'running' && task.progress != null" :value="task.progress" max="100" :aria-label="task.title + '进度'" /><div class="task-actions"><RouterLink class="btn btn-ghost" :to="task.route" @click="opened = false">返回工作台</RouterLink><RouterLink v-if="task.resultRoute && task.status !== 'running'" class="btn btn-primary" :to="task.resultRoute" @click="opened = false">查看结果</RouterLink><button v-if="task.status === 'running' && controls(task.id)?.cancel" class="btn btn-ghost" type="button" :disabled="busy === task.id" @click="act(task.id, 'cancel')">停止</button><button v-if="task.status === 'failed' && controls(task.id)?.retry" class="btn btn-ghost" type="button" :disabled="!!busy" @click="act(task.id, 'retry')">重试失败项</button></div></article><p v-if="!visible.length" class="task-empty">{{ selected === 'all' ? '还没有任务。开始创作后，这里会显示进度。' : '这个分类暂时没有任务。' }}</p></div>
    <footer>刷新或关闭窗口会中断页面内调度；视频可回工作台重新查询，已入册图片保留在作品册。</footer>
  </dialog></Teleport>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { hydrateTasks, useTaskCenter, consumeTaskReloadApproval, type TaskStatus } from '@/composables/useTaskCenter'
const { tasks, opened, activeCount, controls, storageError, clearCompleted } = useTaskCenter()
const dialog = ref<HTMLDialogElement | null>(null), selected = ref('all'), busy = ref(''), feedback = ref('')
const filters = [{ id: 'all', label: '全部' }, { id: 'running', label: '进行中' }, { id: 'attention', label: '待处理' }, { id: 'succeeded', label: '已完成' }]
const labels: Record<TaskStatus, string> = { idle: '待开始', running: '进行中', succeeded: '已完成', failed: '失败', cancelled: '已停止', interrupted: '待检查' }
const visible = computed(() => tasks.value.filter(task => selected.value === 'all' || (selected.value === 'attention' ? ['failed', 'interrupted'].includes(task.status) : task.status === selected.value)))
watch(opened, async value => { await nextTick(); if (value) dialog.value?.showModal(); else dialog.value?.close() })
const beforeUnload = (event: BeforeUnloadEvent) => { if (activeCount.value && !consumeTaskReloadApproval()) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => { void hydrateTasks(); window.addEventListener('beforeunload', beforeUnload) })
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload))
async function act(id: string, action: 'cancel' | 'retry') { busy.value = id; feedback.value = ''; try { const result = controls(id)?.[action]?.(); if (action === 'retry') { void Promise.resolve(result).catch(() => { feedback.value = '重试未完成，请回工作台检查。' }); await nextTick() } else await result } catch { feedback.value = '操作未完成，请回工作台检查后重试。' } finally { busy.value = '' } }
</script>
<style scoped>
.task-center { margin: auto; width: min(780px, calc(100vw - 28px)); max-height: calc(100dvh - 40px); padding: var(--s-5); border: 1px solid var(--border-soft); border-radius: var(--r-xl); background: var(--bg-surface); color: var(--text-primary); box-shadow: var(--shadow-lg); }
.task-center[open] { display: flex; flex-direction: column; gap: var(--s-4); }
.task-center::backdrop { background: var(--art-scrim); }
.task-center header, .task-card-title { display: flex; align-items: start; justify-content: space-between; gap: var(--s-3); }
.task-center h2 { margin: 0; font-size: var(--fs-title-xs); }
.task-center p, .task-center footer { margin: var(--s-2) 0 0; font-size: var(--fs-label); color: var(--text-secondary); line-height: var(--lh-body); }
.task-center nav, .task-actions { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.task-center nav [aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.task-list { overflow-y: auto; min-height: 120px; display: grid; gap: var(--s-3); }
.task-card { padding: var(--s-4); border: 1px solid var(--border-soft); border-radius: var(--r-lg); background: var(--bg-deep); }
.task-card-title strong { font-size: var(--fs-body-sm); overflow-wrap: anywhere; }
.task-card-title span { flex-shrink: 0; color: var(--text-secondary); font-size: var(--fs-label); }
.task-card[data-state="failed"] .task-card-title span { color: var(--warning-text); }
.task-card progress { width: 100%; height: 5px; accent-color: var(--accent); margin-block: var(--s-3); }
.task-actions { margin-top: var(--s-3); }
.task-empty { padding: var(--s-5); text-align: center; }
@media (prefers-reduced-motion: reduce) { .task-center[open] { animation: none; } }
</style>
