interface QueueContext {
    queue: string;
    waitMs: number;
}
type QueueTask<T> = (context: QueueContext) => T | Promise<T>;
interface QueueStatus {
    name: string;
    active: number;
    pending: number;
    maxPending: number;
}
/** run() 在队列已满时抛这个；路由据此回 503 而不是 500。 */
declare class QueueFullError extends Error {
    code: string;
    status: number;
    constructor(name: string, maxPending: number);
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
declare class SerialQueue {
    name: string;
    pending: number;
    active: number;
    maxPending: number;
    tail: Promise<unknown>;
    constructor(name?: string, maxPending?: number);
    run<T>(task: QueueTask<T>): Promise<T>;
    status(): QueueStatus;
}
declare namespace SerialQueue {
    type Full = QueueFullError;
}
export = SerialQueue;
