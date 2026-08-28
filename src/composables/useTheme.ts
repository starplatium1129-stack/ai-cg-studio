/**
 * 主题锁定为深色（2026-08-28 美术设计审计 · 方案 A）。
 *
 * 为什么锁死：
 *   根因是令牌体系的不对称 —— `:root` 的 154 个令牌本来就围绕深色调设计
 *   （紫黑底 #110b22 + 樱花粉 #f4a6d7，阴影走粉紫"读作纸影"，立绘舞台是暗房底），
 *   浅色是后来补的 50 个覆盖，覆盖率实测只有 32.5%。20 套角色主题里 17 套
 *   压根没有浅色版，切过去会看到 asuka 的 #ff4a3d 直接压在粉白纸上。
 *   对单人使用的创作工具，双主题是纯负债：每新增一个颜色都要写两遍，
 *   而收益只是一个自己几乎不拨动的开关。省下的维护成本投到深色体验本身。
 *
 * 锁死后拿掉的东西：
 *   - 不再读写 THEME_SETTING。settingsRepository 里的 schema 保留不动：
 *     它有 scripts/tests/test-storage-repositories.js 契约测试覆盖，
 *     删定义会连带破坏 test:contract，而留着对用户无任何代价。
 *   - 不再跟随 prefers-color-scheme。原本"用户没选过就跟着系统变"，
 *     但系统为浅色时会掉进上面那个没做完的坑 —— 锁死反而更可预期。
 *   - 不再导出 toggle()。AppThemeToggle 已从 AppNav / ControlView 移除。
 *
 * data-theme 属性仍然写入 "dark"：装饰层强度选择器与 SemanticParticleField
 * 的深色画布判据（src/components/visual/SemanticParticleField.vue:166）依赖它，
 * 保留属性可让这些判据继续走同一条代码路径，不必散落特判。
 */

import { ref } from 'vue'

export const LOCKED_THEME = 'dark'

export function preferredTheme() {
  return LOCKED_THEME
}

/** 恒为 'dark'。保留 ref 形状，避免消费方跟着改。 */
const theme = ref(LOCKED_THEME)

export function useTheme() {
  return { theme }
}
