/* Prompt Builder module: SD WebUI settings, generation, and recovery.
 * This file intentionally uses classic script globals for inline HTML handlers.
 */

// ====== SD WebUI API ======
var _sdConnector = null;
var _sdLastDataUrl = '';
var _sdLastResult = null;
var _sdCapabilities = null;
var _sdGeneration = null;
var SD_SETTINGS_KEY = 'aics_sd_settings_v1';
function getSDConnector(){
  if(!_sdConnector) _sdConnector = new SDWebUIConnector();
  return _sdConnector;
}
function readSDSettings(){
  try {
    var parsed = JSON.parse(localStorage.getItem(SD_SETTINGS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch(e) { return {}; }
}

function ensureSelectValue(id, value){
  if (value == null) return;
  var select = document.getElementById(id);
  if (!select) return;
  var wanted = String(value);
  var exists = Array.from(select.options).some(function(option){ return option.value === wanted; });
  if (!exists && wanted) {
    var option = document.createElement('option');
    option.value = wanted;
    option.textContent = wanted;
    select.appendChild(option);
  }
  select.value = wanted;
}

function normalizeModelName(value){
  return String(value || '').toLowerCase().replace(/\.(safetensors|ckpt)\b/g, '').replace(/\s*\[[a-f0-9]+\]\s*$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function findModelProfile(modelName){
  var normalized = normalizeModelName(modelName);
  if (!normalized) return null;
  return (MODEL_PROFILES || []).find(function(profile){
    return (profile.match || []).some(function(pattern){
      var needle = normalizeModelName(pattern);
      return needle && normalized.indexOf(needle) !== -1;
    });
  }) || null;
}

function effectiveModelName(){
  var selected = document.getElementById('sdModel');
  return selected && selected.value ? selected.value : (_sdCapabilities && _sdCapabilities.currentModel ? _sdCapabilities.currentModel : '');
}

function currentQualityPrefix(scene){
  var profile = ACTIVE_MODEL_PROFILE || findModelProfile(effectiveModelName());
  var prefix = profile && profile.quality_prefix ? profile.quality_prefix : 'masterpiece, best_quality, very_aesthetic, absurdres';
  if (profile) {
    var rating = scene && scene.mature ? profile.rating_mature : profile.rating_safe;
    if (rating) prefix = mergeTokenText(prefix, rating);
  }
  return prefix;
}

function currentModelNegativePrefix(){
  var profile = ACTIVE_MODEL_PROFILE || findModelProfile(effectiveModelName());
  return profile && profile.negative_prefix ? profile.negative_prefix : '';
}

function setSelectValueInsensitive(id, value){
  var select = document.getElementById(id);
  if (!select) return;
  var wanted = String(value == null ? '' : value);
  var match = Array.from(select.options).find(function(option){ return option.value.toLowerCase() === wanted.toLowerCase(); });
  if (match) select.value = match.value;
  else ensureSelectValue(id, wanted);
}

function applyModelProfile(modelName, force){
  var profile = findModelProfile(modelName);
  ACTIVE_MODEL_PROFILE = profile;
  var hint = document.getElementById('modelProfileHint');
  if (!profile) {
    if (hint) hint.textContent = '未识别模型：保留你的自定义参数';
    updateLivePreview();
    return false;
  }
  if (hint) hint.textContent = '已匹配 ' + profile.name + ' · ' + profile.sampler + ' · ' + profile.steps + ' steps · CFG ' + profile.cfg;
  var settings = readSDSettings();
  var signature = normalizeModelName(modelName);
  if (!force && settings.profileModel === signature) {
    updateLivePreview();
    return true;
  }
  if (profile.cfg != null) setSelectValueInsensitive('cfg', profile.cfg);
  if (profile.steps != null) setSelectValueInsensitive('steps', profile.steps);
  if (profile.sampler != null) setSelectValueInsensitive('sampler', profile.sampler);
  if (profile.scheduler != null) setSelectValueInsensitive('scheduler', profile.scheduler);
  if (profile.size) setSelectValueInsensitive('size', profile.size);
  saveSDSettings();
  updateLivePreview();
  flash('🎯 已为 ' + profile.name + ' 匹配稳定参数');
  return true;
}

function saveSDSettings(){
  var settings = {
    checkpoint: document.getElementById('sdModel') ? document.getElementById('sdModel').value : '',
    sampler: document.getElementById('sampler') ? document.getElementById('sampler').value : '',
    scheduler: document.getElementById('scheduler') ? document.getElementById('scheduler').value : '',
    hiresUpscaler: document.getElementById('sdHiresUpscaler') ? document.getElementById('sdHiresUpscaler').value : '',
    hiresScale: document.getElementById('sdHiresScale') ? document.getElementById('sdHiresScale').value : '1.5',
    hiresFix: !!(document.getElementById('sdHiresFix') && document.getElementById('sdHiresFix').checked),
    seedLock: !!(document.getElementById('sdSeedLock') && document.getElementById('sdSeedLock').checked),
    seedInput: document.getElementById('sdSeedInput') ? document.getElementById('sdSeedInput').value : '',
    cfg: document.getElementById('cfg') ? document.getElementById('cfg').value : '',
    steps: document.getElementById('steps') ? document.getElementById('steps').value : '',
    size: document.getElementById('size') ? document.getElementById('size').value : '',
    quality: !!(document.getElementById('quality') && document.getElementById('quality').checked),
    tail: !!(document.getElementById('tail') && document.getElementById('tail').checked),
    negative: !!(document.getElementById('negative') && document.getElementById('negative').checked),
    profileModel: normalizeModelName(effectiveModelName()),
    profileId: ACTIVE_MODEL_PROFILE ? ACTIVE_MODEL_PROFILE.id : ''
  };
  try { localStorage.setItem(SD_SETTINGS_KEY, JSON.stringify(settings)); } catch(e) {}
}

function initSDSettings(){
  var settings = readSDSettings();
  if (settings.checkpoint) ensureSelectValue('sdModel', settings.checkpoint);
  if (settings.sampler) ensureSelectValue('sampler', settings.sampler);
  if (settings.scheduler != null) ensureSelectValue('scheduler', settings.scheduler);
  if (settings.hiresUpscaler) ensureSelectValue('sdHiresUpscaler', settings.hiresUpscaler);
  if (settings.hiresScale) ensureSelectValue('sdHiresScale', settings.hiresScale);
  if (settings.cfg) ensureSelectValue('cfg', settings.cfg);
  if (settings.steps) ensureSelectValue('steps', settings.steps);
  if (settings.size) ensureSelectValue('size', settings.size);
  var hires = document.getElementById('sdHiresFix');
  var seed = document.getElementById('sdSeedLock');
  if (hires && settings.hiresFix != null) hires.checked = !!settings.hiresFix;
  if (seed && settings.seedLock != null) seed.checked = !!settings.seedLock;
  var seedInput = document.getElementById('sdSeedInput');
  if (seedInput && settings.seedInput != null) seedInput.value = settings.seedInput;
  ['quality','tail','negative'].forEach(function(id){
    var input = document.getElementById(id);
    if (input && settings[id] != null) input.checked = !!settings[id];
  });
  ['sdModel','sampler','scheduler','sdHiresUpscaler','sdHiresScale','sdHiresFix','sdSeedLock','sdSeedInput','cfg','steps','size','quality','tail','negative'].forEach(function(id){
    var element = document.getElementById(id);
    if (element) element.addEventListener('change', saveSDSettings);
  });
  var model = document.getElementById('sdModel');
  if (model) model.addEventListener('change', function(){ applyModelProfile(effectiveModelName(), true); });
}

function showQuickCreateStatus(message, isError){
  var banner = document.getElementById('quickCreateBanner');
  var copy = document.getElementById('quickCreateCopy');
  if (!banner || !copy) return;
  banner.hidden = false;
  banner.classList.toggle('error', !!isError);
  copy.textContent = message;
}

function applyLastSuccessfulSettings(){
  var settings = AICQuickCreate.read(localStorage);
  if (!settings) return null;
  var fallbacks = [];
  function hasCapability(items, wanted, fields, normalize){
    if (!items || !items.length || !wanted) return true;
    var target = normalize ? normalizeModelName(wanted) : String(wanted).toLowerCase();
    return items.some(function(item){
      return fields.some(function(field){
        var value = typeof item === 'string' ? item : item[field];
        value = normalize ? normalizeModelName(value) : String(value || '').toLowerCase();
        return value && value === target;
      });
    });
  }
  if (settings.checkpoint && hasCapability(_sdCapabilities && _sdCapabilities.models, settings.checkpoint, ['title','model_name','filename'], true)) ensureSelectValue('sdModel', settings.checkpoint);
  else if (settings.checkpoint) fallbacks.push('模型');
  if (settings.sampler && hasCapability(_sdCapabilities && _sdCapabilities.samplers, settings.sampler, ['name','label'], false)) ensureSelectValue('sampler', settings.sampler);
  else if (settings.sampler) fallbacks.push('采样器');
  if (settings.scheduler != null && hasCapability(_sdCapabilities && _sdCapabilities.schedulers, settings.scheduler, ['name','label'], false)) ensureSelectValue('scheduler', settings.scheduler);
  else if (settings.scheduler) fallbacks.push('调度器');
  if (settings.cfg) ensureSelectValue('cfg', settings.cfg);
  if (settings.steps) ensureSelectValue('steps', settings.steps);
  if (settings.size) ensureSelectValue('size', settings.size);
  if (settings.hiresUpscaler && hasCapability(_sdCapabilities && _sdCapabilities.upscalers, settings.hiresUpscaler, ['name','model_name'], false)) ensureSelectValue('sdHiresUpscaler', settings.hiresUpscaler);
  else if (settings.hiresUpscaler) fallbacks.push('放大器');
  var hires = document.getElementById('sdHiresFix'); if (hires) hires.checked = !!settings.hiresFix;
  if (settings.hiresScale) ensureSelectValue('sdHiresScale', settings.hiresScale);
  saveSDSettings();
  updateLivePreview();
  return { settings:settings, fallbacks:fallbacks };
}

function quickCreateCurrent(knownConnection){
  if (_sdGeneration) { flash('当前图片仍在生成中'); return Promise.resolve(false); }
  if (QUICK_CREATE_BUSY) { flash('快速创作正在准备中'); return Promise.resolve(false); }
  if (!state.__sceneId && !String(state.story || '').trim()) {
    flash('⚠️ 请先选择场景');
    var input = document.getElementById('sceneSearch'); if (input) input.focus();
    return Promise.resolve(false);
  }
  QUICK_CREATE_BUSY = true;
  var quickButton = document.getElementById('quickCreateBtn'); if (quickButton) quickButton.disabled = true;
  showQuickCreateStatus('正在检查 SD，并准备最近成功参数…', false);
  var readiness = typeof knownConnection === 'boolean' ? Promise.resolve(knownConnection) : checkSDStatus();
  return readiness.then(function(connected){
    var reused = connected ? applyLastSuccessfulSettings() : null;
    generate();
    if (!connected) {
      showQuickCreateStatus('SD 当前不可用，Prompt 已准备好；连接恢复后点击“生成图片”即可。', true);
      var area = document.getElementById('sdResultArea'); if (area) area.style.display = 'block';
      var status = document.getElementById('sdStatus'); if (status) status.textContent = '未提交生成：SD WebUI 尚未连接。';
      return false;
    }
    var fallbackText = reused && reused.fallbacks.length ? '；' + reused.fallbacks.join('、') + '已失效，改用当前可用值' : '';
    showQuickCreateStatus(reused ? '已复用最近成功参数：' + AICQuickCreate.summary(reused.settings) + fallbackText : '暂无成功记录，正在使用当前稳定参数生成。', false);
    var seedLock = document.getElementById('sdSeedLock');
    var seedInput = document.getElementById('sdSeedInput');
    if (seedInput && (!seedLock || !seedLock.checked)) seedInput.value = '';
    callSDGenerate();
    return true;
  }).catch(function(error){
    generate();
    showQuickCreateStatus('快速出图准备失败，Prompt 已保留，可改用手动生成。', true);
    console.warn('quick create failed', error);
    return false;
  }).finally(function(){
    QUICK_CREATE_BUSY = false;
    if (quickButton && !_sdGeneration) quickButton.disabled = false;
  });
}

function replaceSDSelect(id, items, preferred, placeholder){
  var select = document.getElementById(id);
  if (!select || !items.length) return;
  var values = [];
  select.textContent = '';
  if (placeholder) {
    var first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    select.appendChild(first);
    values.push('');
  }
  items.forEach(function(item){
    var value = typeof item === 'string' ? item : item.value;
    var label = typeof item === 'string' ? item : (item.label || item.value);
    if (!value || values.indexOf(value) !== -1) return;
    values.push(value);
    var option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  var preferredMatch = values.find(function(value){ return String(value).toLowerCase() === String(preferred || '').toLowerCase(); });
  if (preferredMatch != null) select.value = preferredMatch;
  else if (id === 'sampler') {
    select.value = values.find(function(value){ return value.toLowerCase() === 'euler a'; }) || values[0] || '';
  } else if (id === 'scheduler') {
    select.value = values.find(function(value){ return value.toLowerCase() === 'karras'; }) || values[0] || '';
  } else {
    select.value = '';
  }
}

function shortModelName(value){
  var name = String(value || '').split(/[\\/]/).pop().replace(/\s*\[[a-f0-9]+\]\s*$/i, '');
  return name.length > 34 ? name.slice(0, 31) + '…' : name;
}

function populateSDCapabilities(capabilities){
  var modelSelect = document.getElementById('sdModel');
  var currentModelChoice = modelSelect ? modelSelect.value : '';
  var currentSampler = document.getElementById('sampler') ? document.getElementById('sampler').value : '';
  var currentScheduler = document.getElementById('scheduler') ? document.getElementById('scheduler').value : '';
  var currentUpscaler = document.getElementById('sdHiresUpscaler') ? document.getElementById('sdHiresUpscaler').value : '';
  var currentLabel = capabilities.currentModel ? '使用当前模型 · ' + shortModelName(capabilities.currentModel) : '使用 WebUI 当前模型';
  replaceSDSelect('sdModel', capabilities.models.map(function(model){
    var value = model.title || model.model_name || model.filename || '';
    return { value:value, label:shortModelName(model.model_name || model.title || model.filename || value) };
  }), currentModelChoice, currentLabel);
  replaceSDSelect('sampler', capabilities.samplers.map(function(item){ return item.name || item.label || ''; }), currentSampler, '');
  replaceSDSelect('scheduler', capabilities.schedulers.map(function(item){ return item.name || item.label || ''; }), currentScheduler, '自动');
  replaceSDSelect('sdHiresUpscaler', capabilities.upscalers.map(function(item){ return item.name || item.model_name || ''; }), currentUpscaler, '');
  applyModelProfile(currentModelChoice || capabilities.currentModel, false);
}

function detectGateway(){
  return fetch('/api/health', { cache:'no-store' }).then(function(response){
    if (!response.ok) return null;
    return response.json();
  }).then(function(data){
    window.AICS_GATEWAY = !!(data && data.ok && data.gateway && data.app === 'ai-cg-studio');
    return window.AICS_GATEWAY;
  }).catch(function(){ window.AICS_GATEWAY = false; return false; });
}

function checkSDStatus(){
  var badge = document.getElementById('sd-status-badge');
  if (!badge) return Promise.resolve(false);
  badge.textContent = '⏳ 检测中…';
  badge.style.color = '';
  badge.setAttribute('aria-busy', 'true');
  return detectGateway().then(function(){ return getSDConnector().getCapabilities(); }).then(function(capabilities){
    _sdCapabilities = capabilities;
    window.__sdCapabilities = capabilities;
    populateSDCapabilities(capabilities);
    var model = shortModelName(capabilities.currentModel);
    badge.textContent = '🟢 SD WebUI 已连接' + (model ? ' · ' + model : '');
    badge.title = '已读取 ' + capabilities.models.length + ' 个模型、' + capabilities.samplers.length + ' 个采样器；点击重新检测';
    badge.style.color = 'var(--success, #22c55e)';
    return true;
  }).catch(function(error){
    _sdCapabilities = null;
    window.__sdCapabilities = null;
    if (error.status === 404) {
      badge.textContent = '🟠 当前页面未启用 SD 网关';
      badge.title = '静态服务器不提供 /sdapi 代理；请通过 AI-CG-Studio 控制面板或 node server.js 打开网站';
      badge.style.color = 'var(--warning, #f59e0b)';
    } else {
      badge.textContent = '🔴 SD WebUI 离线 · 点击重试';
      badge.title = error.message || '无法连接 SD WebUI';
      badge.style.color = 'var(--danger, #ef4444)';
    }
    return false;
  }).finally(function(){ badge.removeAttribute('aria-busy'); });
}

function setSDProgress(percent){
  var progress = document.getElementById('sdProgress');
  var bar = document.getElementById('sdProgressBar');
  if (!progress || !bar) return;
  progress.hidden = false;
  bar.style.width = Math.max(0, Math.min(100, percent || 0)) + '%';
}

function startSDProgressPolling(generation){
  generation.progressBusy = false;
  generation.progressTimer = setInterval(function(){
    if (_sdGeneration !== generation || generation.progressBusy) return;
    generation.progressBusy = true;
    getSDConnector().getProgress().then(function(data){
      if (_sdGeneration !== generation) return;
      var progress = Math.max(0, Math.min(1, Number(data.progress) || 0));
      var elapsed = Math.floor((Date.now() - generation.startedAt) / 1000);
      var eta = Math.max(0, Math.round(Number(data.eta_relative) || 0));
      setSDProgress(progress * 100);
      var status = document.getElementById('sdStatus');
      if (status) {
        status.textContent = progress > 0
          ? '⏳ 正在生成 ' + Math.round(progress * 100) + '% · 已用 ' + elapsed + ' 秒' + (eta ? ' · 约剩 ' + eta + ' 秒' : '')
          : '⏳ 排队或准备模型中 · 已等待 ' + elapsed + ' 秒';
      }
    }).catch(function(){
      var status = document.getElementById('sdStatus');
      if (status && _sdGeneration === generation) {
        status.textContent = '⏳ 正在生成 · 已等待 ' + Math.floor((Date.now() - generation.startedAt) / 1000) + ' 秒';
      }
    }).finally(function(){ generation.progressBusy = false; });
  }, 1100);
}

function finishSDGeneration(generation){
  if (generation.progressTimer) clearInterval(generation.progressTimer);
  if (_sdGeneration === generation) _sdGeneration = null;
  var generateButton = document.getElementById('sdGenBtn');
  var quickButton = document.getElementById('quickCreateBtn');
  var cancelButton = document.getElementById('sdCancelBtn');
  if (generateButton) { generateButton.disabled = false; generateButton.textContent = '生成图片'; }
  if (quickButton) quickButton.disabled = false;
  if (cancelButton) cancelButton.hidden = true;
}

function cancelSDGenerate(){
  var generation = _sdGeneration;
  if (!generation || generation.cancelled) return;
  generation.cancelled = true;
  var status = document.getElementById('sdStatus');
  if (status) status.textContent = '正在停止生成…';
  getSDConnector().interrupt().catch(function(error){ console.warn('[SD API] interrupt failed', error); });
  if (generation.controller) generation.controller.abort();
}

function clearSDRecovery(){
  var panel = document.getElementById('sdRecovery');
  var action = document.getElementById('sdRecoveryAction');
  if (panel) panel.hidden = true;
  if (action) { action.hidden = true; action.dataset.action = ''; action.onclick = null; }
}

function runSDRecovery(action){
  clearSDRecovery();
  if (action === 'retry_light') {
    ensureSelectValue('size', '768×1344');
    var hires = document.getElementById('sdHiresFix'); if (hires) hires.checked = false;
    saveSDSettings(); updateLivePreview(); flash('已降低尺寸并关闭 hires.fix，正在重试');
    callSDGenerate();
    return;
  }
  if (action === 'retry_without_lora') {
    flash('本次将临时跳过角色 LoRA');
    callSDGenerate({ disableLora:true });
    return;
  }
  if (action === 'retry_current_model') {
    ensureSelectValue('sdModel', '');
    saveSDSettings(); updateLivePreview(); flash('已改用 WebUI 当前模型，正在重试');
    callSDGenerate();
    return;
  }
  if (action === 'retry_safe_sampler') {
    setSelectValueInsensitive('sampler', 'DPM++ 2M');
    ensureSelectValue('scheduler', '');
    saveSDSettings(); updateLivePreview(); flash('已切换到通用采样设置，正在重试');
    callSDGenerate();
    return;
  }
  if (action === 'recheck_connection') {
    checkSDStatus().then(function(connected){ flash(connected ? 'SD WebUI 已恢复连接，可再次生成' : 'SD WebUI 仍未连接'); });
    return;
  }
  if (action === 'open_settings') {
    var settings = document.querySelector('.generation-settings');
    if (settings) { settings.open = true; settings.scrollIntoView({ behavior:'smooth', block:'center' }); }
  }
}

function renderSDRecovery(error){
  var recovery = AICSDError.classify(error);
  var panel = document.getElementById('sdRecovery');
  var title = document.getElementById('sdRecoveryTitle');
  var copy = document.getElementById('sdRecoveryCopy');
  var detail = document.getElementById('sdRecoveryDetail');
  var details = document.getElementById('sdRecoveryDetails');
  var action = document.getElementById('sdRecoveryAction');
  if (!panel || !title || !copy || !detail || !details || !action) return recovery;
  if (recovery.kind === 'cancelled') { clearSDRecovery(); return recovery; }
  panel.hidden = false;
  title.textContent = recovery.title;
  copy.textContent = recovery.message;
  detail.textContent = recovery.details || '没有可用的后端细节。';
  details.open = false;
  if (recovery.action) {
    action.hidden = false;
    action.textContent = recovery.action.label;
    action.dataset.action = recovery.action.id;
    action.onclick = function(){ runSDRecovery(this.dataset.action); };
  } else {
    action.hidden = true;
    action.dataset.action = '';
    action.onclick = null;
  }
  return recovery;
}

function callSDGenerate(requestOptions){
  requestOptions = requestOptions || {};
  if (_sdGeneration) return;
  var queuedJob = requestOptions.job || null;
  var prompt = queuedJob ? queuedJob.prompt : getPlainPrompt();
  if (!prompt) { flash('⚠️ 请先生成 Prompt'); return; }
  var area = document.getElementById('sdResultArea');
  var status = document.getElementById('sdStatus');
  var slot = document.getElementById('sdImageSlot');
  var saveActions = document.getElementById('sdSaveActions');
  var generateButton = document.getElementById('sdGenBtn');
  var quickButton = document.getElementById('quickCreateBtn');
  var cancelButton = document.getElementById('sdCancelBtn');
  var progress = document.getElementById('sdProgress');
  area.style.display = 'block';
  clearSDRecovery();
  saveActions.style.display = 'none';
  var historySaveButton = document.getElementById('sdHistorySaveBtn');
  if (historySaveButton) { historySaveButton.disabled = false; historySaveButton.textContent = '保存到历史'; }
  slot.textContent = '';
  _sdLastDataUrl = '';
  _sdLastResult = null;
  if (progress) progress.hidden = false;
  setSDProgress(0);
  generateButton.disabled = true;
  generateButton.textContent = '生成中…';
  if (quickButton) quickButton.disabled = true;
  cancelButton.hidden = false;

  var cfg = queuedJob ? queuedJob.cfg : (Number(document.getElementById('cfg').value) || 5.5);
  var steps = queuedJob ? queuedJob.steps : (Number(document.getElementById('steps').value) || 28);
  var sampler = queuedJob ? queuedJob.sampler : (document.getElementById('sampler').value || 'DPM++ 2M');
  var scheduler = queuedJob ? queuedJob.scheduler : (document.getElementById('scheduler').value || '');
  var selectedSampler = sampler;
  var selectedScheduler = scheduler;
  if (_sdCapabilities && !_sdCapabilities.schedulers.length && scheduler && sampler.toLowerCase().indexOf(scheduler.toLowerCase()) === -1) {
    sampler += ' ' + scheduler;
    scheduler = '';
  }
  var selectedSize = queuedJob ? queuedJob.size : (document.getElementById('size').value || '832×1216');
  var size = selectedSize.replace('×','x').split('x');
  var seed = -1;
  var manualSeed = queuedJob ? String(queuedJob.seed == null ? '' : queuedJob.seed) : (document.getElementById('sdSeedInput') ? document.getElementById('sdSeedInput').value.trim() : '');
  if (manualSeed !== '' && isFinite(Number(manualSeed))) seed = Number(manualSeed);
  else if (!queuedJob && document.getElementById('sdSeedLock').checked && window.__lastSeed__ != null) seed = window.__lastSeed__;
  var currentSceneId = queuedJob ? queuedJob.sceneId : state.__sceneId;
  var currentCharacter = queuedJob ? queuedJob.char : state.char;
  var currentScene = SCENES.find(function(scene){ return scene.id === currentSceneId; });
  var lora = requestOptions.disableLora ? '' : (queuedJob ? queuedJob.lora : resolveLoraSpecs(currentCharacter, currentScene).map(loraSpecText).join(', '));
  prompt = prompt.replace(/<lora:[^>]+>/g, '').replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
  var hiresEnabled = queuedJob ? !!queuedJob.hiresFix : document.getElementById('sdHiresFix').checked;
  var hiresScale = queuedJob ? queuedJob.hiresScale : (Number(document.getElementById('sdHiresScale').value) || 1.5);
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var generation = {
    controller: controller,
    cancelled: false,
    startedAt: Date.now(),
    progressTimer: null
  };
  _sdGeneration = generation;
  status.textContent = requestOptions.disableLora ? '⏳ 已提交（临时跳过 LoRA），等待 SD WebUI…' : (queuedJob ? '⏳ 队列任务「' + queuedJob.title + '」已提交…' : '⏳ 已提交，等待 SD WebUI…');
  if (!queuedJob) saveSDSettings();
  startSDProgressPolling(generation);

  var options = {
    cfg: cfg,
    steps: steps,
    sampler: sampler,
    scheduler: scheduler,
    width: Number(size[0]) || 832,
    height: Number(size[1]) || 1216,
    seed: seed,
    lora: lora,
    char: currentCharacter,
    checkpoint: queuedJob ? queuedJob.checkpoint : (document.getElementById('sdModel').value || ''),
    enableHires: hiresEnabled,
    hiresUpscaler: queuedJob ? queuedJob.hiresUpscaler : (document.getElementById('sdHiresUpscaler').value || 'Latent'),
    hiresSteps: 14,
    denoisingStrength: 0.35,
    hiresScale: hiresScale,
    signal: controller ? controller.signal : undefined
  };

  var successfulSettings = {
    checkpoint: queuedJob ? queuedJob.checkpoint : effectiveModelName(),
    sampler: selectedSampler,
    scheduler: selectedScheduler,
    cfg: cfg,
    steps: steps,
    size: selectedSize,
    hiresFix: hiresEnabled,
    hiresUpscaler: queuedJob ? queuedJob.hiresUpscaler : (document.getElementById('sdHiresUpscaler').value || 'Latent'),
    hiresScale: hiresScale
  };

  return getSDConnector().generateImage(prompt, queuedJob ? queuedJob.negative : getPlainNegative(), options).then(function(result){
    if (_sdGeneration !== generation || generation.cancelled) return;
    _sdLastResult = result;
    if (queuedJob) _sdLastResult.queueJob = queuedJob;
    _sdLastDataUrl = result.image;
    window.__lastSdPayload = result.payload;
    if (result.seed != null) {
      window.__lastSeed__ = result.seed;
      document.getElementById('sdSeedDisplay').textContent = 'seed: ' + result.seed;
      var _si = document.getElementById('sdSeedInput');
      if (_si && !_si.value.trim()) _si.placeholder = String(result.seed);
    }
    setSDProgress(100);
    var elapsed = Math.max(1, Math.round((Date.now() - generation.startedAt) / 1000));
    status.textContent = '✅ 生成完成 · ' + elapsed + ' 秒' + (hiresEnabled ? ' · hires.fix ' + hiresScale + 'x' : '');
    document.getElementById('stepResult').classList.add('has-image');
    var image = document.createElement('img');
    image.src = result.image;
    image.alt = 'Stable Diffusion 生成图片';
    slot.replaceChildren(image);
    saveActions.style.display = 'flex';
    clearSDRecovery();
    if (!successfulSettings.checkpoint && result.info && result.info.sd_model_name) successfulSettings.checkpoint = result.info.sd_model_name;
    var savedSettings = AICQuickCreate.write(successfulSettings, localStorage);
    var quickBanner = document.getElementById('quickCreateBanner');
    if (quickBanner && !quickBanner.hidden) showQuickCreateStatus('生成完成，已记住成功参数：' + AICQuickCreate.summary(savedSettings), false);
    if (window.AICS_GATEWAY) {
      fetch('/api/save-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64:result.image, filename:'gen_' + Date.now() + '.png' })
      }).catch(function(){});
    }
    if (queuedJob) {
      status.textContent = '✅ 生成完成 · 正在自动保存队列作品…';
      if (historySaveButton) { historySaveButton.disabled = true; historySaveButton.textContent = '自动保存中…'; }
      return fetch(result.image).then(function(response){ return response.blob(); }).then(function(blob){
        return AICGImageStore.put(blob);
      }).then(function(imageId){
        return saveHistoryWithRating({face:0,expression:0,composition:0,hands:0,atmosphere:0}, false, '', '', imageId, true);
      }).then(function(){
        status.textContent = '✅ 队列作品已自动保存到历史 · ' + elapsed + ' 秒';
        if (historySaveButton) historySaveButton.textContent = '✓ 队列已保存';
      }).catch(function(saveError){
        console.error('queue result save failed', saveError);
        pauseSDQueue();
        status.textContent = '⚠️ 图片已生成，但自动保存失败；当前图已保留，请手动保存后继续队列。';
        if (historySaveButton) { historySaveButton.disabled = false; historySaveButton.textContent = '💾 保存到历史'; }
        flash('队列已暂停：' + (saveError.message || '本地存储失败'));
      });
    }
  }).catch(function(error){
    console.error('[SD API] 生成失败:', error);
    document.getElementById('stepResult').classList.remove('has-image');
    var quickBanner = document.getElementById('quickCreateBanner');
    var recovery = renderSDRecovery(error);
    status.textContent = recovery.kind === 'cancelled' ? '已停止生成' : '❌ ' + recovery.title + '：' + recovery.message;
    if (quickBanner && !quickBanner.hidden) showQuickCreateStatus(recovery.kind === 'cancelled' ? '已停止生成；最近成功参数没有被覆盖。' : recovery.title + '；已保留 Prompt 和最近成功参数。', true);
    if (progress) progress.hidden = true;
  }).finally(function(){ finishSDGeneration(generation); });
}

function saveGeneratedImage(){
  if(!_sdLastDataUrl) return;
  var button = document.getElementById('sdHistorySaveBtn');
  if (button && button.disabled) return;
  if (button) { button.disabled = true; button.textContent = '保存中…'; }
  fetch(_sdLastDataUrl).then(function(r){ return r.blob(); }).then(function(blob){
    return AICGImageStore.put(blob);
  }).then(function(imageId){
    var rating = {face:0,expression:0,composition:0,hands:0,atmosphere:0};
    return saveHistoryWithRating(rating, false, '', '', imageId, true);
  }).then(function(){
    flash('💾 图片已保存到历史');
    if (button) button.textContent = '✓ 已保存';
  }).catch(function(e){
    if (button) { button.disabled = false; button.textContent = '保存到历史'; }
    flash('保存失败: ' + e.message);
  });
}
function downloadGeneratedImage(){
  if(!_sdLastDataUrl) return;
  var a = document.createElement('a');
  a.href = _sdLastDataUrl;
  a.download = 'aics_' + state.char + '_' + Date.now() + '.png';
  a.click();
  flash('⬇ 已开始下载');
}

function togglePrompt() {
  const btn = document.getElementById('promptCollapseBtn');
  const body = document.getElementById('promptBody');
  btn.classList.toggle('open'); body.classList.toggle('open');
}
function toggleLivePrompt() {
  const btn = document.querySelector('.preview-card .prompt-collapse-btn');
  const body = document.getElementById('livePreviewBody');
  const arrow = document.getElementById('liveArrow');
  btn.classList.toggle('open'); body.classList.toggle('open');
  if (arrow) arrow.style.transform = body.classList.contains('open') ? 'rotate(90deg)' : '';
}
function resetDirector() {
  state.story = ''; state.__sceneId = null; state.selections = { emotion:[], shot:null, lighting:null, composition:null }; state.colorMood = null; state.manualTags = new Set();
  document.getElementById('storyInput').value = '';
  document.getElementById('stepResult').classList.remove('has-image');
  document.getElementById('sdResultArea').style.display = 'none';
  document.getElementById('sdImageSlot').textContent = '';
  document.querySelectorAll('#chip-emotion .chip-select.selected,#opt-shot .option.selected,#opt-lighting .option.selected,#opt-composition .option.selected,#moodGrid .mood-card.selected').forEach(o => o.classList.remove('selected'));
  goStep(1);
  renderDirectorModeSummary();
  dismissFirstSuccessTip();
  document.body.setAttribute('data-first-creation', 'idle');
  renderRecentSceneShortcuts();
  refreshVoiceText(true);
  updateLivePreview(); updateGuideBar();
  var stage=document.querySelector('.stage-placeholder');if(stage)stage.scrollIntoView({behavior:'smooth',block:'center'});
  flash('已重置，可以开始下一张');
}

