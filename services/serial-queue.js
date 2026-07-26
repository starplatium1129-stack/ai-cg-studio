'use strict';
/**
 * A tiny observable FIFO used for GPU-bound work.
 *
 * Keeping the queue here prevents individual routes from implementing subtly
 * different promise chains. A failed job never poisons later jobs.
 */
class SerialQueue {
    name;
    pending;
    active;
    tail;
    constructor(name) {
        this.name = name || 'queue';
        this.pending = 0;
        this.active = 0;
        this.tail = Promise.resolve();
    }
    run(task) {
        const queue = this;
        const queuedAt = Date.now();
        queue.pending += 1;
        function execute() {
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
            pending: this.pending
        };
    }
}
module.exports = SerialQueue;
