/**
 * 字体声明异步块（2026-08-28 工程审计 P1-7）。
 *
 * 315 条 @font-face（Noto Sans SC unicode-range 子集 + JetBrains Mono）此前
 * 经 main.ts 同步 import 打进入口 CSS（453KB，其中 ~368KB 是字体声明），
 * 每个路由解析 CSS 都要处理。移入独立异步 chunk 后入口 CSS 只留真样式，
 * 文本先用 fallback 渲染——@fontsource 全部 font-display:swap，字体到达后
 * 无闪换断点（同字族度量）。
 *
 * 加载时机：main.ts 里不 await 的动态 import，首帧即发起，不阻塞解析。
 */
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/600.css'
import '@fontsource/noto-sans-sc/700.css'
