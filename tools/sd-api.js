/**
 * SD WebUI API 连接器
 * 功能：与 Stable Diffusion WebUI 通信，发送生成请求
 * 兼容：AUTOMATIC1111、Forge、ReForge 等变体
 *
 * 使用方式：
 *   const connector = new SDWebUIConnector('http://localhost:7860');
 *   const result = await connector.generate({ prompt: '...', steps: 28 });
 *
 * 主要方法：
 *   - generate(options) — 文生图
 *   - getCapabilities() — 获取扩展和模型列表
 *   - interrupt() — 中断当前生成
 */
(function(global){
  'use strict';

  var DEFAULT_BASE = '';
  var DEFAULT_NEGATIVE = 'worst quality, low quality, normal quality, lowres, blurry, photorealistic, realistic skin, 3d render, bad anatomy, bad hands, cropped, duplicate';

  /**
   * @param {string} baseUrl - SD WebUI 地址，如 'http://localhost:7860'
   */
  function SDWebUIConnector(baseUrl){
    this.baseUrl = (baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
    this.apiUrl = this.baseUrl + '/sdapi/v1/txt2img';
  }

  /**
   * 构造 API 错误对象
   */
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

  function splitRegionalSections(prompt){
    return String(prompt || '')
      .replace(/\s*,?\s*\bBREAK\b\s*,?\s*/gi, '\u001e')
      .split('\u001e')
      .map(function(section){ return section.trim().replace(/^,\s*|,\s*$/g, ''); })
      .filter(Boolean);
  }

  function buildRegionalPrompt(prompt){
    var sections = splitRegionalSections(prompt);
    if (sections.length < 2) return { prompt:prompt, enabled:false };
    var first = sections.shift();
    var leftStart = first.lastIndexOf('(');
    if (leftStart < 0) return { prompt:prompt, enabled:false };
    var base = first.slice(0, leftStart).replace(/,\s*$/, '').trim();
    var left = first.slice(leftStart).trim();
    var right = sections.join(', ').trim();
    if (!base || !left || !right) return { prompt:prompt, enabled:false };
    return {
      prompt:[base, left, right].join(' BREAK '),
      enabled:true
    };
  }

  function appendLoraToBase(prompt, loraTags){
    if (!loraTags.length) return prompt;
    var sections = splitRegionalSections(prompt);
    if (sections.length < 2) {
      return [prompt].concat(loraTags).filter(Boolean).join(', ');
    }
    sections[0] = [sections[0]].concat(loraTags).filter(Boolean).join(', ');
    return sections.join(' BREAK ');
  }

  function appendLorasToRegions(prompt, loraTags){
    if (!loraTags.length) return prompt;
    var sections = splitRegionalSections(prompt);
    if (sections.length < 3) return appendLoraToBase(prompt, loraTags);
    var unresolved = [];
    loraTags.forEach(function(tag){
      var target = -1;
      if (/ayachi[_ -]?nene/i.test(tag)) {
        target = sections.findIndex(function(section, index){ return index > 0 && /ayachi[_ -]?nene/i.test(section); });
      } else if (/shiki[_ -]?natsume/i.test(tag)) {
        target = sections.findIndex(function(section, index){ return index > 0 && /shiki[_ -]?natsume/i.test(section); });
      }
      if (target > 0) sections[target] = [sections[target], tag].join(', ');
      else unresolved.push(tag);
    });
    if (unresolved.length) sections[0] = [sections[0]].concat(unresolved).join(', ');
    return sections.join(' BREAK ');
  }

  function regionalPrompterArgs(options){
    options = options || {};
    return [
      true, false, 'Matrix', 'Columns', 'Mask', 'Prompt',
      options.ratios || '1,1',
      options.baseRatio || '0.2',
      true, false, false, options.generationMode || 'Attention', [],
      '0', '0', '0.4', null, '0', '0', false
    ];
  }

  function stripImagePrefix(image){
    return String(image || '').replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  }

  function loadImageDataUrl(url){
    if (!url || typeof fetch !== 'function' || typeof FileReader === 'undefined') return Promise.resolve('');
    return fetch(url, { credentials:'same-origin' }).then(function(response){
      if (!response.ok) throw new Error('pose asset HTTP ' + response.status);
      return response.blob();
    }).then(function(blob){
      return new Promise(function(resolve, reject){
        var reader = new FileReader();
        reader.onload = function(){ resolve(String(reader.result || '')); };
        reader.onerror = function(){ reject(new Error('pose asset read failed')); };
        reader.readAsDataURL(blob);
      });
    });
  }

  function makeControlNetUnit(enhancement, image){
    return {
      input_mode:'simple',
      enabled:true,
      module:'None',
      model:enhancement.controlModel,
      weight:enhancement.controlWeight != null ? enhancement.controlWeight : 0.78,
      image:stripImagePrefix(image),
      resize_mode:enhancement.resizeMode || 'Resize and Fill',
      processor_res:1024,
      threshold_a:-1,
      threshold_b:-1,
      guidance_start:0,
      guidance_end:enhancement.controlEnd != null ? enhancement.controlEnd : 0.82,
      pixel_perfect:false,
      control_mode:'Balanced',
      hr_option:'Both',
      save_detected_map:false
    };
  }

  function makeADetailerArgs(enhancement){
    return [
      true,
      false,
      {
        ad_model:enhancement.adModel || 'face_yolov8s.pt',
        ad_model_classes:'',
        ad_tab_enable:true,
        ad_prompt:'detailed eyes, clean face, character-accurate facial features',
        ad_negative_prompt:'deformed face, asymmetrical eyes, cross-eyed',
        ad_confidence:0.35,
        ad_mask_filter_method:'Area',
        ad_mask_k:2,
        ad_mask_min_ratio:0,
        ad_mask_max_ratio:0.18,
        ad_dilate_erode:4,
        ad_x_offset:0,
        ad_y_offset:0,
        ad_mask_merge_invert:'None',
        ad_mask_blur:4,
        ad_denoising_strength:0.22,
        ad_inpaint_only_masked:true,
        ad_inpaint_only_masked_padding:32,
        ad_use_inpaint_width_height:true,
        ad_inpaint_width:768,
        ad_inpaint_height:768,
        ad_use_steps:false,
        ad_steps:20,
        ad_use_cfg_scale:false,
        ad_cfg_scale:5.5,
        ad_use_checkpoint:false,
        ad_checkpoint:'Use same checkpoint',
        ad_use_vae:false,
        ad_vae:'Use same VAE',
        ad_use_sampler:false,
        ad_sampler:'DPM++ 2M',
        ad_scheduler:'Use same scheduler',
        ad_use_noise_multiplier:false,
        ad_noise_multiplier:1,
        ad_use_clip_skip:false,
        ad_clip_skip:1,
        ad_restore_face:false,
        ad_controlnet_model:'None',
        ad_controlnet_module:'None',
        ad_controlnet_weight:1,
        ad_controlnet_guidance_start:0,
        ad_controlnet_guidance_end:1,
        is_api:true
      }
    ];
  }

  SDWebUIConnector.prototype.generateImage = function(prompt, negativePrompt, options){
    options = options || {};
    var finalPrompt = prompt || '';
    var loras = options.lora ? (Array.isArray(options.lora) ? options.lora : String(options.lora).split(',')) : [];
    var normalizedLoras = loras.map(parseLora).filter(function(item){ return item.name; });
    var isDualCharacter = options.char === 'triad' || normalizedLoras.length > 1 ||
      (finalPrompt.includes('ayachi_nene') && finalPrompt.includes('shiki_natsume'));
    var fallbackWeight = isDualCharacter ? 0.62 : (options.loraWeight != null ? options.loraWeight : 0.8);
    var loraTags = normalizedLoras.filter(function(item){
      return !finalPrompt.includes('<lora:' + item.name);
    }).map(function(item){
      return '<lora:' + item.name + ':' + (item.weight == null ? fallbackWeight : item.weight) + '>';
    });
    var enhancement = isDualCharacter && options.dualEnhancement ? options.dualEnhancement : {};
    var regionalResult = enhancement.regional ? buildRegionalPrompt(finalPrompt) : { prompt:finalPrompt, enabled:false };
    finalPrompt = regionalResult.enabled && enhancement.generationMode === 'Latent'
      ? appendLorasToRegions(regionalResult.prompt, loraTags)
      : appendLoraToBase(regionalResult.prompt, loraTags);

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

    if (regionalResult.enabled) {
      payload.alwayson_scripts = payload.alwayson_scripts || {};
      payload.alwayson_scripts['Regional Prompter'] = {
        args:regionalPrompterArgs(enhancement)
      };
    }
    if (enhancement.adetailer) {
      payload.alwayson_scripts = payload.alwayson_scripts || {};
      payload.alwayson_scripts.ADetailer = { args:makeADetailerArgs(enhancement) };
    }

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

    var controlImage = enhancement.controlImage || '';
    var imagePromise = controlImage
      ? Promise.resolve(controlImage)
      : loadImageDataUrl(enhancement.controlImageUrl).catch(function(){ return ''; });
    var connector = this;
    return imagePromise.then(function(image){
      if (image && enhancement.controlModel) {
        payload.alwayson_scripts = payload.alwayson_scripts || {};
        payload.alwayson_scripts.ControlNet = {
          args:[makeControlNetUnit(enhancement, image)]
        };
      }
      return connector.request('/sdapi/v1/txt2img', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: options.signal
      }, options.timeoutMs == null ? 20 * 60 * 1000 : options.timeoutMs);
    }).then(function(data){
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
        payload: payload,
        enhancements: {
          regional:regionalResult.enabled,
          controlNet:!!(payload.alwayson_scripts && payload.alwayson_scripts.ControlNet),
          adetailer:!!(payload.alwayson_scripts && payload.alwayson_scripts.ADetailer)
        }
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
        connector.request('/sdapi/v1/options', { method: 'GET' }, 6000).catch(function(){ return {}; }),
        connector.request('/sdapi/v1/scripts', { method: 'GET' }, 6000).catch(function(){ return {}; }),
        connector.request('/controlnet/model_list', { method: 'GET' }, 6000).catch(function(){ return {}; }),
        connector.request('/controlnet/module_list', { method: 'GET' }, 6000).catch(function(){ return {}; }),
        connector.request('/adetailer/v1/ad_model', { method: 'GET' }, 6000).catch(function(){ return {}; })
      ]);
    }).then(function(parts){
      var scripts = []
        .concat(parts[6] && parts[6].txt2img || [])
        .map(function(name){ return String(name || '').toLowerCase(); });
      var controlModels = parts[7] && Array.isArray(parts[7].model_list) ? parts[7].model_list : [];
      var controlModules = parts[8] && Array.isArray(parts[8].module_list) ? parts[8].module_list : [];
      var adModels = parts[9] && Array.isArray(parts[9].ad_model) ? parts[9].ad_model : [];
      return {
        models: Array.isArray(parts[0]) ? parts[0] : [],
        samplers: Array.isArray(parts[1]) ? parts[1] : [],
        schedulers: Array.isArray(parts[2]) ? parts[2] : [],
        upscalers: Array.isArray(parts[3]) ? parts[3] : [],
        loras: Array.isArray(parts[4]) ? parts[4] : [],
        options: parts[5] || {},
        currentModel: (parts[5] && parts[5].sd_model_checkpoint) || '',
        extensions: {
          regionalPrompter:scripts.indexOf('regional prompter') !== -1,
          adetailer:scripts.indexOf('adetailer') !== -1,
          controlNet:scripts.indexOf('controlnet') !== -1,
          controlModels:controlModels,
          controlModules:controlModules,
          adModels:adModels
        }
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
