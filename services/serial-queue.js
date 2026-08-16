'use strict';
/** run() 在队列已满时抛这个；路由据此回 503 而不是 500。 */
class QueueFullError extends Error {
    code;
    status;
    constructor(name, maxPending) {
        super('队列已满（' + name + '，上限 ' + maxPending + '），请稍后再试');
        this.name = 'QueueFullError';
        this.code = 'QUEUE_FULL';
        this.status = 503;
    }
}
/** 默认排队上限。GPU 任务本来就串行，排到几十个之后再排也只是徒增等待。 */
const DEFAULT_MAX_PENDING = 16;
/** 排队/入队即中止的统一失败原因（AbortError，与 execute 中原判断一致）。 */
function abortError() {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    return error;
}
/**
 * A tiny observable FIFO used for GPU-bound work.
 *
 * Keeping the queue here prevents individual routes from implementing subtly
 * different promise chains. A failed job never poisons later jobs.
 *
 * 有排队上限：之前无上限，实测连塞 500 个任务全部被接受 ——
 * 一个 token 持有者即可无限堆积 GPU 作业并占满内存。
 */
class SerialQueue {
    name;
    pending;
    active;
    maxPending;
    tail;
    constructor(name, maxPending) {
        this.name = name || 'queue';
        this.pending = 0;
        this.active = 0;
        this.maxPending = typeof maxPending === 'number' && maxPending > 0
            ? maxPending : DEFAULT_MAX_PENDING;
        this.tail = Promise.resolve();
    }
    run(task, options) {
        const queue = this;
        const queuedAt = Date.now();
        const signal = options && options.signal;
        // 入队即已中止：不占槽、不进链，直接失败（避免幽灵槽占用队列容量）。
        if (signal && signal.aborted) {
            return Promise.reject(abortError());
        }
        if (queue.pending >= queue.maxPending) {
            return Promise.reject(new QueueFullError(queue.name, queue.maxPending));
        }
        queue.pending += 1;
        // 2026-08-16 审计：排队期间客户端断开 → 立即释放 pending 槽，而不是等排到
        // 队首才检查。此前被放弃的请求会占着槽位拖慢后面所有真实请求（16 个幽灵槽
        // 就能把 GPU 队列塞满）。槽位释放是幂等的，execute() 与 abort 回调只生效一次。
        let slotReleased = false;
        const releaseSlot = function () {
            if (slotReleased)
                return;
            slotReleased = true;
            queue.pending -= 1;
        };
        const onAbort = function () {
            releaseSlot();
            if (signal && typeof signal.removeEventListener === 'function') {
                try {
                    signal.removeEventListener('abort', onAbort);
                }
                catch { }
            }
        };
        if (signal && typeof signal.addEventListener === 'function') {
            try {
                signal.addEventListener('abort', onAbort, { once: true });
            }
            catch { }
        }
        function execute() {
            if (slotReleased) {
                // abort 已在排队期间释放槽位：跳过执行，不重复操作计数。
                return Promise.reject(abortError());
            }
            if (signal && signal.aborted) {
                // 排到队首才发现的 abort：此刻释放槽位并拒绝（GPU 未执行）。
                releaseSlot();
                return Promise.reject(abortError());
            }
            // 正事开始：abort 不应再碰队列计数（任务已转 active）。
            if (signal && typeof signal.removeEventListener === 'function') {
                try {
                    signal.removeEventListener('abort', onAbort);
                }
                catch { }
            }
            queue.pending -= 1;
            queue.active += 1;
            return Promise.resolve()
                .then(function () {
                return task({ queue: queue.name, waitMs: Date.now() - queuedAt });
            })
                .finally(function () {
                queue.active -= 1;
            });
        }
        const result = queue.tail.then(execute, execute);
        queue.tail = result.catch(function () { });
        return result;
    }
    status() {
        return {
            name: this.name,
            active: this.active,
            pending: this.pending,
            maxPending: this.maxPending
        };
    }
}
SerialQueue.QueueFullError = QueueFullError;
module.exports = SerialQueue;
