'use strict';

var SerialQueue = require('./serial-queue');
var httpClient = require('./http-client');

function modelName(item) {
  return String(item && (item.name || item.model) || '');
}

function publicModel(item) {
  return {
    name:modelName(item),
    size:Number(item && item.size) || 0,
    parameters:item && item.details && item.details.parameter_size || '',
    quantization:item && item.details && item.details.quantization_level || ''
  };
}

function createOllamaService(options) {
  var host = options.host;
  var configuredModel = options.model || '';
  var keepAlive = options.keepAlive || '10m';
  var numPredict = Number(options.numPredict) || 300;
  var numContext = Number(options.numContext) || 4096;
  var queue = new SerialQueue('ollama-chat');
  var activeModel = '';

  async function listModels(signal) {
    var data = await httpClient.readJson(host, '/api/tags', {
      timeoutMs:3000,
      timeoutMessage:'Ollama status request timed out',
      signal:signal
    });
    return (Array.isArray(data.models) ? data.models : [])
      .filter(function (item) {
        var capabilities = Array.isArray(item.capabilities) ? item.capabilities : [];
        return modelName(item) && (!capabilities.length || capabilities.includes('completion'));
      });
  }

  function preferredModel(models) {
    if (configuredModel && models.some(function (item) { return modelName(item) === configuredModel; })) {
      return configuredModel;
    }
    return models.length ? modelName(models[0]) : '';
  }

  async function status(signal) {
    try {
      var models = await listModels(signal);
      return {
        online:true,
        model:preferredModel(models),
        models:models.map(publicModel),
        queue:queue.status(),
        activeModel:activeModel
      };
    } catch (error) {
      if (httpClient.isAbortError(error)) throw error;
      return {
        online:false,
        model:'',
        models:[],
        queue:queue.status(),
        activeModel:activeModel,
        error:error.message
      };
    }
  }

  async function unload(model, signal) {
    if (!model) return;
    try {
      await httpClient.expectSuccess(host, '/api/generate', {
        method:'POST',
        json:{ model:model, keep_alive:0, stream:false },
        timeoutMs:8000,
        signal:signal
      });
    } catch (error) {
      if (httpClient.isAbortError(error)) throw error;
      // Unloading is a VRAM optimization. A failure must not make chat unusable.
      console.warn('  ⚠️ Ollama 模型卸载失败 (' + model + '): ' + error.message);
    }
  }

  async function emitItem(item, callbacks) {
    var content = item && item.message && item.message.content || '';
    if (content && callbacks.onToken) await callbacks.onToken(content);
    if (item && item.done && callbacks.onDone) await callbacks.onDone();
  }

  async function consumeNdjson(response, callbacks) {
    var decoder = new TextDecoder();
    var buffer = '';
    var doneEmitted = false;
    for await (var chunk of response) {
      buffer += decoder.decode(chunk, { stream:true });
      var lines = buffer.split('\n');
      buffer = lines.pop();
      for (var i = 0; i < lines.length; i += 1) {
        if (!lines[i].trim()) continue;
        var item;
        try {
          item = JSON.parse(lines[i]);
        } catch (error) {
          throw new httpClient.UpstreamError('Ollama returned an invalid stream event', {
            code:'INVALID_NDJSON',
            detail:lines[i].slice(0, 300)
          });
        }
        if (item.done) doneEmitted = true;
        await emitItem(item, callbacks);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      var lastItem;
      try {
        lastItem = JSON.parse(buffer);
      } catch (error) {
        throw new httpClient.UpstreamError('Ollama returned an incomplete stream event', {
          code:'INVALID_NDJSON',
          detail:buffer.slice(0, 300)
        });
      }
      if (lastItem.done) doneEmitted = true;
      await emitItem(lastItem, callbacks);
    }
    if (!doneEmitted && callbacks.onDone) await callbacks.onDone();
  }

  function streamChat(input, callbacks) {
    callbacks = callbacks || {};
    return queue.run(async function (queueMeta) {
      if (input.signal && input.signal.aborted) throw httpClient.abortError();
      var models = await listModels(input.signal);
      var allowed = models.map(modelName);
      var selected = allowed.includes(input.model) ? input.model : preferredModel(models);
      if (!selected) throw new Error('Ollama 中没有可用的对话模型');

      if (activeModel && activeModel !== selected) {
        var previous = activeModel;
        await unload(previous, input.signal);
        console.log('  🔄 已卸载旧模型: ' + previous + ' → 加载: ' + selected);
      }
      activeModel = selected;

      var upstream = await httpClient.request(host, '/api/chat', {
        method:'POST',
        timeoutMs:3 * 60 * 1000,
        timeoutMessage:'Ollama 对话超时',
        signal:input.signal,
        json:{
          model:selected,
          messages:input.messages,
          stream:true,
          think:false,
          keep_alive:keepAlive,
          options:{
            temperature:0.72,
            top_p:0.88,
            repeat_penalty:1.1,
            num_predict:numPredict,
            num_ctx:numContext
          }
        }
      });

      if (upstream.response.statusCode < 200 || upstream.response.statusCode >= 300) {
        var body = await httpClient.readBody(upstream.response, 1024 * 1024);
        throw new httpClient.UpstreamError('Ollama 对话失败', {
          code:'OLLAMA_CHAT_FAILED',
          status:upstream.response.statusCode,
          detail:body.toString('utf8').slice(0, 500)
        });
      }

      if (callbacks.onStart) {
        await callbacks.onStart({ model:selected, queueWaitMs:queueMeta.waitMs });
      }
      await consumeNdjson(upstream.response, callbacks);
      return { model:selected, queueWaitMs:queueMeta.waitMs };
    });
  }

  return {
    listModels:listModels,
    preferredModel:preferredModel,
    status:status,
    streamChat:streamChat,
    queueStatus:function () { return queue.status(); }
  };
}

module.exports = {
  createOllamaService:createOllamaService,
  modelName:modelName,
  publicModel:publicModel
};
