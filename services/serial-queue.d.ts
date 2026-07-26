interface QueueContext {
    queue: string;
    waitMs: number;
}
type QueueTask<T> = (context: QueueContext) => T | Promise<T>;
interface QueueStatus {
    name: string;
    active: number;
    pending: number;
}
/**
 * A tiny observable FIFO used for GPU-bound work.
 *
 * Keeping the queue here prevents individual routes from implementing subtly
 * different promise chains. A failed job never poisons later jobs.
 */
declare class SerialQueue {
    name: string;
    pending: number;
    active: number;
    tail: Promise<unknown>;
    constructor(name?: string);
    run<T>(task: QueueTask<T>): Promise<T>;
    status(): QueueStatus;
}
export = SerialQueue;
