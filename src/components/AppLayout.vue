<template>
  <div class="page-root">
    <AppNav />
    <main>
      <RouterView />
    </main>
    <footer class="site-footer">
      <p>© 2024 绫季绘境 · 个人创作工作台</p>
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
main {
  flex: 1;
}
.site-footer {
  padding: var(--s-4) var(--s-6);
  text-align: center;
  font-size: var(--fs-body-sm);
  color: var(--text-muted);
  border-top: 1px solid var(--border-soft);
}
</style>
