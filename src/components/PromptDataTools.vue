<template>
  <details ref="utilityEl" class="utility-menu">
    <summary class="utility-trigger" aria-label="数据工具">
      ···
      <span v-if="backupStale" class="utility-dot" aria-hidden="true"></span>
    </summary>
    <div class="utility-popover">
      <div v-if="backupStale" class="utility-note" role="status">
        <ArchiveIcon name="health" /> 距上次备份 {{ backupDays }} 天，建议导出一次以防数据丢失
      </div>
      <div class="utility-label">本地数据</div>
      <div class="utility-actions">
        <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="backup.exportBackup()"
          title="导出 JSON 恢复文件（含全部图片数据），用于日后「从备份恢复」">
          <ArchiveIcon name="download" /> 导出备份 JSON
        </button>
        <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="backup.exportImages()"
          title="把作品册的每张原图下载成独立的图片文件">
          <ArchiveIcon name="image" /> 导出作品图片
        </button>
        <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="pickBackupFile">
          <ArchiveIcon name="upload" /> 从备份恢复
        </button>
        <input ref="backupFileEl" class="sr-only" type="file" accept="application/json" @change="onBackupFilePicked" />
      </div>
      <div class="utility-divider"></div>
      <div class="utility-label">存储维护</div>
      <div class="utility-actions">
        <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="backup.healthCheck()"><ArchiveIcon name="health" /> 存储体检</button>
        <button class="btn btn-ghost wide" type="button" :disabled="backup.busy.value" @click="backup.cleanOrphanImages()"><ArchiveIcon name="broom" /> 清理孤儿图片</button>
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
import { ref, computed } from 'vue'
import { useBackup, type BackupSummary } from '@/composables/useBackup'
import { useFocusTrap } from '@/composables/useFocusTrap'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'

const emit = defineEmits<{ flash: [message: string] }>()

const backup = useBackup((message) => emit('flash', message))
const backupCardEl = ref<HTMLElement | null>(null)
const backupFileEl = ref<HTMLInputElement | null>(null)
const utilityEl = ref<HTMLDetailsElement | null>(null)
const pendingSummary = ref<BackupSummary | null>(null)

/** 超过 7 天未备份（或从未备份）时在触发器上亮角标，菜单内给提示 */
const BACKUP_REMIND_DAYS = 7
const backupStale = computed(() => {
  const last = backup.lastBackupAt.value
  if (!last) return true
  return Date.now() - last > BACKUP_REMIND_DAYS * 24 * 60 * 60 * 1000
})
const backupDays = computed(() => {
  const last = backup.lastBackupAt.value
  if (!last) return 0
  return Math.max(0, Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000)))
})

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

<style scoped>
.utility-trigger { position: relative; }
.utility-dot {
  position: absolute; top: 2px; right: 2px;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 8px color-mix(in srgb, var(--warning) 70%, transparent);
}
.utility-note {
  display: flex; align-items: center; gap: var(--s-2);
  margin-bottom: var(--s-3); padding: var(--s-2) var(--s-3);
  border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  color: var(--warning-text);
  font-size: var(--fs-label);
}
</style>
