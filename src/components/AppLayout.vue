<template>
  <div class="page-root">
    <a class="skip-link" href="#main">跳到主要内容</a>
    <AppNav />
    <!-- 必须是真的 <main>：skip-link 指向这里，之前是 div，跳转链接落在一个普通容器上 -->
    <main id="main" class="page-main" tabindex="-1">
      <RouterView v-slot="{ Component, route }">
        <Transition :name="route.meta.transition as string || 'page'" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>
    <footer class="site-footer">
      <p>© 2025 绫季绘境 · 个人创作工作台</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import AppNav from './AppNav.vue'
</script>

<style scoped>
.page-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.page-main {
  flex: 1;
  min-width: 0;
}
/* 用 skip-link 跳进来时要有可见落点，但鼠标点击不该出现描边 */
.page-main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.site-footer {
  padding: var(--s-4) var(--s-6);
  text-align: center;
  font-size: var(--fs-body-sm);
  color: var(--text-muted);
  border-top: 1px solid var(--border-soft);
  background: color-mix(in srgb, var(--bg-deep) 55%, transparent);
}
</style>
