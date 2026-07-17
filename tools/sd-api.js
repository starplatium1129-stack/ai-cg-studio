/**
 * SD WebUI API Connector
 * 直连 Stable Diffusion WebUI 的 txt2img 接口。
 * 需要 WebUI 启动时加 --api 参数。
 */
(function(global){
  'use strict';

  // 空字符串 = 相对路径，自动适配本地 / 联机网关
  var DEFAULT_BASE = '';

  function SDWebUIConnector(baseUrl){
    this.baseUrl = (baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
    this.apiUrl = this.baseUrl + '/sdapi/v1/txt2img';
  }

  SDWebUIConnector.prototype.generateImage = function(prompt, negativePrompt, options){
    options = options || {};

    var finalPrompt = prompt || '';

    // 🛡️ 多 LoRA 权重动态稀释：双人同场时自动降权防过拟合爆色
    var isDualCharacter = (options.char === 'triad') ||
      (finalPrompt.includes('ayachi_nene') && finalPrompt.includes('shiki_natsume'));
    var targetWeight = isDualCharacter ? 0.62 : (options.loraWeight || 0.85);

    // LoRA 智能去重注入：已存在则跳过，防止权重叠 buff
    if (options.lora) {
      var loras = Array.isArray(options.lora) ? options.lora : options.lora.split(',');
      loras.forEach(function(name){
        name = (name || '').trim();
        if (!name) return;
        var loraKey = name.split(':')[0]; // strip weight suffix for matching
        if (finalPrompt.includes('<lora:' + loraKey)) {
          console.log('[SD API] LoRA ' + loraKey + ' 已在 Prompt 中，跳过重复注入');
          return;
        }
        if (finalPrompt && !finalPrompt.trim().endsWith(',')) finalPrompt += ',';
        finalPrompt += ' <lora:' + name + ':' + targetWeight + '>';
      });
    }

    // 负向提示词兜底：空值时自动填充 Illustrious SDXL 专用负面词
    var finalNeg = (negativePrompt && negativePrompt.trim()) ? negativePrompt.trim()
      : 'worst quality, low quality, normal quality, lowres, blurry, photorealistic, realistic skin, 3d render, bad anatomy, bad hands, cropped, duplicate';

    var payload = {
      prompt: finalPrompt,
      negative_prompt: finalNeg,
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

    // hires.fix
    if (options.enableHires) {
      payload.enable_hr = true;
      payload.hr_scale = options.hiresScale || 2;
      payload.hr_upscaler = options.hiresUpscaler || 'R-ESRGAN 4x+ Anime6B';
      payload.hr_second_pass_steps = options.hiresSteps || 14;
      payload.denoising_strength = options.denoisingStrength || 0.35;
    }

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
      var info = {};
      try { info = JSON.parse(data.info || '{}'); } catch(e){}
      return { image: 'data:image/png;base64,' + data.images[0], seed: info.seed != null ? info.seed : null };
    });
  };

  SDWebUIConnector.prototype.checkConnection = function(){
    return fetch(this.baseUrl + '/sdapi/v1/sd-models', { method: 'GET' })
      .then(function(r){ return r.ok; })
      .catch(function(){ return false; });
  };

  global.SDWebUIConnector = SDWebUIConnector;
})(window);
