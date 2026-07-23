/* ============================================================
   Prompt Builder: SD WebUI 模块
   功能：与 Stable Diffusion WebUI API 通信，处理图片生成
   依赖：SDWebUIConnector (sd-api.js)
   ============================================================ */

// ====== SD WebUI API 连接 ======
var _sdConnector = null;        // API 连接器实例
var _sdLastDataUrl = '';        // 最后生成的图片 base64
var _sdLastResult = null;       // 最后一次生成的完整结果
var _sdCapabilities = null;     // SD WebUI 能力（扩展、模型等）
var _sdGeneration = null;       // 当前生成任务
var _sdUserPreferredSize = '832×1216';  // 用户偏好的分辨率
var _sdApplyingScenePreset = false;     // 是否正在应用场景预设
var SD_SETTINGS_KEY = 'aics_sd_settings_v1';  // localStorage key

function getSDConnector(){
  if(!_sdConnector) _sdConnector = new SDWebUIConnector();
  return _sdConnector;
}

/**
 * 双人场景增强配置
 * 当 character === 'triad' 时启用：
 * - Regional Prompter（注意力模式，1:1 比例）
 * - ControlNet OpenPose 骨架图
 * - ADetailer 面部修复（仅全身/远景）
 *
 * @param {string} character - 角色类型，'triad' 时启用双人模式
 * @param {object} scene - 场景数据，需要 dual_pose_verified 标签
 * @returns {object|null} 双人增强配置，或 null（非双人场景）
 */
function resolveDualEnhancement(character, scene){
  if (character !== 'triad') return null;
  var extensions = _sdCapabilities && _sdCapabilities.extensions || {};
  var controlModels = Array.isArray(extensions.controlModels) ? extensions.controlModels : [];
  var adModels = Array.isArray(extensions.adModels) ? extensions.adModels : [];
  var controlModel = controlModels.find(function(name){
    return /xinsir.*openpose.*sdxl/i.test(String(name || ''));
  }) || controlModels.find(function(name){
    return /openpose.*sdxl/i.test(String(name || ''));
  }) || '';
  var tags = scene && Array.isArray(scene.tags) ? scene.tags.map(function(tag){ return String(tag).toLowerCase(); }) : [];
  var distantFaces = tags.indexOf('wide_shot') !== -1 || tags.indexOf('full_body') !== -1;
  var hasVerifiedPose = tags.indexOf('dual_pose_verified') !== -1;
  return {
    regional:!!extensions.regionalPrompter,
    ratios:'1,1',
    baseRatio:'0.3',
    // Latent mode can isolate LoRAs more strongly, but the current reForge
    // build becomes unstable when it is combined with ControlNet/ADetailer.
    // Attention mode is the verified production path on this machine.
    generationMode:'Attention',
    controlModel:extensions.controlNet ? controlModel : '',
    controlImageUrl:hasVerifiedPose && scene && scene.id ? '/assets/dual-poses/' + scene.id + '.png' : '',
    controlWeight:0.65,
    controlEnd:0.72,
    resizeMode:'Resize and Fill',
    // Close-up faces from the character LoRAs are already strong. Restrict
    // low-denoise ADetailer to distant two-person compositions.
    adetailer:!!extensions.adetailer && distantFaces && adModels.indexOf('face_yolov8s.pt') !== -1,
    adModel:'face_yolov8s.pt'
  };
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

function sceneRecommendedSize(scene){
  var value = scene && scene.recommendedSize ? String(scene.recommendedSize).trim() : '';
  return /^\d{3,4}×\d{3,4}$/.test(value) ? value : '';
}

function applySceneGenerationPreset(scene){
  var select = document.getElementById('size');
  var hint = document.getElementById('sceneSizeHint');
  if (!select) return '';
  var recommended = sceneRecommendedSize(scene);
  _sdApplyingScenePreset = true;
  if (recommended) {
    ensureSelectValue('size', recommended);
    select.dataset.scenePreset = '1';
    if (hint) {
      hint.hidden = false;
      hint.textContent = '场景推荐 · ' + recommended + ' 横版';
    }
  } else {
    if (select.dataset.scenePreset === '1') ensureSelectValue('size', _sdUserPreferredSize || '832×1216');
    delete select.dataset.scenePreset;
    if (hint) { hint.hidden = true; hint.textContent = ''; }
  }
  _sdApplyingScenePreset = false;
  updateSDBudgetHint();
  return recommended;
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

function sceneRatingKey(scene){
  var rating = String(scene && scene.rating || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (rating === 'R18' || (scene && scene.mature)) return 'r18';
  if (rating === 'R15') return 'r15';
  return 'all';
}

function profileRatingTag(profile, scene){
  if (!profile) return '';
  var rating = sceneRatingKey(scene);
  if (rating === 'r18') return profile.rating_r18 != null ? profile.rating_r18 : (profile.rating_mature || '');
  // R15 is deliberately not treated as `safe`: that tag can fight the
  // suggestive-but-non-explicit direction of these scenes.
  if (rating === 'r15') return profile.rating_r15 || '';
  return profile.rating_all != null ? profile.rating_all : (profile.rating_safe || '');
}

function resolveCurrentModelProfile(modelName){
  var candidate = modelName == null ? effectiveModelName() : String(modelName || '');
  var matched = findModelProfile(candidate);
  if (matched) return matched;
  // 离线且没有任何模型信息时，使用本站角色 LoRA 的默认训练底模。
  // 一旦 WebUI 明确返回了未知模型，则尊重“保留自定义参数”的提示，
  // 不再把旧的 ACTIVE_MODEL_PROFILE 或首个 profile 偷渡进生成参数。
  if (!normalizeModelName(candidate)) return ACTIVE_MODEL_PROFILE || (MODEL_PROFILES && MODEL_PROFILES[0]) || null;
  return null;
}

function currentQualityPrefix(scene){
  // 本站角色 LoRA 以 WAI/Illustrious 训练；离线或尚未识别模型时使用首个
  // profile，而不是退回一组与项目无关的通用 SDXL 词。
  var profile = resolveCurrentModelProfile();
  var prefix = profile && profile.quality_prefix ? profile.quality_prefix : 'masterpiece, best_quality, very_aesthetic, absurdres';
  var rating = profileRatingTag(profile, scene);
  if (rating) prefix = mergeTokenText(prefix, rating);
  return prefix;
}

// With only `scene`, this remains backwards-compatible and returns the model
// prefix. Passing a base negative prompt also applies the profile's merge mode,
// which lets prompt.js opt into `negative_mode: "replace"` without duplicating
// profile logic.
function currentModelNegativePrefix(scene, baseNegative){
  var profile = resolveCurrentModelProfile();
  var prefix = profile && profile.negative_prefix ? profile.negative_prefix : '';
  if (arguments.length < 2) return prefix;
  if (profile && typeof AICPromptPolicy !== 'undefined' && AICPromptPolicy.mergeNegativePrompt) {
    return AICPromptPolicy.mergeNegativePrompt(
      prefix,
      baseNegative || '',
      profile.negative_mode,
      profile.negative_replace_scope
    );
  }
  // The policy module normally owns selective replacement. If it is missing,
  // retain the base prompt instead of risking loss of scene safety/semantics.
  return mergeTokenText(prefix, baseNegative || '');
}

function currentHiresProfileSettings(modelName){
  var profile = resolveCurrentModelProfile(modelName);
  var hires = profile && profile.hires && typeof profile.hires === 'object' ? profile.hires : {};
  function firstValue(primary, nested){ return primary != null ? primary : nested; }
  function finiteNumber(value){
    var parsed = Number(value);
    return value !== '' && value != null && Number.isFinite(parsed) ? parsed : null;
  }
  if (!profile) return { steps:null, denoisingStrength:null, scale:null, upscaler:'' };
  return {
    steps:finiteNumber(firstValue(profile.hires_steps, hires.steps)),
    denoisingStrength:finiteNumber(firstValue(
      profile.hires_denoising_strength != null ? profile.hires_denoising_strength : profile.denoising_strength,
      hires.denoising_strength != null ? hires.denoising_strength : hires.denoise
    )),
    scale:finiteNumber(firstValue(profile.hires_scale, hires.scale)),
    upscaler:String(firstValue(profile.hires_upscaler, hires.upscaler) || '')
  };
}

function setSelectValueInsensitive(id, value){
  var select = document.getElementById(id);
  if (!select) return false;
  var wanted = String(value == null ? '' : value);
  var match = Array.from(select.options).find(function(option){ return option.value.toLowerCase() === wanted.toLowerCase(); });
  if (match) {
    select.value = match.value;
    return true;
  }
  // Once capabilities are known, never append an option that the backend did
  // not advertise. Before connection, saved/local values remain supported.
  if (_sdCapabilities && ['sdModel','sampler','scheduler','sdHiresUpscaler'].indexOf(id) !== -1) return false;
  ensureSelectValue(id, wanted);
  return true;
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
  if (hint) {
    var incompatibleLora = (LORA_META || []).some(function(meta){
      if (!meta || !(meta.compatible_models || []).length) return false;
      return !(meta.compatible_models || []).some(function(candidate){ return normalizeModelName(modelName).indexOf(normalizeModelName(candidate)) !== -1; });
    });
    hint.textContent = '已匹配 ' + profile.name + ' · ' + profile.sampler + ' · ' + profile.steps + ' steps · CFG ' + profile.cfg +
      (incompatibleLora ? ' · 当前角色 LoRA 未标注兼容此底模' : '');
  }
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
  if (profile.size) {
    setSelectValueInsensitive('size', profile.size);
    var profiledSize = document.getElementById('size');
    if (profiledSize && profiledSize.value) _sdUserPreferredSize = profiledSize.value;
  }
  var hiresProfile = currentHiresProfileSettings(modelName);
  if (hiresProfile.scale != null) setSelectValueInsensitive('sdHiresScale', hiresProfile.scale);
  if (hiresProfile.upscaler) setSelectValueInsensitive('sdHiresUpscaler', hiresProfile.upscaler);
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
    // A scene may temporarily switch the canvas to 16:9. Keep the user's
    // normal default separate so the next ordinary scene does not inherit it.
    size: _sdUserPreferredSize || (document.getElementById('size') ? document.getElementById('size').value : ''),
    quality: !!(document.getElementById('quality') && document.getElementById('quality').checked),
    tail: !!(document.getElementById('tail') && document.getElementById('tail').checked),
    negative: !!(document.getElementById('negative') && document.getElementById('negative').checked),
    profileModel: normalizeModelName(effectiveModelName()),
    profileId: ACTIVE_MODEL_PROFILE ? ACTIVE_MODEL_PROFILE.id : ''
  };
  try { localStorage.setItem(SD_SETTINGS_KEY, JSON.stringify(settings)); } catch(e) {}
  updateSDBudgetHint();
}

function currentSDBudget(){
  var sizeValue = document.getElementById('size') ? document.getElementById('size').value : '832×1216';
  var size = String(sizeValue).replace('×','x').split('x').map(Number);
  var hires = !!(document.getElementById('sdHiresFix') && document.getElementById('sdHiresFix').checked);
  var scale = hires && document.getElementById('sdHiresScale') ? (Number(document.getElementById('sdHiresScale').value) || 1.5) : 1;
  var width = Math.round((size[0] || 832) * scale);
  var height = Math.round((size[1] || 1216) * scale);
  var megapixels = width * height / 1000000;
  return { width:width, height:height, megapixels:megapixels, hires:hires, scale:scale };
}

function updateSDBudgetHint(){
  var hint = document.getElementById('sdBudgetHint');
  if (!hint) return;
  var budget = currentSDBudget();
  var level = budget.megapixels > 6 ? 'danger' : (budget.megapixels > 3.2 ? 'warn' : 'ok');
  var aspect = typeof AICPromptPolicy !== 'undefined'
    ? AICPromptPolicy.recommendAspect(Array.from(state.manualTags || []), state.char)
    : '';
  var sizeValue = document.getElementById('size') ? document.getElementById('size').value : '';
  var portrait = /^\d+×\d+$/.test(sizeValue) && Number(sizeValue.split('×')[0]) < Number(sizeValue.split('×')[1]);
  var aspectTip = aspect === 'landscape' && portrait ? ' · 当前是远景/双人，横图通常更稳' : '';
  hint.className = 'sd-budget-hint' + (level === 'ok' ? '' : ' ' + level);
  hint.textContent = '最终 ' + budget.width + '×' + budget.height + ' · ' + budget.megapixels.toFixed(1) + ' MP' +
    (level === 'danger' ? ' · 显存风险高，建议降尺寸或关闭 hires.fix' : (level === 'warn' ? ' · 需要较多显存' : ' · 显存负担适中')) + aspectTip;
  return budget;
}

function initSDSettings(){
  var settings = readSDSettings();
  var hasSavedSettings = Object.keys(settings).length > 0;
  if (settings.checkpoint) ensureSelectValue('sdModel', settings.checkpoint);
  if (settings.sampler) ensureSelectValue('sampler', settings.sampler);
  if (settings.scheduler != null) ensureSelectValue('scheduler', settings.scheduler);
  if (settings.hiresUpscaler) ensureSelectValue('sdHiresUpscaler', settings.hiresUpscaler);
  if (settings.hiresScale) ensureSelectValue('sdHiresScale', settings.hiresScale);
  if (settings.cfg) ensureSelectValue('cfg', settings.cfg);
  if (settings.steps) ensureSelectValue('steps', settings.steps);
  if (settings.size) ensureSelectValue('size', settings.size);
  var sizeSelect = document.getElementById('size');
  _sdUserPreferredSize = sizeSelect && sizeSelect.value ? sizeSelect.value : '832×1216';
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
    if (element) element.addEventListener('change', function(){
      if (id === 'size' && !_sdApplyingScenePreset) {
        _sdUserPreferredSize = element.value || '832×1216';
        delete element.dataset.scenePreset;
        var hint = document.getElementById('sceneSizeHint');
        if (hint) { hint.hidden = true; hint.textContent = ''; }
      }
      saveSDSettings();
    });
  });
  var model = document.getElementById('sdModel');
  if (model) model.addEventListener('change', function(){ applyModelProfile(effectiveModelName(), true); });
  if (!hasSavedSettings && MODEL_PROFILES && MODEL_PROFILES[0]) {
    var defaultProfileName = (MODEL_PROFILES[0].match || [MODEL_PROFILES[0].name])[0];
    applyModelProfile(defaultProfileName, true);
  }
  updateSDBudgetHint();
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
    if (!wanted) return true;
    if (!items) return true;
    if (!items.length) return false;
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
    var activeScene = SCENES.find(function(item){ return item.id === state.__sceneId; });
    if (activeScene) applySceneGenerationPreset(activeScene);
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
  if (!select) return;
  // Keep a local fallback only when the backend could not provide this
  // capability at all. Selects with an explicit placeholder (notably the
  // scheduler) are reset so stale, unsupported options cannot leak through.
  if (!items.length && !placeholder) return;
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
  // `currentModelChoice` may have been a saved checkpoint that disappeared.
  // Profile the value that survived capability replacement, or the WebUI's
  // actual current model when the placeholder is selected.
  var selectedModel = modelSelect && modelSelect.value ? modelSelect.value : capabilities.currentModel;
  applyModelProfile(selectedModel, false);
}

function capabilityNames(items, fields){
  return (Array.isArray(items) ? items : []).map(function(item){
    if (typeof item === 'string') return item;
    for (var index = 0; index < fields.length; index += 1) {
      if (item && item[fields[index]]) return String(item[fields[index]]);
    }
    return '';
  }).filter(Boolean);
}

function availableName(names, wanted){
  var target = String(wanted || '').toLowerCase();
  if (!target) return '';
  return names.find(function(name){ return String(name).toLowerCase() === target; }) || '';
}

function resolveSDSamplingSelection(sampler, scheduler){
  var desiredSampler = String(sampler || '');
  var desiredScheduler = String(scheduler || '');
  if (!_sdCapabilities) return { sampler:desiredSampler, scheduler:desiredScheduler };
  var samplers = capabilityNames(_sdCapabilities.samplers, ['name','label']);
  var schedulers = capabilityNames(_sdCapabilities.schedulers, ['name','label']);

  // Older WebUI variants expose scheduler-specific samplers instead of a
  // scheduler endpoint. Use that form only when the combined name was
  // explicitly advertised; never manufacture an unsupported sampler name.
  if (!schedulers.length && desiredScheduler && samplers.length) {
    var combined = availableName(samplers, desiredSampler + ' ' + desiredScheduler);
    if (combined) return { sampler:combined, scheduler:'' };
  }

  var resolvedSampler = availableName(samplers, desiredSampler);
  if (!resolvedSampler && samplers.length) {
    resolvedSampler = availableName(samplers, 'Euler a') || samplers[0];
  }
  if (!resolvedSampler) resolvedSampler = desiredSampler;
  return {
    sampler:resolvedSampler,
    scheduler:schedulers.length ? availableName(schedulers, desiredScheduler) : ''
  };
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
    // 768×1344 is slightly *more* pixels than the common 832×1216 preset.
    // Use a genuinely low-memory canvas for OOM recovery.
    ensureSelectValue('size', '640×960');
    var hires = document.getElementById('sdHiresFix'); if (hires) hires.checked = false;
    saveSDSettings(); updateLivePreview(); flash('已切换到 640×960 并关闭 hires.fix，正在重试');
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
  if (_sdGeneration) return Promise.resolve({ status:'failure', reason:'busy' });
  var queuedJob = requestOptions.job || null;
  var prompt = queuedJob ? queuedJob.prompt : getPlainPrompt();
  if (!prompt) {
    flash('⚠️ 请先生成 Prompt');
    return Promise.resolve({ status:'failure', reason:'empty_prompt' });
  }
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
  var samplerChoice = queuedJob ? queuedJob.sampler : (document.getElementById('sampler').value || 'DPM++ 2M');
  var schedulerChoice = queuedJob ? queuedJob.scheduler : (document.getElementById('scheduler').value || '');
  var sampling = resolveSDSamplingSelection(samplerChoice, schedulerChoice);
  var sampler = sampling.sampler || samplerChoice || 'DPM++ 2M';
  var scheduler = sampling.scheduler;
  var selectedSampler = sampler;
  var selectedScheduler = scheduler;
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
  if (lora && _sdCapabilities && Array.isArray(_sdCapabilities.loras) && _sdCapabilities.loras.length) {
    var installedLoras = _sdCapabilities.loras.map(function(item){ return normalizeModelName(item && (item.name || item.alias || item.path)); }).filter(Boolean);
    var missingLoras = String(lora).split(',').map(function(spec){ return spec.trim().replace(/^<lora:/i,'').replace(/>$/,'').split(':')[0]; }).filter(function(name){
      var wanted = normalizeModelName(name);
      return wanted && !installedLoras.some(function(installed){ return installed === wanted || installed.indexOf(wanted) !== -1; });
    });
    if (missingLoras.length) flash('⚠️ SD WebUI 未检测到 LoRA：' + missingLoras.join('、') + '；仍会尝试生成');
  }
  prompt = prompt.replace(/<lora:[^>]+>/g, '').replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
  var hiresEnabled = queuedJob ? !!queuedJob.hiresFix : document.getElementById('sdHiresFix').checked;
  var generationModel = queuedJob ? queuedJob.checkpoint : effectiveModelName();
  var hiresProfile = currentHiresProfileSettings(generationModel);
  var hiresScale = queuedJob
    ? (Number(queuedJob.hiresScale) || 1.5)
    : (Number(document.getElementById('sdHiresScale').value) || hiresProfile.scale || 1.5);
  var hiresUpscaler = queuedJob
    ? (queuedJob.hiresUpscaler || hiresProfile.upscaler || 'Latent')
    : (document.getElementById('sdHiresUpscaler').value || hiresProfile.upscaler || 'Latent');
  var hiresSteps = queuedJob && queuedJob.hiresSteps != null
    ? Number(queuedJob.hiresSteps)
    : (hiresProfile.steps != null ? hiresProfile.steps : 14);
  var denoisingStrength = queuedJob && queuedJob.denoisingStrength != null
    ? Number(queuedJob.denoisingStrength)
    : (hiresProfile.denoisingStrength != null ? hiresProfile.denoisingStrength : 0.35);
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
    dualEnhancement: resolveDualEnhancement(currentCharacter, currentScene),
    checkpoint: queuedJob ? queuedJob.checkpoint : (document.getElementById('sdModel').value || ''),
    enableHires: hiresEnabled,
    hiresUpscaler: hiresUpscaler,
    hiresSteps: Number.isFinite(hiresSteps) ? hiresSteps : 14,
    denoisingStrength: Number.isFinite(denoisingStrength) ? denoisingStrength : 0.35,
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
    hiresUpscaler: hiresUpscaler,
    hiresScale: hiresScale
  };
  var dualLabels = [];
  if (options.dualEnhancement) {
    if (options.dualEnhancement.regional) dualLabels.push('角色分区');
    if (options.dualEnhancement.controlModel && options.dualEnhancement.controlImageUrl) dualLabels.push('姿势约束');
    if (options.dualEnhancement.adetailer) dualLabels.push('双脸精修');
  }
  if (dualLabels.length) status.textContent = '⏳ 双人构图增强（' + dualLabels.join('＋') + '）已提交…';

  return getSDConnector().generateImage(prompt, queuedJob ? queuedJob.negative : getPlainNegative(), options).then(function(result){
    if (_sdGeneration !== generation || generation.cancelled) {
      status.textContent = '已停止生成';
      if (progress) progress.hidden = true;
      clearSDRecovery();
      return { status:'cancelled' };
    }
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
    var enhancementLabels = result.enhancements
      ? [result.enhancements.regional ? '角色分区' : '', result.enhancements.controlNet ? '姿势约束' : '', result.enhancements.adetailer ? '双脸精修' : ''].filter(Boolean)
      : [];
    status.textContent = '✅ 生成完成 · ' + elapsed + ' 秒' +
      (enhancementLabels.length ? ' · ' + enhancementLabels.join('＋') : '') +
      (hiresEnabled ? ' · hires.fix ' + hiresScale + 'x' : '');
    document.getElementById('stepResult').classList.add('has-image');
    var image = document.createElement('img');
    image.src = result.image;
    image.alt = 'Stable Diffusion 生成图片';
    slot.replaceChildren(image);
    saveActions.style.display = 'flex';
    if (typeof finishFirstCreation === 'function') {
      try { finishFirstCreation(); }
      catch (firstCreationError) { console.warn('first creation state update failed', firstCreationError); }
    }
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
        return { status:'success', result:result };
      }).catch(function(saveError){
        console.error('queue result save failed', saveError);
        pauseSDQueue();
        status.textContent = '⚠️ 图片已生成，但自动保存失败；当前图已保留，请手动保存后继续队列。';
        if (historySaveButton) { historySaveButton.disabled = false; historySaveButton.textContent = '💾 保存到历史'; }
        flash('队列已暂停：' + (saveError.message || '本地存储失败'));
        return { status:'failure', reason:'save_failed', error:saveError, result:result };
      });
    }
    return { status:'success', result:result };
  }).catch(function(error){
    console.error('[SD API] 生成失败:', error);
    document.getElementById('stepResult').classList.remove('has-image');
    var quickBanner = document.getElementById('quickCreateBanner');
    var recovery = renderSDRecovery(error);
    status.textContent = recovery.kind === 'cancelled' ? '已停止生成' : '❌ ' + recovery.title + '：' + recovery.message;
    if (quickBanner && !quickBanner.hidden) showQuickCreateStatus(recovery.kind === 'cancelled' ? '已停止生成；最近成功参数没有被覆盖。' : recovery.title + '；已保留 Prompt 和最近成功参数。', true);
    if (progress) progress.hidden = true;
    return { status:recovery.kind === 'cancelled' || generation.cancelled ? 'cancelled' : 'failure', error:error, recovery:recovery };
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
  if (typeof clearSceneContext === 'function') clearSceneContext({ keepStory:false, silent:true });
  else {
    state.story = ''; state.__sceneId = null; state.__sceneBaseStory = ''; state.selections = { emotion:[], shot:null, lighting:null, composition:null }; state.colorMood = null; state.manualTags = new Set();
    document.getElementById('storyInput').value = '';
  }
  try { if (typeof DRAFT_KEY !== 'undefined') localStorage.removeItem(DRAFT_KEY); } catch(e) {}
  document.getElementById('stepResult').classList.remove('has-image');
  document.getElementById('sdResultArea').style.display = 'none';
  document.getElementById('sdImageSlot').textContent = '';
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

