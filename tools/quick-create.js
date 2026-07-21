(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AICQuickCreate = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  var STORAGE_KEY = 'aics_sd_last_success_v1';

  function text(value){ return typeof value === 'string' ? value.trim() : ''; }
  function finite(value, fallback){
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function normalizeSize(value){
    var match = text(value).replace('x', '×').match(/^(\d{2,5})×(\d{2,5})$/);
    return match ? match[1] + '×' + match[2] : '';
  }
  function normalize(value){
    if (!value || typeof value !== 'object') return null;
    var settings = {
      version:1,
      savedAt:finite(value.savedAt, 0),
      checkpoint:text(value.checkpoint),
      sampler:text(value.sampler),
      scheduler:text(value.scheduler),
      cfg:finite(value.cfg, 0),
      steps:Math.max(0, Math.round(finite(value.steps, 0))),
      size:normalizeSize(value.size),
      hiresFix:!!value.hiresFix,
      hiresUpscaler:text(value.hiresUpscaler),
      hiresScale:finite(value.hiresScale, 1.5)
    };
    if (!settings.sampler && !settings.cfg && !settings.steps && !settings.size) return null;
    return settings;
  }
  function targetStorage(storage){
    if (storage) return storage;
    return typeof localStorage !== 'undefined' ? localStorage : null;
  }
  function read(storage){
    try {
      var target = targetStorage(storage);
      return target ? normalize(JSON.parse(target.getItem(STORAGE_KEY) || 'null')) : null;
    } catch(e) { return null; }
  }
  function write(value, storage){
    var settings = normalize(Object.assign({}, value, { savedAt:finite(value && value.savedAt, Date.now()) }));
    if (!settings) return null;
    try {
      var target = targetStorage(storage);
      if (target) target.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch(e) {}
    return settings;
  }
  function shortModel(value){
    var model = text(value).split(/[\\/]/).pop().replace(/\.(safetensors|ckpt)$/i, '');
    return model.length > 22 ? model.slice(0, 19) + '…' : model;
  }
  function summary(value){
    var settings = normalize(value);
    if (!settings) return '';
    return [shortModel(settings.checkpoint), settings.sampler, settings.steps ? settings.steps + ' steps' : '', settings.cfg ? 'CFG ' + settings.cfg : '', settings.size]
      .filter(Boolean).join(' · ');
  }
  function url(sceneId){
    return 'prompt-builder.html?scene=' + encodeURIComponent(String(sceneId || '')) + '&quick=1';
  }

  return { STORAGE_KEY:STORAGE_KEY, normalize:normalize, read:read, summary:summary, url:url, write:write };
});
