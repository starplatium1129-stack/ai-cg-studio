'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var pathToFileURL = require('url').pathToFileURL;
var root = path.resolve(__dirname, '..', '..');

function assert(condition, message) {
  if (!condition) throw new Error('[chat] ' + message);
}

function listen(server) {
  return new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', function () {
      resolve('http://127.0.0.1:' + server.address().port);
    });
  });
}

function close(server) {
  return new Promise(function (resolve) {
    if (!server || !server.listening) return resolve();
    server.close(function () { resolve(); });
  });
}

function createMockAiServer() {
  var state = {
    activeChat:0,
    maxActiveChat:0,
    activeVoice:0,
    maxActiveVoice:0,
    voicePayloads:[],
    unloaded:[],
    compatiblePayloads:[],
    compatibleAuth:''
  };
  var server = http.createServer(function (req, res) {
    var chunks = [];
    req.on('data', function (chunk) { chunks.push(chunk); });
    req.on('end', function () {
      var body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (error) {}
      if (req.url === '/api/tags') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ models:[
          { name:'model-a', size:1, details:{ parameter_size:'7B', quantization_level:'Q4' } },
          { name:'model-b', size:2, details:{ parameter_size:'9B', quantization_level:'Q5' } }
        ] }));
        return;
      }
      if (req.url === '/api/generate') {
        state.unloaded.push(body.model);
        res.end('{}');
        return;
      }
      if (req.url === '/api/chat') {
        state.activeChat += 1;
        state.maxActiveChat = Math.max(state.maxActiveChat, state.activeChat);
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.write('{"message":{"content":"你');
        setTimeout(function () {
          res.write('好。"}}\n{"done":true}\n');
          res.end();
          state.activeChat -= 1;
        }, 35);
        return;
      }
      if (req.url === '/v1/models') {
        state.compatibleAuth = String(req.headers.authorization || '');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ data:[
          { id:'compatible-model' },
          { id:'compatible-model-fast' }
        ] }));
        return;
      }
      if (req.url === '/v1/chat/completions') {
        state.compatiblePayloads.push(body);
        state.compatibleAuth = String(req.headers.authorization || '');
        res.setHeader('Content-Type', 'text/event-stream');
        var utf8Event = Buffer.from('data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n', 'utf8');
        var chineseStart = utf8Event.indexOf(Buffer.from('你', 'utf8'));
        res.write(utf8Event.subarray(0, chineseStart + 1));
        setTimeout(function () {
          res.end(utf8Event.subarray(chineseStart + 1));
        }, 10);
        return;
      }
      if (req.url === '/docs') {
        res.end('ok');
        return;
      }
      if (req.url.startsWith('/set_sovits_weights') || req.url.startsWith('/set_gpt_weights')) {
        res.end('ok');
        return;
      }
      if (req.url === '/tts') {
        state.voicePayloads.push(body);
        state.activeVoice += 1;
        state.maxActiveVoice = Math.max(state.maxActiveVoice, state.activeVoice);
        res.setHeader('Content-Type', 'audio/wav');
        res.write(Buffer.from('RIFF'));
        setTimeout(function () {
          res.end(Buffer.from('voice'));
          state.activeVoice -= 1;
        }, 35);
        return;
      }
      res.statusCode = 404;
      res.end();
    });
  });
  return { server:server, state:state };
}

async function consumeVoice(service, input) {
  return service.stream(input, {
    onResponse:async function (result) {
      for await (var chunk of result.response) void chunk;
    }
  });
}

async function run() {
  // 角色房间已迁为 Vue：ChatView.vue + useVoice / useLive2D composable
  var html = fs.readFileSync(path.join(root, 'src', 'views', 'ChatView.vue'), 'utf8');
  var apiSettingsComponent = fs.readFileSync(path.join(root, 'src', 'components', 'ChatApiSettings.vue'), 'utf8');
  var characterStageComponent = fs.readFileSync(path.join(root, 'src', 'components', 'ChatCharacterStage.vue'), 'utf8');
  var voiceModule = fs.readFileSync(path.join(root, 'src', 'composables', 'useVoice.ts'), 'utf8');
  var live2dModule = fs.readFileSync(path.join(root, 'src', 'composables', 'useLive2D.ts'), 'utf8');
  var chatCss = fs.readFileSync(path.join(root, 'src', 'assets', 'css', 'chat.css'), 'utf8');
  var mainTs = fs.readFileSync(path.join(root, 'src', 'main.ts'), 'utf8');
  var streamUtils = fs.readFileSync(path.join(root, 'src', 'utils', 'stream.ts'), 'utf8');
  var chatStorage = fs.readFileSync(path.join(root, 'src', 'composables', 'useChatStorage.ts'), 'utf8');
  var securitySource = fs.readFileSync(path.join(root, 'server', 'security.js'), 'utf8');
  var voiceRoute = fs.readFileSync(path.join(root, 'routes', 'voice.js'), 'utf8');
  var serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

  assert(html.includes('chat-page'), 'chat view must render the character room shell');
  assert(characterStageComponent.includes("'nene'") && characterStageComponent.includes("'natsume'") && html.includes('switchCharacter'), 'both characters must be selectable');
  // chat.css 是路由专属样式：由 ChatView 自己 import，随 /chat 的懒加载块下发，
  // 不再进全局包（它曾占 139KB 全局 CSS 的 13%，而只有一个路由用得到）。
  assert(html.includes('assets/css/chat.css'), 'chat styles must be imported by the chat view');
  assert(!mainTs.includes('assets/css/chat.css'), 'chat styles must not ship in the global entry bundle');
  assert(html.includes('useVoice') && html.includes('ChatCharacterStage'), 'chat view must compose voice and the character stage');
  assert(characterStageComponent.includes('useLive2D'), 'the character stage must own the Live2D lifecycle');
  assert(characterStageComponent.includes("'live2d-ready': live2d.ready"), 'Vue must own the Live2D visibility class so voice state renders cannot restore the static portrait');
  assert(html.includes('voice-console') && html.includes('replay-btn'), 'live voice and replay must share one visual control');
  assert(!html.includes('portrait-blink') && !html.includes('scheduleBlink'), 'static portraits must not use a duplicate-image blink effect');
  assert(!chatCss.includes('portrait-talk'), 'static portraits must not scale or bounce while voice is playing');
  assert(html.includes("fetch('/api/chat'") && html.includes('parseNdjsonResponse'), 'chat view must stream from the gateway');
  assert(html.includes('ChatApiSettings'), 'chat API settings must have independent component ownership');
  assert(
    characterStageComponent.includes('defineExpose({ setSpeaking, setExpression, setMouth })')
      && characterStageComponent.includes("emit('live2dEnabled'"),
    'the character stage must expose only voice animation controls and persist the Live2D preference'
  );
  assert(
    apiSettingsComponent.includes("fetch('/api/chat-provider/test'")
      && apiSettingsComponent.includes('discoveredModels'),
    'chat API settings must test credentials and discover models'
  );
  assert(html.includes('AbortController') && html.includes('stop-btn'), 'chat requests must be cancellable');
  assert(!/\bany\b/.test(html), 'ChatView model, stream, error, and history boundaries must stay explicitly typed');
  assert(!/\bany\b/.test(streamUtils), 'chat stream events and abort errors must stay explicitly typed');
  assert(!/\bany\b/.test(chatStorage), 'persisted chat messages must stay explicitly typed');
  assert(html.includes('streamingMid'), 'only the active assistant message may keep the streaming cursor');
  assert(voiceModule.includes('SentenceBuffer') && /\bawait r\.arrayBuffer\(\)/.test(voiceModule), 'voice must synthesize complete sentence WAV files');
  assert(
    voiceModule.includes("consistency: 'locked'") && voiceModule.includes('referenceEmotion: meta.referenceEmotion'),
    'one reply must lock a single identity reference across all sentences'
  );
  assert(voiceModule.includes('AbortController') && voiceModule.includes('messageAudio'), 'voice sessions must support cancellation and replay');
  assert(!/\bany\b/.test(voiceModule), 'voice queue, turn, API responses, and Web Audio boundaries must stay explicitly typed');
  assert(
    voiceModule.includes('readVoiceAvailability') && voiceModule.includes('readTranslation'),
    'voice API responses must be narrowed at the JSON boundary'
  );
  assert(voiceModule.includes("fetch('/api/voice/prepare'") && voiceRoute.includes("router.post('/api/voice/prepare'"), 'voice models and translation must prewarm before the first line');
  assert(voiceModule.includes('getByteTimeDomainData') && voiceModule.includes('onMouth'), 'lip sync must use real audio amplitude');
  assert(live2dModule.includes('ResizeObserver') && live2dModule.includes('webglcontextlost'), 'Live2D must recover layout and WebGL failures');
  assert(live2dModule.includes('setExpression') && live2dModule.includes('setSpeaking') && live2dModule.includes('applyMouth') && live2dModule.includes('ParamMouthOpenY'), 'Live2D must write real speech amplitudes into the mouth parameter');
  assert(live2dModule.includes('model.focus') && live2dModule.includes('model.hitTest'), 'Live2D must support pointer focus and model hit testing');
  assert(!/\bany\b/.test(live2dModule), 'Live2D catalog, runtime, controller, and model boundaries must stay explicitly typed');
  assert(
    live2dModule.includes('readLive2DCatalog') && live2dModule.includes('readLibrary'),
    'Live2D status JSON and dynamic runtime exports must be narrowed before use'
  );
  assert(
    characterStageComponent.includes("live2d.interact('greet')")
      && characterStageComponent.includes("live2d.interact('head')")
      && live2dModule.includes("function interact(kind: 'greet' | 'head'"),
    'Live2D must expose keyboard-accessible greeting and head-pat interactions'
  );
  assert(
    live2dModule.includes('options.autoLoad === true')
      && live2dModule.includes("setState('idle', '启用 Live2D'"),
    'Live2D must stay unloaded until the user explicitly enables it'
  );
  assert(live2dModule.includes("'degraded'") && live2dModule.includes('已经显示的模型失效'), 'runtime expression failures must not replace a loaded Live2D model with the static portrait');
  // Live2D 运行库必须真正被加载（重构后曾漏掉，导致"运行库加载失败"）
  assert(live2dModule.includes("import('wl-live2d')"), 'Live2D runtime must be imported by the composable');
  // PixiJS 需要 unsafe-eval：CSP 必须为 /chat 放行，否则 Live2D 初始化失败
  assert(
    securitySource.includes("path === '/chat'") && securitySource.includes('unsafe-eval'),
    'CSP must allow unsafe-eval on the chat route for the Live2D renderer'
  );
  // 情绪关键词曾因编码损坏全部失效，导致语音永远 neutral
  assert(!/\uFFFD/.test(streamUtils), 'emotion keywords must not contain replacement characters');
  ['shy', 'happy', 'sad', 'serious', 'gentle'].forEach(function (emotion) {
    assert(streamUtils.includes("'" + emotion + "'"), 'inferEmotion must classify ' + emotion);
  });
  assert(serverSource.includes('createGateway') && serverSource.includes("require('./routes/chat')"), 'gateway must use modular route composition');

  var utils = require('../../src/utils/stream.ts');
  var chatStatus = require('../../src/utils/chatStatus.ts');
  var parsedStatus = chatStatus.parseChatStatus({
    online:true,
    model:'model-a',
    models:[{ name:'model-a', parameters:'7B' }, null, { name:4 }]
  });
  assert(parsedStatus.online && parsedStatus.models.length === 1,
    'chat status parsing must discard malformed model records');
  assert(parsedStatus.models[0].parameters === '7B',
    'chat status parsing must preserve display metadata');
  assert(utils.streamErrorMessage(
    Object.assign(new Error('upstream failed'), { detail:'timeout' }),
    'fallback'
  ) === 'upstream failed：timeout', 'stream errors must preserve safe detail text');
  var sentences = new utils.SentenceBuffer({ minimumLength:6 });
  assert(sentences.push('嗯。').length === 0, 'short sentence should wait for the next boundary');
  assert(sentences.push('今天过得怎么样？')[0] === '嗯。今天过得怎么样？', 'short sentence should merge without being lost');
  assert(sentences.push('最后一句', true)[0] === '最后一句', 'flush must emit the remaining sentence');

  var wav = new ArrayBuffer(48);
  var wavView = new DataView(wav);
  wavView.setUint32(0, 0x52494646, false);
  wavView.setUint32(8, 0x57415645, false);
  wavView.setUint32(12, 0x666d7420, false);
  wavView.setUint32(16, 16, true);
  wavView.setUint32(36, 0x64617461, false);
  utils.fixWavHeader(wav);
  assert(wavView.getUint32(4, true) === 40 && wavView.getUint32(40, true) === 4, 'WAV sizes must be repaired');

  var chatRoute = require('../../routes/chat');
  assert(chatRoute.validateChatBody({
    character:'nene',
    messages:[{ role:'user', content:'你好' }]
  }).value, 'valid chat body must pass');
  assert(chatRoute.validateChatBody({ character:'unknown', messages:[] }).error, 'invalid character must be rejected');
  assert(chatRoute.validateChatBody({
    character:'nene',
    provider:'api',
    api:{ baseUrl:'http://example.com/v1', model:'model-a', apiKey:'secret' },
    messages:[{ role:'user', content:'hello' }]
  }).error, 'remote compatible APIs must require HTTPS');
  var compatibleValidation = chatRoute.validateChatBody({
    character:'nene',
    provider:'api',
    api:{ baseUrl:'https://api.example.com/v1', model:'model-a', apiKey:'secret' },
    messages:[{ role:'user', content:'hello' }]
  });
  assert(
    compatibleValidation.value.api.pathname === '/v1/chat/completions',
    'compatible API base paths must preserve the /v1 prefix'
  );
  var deepseekValidation = chatRoute.validateCompatibleApi({
    baseUrl:'https://api.deepseek.com',
    model:'deepseek-v4-flash',
    apiKey:'secret'
  });
  assert(deepseekValidation.value.vendor === 'deepseek', 'official DeepSeek endpoints must receive the role-chat optimization');
  var opencodeValidation = chatRoute.validateCompatibleApi({
    baseUrl:'https://opencode.ai/zen/v1',
    model:'deepseek-v4-flash-free',
    apiKey:'secret'
  });
  assert(
    opencodeValidation.value.vendor === 'opencode'
      && opencodeValidation.value.pathname === '/zen/v1/chat/completions',
    'OpenCode Zen must use its OpenAI-compatible chat endpoint'
  );
  assert(chatRoute.chatCharacterPrompt('nene').includes('不要每句话都结巴'), 'Nene prompt must constrain repetitive roleplay mannerisms');
  assert(chatRoute.chatCharacterPrompt('natsume').includes('关心藏进提醒'), 'Natsume prompt must preserve restrained care');
  assert(chatRoute.chatCharacterPrompt('nene').includes('不要假装知道用户没说过的'), 'character prompts must not invent shared facts');
  assert(chatRoute.chatCharacterPrompt('nene').includes('先辨认用户这句话里的情绪'), 'Nene prompt must explicitly respond to the user emotion');
  assert(chatRoute.chatCharacterPrompt('natsume').includes('先辨认用户这句话里的情绪'), 'Natsume prompt must explicitly respond to the user emotion');
  assert(chatRoute.chatCharacterPrompt('natsume').includes('关心不等于管束或占有'), 'character prompts must keep care distinct from control');
  assert(chatRoute.chatCharacterPrompt('nene').includes('这是私人本地角色扮演'), 'character prompts must identify the private local context');
  assert(chatRoute.chatCharacterPrompt('natsume').includes('不输出政策声明或机械拒绝'), 'character prompts must stay in character for sensitive adult topics');
  assert(!chatRoute.chatCharacterPrompt('nene').includes('未成年人性内容'), 'character prompts must not contain generic content-review boilerplate');

  var live2dService = require('../../services/live2d-service').createLive2dService({
    rootDir:path.join(root, 'assets', 'live2d'),
    characters:['nene', 'natsume']
  });
  var liveStatus = live2dService.status();
  assert(liveStatus.models.nene.available, 'Nene Live2D model and all references must exist');
  var neneManifest = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'live2d', 'nene', 'nene.model3.json'), 'utf8'));
  assert(neneManifest.HitAreas.some(function (area) { return area.Name === 'Head'; }), 'Nene model must expose the source-model head hit area');
  assert(neneManifest.FileReferences.Motions.TapHead.length === 1, 'Nene model must expose the safe head-tap motion');
  assert(!neneManifest.FileReferences.Motions.TapHead[0].Sound, 'head-tap interaction must not conflict with AI voice playback');
  assert(!liveStatus.models.natsume.available, 'missing Natsume model must use a declared fallback');

  var mock = createMockAiServer();
  var mockBase = await listen(mock.server);
  try {
    var ollama = require('../../services/ollama-service').createOllamaService({
      host:mockBase,
      model:'model-a',
      keepAlive:'1m'
    });
    var outputs = [];
    function runChat(model) {
      return ollama.streamChat({
        model:model,
        messages:[{ role:'user', content:'test' }]
      }, {
        onToken:function (content) { outputs.push(content); }
      });
    }
    await Promise.all([runChat('model-a'), runChat('model-b')]);
    assert(mock.state.maxActiveChat === 1, 'Ollama streams must be serialized');
    assert(mock.state.unloaded.includes('model-a'), 'switching models must unload the previous model');
    assert(outputs.join('') === '你好。你好。', 'split NDJSON chunks must be reconstructed');

    var compatibleOutput = [];
    var localApi = chatRoute.validateCompatibleApi({
      baseUrl:mockBase + '/v1',
      model:'compatible-model',
      apiKey:'local-secret'
    });
    assert(localApi.value, 'loopback compatible APIs may use HTTP');
    var compatibleStatus = await chatRoute.inspectCompatibleApi(localApi.value);
    assert(
      compatibleStatus.online && compatibleStatus.models.includes('compatible-model-fast'),
      'compatible API diagnostics must authenticate and discover models'
    );
    await chatRoute.streamCompatibleApi({
      api:localApi.value,
      messages:[{ role:'system', content:'persona' }, { role:'user', content:'hello' }]
    }, {
      onToken:function (content) { compatibleOutput.push(content); }
    });
    assert(compatibleOutput.join('') === '你好', 'compatible API SSE must preserve Chinese characters split across UTF-8 chunks');
    assert(!compatibleOutput.join('').includes('\uFFFD'), 'compatible API output must not contain replacement characters');
    assert(mock.state.compatibleAuth === 'Bearer local-secret', 'compatible API key must be sent as a bearer token');
    assert(mock.state.compatiblePayloads[0].messages[0].content === 'persona', 'compatible APIs must receive the character system prompt');

    var abortController = new AbortController();
    var resolveStarted;
    var started = new Promise(function (resolve) { resolveStarted = resolve; });
    var cancelled = ollama.streamChat({
      model:'model-b',
      messages:[{ role:'user', content:'cancel' }],
      signal:abortController.signal
    }, {
      onStart:function () { resolveStarted(); }
    }).then(function () {
      return null;
    }, function (error) {
      return error;
    });
    await started;
    abortController.abort();
    var cancelError = await cancelled;
    assert(cancelError && cancelError.name === 'AbortError', 'aborting a chat must cancel the upstream stream');
    assert(ollama.queueStatus().active === 0, 'cancelled chat must release the Ollama queue');

    var tts = require('../../services/tts-service').createTtsService({
      host:mockBase,
      profiles:{
        nene:{
          refAudioPath:'nene.wav', promptText:'ref', sovitsWeightsPath:'nene.pth', gptWeightsPath:'nene.ckpt',
          references:{ gentle:{ refAudioPath:'nene-gentle.wav', promptText:'gentle ref' }, shy:{ refAudioPath:'nene-shy.wav', promptText:'shy ref' } }
        },
        natsume:{ refAudioPath:'natsume.wav', promptText:'ref', sovitsWeightsPath:'natsume.pth', gptWeightsPath:'natsume.ckpt' }
      }
    });
    await tts.prepare('nene');
    assert((await tts.status()).activeVoice === 'nene', 'voice preparation must activate the requested character before synthesis');
    await Promise.all([
      consumeVoice(tts, { voice:'nene', text:'a', language:'ja', emotion:'neutral', speed:1 }),
      consumeVoice(tts, { voice:'natsume', text:'b', language:'ja', emotion:'neutral', speed:1 })
    ]);
    assert(mock.state.maxActiveVoice === 1, 'GPT-SoVITS streams must remain serialized until audio ends');
    await consumeVoice(tts, { voice:'nene', text:'綾地寧々です。', language:'ja', emotion:'shy', referenceEmotion:'gentle', consistency:'locked', speed:1 });
    var lockedPayload = mock.state.voicePayloads[mock.state.voicePayloads.length - 1];
    assert(lockedPayload.ref_audio_path === 'nene-gentle.wav', 'locked voice must keep the turn reference even when the sentence emotion changes');
    assert(lockedPayload.text.includes('あやち ねね') && lockedPayload.text_split_method === 'cut0', 'Japanese speech must normalize character names and preserve the complete sentence');
    assert(lockedPayload.seed === 1234 && lockedPayload.top_k === 15 && lockedPayload.streaming_mode === false, 'short sentence synthesis must use deterministic identity settings instead of ineffective audio streaming');
    var ttsModule = require('../../services/tts-service');
    assert(ttsModule.normalizeSpeechText('  四季夏目\nありがとう。 ', 'ja') === 'しき なつめ。ありがとう。', 'speech normalization must keep every sentence and stabilize character-name pronunciation');
  } finally {
    await close(mock.server);
  }

  var gatewayModule = require('../../server');
  var gateway = gatewayModule.createGateway({ env:{ DISABLE_TUNNEL:'1' } });
  var gatewayServer = http.createServer(gateway.app);
  var gatewayBase = await listen(gatewayServer);
  try {
    var healthResponse = await fetch(gatewayBase + '/api/health');
    var health = await healthResponse.json();
    assert(health.ok && health.capabilities.chat && health.capabilities.tts, 'gateway health must expose conversation capabilities');

    // SPA 路由由 index.html 承载；同时确认 /chat 的 CSP 放行了 Live2D 所需的 unsafe-eval
    var chatResponse = await fetch(gatewayBase + '/chat');
    assert(chatResponse.ok, 'chat route must be served by the SPA fallback');
    var chatCsp = chatResponse.headers.get('content-security-policy') || '';
    assert(chatCsp.includes("'unsafe-eval'"), 'chat route CSP must allow the Live2D renderer');
    var homeResponse = await fetch(gatewayBase + '/');
    assert(homeResponse.ok, 'home route must be served');
    var homeCsp = homeResponse.headers.get('content-security-policy') || '';
    assert(!homeCsp.includes("'unsafe-eval'"), 'unsafe-eval must stay scoped to the chat route');

    // 设计系统只剩 src/assets/css 一份（css/ 下的分叉副本已删除）
    var cssResponse = await fetch(gatewayBase + '/src/assets/css/design-system.css', {
      headers:{ 'Accept-Encoding':'gzip' }
    });
    assert((cssResponse.headers.get('cache-control') || '').includes('max-age=86400'), 'versioned CSS and JS should use a one-day browser cache');
    assert(cssResponse.headers.get('content-encoding') === 'gzip', 'text assets larger than 1 KB should be compressed');

    var dataResponse = await fetch(gatewayBase + '/data/scenes.json');
    assert((dataResponse.headers.get('cache-control') || '').includes('no-cache'), 'editable project data must revalidate on every visit');

    var assetResponse = await fetch(gatewayBase + '/assets/logo.svg');
    assert((assetResponse.headers.get('cache-control') || '').includes('max-age=604800'), 'stable image assets should use a one-week browser cache');

    var badChat = await fetch(gatewayBase + '/api/chat', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ character:'bad', messages:[] })
    });
    assert(badChat.status === 400, 'chat route must reject invalid input without contacting Ollama');
  } finally {
    gateway.close();
    await close(gatewayServer);
  }

  console.log('Chat tests passed: modular gateway, static delivery, serialized AI queues, cancellable streaming voice, Live2D recovery and fallback');
}

run().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
