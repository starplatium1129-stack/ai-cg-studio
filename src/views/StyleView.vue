<template>
  <article class="page" style="--page-max:1000px">
    <div class="page-kicker">Art direction</div>
    <h1 class="title">画风</h1>
    <p class="subtitle">先定下今天的调子。选好之后，绘制台会让整张画面都听这个调子。</p>
    <div class="section-title">色彩氛围 (Color Moods)</div>
    <div class="mood-grid mood-grid-lg">
      <RouterLink
        v-for="m in MOODS" :key="m.id"
        :to="'/prompt-builder?mood=' + m.id"
        class="mood-card"
      >
        <div class="mood-strip"><div class="mood-swatch" :style="{ '--swatch': m.color }"></div></div>
        <div class="mood-body">
          <div class="mood-name">{{ m.name }}</div>
          <div class="mood-desc">{{ m.desc }}</div>
        </div>
      </RouterLink>
    </div>
    <RouterLink to="/color-script" class="btn btn-ghost" style="margin-top:var(--s-4)">📖 查看完整色彩剧本 →</RouterLink>
  </article>
</template>

<script setup lang="ts">
const MOODS = [
  { id:'joy',     color:'#FFD54F', name:'Joy 喜悦',     desc:'明亮、温暖、希望' },
  { id:'love',    color:'#F06292', name:'Love 恋爱',    desc:'樱粉、羞涩、心动' },
  { id:'calm',    color:'#81C784', name:'Calm 平静',    desc:'柔和、治愈、安宁' },
  { id:'sad',     color:'#64B5F6', name:'Sad 忧郁',     desc:'冷蓝、雨夜、思念' },
  { id:'tension', color:'#BA68C8', name:'Tension 紧张', desc:'紫红、戏剧、冲突' },
  { id:'warmth',  color:'#FFB74D', name:'Warmth 温馨',  desc:'橙金、炉火、归属' },
]
</script>
