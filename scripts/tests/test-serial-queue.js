'use strict';

const assert = require('assert');
const SerialQueue = require('../../services/serial-queue');

const queue = new SerialQueue('test-queue');
assert.deepStrictEqual(queue.status(), { name: 'test-queue', active: 0, pending: 0 });

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
  assert.deepStrictEqual(queue.status(), { name: 'test-queue', active: 0, pending: 0 });
  console.log('Serial queue tests passed: FIFO order, wait context, and failure isolation');
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
