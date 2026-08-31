<script setup lang="ts">
/**
 * 全局桌面端自动更新横幅（2026-08-31 收敛自 ControlView）。
 * 任何页面可见：挂载即主动查询（不依赖 Rust 启动事件——懒加载路由会丢事件），
 * 发现新版本显示「一键升级」，检查失败显示原因（不再静默）。
 */
import { onMounted } from 'vue'
import { useDesktopUpdater } from '@/composables/useDesktopUpdater'

const {
  availableVersion,
  statusText,
  installing,
  errorText,
  check: checkForUpdate,
  install: installUpdate,
} = useDesktopUpdater()

onMounted(() => { checkForUpdate() })
</script>

<template>
  <div v-if="availableVersion || errorText" class="desktop-update-banner" role="status">
    <span class="desktop-update-text">
      <template v-if="availableVersion">桌面端新版本 {{ availableVersion }} 可用</template>
      <template v-else-if="errorText">更新检查失败：{{ errorText }}</template>
      <template v-if="statusText"> · {{ statusText }}</template>
    </span>
    <button
      v-if="availableVersion"
      class="btn btn-primary"
      type="button"
      :disabled="installing || undefined"
      @click="installUpdate()"
    >
      {{ installing ? '正在更新…' : '一键升级' }}
    </button>
  </div>
</template>

<style scoped>
.desktop-update-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  margin: var(--s-3) var(--s-4) 0;
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: var(--fs-body-sm);
  line-height: var(--lh-body);
}
</style>
