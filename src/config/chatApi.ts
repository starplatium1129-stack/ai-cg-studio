/**
 * 聊天 API 默认值单一来源。
 *
 * useChatStorage 的初始 settings 与 ChatApiSettings 的 vendor 预设原本各自
 * 硬编码同一批端点/模型/key —— 改一处另一处漂移。这里收敛为共享常量，
 * 两端都从这里取。
 */

/** 本机 CLIProxyAPI 网关（CPA-Manager-Plus / CLIProxyAPI 管理的本地多账号代理） */
export const CLIPROXY_BASE_URL = 'http://127.0.0.1:8317/v1'
/**
 * 密钥不入库（2026-08-31 七维审计 P1）：.env* 已 .gitignore，本机在项目根
 * `.env.local` 写 `VITE_CLIPROXY_API_KEY=sk-xxx` 即可在 dev/build 时注入
 * （Vite 静态内联，桌面部署随 dist 生效）。未配置时为空串，此时走
 * ChatApiSettings 手填或网关侧配置。注意：历史提交中曾有旧默认值，需要
 * 彻底轮换时在 CLIProxyAPI 侧改管理 key 后同步更新 .env.local。
 */
export const CLIPROXY_API_KEY: string = import.meta.env.VITE_CLIPROXY_API_KEY || ''
export const CLIPROXY_DEFAULT_MODEL = 'gemini-3.6-flash-high'

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash'

export const OPENCODE_BASE_URL = 'https://opencode.ai/zen/v1'
export const OPENCODE_DEFAULT_MODEL = 'deepseek-v4-flash-free'

export const OPENCODE_GO_BASE_URL = 'https://opencode.ai/zen/go/v1'
export const OPENCODE_GO_DEFAULT_MODEL = 'deepseek-v4-flash'
