import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export interface InpaintMaskCanvasDeps {
  /** 弹窗是否打开（关闭时不响应撤销快捷键）。 */
  active: () => boolean
  /** 预览 <img> 元素（同步画布尺寸时读 naturalWidth/Height）。 */
  imageEl: Ref<HTMLImageElement | null>
  /** 检测到的目标画幅（优先于 naturalWidth，见 useInpaintImageSource）。 */
  resolution: () => { width: number; height: number } | null
}

const MAX_UNDO_STEPS = 20

/**
 * 局部换装弹窗「手绘遮罩引擎」（2026-08-22 自 AnimaInpaintModal 下沉）。
 *
 * 半透明白色笔触（ComfyUI 以亮度识别遮罩）、Shift/右键擦除
 * （destination-out）、pointer capture 跨元素连续笔划、坐标按
 * canvas/display 双比例换算、20 步 ImageData 撤销栈（Ctrl+Z）、
 * Alt+滚轮调笔刷、自定义属性笔刷光标。toBlob 导出前做空遮罩检测。
 */
export function useInpaintMaskCanvas(deps: InpaintMaskCanvasDeps) {
  const maskCanvasEl = ref<HTMLCanvasElement | null>(null)
  const maskMode = ref<'auto' | 'paint'>('paint')
  const brushSize = ref(36)
  const maskHistory = ref<ImageData[]>([])
  const cursorVisible = ref(false)
  const cursorX = ref(0)
  const cursorY = ref(0)
  let drawing = false
  let erase = false
  let lastMaskPoint: { x: number; y: number } | null = null

  // 自定义属性载体：笔刷光标样式规则留在 scoped CSS，内联只承载数据（style-debt 门禁约定）
  const brushCursorStyle = computed(() => ({
    '--cursor-x': `${cursorX.value}px`,
    '--cursor-y': `${cursorY.value}px`,
    '--brush-diameter': `${brushSize.value * 2}px`,
  }))

  function clearMask() {
    const canvas = maskCanvasEl.value
    if (!canvas) return
    const context = canvas.getContext('2d')
    context?.clearRect(0, 0, canvas.width, canvas.height)
    maskHistory.value = []
  }

  function saveMaskState() {
    const canvas = maskCanvasEl.value
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const data = context.getImageData(0, 0, canvas.width, canvas.height)
    maskHistory.value.push(data)
    if (maskHistory.value.length > MAX_UNDO_STEPS) {
      maskHistory.value.shift()
    }
  }

  function undoMask() {
    const canvas = maskCanvasEl.value
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context || maskHistory.value.length === 0) return
    const prevState = maskHistory.value.pop()
    if (prevState) {
      context.putImageData(prevState, 0, 0)
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!deps.active() || maskMode.value !== 'paint') return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      undoMask()
    }
  }

  function handleCanvasWheel(event: WheelEvent) {
    if (event.altKey && maskMode.value === 'paint') {
      event.preventDefault()
      const delta = event.deltaY < 0 ? 4 : -4
      brushSize.value = Math.max(8, Math.min(96, brushSize.value + delta))
    }
  }

  function syncMaskCanvas() {
    const image = deps.imageEl.value
    const canvas = maskCanvasEl.value
    if (!image || !canvas || !image.naturalWidth || !image.naturalHeight) return
    canvas.width = deps.resolution()?.width ?? image.naturalWidth
    canvas.height = deps.resolution()?.height ?? image.naturalHeight
    clearMask()
  }

  function pointerPosition(event: PointerEvent): { x: number; y: number } | null {
    const canvas = maskCanvasEl.value
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function drawMaskStroke(event: PointerEvent) {
    const canvas = maskCanvasEl.value
    const position = pointerPosition(event)
    if (!canvas || !position) return
    const context = canvas.getContext('2d')
    if (!context) return
    const rect = canvas.getBoundingClientRect()
    const radius = brushSize.value * (canvas.width / rect.width)
    context.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
    context.fillStyle = 'rgba(255, 255, 255, 0.72)'
    context.strokeStyle = 'rgba(255, 255, 255, 0.72)'
    context.lineWidth = radius * 2
    context.lineCap = 'round'
    if (lastMaskPoint) {
      context.beginPath()
      context.moveTo(lastMaskPoint.x, lastMaskPoint.y)
      context.lineTo(position.x, position.y)
      context.stroke()
    } else {
      context.beginPath()
      context.arc(position.x, position.y, radius, 0, Math.PI * 2)
      context.fill()
    }
    lastMaskPoint = position
  }

  function startMaskPaint(event: PointerEvent) {
    if (maskMode.value !== 'paint') return
    saveMaskState()
    drawing = true
    erase = event.button === 2 || event.shiftKey
    lastMaskPoint = null
    event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId)
    drawMaskStroke(event)
  }

  function updateCursor(event: PointerEvent) {
    const canvas = maskCanvasEl.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    cursorX.value = event.clientX - rect.left
    cursorY.value = event.clientY - rect.top
  }

  function continueMaskPaint(event: PointerEvent) {
    updateCursor(event)
    if (drawing) drawMaskStroke(event)
  }

  function stopMaskPaint() {
    drawing = false
    erase = false
    lastMaskPoint = null
  }

  /** 导出遮罩 PNG；空遮罩（全 0 alpha）返回 null，交由宿主提示先涂抹。 */
  async function maskBlob(): Promise<Blob | null> {
    if (maskMode.value !== 'paint' || !maskCanvasEl.value) return null
    const canvas = maskCanvasEl.value
    const context = canvas.getContext('2d')
    if (!context || !context.getImageData(0, 0, canvas.width, canvas.height).data.some(value => value > 0)) return null
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'))
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    maskCanvasEl,
    maskMode,
    brushSize,
    cursorVisible,
    brushCursorStyle,
    /** 撤销栈（模板用它禁用撤销按钮）。 */
    maskHistory,
    clearMask,
    undoMask,
    handleCanvasWheel,
    syncMaskCanvas,
    startMaskPaint,
    continueMaskPaint,
    stopMaskPaint,
    maskBlob,
  }
}
