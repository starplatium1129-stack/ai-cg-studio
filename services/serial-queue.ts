'use strict';

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
class SerialQueue {
  name: string;
  pending: number;
  active: number;
  tail: Promise<unknown>;

  constructor(name?: string) {
    this.name = name || 'queue';
    this.pending = 0;
    this.active = 0;
    this.tail = Promise.resolve();
  }

  run<T>(task: QueueTask<T>): Promise<T> {
    const queue = this;
    const queuedAt = Date.now();
    queue.pending += 1;

    function execute(): Promise<T> {
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

    const result = queue.tail.then(execute, execute) as Promise<T>;
    queue.tail = result.catch(function () {});
    return result;
  }

  status(): QueueStatus {
    return {
      name: this.name,
      active: this.active,
      pending: this.pending
    };
  }
}

export = SerialQueue;
