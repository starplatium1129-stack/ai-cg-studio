import { ref, onBeforeUnmount, type Ref } from 'vue'
// 带 .ts 扩展（allowImportingTsExtensions）：让本模块可被 scripts/tests 以 node --test 直跑
import { useFocusTrap } from './useFocusTrap.ts'

/**
 * 出图对比快照的生命周期所有权（2026-08-21 自 PromptBuilderView 拆出）。
 *
 * 引擎出新图时会 revoke 上一张的 blob URL（useSDGenerate / useAnimaSession），
 * 快照若直接存引擎 URL，「上一张」必然裂图。本 composable 负责：
 *   1. 轮转前把 blob 克隆成独立 URL 保活（persistCompareUrl）；
 *   2. 被替换的克隆延迟到对比弹层关闭后再释放（pending 队列，上限 8 张强制回收）；
 *   3. token 防乱序：连续出图时丢弃过期快照，避免旧图覆盖新图；
 *   4. 弹层焦点陷阱与卸载时全量 revoke。
 *
 * 快照的业务字段（seed/sampler/尺寸等引擎元数据）由调用方通过 `build` 提供，
 * 本模块只拥有「URL 保活 + 双快照轮转 + 弹层状态」这一层。
 */
export function useCompareSnapshots<T extends { url: string }>(options: {
  /** 在 URL 已完成克隆保活之后，组装业务元数据并返回完整快照 */
  build: (persistentUrl: string) => T | Promise<T>
}) {
  const prevResult = ref<T | null>(null)
  const lastResult = ref<T | null>(null)
  const compareOpen = ref(false)
  const compareEl = ref<HTMLElement | null>(null)

  const cloneUrls = new Set<string>()
  const pendingRelease = new Set<string>()
  let rotateToken = 0

  async function persistUrl(url: string): Promise<string> {
    if (!url.startsWith('blob:')) return url
    try {
      const blob = await (await fetch(url)).blob()
      if (!blob.size) return url
      const cloned = URL.createObjectURL(blob)
      cloneUrls.add(cloned)
      return cloned
    } catch {
      return url
    }
  }

  function flushPendingRelease() {
    pendingRelease.forEach(url => {
      cloneUrls.delete(url)
      URL.revokeObjectURL(url)
    })
    pendingRelease.clear()
  }

  function release(snap: T | null) {
    if (!snap || !cloneUrls.has(snap.url)) return
    // 对比弹层打开时上一张可能正被引用，延迟到关闭时统一释放；
    // 弹层未打开则立即释放，避免长时间生成时内存持续增长。
    if (compareOpen.value) {
      pendingRelease.add(snap.url)
      if (pendingRelease.size > 8) flushPendingRelease()
    } else {
      cloneUrls.delete(snap.url)
      URL.revokeObjectURL(snap.url)
    }
  }

  /**
   * 新一轮出图到达时轮转双快照：释放上上张、prev←last、异步构建新快照。
   * sourceUrl 先经 persistUrl 克隆保活（引擎稍后会 revoke 原 blob），
   * build 拿到的是克隆后的持久 URL。token 保证连续触发时只有最后一次
   * 写入生效，过期结果立即释放。
   */
  function rotate(sourceUrl: string) {
    release(prevResult.value)
    if (lastResult.value) prevResult.value = lastResult.value
    const token = ++rotateToken
    void persistUrl(sourceUrl)
      .then(persistentUrl => Promise.resolve(options.build(persistentUrl)))
      .then(snap => {
        if (token !== rotateToken) {
          release(snap)
          return
        }
        lastResult.value = snap
      })
  }

  function close() {
    compareOpen.value = false
    flushPendingRelease()
  }

  useFocusTrap(compareEl, () => compareOpen.value, {
    onEscape: close,
  })

  onBeforeUnmount(() => {
    cloneUrls.forEach(url => URL.revokeObjectURL(url))
    cloneUrls.clear()
    pendingRelease.clear()
  })

  return {
    prevResult: prevResult as Ref<T | null>,
    lastResult: lastResult as Ref<T | null>,
    compareOpen,
    compareEl,
    rotate,
    release,
    close,
  }
}
