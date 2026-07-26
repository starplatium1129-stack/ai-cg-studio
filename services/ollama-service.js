'use strict';
const SerialQueue = require("./serial-queue");
const httpClient = require("./http-client");
function modelName(item) {
    return String((item && (item.name || item.model)) || '');
}
function publicModel(item) {
    return {
        name: modelName(item),
        size: Number(item && item.size) || 0,
        parameters: (item && item.details && item.details.parameter_size) || '',
        quantization: (item && item.details && item.details.quantization_level) || ''
    };
}
function errorMessage(error) {
    if (error instanceof Error)
        return error.message;
    return String(error);
}
function createOllamaService(options) {
    const host = options.host;
    const configuredModel = options.model || '';
    const keepAlive = options.keepAlive || '10m';
    const numPredict = Number(options.numPredict) || 300;
    const numContext = Number(options.numContext) || 4096;
    const queue = new SerialQueue('ollama-chat');
    let activeModel = '';
    async function listModels(signal) {
        const data = (await httpClient.readJson(host, '/api/tags', {
            timeoutMs: 3000,
            timeoutMessage: 'Ollama status request timed out',
            signal: signal
        }));
        return (Array.isArray(data.models) ? data.models : []).filter(function (item) {
            const capabilities = Array.isArray(item.capabilities) ? item.capabilities : [];
            return modelName(item) && (!capabilities.length || capabilities.includes('completion'));
        });
    }
    function preferredModel(models) {
        if (configuredModel &&
            models.some(function (item) {
                return modelName(item) === configuredModel;
            })) {
            return configuredModel;
        }
        return models.length ? modelName(models[0]) : '';
    }
    async function status(signal) {
        try {
            const models = await listModels(signal);
            return {
                online: true,
                model: preferredModel(models),
                models: models.map(publicModel),
                queue: queue.status(),
                activeModel: activeModel
            };
        }
        catch (error) {
            if (httpClient.isAbortError(error))
                throw error;
            return {
                online: false,
                model: '',
                models: [],
                queue: queue.status(),
                activeModel: activeModel,
                error: errorMessage(error)
            };
        }
    }
    async function unload(model, signal) {
        if (!model)
            return;
        try {
            await httpClient.expectSuccess(host, '/api/generate', {
                method: 'POST',
                json: { model: model, keep_alive: 0, stream: false },
                timeoutMs: 8000,
                signal: signal
            });
        }
        catch (error) {
            if (httpClient.isAbortError(error))
                throw error;
            console.warn('  ⚠️ Ollama 模型卸载失败 (' + model + '): ' + errorMessage(error));
        }
    }
    async function emitItem(item, callbacks) {
        const content = (item && item.message && item.message.content) || '';
        if (content && callbacks.onToken)
            await callbacks.onToken(content);
        if (item && item.done && callbacks.onDone)
            await callbacks.onDone();
    }
    async function consumeNdjson(response, callbacks) {
        const decoder = new TextDecoder();
        let buffer = '';
        let doneEmitted = false;
        for await (const chunk of response) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (let i = 0; i < lines.length; i += 1) {
                if (!lines[i].trim())
                    continue;
                let item;
                try {
                    item = JSON.parse(lines[i]);
                }
                catch {
                    throw new httpClient.UpstreamError('Ollama returned an invalid stream event', {
                        code: 'INVALID_NDJSON',
                        detail: lines[i].slice(0, 300)
                    });
                }
                if (item.done)
                    doneEmitted = true;
                await emitItem(item, callbacks);
            }
        }
        buffer += decoder.decode();
        if (buffer.trim()) {
            let lastItem;
            try {
                lastItem = JSON.parse(buffer);
            }
            catch {
                throw new httpClient.UpstreamError('Ollama returned an incomplete stream event', {
                    code: 'INVALID_NDJSON',
                    detail: buffer.slice(0, 300)
                });
            }
            if (lastItem.done)
                doneEmitted = true;
            await emitItem(lastItem, callbacks);
        }
        if (!doneEmitted && callbacks.onDone)
            await callbacks.onDone();
    }
    function streamChat(input, callbacks) {
        const streamCallbacks = callbacks || {};
        return queue.run(async function (queueMeta) {
            if (input.signal && input.signal.aborted)
                throw httpClient.abortError();
            const models = await listModels(input.signal);
            const allowed = models.map(modelName);
            const selected = input.model && allowed.includes(input.model) ? input.model : preferredModel(models);
            if (!selected)
                throw new Error('Ollama 中没有可用的对话模型');
            if (activeModel && activeModel !== selected) {
                const previous = activeModel;
                await unload(previous, input.signal);
                console.log('  🔄 已卸载旧模型: ' + previous + ' → 加载: ' + selected);
            }
            activeModel = selected;
            const upstream = await httpClient.request(host, '/api/chat', {
                method: 'POST',
                timeoutMs: 3 * 60 * 1000,
                timeoutMessage: 'Ollama 对话超时',
                signal: input.signal,
                json: {
                    model: selected,
                    messages: input.messages,
                    stream: true,
                    think: false,
                    keep_alive: keepAlive,
                    options: {
                        temperature: 0.72,
                        top_p: 0.88,
                        repeat_penalty: 1.1,
                        num_predict: numPredict,
                        num_ctx: numContext
                    }
                }
            });
            const statusCode = upstream.response.statusCode || 0;
            if (statusCode < 200 || statusCode >= 300) {
                const body = await httpClient.readBody(upstream.response, 1024 * 1024);
                throw new httpClient.UpstreamError('Ollama 对话失败', {
                    code: 'OLLAMA_CHAT_FAILED',
                    status: statusCode,
                    detail: body.toString('utf8').slice(0, 500)
                });
            }
            if (streamCallbacks.onStart) {
                await streamCallbacks.onStart({ model: selected, queueWaitMs: queueMeta.waitMs });
            }
            await consumeNdjson(upstream.response, streamCallbacks);
            return { model: selected, queueWaitMs: queueMeta.waitMs };
        });
    }
    return {
        listModels: listModels,
        preferredModel: preferredModel,
        status: status,
        streamChat: streamChat,
        queueStatus: function () {
            return queue.status();
        }
    };
}
module.exports = {
    createOllamaService: createOllamaService,
    modelName: modelName,
    publicModel: publicModel
};
