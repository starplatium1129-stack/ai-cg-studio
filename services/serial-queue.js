'use strict';

/**
 * A tiny observable FIFO used for GPU-bound work.
 *
 * Keeping the queue here prevents individual routes from implementing subtly
 * different promise chains. A failed job never poisons later jobs.
 */
function SerialQueue(name) {
  this.name = name || 'queue';
  this.pending = 0;
  this.active = 0;
  this.tail = Promise.resolve();
}

SerialQueue.prototype.run = function (task) {
  var queue = this;
  var queuedAt = Date.now();
  queue.pending += 1;

  function execute() {
    queue.pending -= 1;
    queue.active += 1;
    return Promise.resolve()
      .then(function () {
        return task({ queue:queue.name, waitMs:Date.now() - queuedAt });
      })
      .finally(function () {
        queue.active -= 1;
      });
  }

  var result = queue.tail.then(execute, execute);
  queue.tail = result.catch(function () {});
  return result;
};

SerialQueue.prototype.status = function () {
  return {
    name:this.name,
    active:this.active,
    pending:this.pending
  };
};

module.exports = SerialQueue;
