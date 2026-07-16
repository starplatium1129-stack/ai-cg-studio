/**
 * SD WebUI API Connector
 * 直连 Stable Diffusion WebUI 的 txt2img 接口。
 * 需要 WebUI 启动时加 --api 参数。
 */
(function(global){
  'use strict';

  var DEFAULT_BASE = 'http://127.0.0.1:7860';

  function SDWebUIConnector(baseUrl){
    this.baseUrl = (baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
    this.apiUrl = this.baseUrl + '/sdapi/v1/txt2img';
  }

  SDWebUIConnector.prototype.generateImage = function(prompt, negativePrompt, options){
    options = options || {};

    // LoRA 注入：将 lora 参数转为 <lora:name:weight> 语法拼入 prompt
    var finalPrompt = prompt || '';
    var loraWeight = options.loraWeight || 0.85;
    if (options.lora) {
      var loras = Array.isArray(options.lora) ? options.lora : options.lora.split(',');
      loras.forEach(function(name){
        name = (name || '').trim();
        if (name) finalPrompt += ', <lora:' + name + ':' + loraWeight + '>';
      });
    }

    var payload = {
      prompt: finalPrompt,
      negative_prompt: negativePrompt || '',
      steps: options.steps || 28,
      width: options.width || 832,
      height: options.height || 1216,
      sampler_name: options.sampler || 'DPM++ 2M SDE Karras',
      cfg_scale: options.cfg != null ? options.cfg : 5.5,
      seed: options.seed != null ? options.seed : -1,
      override_settings: {
        sd_model_checkpoint: options.checkpoint || 'waiIllustriousSDXL_v170.safetensors'
      }
    };

    console.log('[SD API] 发送 Payload:', payload);
    return fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(response){
      if(!response.ok) throw new Error('请求失败: HTTP ' + response.status);
      return response.json();
    }).then(function(data){
      if(!data.images || !data.images[0]) throw new Error('返回数据无图片');
      return 'data:image/png;base64,' + data.images[0];
    });
  };

  SDWebUIConnector.prototype.checkConnection = function(){
    return fetch(this.baseUrl + '/sdapi/v1/sd-models', { method: 'GET' })
      .then(function(r){ return r.ok; })
      .catch(function(){ return false; });
  };

  global.SDWebUIConnector = SDWebUIConnector;
})(window);
