<template>
  <svg
    class="archive-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 主笔 -->
    <path v-for="path in def.paths" :key="'a' + path" :d="path" />
    <!-- 钢笔第二笔：整体轻微错开 + 旋转，形成手绘双线 -->
    <g v-if="def.double !== false" class="archive-icon-dupe" opacity="0.55" stroke-width="1.2">
      <path
        v-for="path in def.paths"
        :key="'b' + path"
        :d="path"
        transform="translate(0.55 0.45) rotate(1.2 12 12)"
      />
    </g>
    <!-- 端点墨点：开放笔画的起笔/收笔处的小圆点 -->
    <circle
      v-for="(point, i) in def.ends || []"
      :key="'c' + i"
      class="archive-icon-end"
      :cx="point[0]"
      :cy="point[1]"
      r="0.52"
      fill="currentColor"
      stroke="none"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ArchiveIconDef } from './icons/types.ts'
import { navDefs } from './icons/nav.ts'
import { statusDefs } from './icons/status.ts'
import { emotionDefs } from './icons/emotion.ts'
import { characterDefs } from './icons/character.ts'
import { cameraDefs } from './icons/camera.ts'
import { lightingDefs } from './icons/lighting.ts'
import { compositionDefs } from './icons/composition.ts'
import { motifDefs } from './icons/motif.ts'
import { toolDefs } from './icons/tool.ts'

export type ArchiveIconName =
  | 'scene' | 'spark' | 'chat' | 'image' | 'gallery'
  | 'character' | 'palette' | 'model' | 'manager'
  | 'info' | 'success' | 'error' | 'warning' | 'sound' | 'mute'
  | 'close' | 'refresh' | 'sun' | 'moon' | 'menu'
  | 'gear' | 'lightning' | 'lock' | 'eye' | 'wand' | 'speaker' | 'filter' | 'search' | 'pin'
  | 'trash'
  | 'happy' | 'shy' | 'miss' | 'expect' | 'nervous' | 'gentle' | 'moved' | 'sad'
  | 'calm' | 'joyful' | 'relaxed' | 'serious' | 'love' | 'sleepy' | 'spoiled' | 'wronged'
  | 'nene' | 'natsume' | 'triad'
  // ── 镜头（导演台选择）─────────────────────────────────────────
  | 'closeup' | 'midshot' | 'wideshot' | 'pov' | 'lowangle' | 'highangle'
  | 'sideview' | 'turnshot' | 'selfie' | 'detail'
  // ── 光照 ─────────────────────────────────────────────────────
  | 'goldenhour' | 'windowlight' | 'backlight' | 'moonlight' | 'lantern' | 'overcast'
  // ── 构图 ─────────────────────────────────────────────────────
  | 'centercomp' | 'rule3' | 'leftcomp' | 'rightcomp' | 'foreground' | 'framecomp' | 'bywindow'
  // ── 色板 / 主题 / 季节 ────────────────────────────────────────
  | 'leaf' | 'rain' | 'coffee' | 'cap' | 'plane' | 'flower' | 'flame' | 'play' | 'book'
  | 'clap' | 'snowflake' | 'cherry' | 'autumnleaf'
  // ── 工具 / 服装形态 ──────────────────────────────────────────
  | 'star' | 'download' | 'upload' | 'copy' | 'broom' | 'health' | 'wardrobe' | 'compare'
  | 'bikini' | 'dress' | 'bunny' | 'coat' | 'school' | 'kimono' | 'ribbon'
  | 'expand' | 'compress' | 'dice' | 'queue' | 'inpaint'
  | 'play'

const props = defineProps<{ name: ArchiveIconName }>()

const ICON_DEFS: Record<ArchiveIconName, ArchiveIconDef> = {
  ...navDefs,
  ...statusDefs,
  ...emotionDefs,
  ...characterDefs,
  ...cameraDefs,
  ...lightingDefs,
  ...compositionDefs,
  ...motifDefs,
  ...toolDefs,
} as Record<ArchiveIconName, ArchiveIconDef>

const def = computed(() => ICON_DEFS[props.name])
</script>

<style scoped>
.archive-icon { display:inline-block; width:1em; height:1em; flex:0 0 auto; vertical-align:-.14em; }
.archive-icon-dupe {
  pointer-events:none;
  transform-origin: 12px 12px;
  transition: transform var(--motion-hover) var(--ease-out), opacity var(--motion-hover) var(--ease-out);
}
.archive-icon-end {
  pointer-events: none;
  transform-origin: center;
  transition: transform var(--motion-hover) var(--ease-out);
}

/* 宿主控件 hover 时：第二笔墨线微微收拢入墨，端点微扩，如笔尖蘸墨起笔 */
@media (hover: hover) and (pointer: fine) {
  :where(button, a, summary, [role="button"], .chip, .sc-tag):hover .archive-icon-dupe {
    transform: translate(-0.15px, -0.15px) rotate(-0.3deg);
    opacity: 0.72;
  }
  :where(button, a, summary, [role="button"], .chip, .sc-tag):hover .archive-icon-end {
    transform: scale(1.18);
  }
}

/* 宿主控件 active 按下时：第二笔墨线如笔尖受力按压微散，呈现真实物理压感 */
:where(button, a, summary, [role="button"], .chip, .sc-tag):active .archive-icon-dupe {
  transform: translate(0.2px, 0.2px) rotate(0.4deg);
  opacity: 0.85;
}
</style>
