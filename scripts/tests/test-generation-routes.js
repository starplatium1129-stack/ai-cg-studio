'use strict';

var assert = require('assert/strict');
var gatewayStack = require('./gateway-test-stack');
var generation = require('../../routes/generation');

async function json(response) { return response.json(); }
async function post(base, body, token) {
  return fetch(base + '/api/generation/jobs', { method:'POST', headers:{ 'content-type':'application/json', ...(token ? { 'x-token':token } : {}) }, body:JSON.stringify(body) });
}

async function run() {
  var valid = generation.validateInput({ prompt:'1girl, solo', negative:'bad', loras:[{ id:'L_NENE_V18_WD14', strength:0.85 }], width:832, height:1216, steps:28, cfg:5.5, seed:12, sampler:'DPM++ 2M', scheduler:'Karras' });
  var requestBody = { prompt:'1girl, solo, <lora:ayachi_nene_v18_wd14:0.85>', negative:'bad', loras:[{ id:'L_NENE_V18_WD14', strength:0.85 }], width:832, height:1216, steps:28, cfg:5.5, seed:12, sampler:'DPM++ 2M', scheduler:'Karras' };
  var graph = generation.buildWorkflow(valid);
  assert.equal(graph['1'].class_type, 'CheckpointLoaderSimple');
  assert.equal(graph['10'].class_type, 'SaveImage');
  assert.equal(graph['2'].inputs.lora_name, 'ayachi_nene_v18_wd14.safetensors');
  var tagged = generation.validateInput({ prompt:'1girl, <lora:ayachi_nene_v18_wd14:0.85>', negative:'bad', loras:[{ id:'L_NENE_V18_WD14', strength:0.85 }], width:832, height:1216, steps:28, cfg:5.5, seed:12, sampler:'DPM++ 2M' });
  var taggedGraph = generation.buildWorkflow(tagged);
  assert.equal(taggedGraph['4'].inputs.text.includes('<lora:'), false, 'Comfy CLIP text must not contain LoRA syntax');
  assert.throws(function () { generation.validateInput({ prompt:'x', workflow:{}, width:832, height:1216 }); }, /不支持的参数/);
  assert.throws(function () { generation.validateInput({ prompt:'x', loras:[{ id:'bad', strength:0.8 }], width:832, height:1216 }); }, /未知 WAI LoRA/);
  assert.throws(function () { generation.validateInput({ prompt:'x', modelId:'other', width:832, height:1216 }); }, /未知 WAI checkpoint/);

  var stack = await gatewayStack.start();
  try {
    var base = stack.baseUrl;
    var webuiResponse = await post(base, requestBody);
    assert.equal(webuiResponse.status, 202);
    var webuiJob = (await json(webuiResponse)).job;
    assert.equal(webuiJob.provider, 'webui');
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
    var webuiCalls = await json(await fetch(stack.upstreams.sd.url + '/__mock/state'));
    var webuiPayload = webuiCalls.calls.find(function (call) { return call.path === '/sdapi/v1/txt2img'; }).body;
    assert.match(webuiPayload.prompt, /<lora:ayachi_nene_v18_wd14:0.85>/);
    var webuiSamplerFallback = await post(base, Object.assign({}, requestBody, { sampler:'DPM++ SDE' }));
    assert.equal((await json(webuiSamplerFallback)).job.provider, 'webui');
    await fetch(stack.upstreams.sd.url + '/__mock/fault', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ offline:true }) });

    var comfyResponse = await post(base, requestBody);
    assert.equal(comfyResponse.status, 202);
    var comfyJob = (await json(comfyResponse)).job;
    assert.equal(comfyJob.provider, 'comfy');
    var comfyCalls = await json(await fetch(stack.upstreams.comfy.url + '/__mock/state'));
    var comfyGraph = comfyCalls.calls.find(function (call) { return call.path === '/prompt'; }).body.prompt;
    assert.equal(Object.values(comfyGraph).filter(function (node) { return node && node.class_type === 'CLIPTextEncode' && String(node.inputs.text).includes('<lora:'); }).length, 0);
    assert.equal((await fetch(base + '/prompt')).status, 404);
    assert.equal((await fetch(base + '/history/x')).status, 404);
    assert.equal((await fetch(base + '/view')).status, 404);
    assert.ok([401, 404].includes((await fetch(base + '/api/generation/jobs/' + comfyJob.id, { headers:{ 'x-token':'wrong-token', 'x-forwarded-for':'203.0.113.10' } })).status));

    var detailerOffline = await post(base, Object.assign({}, requestBody, { faceDetailer:true }));
    assert.equal(detailerOffline.status, 503);
    assert.equal((await json(detailerOffline)).code, 'WEBUI_REQUIRED_OFFLINE');
    var hiresOffline = await post(base, Object.assign({}, requestBody, { hiresFix:true }));
    assert.equal(hiresOffline.status, 503);
    assert.equal((await json(hiresOffline)).code, 'WEBUI_REQUIRED_OFFLINE');

    var capabilityFallback = await post(base, Object.assign({}, requestBody, { sampler:'DPM++ SDE' }));
    assert.equal(capabilityFallback.status, 503);
    assert.equal((await json(capabilityFallback)).code, 'COMFY_CAPABILITY_UNAVAILABLE');

    await fetch(stack.upstreams.comfy.url + '/__mock/fault', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ executionError:'after prompt id' }) });
    var failureResponse = await post(base, requestBody);
    assert.equal(failureResponse.status, 202);
    var failureJob = (await json(failureResponse)).job;
    await new Promise(function (resolve) { setTimeout(resolve, 150); });
    var failed = await json(await fetch(base + '/api/generation/jobs/' + failureJob.id));
    assert.equal(failed.job.provider, 'comfy');
    assert.equal(failed.job.status, 'failed');
    var calls = await json(await fetch(stack.upstreams.comfy.url + '/__mock/state'));
    assert.equal(calls.calls.filter(function (call) { return call.path === '/prompt'; }).length, 2);
    var finalSdCalls = await json(await fetch(stack.upstreams.sd.url + '/__mock/state'));
    assert.equal(finalSdCalls.calls.filter(function (call) { return call.path === '/sdapi/v1/txt2img'; }).length, 2, 'Comfy post-submit failure must not retry WebUI');
  } finally {
    await stack.close();
  }
}

if (require.main === module) run().then(function () { console.log('test-generation-routes: ok'); }).catch(function (error) { console.error(error); process.exitCode=1; });
module.exports = { run:run };
