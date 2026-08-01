/**
 * 服务自愈看门狗。
 *
 * 规则：
 * - 只有"曾经健康且当前处于受管状态"的服务才自动重启，避免上游本来就没
 *   启动时无限拉起（例如用户从未点过"启动语音"）。
 * - 掉线后按指数退避重试（intervalMs → 2x → 4x → …，封顶 maxBackoffMs）；
 *   恢复健康后重置退避。
 * - 重启动作互斥（同一服务不会并发重启）；stop() 会清掉全部定时器。
 */
interface WatchdogService {
    name: string;
    /** 探测当前健康状态（true = 在线）。 */
    probe: () => Promise<boolean>;
    /** 执行重启；返回 ok:true 表示已恢复或已开始恢复。 */
    restart: () => Promise<{
        ok: boolean;
        error?: string;
    }>;
    /** 是否允许自动重启（受管状态）。 */
    shouldManage: () => boolean;
}
interface WatchdogOptions {
    services: WatchdogService[];
    intervalMs?: number;
    maxBackoffMs?: number;
    onEvent?: (event: {
        service: string;
        kind: 'down' | 'restarted' | 'restart-failed';
        attempt?: number;
        error?: string;
    }) => void;
}
interface WatchdogStatus {
    running: boolean;
    services: Record<string, {
        healthy: boolean;
        managed: boolean;
        restarting: boolean;
        attempt: number;
        lastError: string;
        lastRestartAt: number;
    }>;
}
declare function createServiceWatchdog(options: WatchdogOptions): {
    start: () => void;
    stop: () => void;
    check: () => Promise<void>;
    status: () => WatchdogStatus;
};
declare const _default: {
    createServiceWatchdog: typeof createServiceWatchdog;
};
export = _default;
