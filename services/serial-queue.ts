'use strict';

interface QueueContext {
  queue: string;
  waitMs: number;
}

type QueueTask<T> = (context: QueueContext) => T | Promise<T>;

interface QueueRunOptions {
  /**
   * 客户端断开时用的 signal。传了它，任务在排队期间被 abort 就会被直接丢弃 ——
   * 原先要等排到队首才检查，被放弃的请求照样拖慢后面的真实请求。
   */
  signal?: { aborted: boolean; addEventListener?: Function; removeEventListener?: Function };
}

interface QueueStatus {
  name: string;
  active: number;
  pending: number;
  maxPending: number;
}

/** run() 在队列已满时抛这个；路由据此回 503 而不是 500。 */
class QueueFullError extends Error {
  code: string;
  status: number;
  constructor(name: string, maxPending: number) {
    super('队列已满（' + name + '，上限 ' + maxPending + '），请稍后再试');
    this.name = 'QueueFullError';
    this.code = 'QUEUE_FULL';
    this.status = 503;
  }
}

/** 默认排队上限。GPU 任务本来就串行，排到几十个之后再排也只是徒增等待。 */
const DEFAULT_MAX_PENDING = 16;

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
  name: string;
  pending: number;
  active: number;
  maxPending: number;
  tail: Promise<unknown>;

  constructor(name?: string, maxPending?: number) {
    this.name = name || 'queue';
    this.pending = 0;
    this.active = 0;
    this.maxPending = typeof maxPending === 'number' && maxPending > 0
      ? maxPending : DEFAULT_MAX_PENDING;
    this.tail = Promise.resolve();
  }

  run<T>(task: QueueTask<T>, options?: QueueRunOptions): Promise<T> {
    const queue = this;
    const queuedAt = Date.now();
    if (queue.pending >= queue.maxPending) {
      return Promise.reject(new QueueFullError(queue.name, queue.maxPending));
    }
    queue.pending += 1;
    const signal = options && options.signal;

    function execute(): Promise<T> {
      queue.pending -= 1;
      // 排队期间客户端就走了：跳过执行，别占着 GPU 也别拖慢下一个
      if (signal && signal.aborted) {
        const error = new Error('The operation was aborted') as Error & { name: string };
        error.name = 'AbortError';
        return Promise.reject(error);
      }
      queue.active += 1;
      return Promise.resolve()
        .then(function () {
          return task({ queue: queue.name, waitMs: Date.now() - queuedAt });
        })
        .finally(function () {
          queue.active -= 1;
        });
    }

    const result = queue.tail.then(execute, execute) as Promise<T>;
    queue.tail = result.catch(function () {});
    return result;
  }

  status(): QueueStatus {
    return {
      name: this.name,
      active: this.active,
      pending: this.pending,
      maxPending: this.maxPending
    };
  }
}

namespace SerialQueue {
  export type Full = QueueFullError;
}
(SerialQueue as unknown as { QueueFullError: typeof QueueFullError }).QueueFullError = QueueFullError;

export = SerialQueue;
