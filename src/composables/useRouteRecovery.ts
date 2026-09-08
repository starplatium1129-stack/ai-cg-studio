import { shallowRef } from 'vue'
import type { Router } from 'vue-router'

export const routeRecovery = shallowRef<{ target: string } | null>(null)

export function installRouteRecovery(router: Router) {
  router.onError((_error, to) => {
    routeRecovery.value = { target: to.fullPath }
  })
  router.afterEach((_to, _from, failure) => {
    if (!failure) routeRecovery.value = null
  })
}
