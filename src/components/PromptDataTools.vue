<template>
  <details ref="utilityEl" class="utility-menu">
    <summary class="utility-trigger" aria-label="数据工具">···</summary>
    <div class="utility-popover">
      <div class="utility-label">本地数据</div>
      <div class="utility-actions">
        <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="backup.exportBackup()">
          ⬇️ 导出备份
        </button>
        <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="pickBackupFile">
          ⬆️ 从备份恢复
        </button>
        <input ref="backupFileEl" class="sr-only" type="file" accept="application/json" @change="onBackupFilePicked" />
      </div>
      <div class="utility-divider"></div>
      <div class="utility-label">存储维护</div>
      <div class="utility-actions">
        <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="backup.healthCheck()">🩺 存储体检</button>
        <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="backup.cleanOrphanImages()">🧹 清理孤儿图片</button>
      </div>
    </div>
  </details>

  <Teleport to="body">
    <div v-if="backup.pending.value" class="pb-backup-overlay open" @click.self="discard">
      <div
        ref="backupCardEl"
        class="pb-backup-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-restore-title"
      >
        <h3 id="backup-restore-title">从备份恢复</h3>
        <p>选择恢复方式。覆盖会替换现有数据，合并会按 id 保留较新的记录。</p>
        <div class="pb-backup-summary">
          <strong>{{ backup.pendingName.value }}</strong>
          <span>
            {{ pendingSummary?.history ?? 0 }} 条历史 ·
            {{ pendingSummary?.projects ?? 0 }} 个项目 ·
            {{ pendingSummary?.images ?? 0 }} 张图片 ·
            数据版本 v{{ backup.pending.value.schemaVersion }}
          </span>
        </div>
        <div class="pb-backup-actions">
          <button class="btn btn-ghost" type="button" :disabled="backup.busy.value" @click="discard">取消</button>
          <button class="btn btn-ghost" type="button" :disabled="backup.busy.value" @click="backup.restore('merge')">合并恢复</button>
          <button class="btn btn-danger" type="button" :disabled="backup.busy.value" @click="backup.restore('replace')">覆盖本地</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useBackup, type BackupSummary } from '@/composables/useBackup'
import { useFocusTrap } from '@/composables/useFocusTrap'

const emit = defineEmits<{ flash: [message: string] }>()

const backup = useBackup((message) => emit('flash', message))
const backupCardEl = ref<HTMLElement | null>(null)
const backupFileEl = ref<HTMLInputElement | null>(null)
const utilityEl = ref<HTMLDetailsElement | null>(null)
const pendingSummary = ref<BackupSummary | null>(null)

useFocusTrap(backupCardEl, () => backup.pending.value !== null, {
  onEscape: () => { if (!backup.busy.value) discard() },
})

function pickBackupFile() {
  backupFileEl.value?.click()
}

function discard() {
  if (backup.busy.value) return
  backup.discard()
  pendingSummary.value = null
}

async function onBackupFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  pendingSummary.value = await backup.loadFile(file)
  input.value = ''
  if (utilityEl.value) utilityEl.value.open = false
}
</script>
