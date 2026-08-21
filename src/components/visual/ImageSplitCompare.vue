<template>
  <div
    ref="containerEl"
    class="image-split-compare"
    :class="{ 'is-dragging': isDragging }"
    @pointerdown="startDrag"
    @pointermove="onDrag"
    @pointerup="stopDrag"
    @pointercancel="stopDrag"
  >
    <!-- Before Image (Base layer) -->
    <div class="split-layer layer-before">
      <img :src="beforeSrc" :alt="beforeLabel || '原图'" class="split-img" draggable="false" />
      <span class="split-badge badge-before">{{ beforeLabel || '换装前' }}</span>
    </div>

    <!-- After Image (Clipped overlay) -->
    <div
      class="split-layer layer-after"
      :style="{ clipPath: `polygon(${splitPos}% 0, 100% 0, 100% 100%, ${splitPos}% 100%)` }"
    >
      <img :src="afterSrc" :alt="afterLabel || '换装后'" class="split-img" draggable="false" />
      <span class="split-badge badge-after">{{ afterLabel || '换装后' }}</span>
    </div>

    <!-- Split Divider Handle -->
    <div
      class="split-divider"
      :style="{ left: `${splitPos}%` }"
      role="slider"
      aria-label="左右对比滑动条"
      :aria-valuenow="splitPos"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="divider-line"></div>
      <div class="divider-handle">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="8 6 2 12 8 18"></polyline>
          <polyline points="16 6 22 12 16 18"></polyline>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  beforeSrc: string
  afterSrc: string
  beforeLabel?: string
  afterLabel?: string
  initialPos?: number
}>()

const splitPos = ref(props.initialPos ?? 50)
const isDragging = ref(false)
const containerEl = ref<HTMLElement | null>(null)

function updatePosFromEvent(event: PointerEvent) {
  if (!containerEl.value) return
  const rect = containerEl.value.getBoundingClientRect()
  if (!rect.width) return
  const offsetX = event.clientX - rect.left
  const clampedX = Math.max(0, Math.min(rect.width, offsetX))
  splitPos.value = Math.round((clampedX / rect.width) * 100)
}

function startDrag(event: PointerEvent) {
  isDragging.value = true
  event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId)
  updatePosFromEvent(event)
}

function onDrag(event: PointerEvent) {
  if (isDragging.value) {
    updatePosFromEvent(event)
  }
}

function stopDrag(event: PointerEvent) {
  if (isDragging.value) {
    isDragging.value = false
    try {
      event.currentTarget instanceof HTMLElement && event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {}
  }
}
</script>

<style scoped>
.image-split-compare {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
  touch-action: none;
  cursor: ew-resize;
  border-radius: 8px;
  background: #09090b;
}

.split-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.split-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.split-badge {
  position: absolute;
  top: 10px;
  font-size: 0.72rem;
  padding: 3px 8px;
  border-radius: 4px;
  backdrop-filter: blur(6px);
  z-index: 2;
  font-weight: 500;
}

.badge-before {
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.badge-after {
  right: 10px;
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.split-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  z-index: 5;
  pointer-events: none;
}

.divider-line {
  position: absolute;
  inset: 0;
  background: #38bdf8;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
}

.divider-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #0f172a;
  border: 2px solid #38bdf8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #38bdf8;
}

.is-dragging .divider-handle {
  transform: translate(-50%, -50%) scale(1.15);
  background: #38bdf8;
  color: #0f172a;
}
</style>
