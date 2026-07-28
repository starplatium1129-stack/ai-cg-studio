const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sdError = require('../../src/utils/sdError.ts');

const source = fs.readFileSync(path.resolve(__dirname, '../../src/utils/sdError.ts'), 'utf8');
assert(!/\bany\b/.test(source), 'SD error parsing must keep unknown inputs narrowed');

function classify(error){ return sdError.classifySDError(error); }

assert.strictEqual(classify({ message:'CUDA out of memory', status:500 }).kind, 'oom');
assert.strictEqual(classify({ message:'could not find lora ayachi_nene', status:500 }).action.id, 'retry_without_lora');
assert.strictEqual(classify({ detail:'checkpoint not found', status:500 }).action.id, 'retry_current_model');
assert.strictEqual(classify({ message:'sampler not found', status:400 }).kind, 'sampler');
assert.strictEqual(classify({ name:'TimeoutError', message:'SD WebUI 请求超时' }).action.id, 'retry_light');
assert.strictEqual(classify({ status:404, message:'HTTP 404' }).kind, 'gateway');
assert.strictEqual(classify({ name:'NetworkError', message:'无法连接 SD WebUI' }).action.id, 'recheck_connection');
assert.strictEqual(classify({ name:'AbortError', message:'已取消生成' }).kind, 'cancelled');
assert.strictEqual(classify({ status:400, detail:'invalid request' }).kind, 'parameters');
assert.strictEqual(classify('CUDA out of memory').kind, 'oom', 'primitive error messages must be classified');
assert.strictEqual(classify(null).kind, 'unknown', 'empty external errors must stay safe');

console.log('SD error tests passed against the production TypeScript module');
