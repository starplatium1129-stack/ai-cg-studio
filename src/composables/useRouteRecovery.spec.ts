import { expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { installRouteRecovery, routeRecovery } from './useRouteRecovery'

it('keeps the current route on failed navigation and clears recovery after success', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: {} },
    { path: '/missing', component: () => Promise.reject(new Error('Failed to fetch dynamically imported module')) },
    { path: '/ready', component: {} },
  ] })
  installRouteRecovery(router)
  await router.push('/')
  await expect(router.push('/missing?return=1')).rejects.toThrow()
  expect(router.currentRoute.value.path).toBe('/')
  expect(routeRecovery.value?.target).toBe('/missing?return=1')
  await router.push('/ready')
  expect(routeRecovery.value).toBeNull()
})
