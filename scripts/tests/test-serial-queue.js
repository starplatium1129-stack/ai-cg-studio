'use strict';

const assert = require('assert');
const SerialQueue = require('../../services/serial-queue');

const { test } = require('node:test');

test("Serial queue tests passed: FIFO order, wait context, failure isolation, admission control, and abort dequeue", () => {
const queue = new SerialQueue('test-queue');
assert.deepStrictEqual(queue.status(), { name: 'test-queue', active: 0, pending: 0, maxPending: 16 });

const order = [];
const first = queue.run(function (context) {
  assert.strictEqual(context.queue, 'test-queue');
  assert(context.waitMs >= 0);
  order.push('start-1');
  return new Promise(function (resolve) {
    setTimeout(function () {
      order.push('end-1');
      resolve('one');
    }, 20);
  });
});

assert.strictEqual(queue.status().pending, 1);
assert.strictEqual(queue.status().active, 0);

const second = queue.run(function () {
  order.push('start-2');
  return 'two';
});

const failed = queue.run(function () {
  order.push('start-fail');
  throw new Error('boom');
});

const third = queue.run(function () {
  order.push('start-3');
  return 'three';
});

Promise.allSettled([first, second, failed, third]).then(function (results) {
  assert.strictEqual(results[0].status, 'fulfilled');
  assert.strictEqual(results[0].value, 'one');
  assert.strictEqual(results[1].status, 'fulfilled');
  assert.strictEqual(results[1].value, 'two');
  assert.strictEqual(results[2].status, 'rejected');
  assert.strictEqual(String(results[2].reason && results[2].reason.message), 'boom');
  assert.strictEqual(results[3].status, 'fulfilled');
  assert.strictEqual(results[3].value, 'three');
  assert.deepStrictEqual(order, ['start-1', 'end-1', 'start-2', 'start-fail', 'start-3']);
  assert.deepStrictEqual(queue.status(), { name: 'test-queue', active: 0, pending: 0, maxPending: 16 });
  return checkAdmissionControl();
}).then(function () {
  console.log('Serial queue tests passed: FIFO order, wait context, failure isolation, admission control, and abort dequeue');
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});

// 排队上限：无上限时一个客户端就能无限堆积 GPU 作业（实测 500 个全被接受）
function checkAdmissionControl() {
  const bounded = new SerialQueue('bounded', 3);
  assert.strictEqual(bounded.status().maxPending, 3);

  const block = function () {
    return new Promise(function (resolve) { setTimeout(resolve, 30); });
  };
  const accepted = [bounded.run(block), bounded.run(block), bounded.run(block)];
  assert.strictEqual(bounded.status().pending, 3, 'three jobs must be queued');

  const rejected = bounded.run(block);
  return rejected.then(function () {
    throw new Error('queue must reject work beyond maxPending');
  }, function (error) {
    assert.strictEqual(error.code, 'QUEUE_FULL');
    assert.strictEqual(error.status, 503, 'callers need a 503-mappable status');
    return Promise.all(accepted);
  }).then(function () {
    // 队列排空后必须重新接受任务
    return bounded.run(function () { return 'ok'; });
  }).then(function (value) {
    assert.strictEqual(value, 'ok', 'queue must accept work again after draining');
    return checkAbortDequeue();
  });
}

// 排队期间客户端断开：任务必须直接出队，而不是等排到队首才发现
// （否则被放弃的请求照样拖慢后面的真实请求）
function checkAbortDequeue() {
  const q = new SerialQueue('abort-test');
  const ran = [];

  const head = q.run(function () {
    return new Promise(function (resolve) { setTimeout(resolve, 25); });
  });

  const signal = { aborted: false };
  const abandoned = q.run(function () { ran.push('abandoned'); return 'nope'; }, { signal: signal });
  const real = q.run(function () { ran.push('real'); return 'yes'; });

  signal.aborted = true;  // 还在排队时客户端就走了

  return Promise.allSettled([head, abandoned, real]).then(function (results) {
    assert.strictEqual(results[1].status, 'rejected', 'aborted job must not run');
    assert.strictEqual(results[1].reason.name, 'AbortError');
    assert.strictEqual(results[2].status, 'fulfilled', 'the real job must still complete');
    assert.deepStrictEqual(ran, ['real'], 'abandoned work must never reach the GPU');
    assert.strictEqual(q.status().pending, 0, 'aborted job must leave the queue');
  });
}

});
