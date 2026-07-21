const assert = require('assert');
const sdError = require('../tools/sd-error');

function classify(error){ return sdError.classify(error); }

assert.strictEqual(classify({ message:'CUDA out of memory', status:500 }).kind, 'oom');
assert.strictEqual(classify({ message:'could not find lora ayachi_nene', status:500 }).action.id, 'retry_without_lora');
assert.strictEqual(classify({ detail:'checkpoint not found', status:500 }).action.id, 'retry_current_model');
assert.strictEqual(classify({ message:'sampler not found', status:400 }).kind, 'sampler');
assert.strictEqual(classify({ name:'TimeoutError', message:'SD WebUI 请求超时' }).action.id, 'retry_light');
assert.strictEqual(classify({ status:404, message:'HTTP 404' }).kind, 'gateway');
assert.strictEqual(classify({ name:'NetworkError', message:'无法连接 SD WebUI' }).action.id, 'recheck_connection');
assert.strictEqual(classify({ name:'AbortError', message:'已取消生成' }).kind, 'cancelled');
assert.strictEqual(classify({ status:400, detail:'invalid request' }).kind, 'parameters');

console.log('SD error tests passed: classification and recovery actions');
