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
    var payload = {
      prompt: prompt,
      negative_prompt: negativePrompt || '',
      steps: options.steps || 20,
      width: options.width || 512,
      height: options.height || 512,
      sampler_name: options.sampler || 'Euler a',
      cfg_scale: options.cfg || 7,
      seed: options.seed != null ? options.seed : -1
    };
    console.log('[SD API] 请求生成...', payload);
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
