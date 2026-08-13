/**
 * 原生渲染后端 —— Rust overlay 窗口 + Cubism Native（路径 B）。
 *
 * 前端经 window.aicsLive2dNative 桥与 Rust 通信：Rust 在透明 WS_EX_LAYERED
 * overlay 窗口上用 wgpu 呈现 Live2D，模型由 Cubism Native 官方运行时执行
 * motion/physics/pose/expression/hit-test。前端只传"意图"（口型电平、
 * 情绪名称/强度、动作组请求、overlay 矩形），不做参数级写入。
 *
 * 桥不存在时 connect 必须 reject（错误名 NATIVE_BACKEND_UNAVAILABLE），
 * useLive2D 据此 fallback 到浏览器后端。
 */

import {
  NATIVE_BACKEND_UNAVAILABLE,
  NATIVE_CAPABILITY,
  type Live2DConnectOptions,
  type Live2DModelHandle,
  type Live2DStageBackend,
  type Live2DStageSession,
} from './types.ts'
import type { Live2DMotionPriority, Live2DNativeBridge } from '@/types/live2dNative'

export type NativeBridgeProvider = () => Live2DNativeBridge | null | undefined

function defaultBridgeProvider(): Live2DNativeBridge | null | undefined {
  if (typeof window === 'undefined') return undefined
  return window.aicsLive2dNative
}

const PRIORITY_MAP: Record<number, Live2DMotionPriority> = {
  1: 'idle',
  2: 'normal',
  3: 'force',
}

export function createNativeLive2DBackend(provider: NativeBridgeProvider = defaultBridgeProvider): Live2DStageBackend {
  return {
    kind: 'native',
    capability: NATIVE_CAPABILITY,

    async connect(options: Live2DConnectOptions): Promise<Live2DStageSession> {
      const bridge = provider()
      if (!bridge) {
        throw new Error(NATIVE_BACKEND_UNAVAILABLE)
      }
      const character = options.character || 'nene'
      const result = await bridge.setCharacter(options.modelUrl, { character })
      if (!result.ok) {
        throw new Error(`原生 Live2D 加载失败：${result.error ?? '未知错误'}`)
      }

      let destroyed = false
      let lastRect: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 }
      let lastVisible = false
      let gazeInFlight = false
      let queuedGaze: { x: number; y: number } | null = null
      let lastPassthrough: { x: number; y: number; width: number; height: number }[] = []
      const hitTestListeners = new Set<(areas: string[]) => void>()
      const motionStartedListeners = new Set<() => void>()
      const motionFailedListeners = new Set<(info: { group: string; index?: number; reason: string }) => void>()

      const pushFrame = () => {
        bridge.setFrame({ rect: lastRect, visible: lastVisible, opacity: 1, passthrough: lastPassthrough })
      }

      const pushGaze = (x: number, y: number) => {
        if (destroyed) return
        if (gazeInFlight) {
          queuedGaze = { x, y }
          return
        }
        gazeInFlight = true
        void Promise.resolve(bridge.setGaze(x, y))
          .catch(() => {})
          .finally(() => {
            gazeInFlight = false
            const next = queuedGaze
            queuedGaze = null
            if (next) pushGaze(next.x, next.y)
          })
      }

      const subscriptions: number[] = []
      subscriptions.push(bridge.onHitTest((areas) => {
        if (destroyed) return
        for (const listener of hitTestListeners) listener(areas)
      }))
      subscriptions.push(bridge.onMotionStarted(() => {
        if (destroyed) return
        for (const listener of motionStartedListeners) listener()
      }))
      subscriptions.push(bridge.onMotionFailed((info) => {
        if (destroyed) return
        for (const listener of motionFailedListeners) listener(info)
      }))

      const handle: Live2DModelHandle = {
        visible: true,
        motion(group, index, priority) {
          return bridge.playMotion(group, index, PRIORITY_MAP[priority ?? 3] ?? 'force')
            .then((result) => result.ok)
            .catch(() => false)
        },
        expression(name) {
          return bridge.setExpression(name)
            .then((result) => result.ok)
            .catch(() => false)
        },
        hitTest(x, y) {
          void bridge.hitTest(x, y).then((result) => {
            if (!destroyed) for (const listener of hitTestListeners) listener(result.areas)
          })
          return []
        },
        focus() { /* 原生端凝视由 Rust 经 setGaze 驱动，桌面场景用全局鼠标 */ },
        setParameterValueById() { /* 原生端不做参数写入（capability.parameterOverride=false） */ },
        onBeforeModelUpdate() { /* 原生端由 Cubism Native 帧循环执行作者工程 */ },
        applyFit() { /* 原生端尺寸由 overlay 帧控制（setFrame） */ },
        getNaturalSize() { return { width: options.canvasWidth, height: options.canvasHeight } },
        hasMotionGroup() { return false },
      }

      const session: Live2DStageSession = {
        kind: 'native',
        capability: NATIVE_CAPABILITY,
        onModelLoaded(callback) {
          const subscriptionId = bridge.onReady(() => {
            if (!destroyed) callback(handle)
          })
          subscriptions.push(subscriptionId)
        },
        onModelError(_callback) {
          // 桥没有独立错误事件：加载失败已由 connect 的 setCharacter 结果反映；
          // 运行期错误走 onMotionFailed / onEntranceFinished 之外的退化提示。
        },
        setPaused(paused) {
          lastVisible = !paused
          pushFrame()
        },
        setMaxFps(fps) {
          // 原生渲染线程接电目标 165fps；上限放行到 165，不被浏览器 120 限制。
          bridge.setMaxFps(Math.max(24, Math.min(165, Math.round(fps) || 60)))
        },
        getScreenSize() { return { width: options.canvasWidth, height: options.canvasHeight } },
        getCanvasSize() { return { width: options.canvasWidth, height: options.canvasHeight } },
        setStageScale() { /* overlay 尺寸由 live2dOverlayLayout 计算后经 updateOverlay 下发 */ },
        updateOverlay(rect, visible, passthrough = []) {
          lastRect = rect
          lastVisible = visible
          lastPassthrough = passthrough
          pushFrame()
        },
        canvasElement() { return null },
        onNativeHitTest(callback) {
          hitTestListeners.add(callback)
          return () => { hitTestListeners.delete(callback) }
        },
        onMotionFailed(callback) {
          motionFailedListeners.add(callback)
          return () => { motionFailedListeners.delete(callback) }
        },
        sendMouthLevel(level) {
          bridge.setMouthLevel(Math.max(0, Math.min(1, level)))
        },
        sendEmotion(name, intensity) {
          bridge.setEmotion(name, Math.max(0, Math.min(1, intensity)))
        },
        sendGaze(x, y) {
          pushGaze(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)))
        },
        destroy() {
          destroyed = true
          queuedGaze = null
          hitTestListeners.clear()
          motionStartedListeners.clear()
          motionFailedListeners.clear()
          for (const id of subscriptions) bridge.off(id)
          subscriptions.length = 0
          void bridge.destroy().catch(() => { /* 析构期忽略 */ })
        },
      }
      return session
    },
  }
}
