/* Prompt Builder module: manual tags and prompt composition.
 * This file intentionally uses classic script globals for inline HTML handlers.
 */

const CAT_LABELS = { clothes:'服装', pose:'姿势', expression:'表情', scene_env:'场景', lighting_tag:'光照', details:'外观', camera:'镜头', weather:'天气' };

// ========== MANUAL TAGS ==========
var currentCat = 'clothes';
function renderManualTags() {
  renderTagPool('tagPoolRecommended', RECOMMENDED_TAGS, 'recommended');
  renderCatTabs();
  renderTagPool('tagPool', (TAGS[currentCat] || []), '');
  renderTagPool('tagPoolBanned', BANNED_TAGS, 'banned');
  applyStorySuggestions();
}
function applyStorySuggestions() {
  if (!state._storySuggestions) return;
  document.querySelectorAll('#tagPool .tag-chip, #tagPoolRecommended .tag-chip').forEach(c => {
    c.setAttribute('data-suggested', state._storySuggestions.has(c.dataset.tag) ? '1' : '0');
  });
}

function inferStoryIntent(story) {
  return typeof AICPromptPolicy !== 'undefined'
    ? AICPromptPolicy.inferStory(story || '')
    : { tags:[], matched:[] };
}

function updateStoryIntent(showFeedback) {
  var intent = inferStoryIntent(state.story);
  state.storyIntent = intent;
  state._storySuggestions = new Set(intent.tags);
  var hint = document.getElementById('storyPromptHint');
  if (hint) {
    if (intent.tags.length) {
      hint.hidden = false;
      hint.innerHTML = '<span>已识别画面</span><strong>' + intent.tags.slice(0, 7).map(escapeHtml).join(' · ') + '</strong>';
    } else {
      hint.hidden = true;
      hint.textContent = '';
    }
  }
  applyStorySuggestions();
  if (showFeedback && !intent.tags.length) flash('💡 还没有识别到画面元素，可补充地点、时间、动作或表情。');
  return intent;
}
function renderCatTabs() {
  const el = document.getElementById('catTabs'); el.innerHTML = '';
  Object.keys(TAGS).forEach(cat => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat-tab' + (cat === currentCat ? ' active' : '');
    b.innerHTML = CAT_LABELS[cat] + ' <small style="opacity:0.5;font-size:0.65rem;">' + cat + '</small>';
    b.onclick = () => { currentCat = cat; renderManualTags(); applyStorySuggestions(); };
    el.appendChild(b);
  });
}
// 故事关键词统一由 tools/prompt-policy.js 编译，避免 UI 与校验脚本各维护一份规则。
function suggestTagsFromStory() {
  if (!(state.story || '').trim()) { flash('📖 请先写一句话故事'); return; }
  const intent = updateStoryIntent(true);
  const matched = new Set(intent.tags);
  if (!matched.size) return;
  let added = 0;
  matched.forEach(tag => { if (!state.manualTags.has(tag)) { state.manualTags.add(tag); added++; } });
  state._storySuggestions = matched;
  renderManualTags(); renderTraits(); renderSelRow(); updateLivePreview();
  flash('📖 已将 ' + added + ' 个故事元素固定到 Prompt' + (added < matched.size ? '（其余已存在）' : ''));
}
function clearStorySuggestions() {
  if (state._storySuggestions) { state._storySuggestions = null; document.querySelectorAll('.tag-chip[data-suggested]').forEach(c => c.setAttribute('data-suggested','0')); }
}
function renderTagPool(tag, items, cls) {
  const el = document.getElementById(tag); el.innerHTML = '';
  items.forEach(item => {
    const isObj = item && typeof item === 'object' && 't' in item;
    const tagKey = isObj ? item.t : item;
    const cn = isObj ? item.c : '';
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip ' + cls + (state.manualTags.has(tagKey) ? ' active' : '');
    chip.dataset.tag = tagKey;
    chip.setAttribute('aria-pressed', state.manualTags.has(tagKey) ? 'true' : 'false');
    chip.innerHTML = (cn ? cn + ' <small style="opacity:0.5;font-size:0.65rem;">' + tagKey + '</small>' : tagKey);
    chip.onclick = () => toggleTag(chip.dataset.tag);
    el.appendChild(chip);
  });
}
function toggleTag(tag) {
  if (!tag) return;
  if (state.manualTags.has(tag)) state.manualTags.delete(tag); else state.manualTags.add(tag);
  renderManualTags(); renderTraits(); renderSelRow(); updateLivePreview();
}
function tagLabel(t){ return TAG_CN[t] || t; }

function renderSelRow() {
  const row = document.getElementById('selRow'); row.innerHTML = '';
  document.getElementById('selCount').textContent = state.manualTags.size;
  Array.from(state.manualTags).forEach(tag => {
    const chip = document.createElement('span'); chip.className = 'sel-chip';
    chip.innerHTML = `<span>${tagLabel(tag)}</span><button type="button" class="x" aria-label="移除 ${escapeHtml(tagLabel(tag))}">×</button>`;
    chip.querySelector('.x').onclick = () => toggleTag(tag);
    row.appendChild(chip);
  });
}

// ========== TABS ==========
function switchTab(name, el) {
  document.querySelectorAll('.pb-tab').forEach(t => t.classList.toggle('active', t === el));
  ['director','scenes','manual'].forEach(t => { const p = document.getElementById('tab-'+t); if (p) p.classList.toggle('active', t === name); });
}

// 空格/连字符 → 下划线 规范化 (统一处理所有标签)
function norm(t){ return t.split(',').map(function(s){ return s.trim().replace(/[\s-]+/g,'_'); }).join(', '); }

function sceneTemplateText(scene) {
  if (!scene || !scene.prompt) return '';
  var sceneTags = new Set((scene.tags || []).map(function(tag){ return String(tag).toLowerCase().replace(/[\s-]+/g, '_'); }));
  var template = String(scene.prompt)
    .replace(/<lora:[^>]+>/gi, '')
    .replace(/_BREAK_/gi, ' BREAK ')
    .split(',')
    .map(function(token){ return token.trim(); })
    .filter(Boolean)
    .filter(function(token){
      var key = token.toLowerCase().replace(/[\s-]+/g, '_');
      return !sceneTags.has(key) || state.manualTags.has(key);
    })
    .join(', ');
  if (state.char === 'triad' && typeof AICPromptPolicy !== 'undefined') {
    template = AICPromptPolicy.enrichDualPrompt(
      template,
      ['ayachi_nene','white_hair','very_long_hair','low_twintails','purple_eyes','ahoge','hair_ribbon'],
      ['shiki_natsume','black_hair','long_hair','yellow_eyes','mole_under_eye','hairclip']
    );
  }
  return typeof AICPromptPolicy !== 'undefined'
    ? AICPromptPolicy.filterFraming(template, state.selections.shot)
    : template;
}

function loraMetaByName(name) {
  return (LORA_META || []).find(function(item){ return item && item.name === name; }) || null;
}

function resolveLoraSpecs(character, scene) {
  var raw = scene && scene.lora ? scene.lora : (LORA_ID[character] || '');
  var refs = String(raw).split(',').map(function(value){
    var clean = value.trim().replace(/^<lora:/i, '').replace(/>$/, '');
    var parts = clean.split(':');
    return { name:(parts[0] || '').trim(), explicit:Number(parts[1]) };
  }).filter(function(item){ return item.name; });
  var dual = character === 'triad' || refs.length > 1;
  var complex = scene && (scene.category === '战斗' || scene.category === 'Active_Sync_Scenes');
  var framingMode = typeof AICPromptPolicy !== 'undefined' && AICPromptPolicy.resolveFramingMode
    ? AICPromptPolicy.resolveFramingMode(state.selections.shot, Array.from(state.manualTags || []))
    : (state.selections.shot
      ? (state.selections.shot === 'wide' ? 'wide' : (state.selections.shot === 'close' || state.selections.shot === 'detail' ? 'close' : ''))
      : (state.manualTags.has('full_body') || state.manualTags.has('wide_shot') ? 'wide' : (state.manualTags.has('close_up') ? 'close' : '')));
  var wide = framingMode === 'wide';
  var portrait = framingMode === 'close';
  return refs.map(function(ref){
    var meta = loraMetaByName(ref.name);
    var recommended = meta && meta.recommended_weight ? meta.recommended_weight : {};
    var base = meta && meta.strength && Number(meta.strength.default);
    if (!Number.isFinite(base)) base = 0.8;
    // 场景作者显式写出的权重是已调好的结果，优先于自动镜头策略。
    var weight = Number.isFinite(ref.explicit) ? ref.explicit : (dual ? 0.62 : complex ? (Number(recommended.complex_scene) || 0.7) : wide ? (Number(recommended.fullbody) || 0.75) : portrait ? (Number(recommended.portrait) || 0.85) : base);
    return { name:ref.name, weight:Number(Number(weight).toFixed(2)) };
  });
}

function loraSpecText(spec) { return spec.name + ':' + spec.weight; }

function mergeTokenText() {
  var seen = new Set();
  var output = [];
  Array.from(arguments).forEach(function(text){
    String(text || '').split(',').map(function(token){ return token.trim(); }).filter(Boolean).forEach(function(token){
      var key = token.toLowerCase().replace(/[\s-]+/g, '_');
      if (!seen.has(key)) { seen.add(key); output.push(token); }
    });
  });
  return output.join(', ');
}

function dedupePromptParts(parts, shot) {
  if (typeof AICPromptPolicy !== 'undefined') {
    // Apply the selected framing at the final composition boundary. This covers
    // scene templates, story inference, manual tags and tail additions equally.
    parts = AICPromptPolicy.applyFraming(parts, shot);
    return AICPromptPolicy.dedupeParts(parts);
  }
  return parts;
}

// ========== PROMPT BUILD ==========
function buildParts() {
  const quality = document.getElementById('quality').checked;
  const neg = document.getElementById('negative').checked;
  const tail = document.getElementById('tail').checked;
  const sel = state.selections;
  const char = state.char;
  const parts = [];
  const activeScene = SCENES.find(sc => sc.id === state.__sceneId && (typeof AICPromptPolicy === 'undefined' || AICPromptPolicy.sceneSupportsCharacter(sc, char)));
  const sceneTemplate = sceneTemplateText(activeScene);
  const sceneNegativeBase = activeScene && activeScene.negative ? activeScene.negative : NEGATIVE;
  const negativeBase = currentModelNegativePrefix(activeScene, sceneNegativeBase);
  const sceneNegative = typeof AICPromptPolicy !== 'undefined'
    ? AICPromptPolicy.adaptNegative(negativeBase, activeScene, { shot:sel.shot, character:char })
    : negativeBase;
  const charLine = PROMPT_MAP.character[char];
  const traitTags = (TRAITS[char] || []).filter(t => state.manualTags.has(t.tag)).map(t => t.tag);
  const loraSpecs = resolveLoraSpecs(char, activeScene);
  if (quality) parts.push({ cls:'q', text:currentQualityPrefix(activeScene) });
  parts.push({ cls:'c', text: norm(traitTags.length ? charLine + ', ' + traitTags.join(', ') : charLine) });
  if (char === 'triad' && !sceneTemplate && typeof AICPromptPolicy !== 'undefined') {
    parts.push({ cls:'t', text:AICPromptPolicy.enrichDualPrompt('',
      ['ayachi_nene','white_hair','very_long_hair','low_twintails','purple_eyes','ahoge','hair_ribbon'],
      ['shiki_natsume','black_hair','long_hair','yellow_eyes','mole_under_eye','hairclip']) });
  }
  if (sceneTemplate && !state.concise) parts.push({ cls:'t', text: sceneTemplate });
  // 精简模式:只保留 quality + character(+traits) + top5 manualTags + LoRA + neg,砍掉中间 5 模块
  if (state.concise) {
    if (state.manualTags.size) {
      const top = Array.from(state.manualTags).slice(0, 5);
      parts.push({ cls:'t', text: norm(top.join(', ')) });
    }
    if (sel.shot) parts.push({ cls:'t', text: norm(SHOT_PROMPT[sel.shot] || '') });
    loraSpecs.forEach(function(spec){ parts.push({ cls:'l', text:'<lora:' + loraSpecText(spec) + '>' }); });
    if (neg) parts.push({ cls:'n', text:'[NEG] ' + sceneNegative });
    return dedupePromptParts(parts, sel.shot);
  }
  if (state.colorMood) {
    const m = COLOR_MOODS.find(x => x.id === state.colorMood);
    if (m) parts.push({ cls:'t', text: norm(m.prompt) });
  }
  if (sel.emotion.length) parts.push({ cls:'t', text: norm(sel.emotion.map(e => PROMPT_MAP.emotion[e]).join(', ')) });
  if (sel.shot) parts.push({ cls:'t', text: norm(SHOT_PROMPT[sel.shot] || '') });
  if (sel.lighting) parts.push({ cls:'c', text: norm(LIGHTING_PROMPT[sel.lighting] || '') });
  if (sel.composition) parts.push({ cls:'t', text: norm(COMPOSITION_PROMPT[sel.composition] || '') });
  const storyIntent = state.storyIntent || inferStoryIntent(state.story);
  if (!activeScene && storyIntent.tags.length) parts.push({ cls:'t', text:norm(storyIntent.tags.join(', ')) });
  if (state.manualTags.size) {
    const templateKeys = new Set(typeof AICPromptPolicy !== 'undefined'
      ? AICPromptPolicy.splitBreaks(sceneTemplate).flatMap(AICPromptPolicy.tokenize).map(AICPromptPolicy.normalizeKey)
      : []);
    const manual = Array.from(state.manualTags).filter(t => !templateKeys.has(typeof AICPromptPolicy !== 'undefined' ? AICPromptPolicy.normalizeKey(t) : String(t).toLowerCase()));
    if (manual.length) parts.push({ cls:'t', text: norm(manual.join(', ')) });
  }
  // 智能 tail:按镜头/场景决定附加,避免 POV+looking_at_viewer 矛盾 / 夜景+cinematic_lighting 违和
  if (tail && !state.concise) {
    const isWide = sel.shot ? sel.shot === 'wide' : (state.manualTags.has('wide_shot') || state.manualTags.has('full_body'));
    const tailToks = [isWide ? 'deep_focus' : 'depth_of_field'];
    if (tailToks.length) parts.push({ cls:'c', text: norm(tailToks.join(', ')) });
  }
  loraSpecs.forEach(function(spec){ parts.push({ cls:'l', text:'<lora:' + loraSpecText(spec) + '>' }); });
  if (neg) parts.push({ cls:'n', text:'[NEG] ' + sceneNegative });
  return dedupePromptParts(parts, sel.shot);
}

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function checkArtDirection(text) {
  const lower = text.toLowerCase();
  return BANNED_TAGS.filter(t => lower.includes(t.toLowerCase()) || lower.includes(t.toLowerCase().replace(/\s/g,'_')));
}
function colorizeParts(parts) {
  // 输出预览 = 纯英文 (供复制到 WebUI); 中文注释仅出现在"选之前"的选择态标签上
  return parts.map(p => {
    const tokens = p.text.split(',').map(tk => {
      const t = tk.trim(); if (!t) return '';
      const low = t.toLowerCase().replace(/[\s\/]+/g,'_');
      const isBad = BANNED_TAGS.some(b => low === b.toLowerCase() || low.includes(b.toLowerCase()));
      return isBad ? `<span class="violate">${escapeHtml(t)}</span>` : escapeHtml(t);
    }).join(', ');
    return `<span class="${p.cls}">${tokens}</span>`;
  }).join('\n');
}
function updateLivePreview() {
  const parts = buildParts();

  document.getElementById('preview').innerHTML = colorizeParts(parts);
  document.getElementById('preview').dataset.raw = parts.map(p => p.text).join('\n');
  var finalPrompt = document.getElementById('finalPrompt');
  if (finalPrompt && document.body.classList.contains('step-4') && finalPrompt.style.display !== 'none') {
    finalPrompt.innerHTML = colorizeParts(parts);
  }
  // 这是逗号标签数，不冒充具体模型 tokenizer 的 token 数。
  const report = typeof AICPromptPolicy !== 'undefined'
    ? AICPromptPolicy.analyzeParts(parts)
    : { positiveCount:0, negativeCount:0, level:'ok', label:'结构均衡', warnings:[] };
  const pct = Math.min(100, Math.round(report.positiveCount / 72 * 100));
  ['liveTokCount','resultTokCount'].forEach(id=>{
    const el = document.getElementById(id); if(!el) return;
    el.className = 'token-counter ' + report.level;
    const pos = el.querySelector('.num'); if (pos) pos.textContent = report.positiveCount;
    const neg = el.querySelector('.neg-num'); if (neg) neg.textContent = report.negativeCount;
    const health = el.querySelector('.prompt-health'); if (health) health.textContent = report.label;
    const bar = el.querySelector('.bar > i'); if (bar) bar.style.width = pct + '%';
    el.title = report.warnings.join('；') || '正向标签结构清晰；实际 CLIP token 由当前模型和 WebUI 决定。';
  });
  scheduleDraftSave();
}
// ---- Prompt 防错净化 (Danbooru 标签规范化) ----
// 已知多词 Danbooru 标签：空格 → 下划线 (按长度降序排列，避免短词先匹配)
var UNDERSCORE_TAGS = [
  'depth of field','chromatic aberration','beautiful detailed eyes',
  'volumetric lighting','natural lighting','studio lighting','neon lighting',
  'dramatic lighting','back lighting','side lighting','rim lighting','soft lighting','hard lighting',
  'extreme close up','dynamic angle','portrait shot','cowboy shot','upper body','full body',
  'medium shot','long shot','close up','wide shot','dutch angle','pov shot',
  'half closed eyes','crossed arms','outstretched arm','reaching towards viewer',
  'hands on hips','hand on chest','hand on own cheek','hand between legs',
  'arms behind back','arms up',
  'sparkling eyes','glowing eyes','detailed eyes','narrowed eyes','wide eyes',
  'open mouth','closed mouth','parted lips','pout lips','biting lip','licking lips','tongue out',
  'pink tone','warm light','soft light','lantern light',
  'loose hair','wet hair','short hair','long hair','twintails hair',
  'black dress','white dress','school uniform','off shoulder','crop top',
  'mini skirt','pleated skirt','micro skirt','denim shorts','thigh highs',
  'fishnet stockings','red ribbon','hair ribbon','hair clip','hair ornament',
  'cat ears','fox ears','bunny ears',
  'sailor collar','standing collar','open jacket','hood up',
  'elbow gloves','finger gloves','choker necklace','cross earrings',
  'puffy sleeves','detached sleeves','frilled skirt','layered skirt',
  'lace trim','ribbon trim','bow tie','neck ribbon',
  'high slit','side slit','front slit','see through','wet clothes',
  'sweat stain','sweaty body','blush marks','embarrassed face',
  'bare shoulders','skin tight',
  'looking back','looking up','looking down','squatting down','leaning forward','bent over',
  'from behind','from below','peace sign','v sign','thumbs up','waving',
  'holding cup','holding bag','holding flower','holding umbrella','holding phone','holding book',
  'sun beam','light rays','god rays','lens flare',
  'particle light','floating particles','bokeh background','blurry background',
  'film grain','motion blur',
  'on bed','on floor','on ground','on grass','on rooftop','on beach',
  'in water','in rain','in snow','under tree',
  'sitting on bed','sitting on chair','hand on cheek','lying on grass',
  'standing split','cat ears','cherry blossoms','falling petals',
  'autumn leaves','falling leaves','starry sky','full moon',
  'sunset sky','sunrise sky','blue sky','cloudy sky','dramatic sky','sunset glow'
];
var _tagRe = new RegExp('\\b(' + UNDERSCORE_TAGS.sort(function(a,b){return b.length-a.length}).map(function(t){return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s')}).join('|') + ')\\b', 'gi');

function sanitizePrompt(raw) {
  return raw
    // A1111/ReForge 分区关键字必须是独立 BREAK，不能写成 Danbooru 标签
    .replace(/_BREAK_/gi, ' BREAK ')
    // 已知多词标签 → 下划线死锁
    .replace(_tagRe, function(m){ return m.replace(/\s+/g, '_'); })
    // 统一分隔符: 分号/竖线 → 逗号
    .replace(/\s*[;|]\s*/g, ', ')
    // 重复逗号 / 首尾逗号
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .replace(/^\s*,/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPlainPrompt() {
  // 始终返回纯英文, 保留模块间换行, 供 SD 使用
  var raw = document.getElementById('preview').dataset.raw;
  if (!raw) return '';
  // 截断 [NEG] 及其后内容，负向词不混入正向 prompt
  var negIdx = raw.indexOf('[NEG]');
  var pos = negIdx >= 0 ? raw.substring(0, negIdx) : raw;
  return sanitizePrompt(pos.replace(/\n/g, ', '));
}
function getPlainNegative() {
  // 从 preview 的 raw 数据中提取 [NEG] 后面的内容作为负向 prompt
  var raw = document.getElementById('preview').dataset.raw;
  if (!raw) return '';
  var negIdx = raw.indexOf('[NEG]');
  if (negIdx < 0) return '';
  return sanitizePrompt(raw.substring(negIdx).replace('[NEG] ', '').replace(/\n/g, ', '));
}

// ====== GENERATE ======
function generate() {
  if (!state.__sceneId && !state.story.trim()) { flash('⚠️ 请先写一句故事，或选一张场景卡'); document.getElementById('storyInput')?.focus(); return false; }
  updateStoryIntent(false);
  const charName = CHARACTER.find(c => c.id === state.char)?.name || state.char;
  const resultEl = document.getElementById('stepResult');
  const parts = buildParts();
  let fullText = parts.map(p => p.text).join(', ');

  const violations = checkArtDirection(fullText);
  const artWarn = document.getElementById('artWarn');
  artWarn.style.display = violations.length ? 'flex' : 'none';
  artWarn.textContent = violations.length ? '⚠️ 检测到 '+violations.length+' 个标签违反美术规范: '+violations.join(', ') : '';
  document.getElementById('finalPrompt').innerHTML = colorizeParts(parts);
  document.getElementById('finalPrompt').style.display = 'block';
  goStep(4);
  refreshVoiceText(false);
  if(resultEl) resultEl.scrollIntoView({ behavior:'smooth', block:'start' });
  flash('✨ Prompt 已就绪；生成图片后才会记录 Seed');
  return true;
}

