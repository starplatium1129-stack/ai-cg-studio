/**
 * Stable Diffusion WebUI API connector.
 * Supports AUTOMATIC1111-compatible WebUI variants, including Forge/ReForge.
 */
(function(global){
  'use strict';

  var DEFAULT_BASE = '';
  var DEFAULT_NEGATIVE = 'worst quality, low quality, normal quality, lowres, blurry, photorealistic, realistic skin, 3d render, bad anatomy, bad hands, cropped, duplicate';

  function SDWebUIConnector(baseUrl){
    this.baseUrl = (baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
    this.apiUrl = this.baseUrl + '/sdapi/v1/txt2img';
  }

  function apiError(response, body){
    var detail = body && (body.detail || body.error || body.message || body.errors);
    if (Array.isArray(detail)) detail = detail.map(function(item){ return item.msg || item.message || String(item); }).join('; ');
    if (detail && typeof detail === 'object') {
      try { detail = JSON.stringify(detail); } catch (e) { detail = String(detail); }
    }
    var message = 'SD WebUI 请求失败（HTTP ' + response.status + '）';
    if (detail) message += '：' + String(detail).slice(0, 500);
    var error = new Error(message);
    error.status = response.status;
    error.detail = detail || '';
    return error;
  }

  function createAbortBundle(externalSignal, timeoutMs){
    if (typeof AbortController === 'undefined') {
      return { signal: externalSignal, cleanup: function(){}, timedOut: function(){ return false; } };
    }
    var controller = new AbortController();
    var didTimeout = false;
    var timer = null;
    var relayAbort = function(){ controller.abort(); };
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', relayAbort, { once: true });
    }
    if (timeoutMs > 0) {
      timer = setTimeout(function(){ didTimeout = true; controller.abort(); }, timeoutMs);
    }
    return {
      signal: controller.signal,
      timedOut: function(){ return didTimeout; },
      cleanup: function(){
        if (timer) clearTimeout(timer);
        if (externalSignal) externalSignal.removeEventListener('abort', relayAbort);
      }
    };
  }

  SDWebUIConnector.prototype.request = function(path, init, timeoutMs){
    init = init || {};
    var externalSignal = init.signal;
    var bundle = createAbortBundle(externalSignal, timeoutMs == null ? 8000 : timeoutMs);
    var fetchOptions = Object.assign({}, init, { signal: bundle.signal });
    return fetch(this.baseUrl + path, fetchOptions).then(function(response){
      if (response.ok) {
        if (response.status === 204) return {};
        return response.text().then(function(text){
          if (!text) return {};
          try { return JSON.parse(text); }
          catch (e) { throw new Error('SD WebUI 返回了无法解析的数据'); }
        });
      }
      return response.text().then(function(text){
        var body = {};
        try { body = text ? JSON.parse(text) : {}; }
        catch (e) { body = { detail: text }; }
        throw apiError(response, body);
      });
    }).catch(function(error){
      if (error && error.name === 'AbortError') {
        if (bundle.timedOut()) {
          var timeoutError = new Error('SD WebUI 请求超时');
          timeoutError.name = 'TimeoutError';
          throw timeoutError;
        }
        var abortError = new Error('已取消生成');
        abortError.name = 'AbortError';
        throw abortError;
      }
      if (error && error.status) throw error;
      if (error && /无法解析/.test(error.message || '')) throw error;
      var networkError = new Error('无法连接 SD WebUI：' + ((error && error.message) || '网络请求失败'));
      networkError.name = 'NetworkError';
      throw networkError;
    }).finally(function(){ bundle.cleanup(); });
  };

  function parseLora(raw){
    var value = String(raw || '').trim().replace(/^<lora:/i, '').replace(/>$/, '');
    var parts = value.split(':');
    var parsedWeight = Number(parts[1]);
    return {
      name: (parts[0] || '').trim(),
      weight: Number.isFinite(parsedWeight) ? parsedWeight : null
    };
  }

  function asDataUrl(image){
    if (/^data:image\//i.test(image || '')) return image;
    return 'data:image/png;base64,' + image;
  }

  SDWebUIConnector.prototype.generateImage = function(prompt, negativePrompt, options){
    options = options || {};
    var finalPrompt = prompt || '';
    var loras = options.lora ? (Array.isArray(options.lora) ? options.lora : String(options.lora).split(',')) : [];
    var normalizedLoras = loras.map(parseLora).filter(function(item){ return item.name; });
    var isDualCharacter = options.char === 'triad' || normalizedLoras.length > 1 ||
      (finalPrompt.includes('ayachi_nene') && finalPrompt.includes('shiki_natsume'));
    var fallbackWeight = isDualCharacter ? 0.62 : (options.loraWeight != null ? options.loraWeight : 0.8);

    normalizedLoras.forEach(function(item){
      if (finalPrompt.includes('<lora:' + item.name)) return;
      if (finalPrompt && !finalPrompt.trim().endsWith(',')) finalPrompt += ',';
      finalPrompt += ' <lora:' + item.name + ':' + (item.weight == null ? fallbackWeight : item.weight) + '>';
    });

    // An explicit empty string means the caller intentionally disabled the
    // negative prompt. Only an omitted/non-string value should use defaults.
    var finalNegative = typeof negativePrompt === 'string' ? negativePrompt.trim() : DEFAULT_NEGATIVE;
    var payload = {
      prompt: finalPrompt,
      negative_prompt: finalNegative,
      steps: options.steps || 28,
      width: options.width || 832,
      height: options.height || 1216,
      sampler_name: options.samplerName || options.sampler || 'DPM++ 2M',
      cfg_scale: options.cfg != null ? options.cfg : 5.5,
      seed: options.seed != null ? options.seed : -1,
      batch_size: options.batchSize || 1,
      n_iter: 1
    };

    if (options.scheduler) payload.scheduler = options.scheduler;
    if (options.checkpoint) {
      payload.override_settings = { sd_model_checkpoint: options.checkpoint };
      payload.override_settings_restore_afterwards = true;
    }
    if (options.enableHires) {
      payload.enable_hr = true;
      payload.hr_scale = options.hiresScale != null ? options.hiresScale : 1.5;
      payload.hr_upscaler = options.hiresUpscaler || 'Latent';
      payload.hr_second_pass_steps = options.hiresSteps != null ? options.hiresSteps : 14;
      payload.denoising_strength = options.denoisingStrength != null ? options.denoisingStrength : 0.35;
    }

    return this.request('/sdapi/v1/txt2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: options.signal
    }, options.timeoutMs == null ? 20 * 60 * 1000 : options.timeoutMs).then(function(data){
      if (!data.images || !data.images.length) throw new Error('SD WebUI 返回数据中没有图片');
      var info = {};
      if (typeof data.info === 'string') {
        try { info = JSON.parse(data.info || '{}'); } catch (e) { info = {}; }
      } else if (data.info && typeof data.info === 'object') {
        info = data.info;
      }
      var images = data.images.map(asDataUrl);
      var seed = info.seed;
      if (seed == null && Array.isArray(info.all_seeds)) seed = info.all_seeds[0];
      if (seed == null && data.parameters) seed = data.parameters.seed;
      return {
        image: images[0],
        images: images,
        seed: seed != null ? seed : null,
        seeds: Array.isArray(info.all_seeds) ? info.all_seeds : [],
        infotexts: Array.isArray(info.infotexts) ? info.infotexts : [],
        info: info,
        parameters: data.parameters || {},
        payload: payload
      };
    });
  };

  SDWebUIConnector.prototype.getProgress = function(){
    return this.request('/sdapi/v1/progress?skip_current_image=true', { method: 'GET' }, 4000);
  };

  SDWebUIConnector.prototype.interrupt = function(){
    return this.request('/sdapi/v1/interrupt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }, 5000);
  };

  SDWebUIConnector.prototype.getCapabilities = function(){
    var connector = this;
    return connector.request('/sdapi/v1/sd-models', { method: 'GET' }, 6000).then(function(models){
      return Promise.all([
        Promise.resolve(models),
        connector.request('/sdapi/v1/samplers', { method: 'GET' }, 6000).catch(function(){ return []; }),
        connector.request('/sdapi/v1/schedulers', { method: 'GET' }, 6000).catch(function(){ return []; }),
        connector.request('/sdapi/v1/upscalers', { method: 'GET' }, 6000).catch(function(){ return []; }),
        connector.request('/sdapi/v1/loras', { method: 'GET' }, 6000).catch(function(){ return []; }),
        connector.request('/sdapi/v1/options', { method: 'GET' }, 6000).catch(function(){ return {}; })
      ]);
    }).then(function(parts){
      return {
        models: Array.isArray(parts[0]) ? parts[0] : [],
        samplers: Array.isArray(parts[1]) ? parts[1] : [],
        schedulers: Array.isArray(parts[2]) ? parts[2] : [],
        upscalers: Array.isArray(parts[3]) ? parts[3] : [],
        loras: Array.isArray(parts[4]) ? parts[4] : [],
        options: parts[5] || {},
        currentModel: (parts[5] && parts[5].sd_model_checkpoint) || ''
      };
    });
  };

  SDWebUIConnector.prototype.checkConnection = function(){
    return this.request('/sdapi/v1/sd-models', { method: 'GET' }, 5000)
      .then(function(){ return true; })
      .catch(function(){ return false; });
  };

  global.SDWebUIConnector = SDWebUIConnector;
})(window);
