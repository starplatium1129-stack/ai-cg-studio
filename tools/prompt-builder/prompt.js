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
function renderCatTabs() {
  const el = document.getElementById('catTabs'); el.innerHTML = '';
  Object.keys(TAGS).forEach(cat => {
    const b = document.createElement('div');
    b.className = 'cat-tab' + (cat === currentCat ? ' active' : '');
    b.innerHTML = CAT_LABELS[cat] + ' <small style="opacity:0.5;font-size:0.65rem;">' + cat + '</small>';
    b.onclick = () => { currentCat = cat; renderManualTags(); applyStorySuggestions(); };
    el.appendChild(b);
  });
}
// 故事联想:中文关键词 → 匹配 tag 高亮推荐(不强制勾选,用户一眼看到相关 tag)
const STORY_KEYWORD_TAGS = {
  '海边':'beach','沙滩':'beach','海浪':'beach','海边':'beach','大海':'beach','海滨':'beach',
  '神社':'shrine','巫女':'shrine','祭典':'shrine','祭典':'summer_festival','夏日祭':'summer_festival','烟花':'summer_festival','花火':'summer_festival','浴衣':'yukata',
  '咖啡馆':'cafe','咖啡':'cafe','拿铁':'cafe','窗边':'window_light','窗':'window_light','窗户':'window_light','阳光':'window_light',
  '公园':'park','树下':'park','樱花':'cherry_blossoms','花瓣':'petals','飘落':'petals',
  '教室':'classroom','学校':'classroom','校服':'school_uniform','上学':'school_uniform',
  '图书馆':'library','读书':'library','书店':'library',
  '天台':'school_rooftop','屋顶':'school_rooftop','楼顶':'school_rooftop',
  '车站':'train_station','火车站':'train_station','月台':'train_station',
  '卧室':'bedroom','房间':'bedroom','床上':'bedroom','睡衣':'pajamas',
  '日落':'sunset','黄昏':'sunset','傍晚':'sunset','夕阳':'sunset','晚霞':'sunset',
  '夜晚':'night','夜':'night','晚上':'night','月亮':'moonlight','月光':'moonlight','月色':'moonlight','中秋':'moonlight',
  '烛光':'candlelight','蜡烛':'candlelight','烛':'candlelight',
  '雪':'snow','下雪':'snow','雪花':'snow','冬天':'snow','冬':'snow',
  '雨':'rain','下雨':'rain','雨伞':'rain','撑伞':'rain',
  '回头看':'looking_back','回眸':'looking_back','回头':'looking_back','转身':'looking_back',
  '微笑':'smile','笑':'smile','大笑':'laughing','哈哈':'laughing',
  '脸红':'blush','害羞':'shy','羞':'shy',
  '哭泣':'crying','哭':'crying','眼泪':'tear','流泪':'tear','泪':'tear',
  '生气':'angry','怒':'angry','愤怒':'angry',
  '惊讶':'surprised','吃惊':'surprised','吓':'surprised',
  '闭眼':'closed_eyes','眠':'sleepy','睡':'sleepy','睡觉':'sleepy','打盹':'sleepy',
  '和服':'kimono','韩服':'hanbok','旗袍':'china_dress','女仆':'maid','围裙':'apron',
  '泳装':'swimsuit','游泳':'swimsuit','海边泳':'swimsuit',
  '卧':'lying','躺':'lying','坐':'sitting','站':'standing','走':'walking','跑':'running','跳':'jumping'
};
function suggestTagsFromStory() {
  const s = (state.story || '').toLowerCase();
  if (!s.trim()) { flash('📖 请先写一句话故事'); return; }
  const matched = new Set();
  Object.keys(STORY_KEYWORD_TAGS).forEach(kw => { if (s.includes(kw)) matched.add(STORY_KEYWORD_TAGS[kw]); });
  if (!matched.size) { flash('💡 没有匹配到关键词，可以试试：海边、黄昏、樱花、神社或教室。'); return; }
  let added = 0;
  matched.forEach(tag => { if (!state.manualTags.has(tag)) { state.manualTags.add(tag); added++; } });
  state._storySuggestions = matched;
  renderManualTags(); renderTraits(); renderSelRow(); updateLivePreview();
  flash('📖 故事匹配:从故事添加 ' + added + ' 个 tag' + (added<matched.length?('(部分已存在)'):''));
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
    const chip = document.createElement('span');
    chip.className = 'tag-chip ' + cls + (state.manualTags.has(tagKey) ? ' active' : '');
    chip.dataset.tag = tagKey;
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
    chip.innerHTML = `<span>${tagLabel(tag)}</span><span class="x">×</span>`;
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
  return String(scene.prompt)
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
  var wide = state.selections.shot === 'wide' || state.manualTags.has('full_body') || state.manualTags.has('wide_shot');
  var portrait = state.selections.shot === 'close' || state.selections.shot === 'detail';
  return refs.map(function(ref){
    var meta = loraMetaByName(ref.name);
    var recommended = meta && meta.recommended_weight ? meta.recommended_weight : {};
    var base = meta && meta.strength && Number(meta.strength.default);
    if (!Number.isFinite(base)) base = Number.isFinite(ref.explicit) ? ref.explicit : 0.8;
    var weight = dual ? 0.62 : complex ? (Number(recommended.complex_scene) || 0.7) : wide ? (Number(recommended.fullbody) || 0.75) : portrait ? (Number(recommended.portrait) || 0.85) : base;
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

function dedupePromptParts(parts) {
  var seen = new Set();
  return parts.map(function(part){
    var scope = part.cls === 'n' ? 'neg:' : 'pos:';
    var tokens = part.text.split(',').map(function(token){ return token.trim(); }).filter(Boolean).filter(function(token){
      var key = scope + token.toLowerCase().replace(/[\s\/]+/g, '_');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { cls:part.cls, text:tokens.join(', ') };
  }).filter(function(part){ return part.text.length > 0; });
}

// ========== PROMPT BUILD ==========
function buildParts() {
  const quality = document.getElementById('quality').checked;
  const neg = document.getElementById('negative').checked;
  const tail = document.getElementById('tail').checked;
  const sel = state.selections;
  const char = state.char;
  const parts = [];
  const activeScene = SCENES.find(sc => sc.id === state.__sceneId);
  const sceneTemplate = sceneTemplateText(activeScene);
  const sceneNegative = mergeTokenText(currentModelNegativePrefix(), activeScene && activeScene.negative ? activeScene.negative : NEGATIVE);
  const charLine = PROMPT_MAP.character[char];
  const traitTags = (TRAITS[char] || []).filter(t => state.manualTags.has(t.tag)).map(t => t.tag);
  const loraSpecs = resolveLoraSpecs(char, activeScene);
  if (quality) parts.push({ cls:'q', text:currentQualityPrefix(activeScene) });
  parts.push({ cls:'c', text: norm(traitTags.length ? charLine + ', ' + traitTags.join(', ') : charLine) });
  if (sceneTemplate && !state.concise) parts.push({ cls:'t', text: sceneTemplate });
  // 精简模式:只保留 quality + character(+traits) + top5 manualTags + LoRA + neg,砍掉中间 5 模块
  if (state.concise) {
    if (state.manualTags.size) {
      const top = Array.from(state.manualTags).slice(0, 5);
      parts.push({ cls:'t', text: norm(top.join(', ')) });
    }
    loraSpecs.forEach(function(spec){ parts.push({ cls:'l', text:'<lora:' + loraSpecText(spec) + '>' }); });
    if (neg) parts.push({ cls:'n', text:'[NEG] ' + sceneNegative });
    return dedupePromptParts(parts);
  }
  if (state.colorMood) {
    const m = COLOR_MOODS.find(x => x.id === state.colorMood);
    if (m) parts.push({ cls:'t', text: norm(m.prompt) });
  }
  if (sel.emotion.length) parts.push({ cls:'t', text: norm(sel.emotion.map(e => PROMPT_MAP.emotion[e]).join(', ')) });
  if (sel.shot) parts.push({ cls:'t', text: norm(SHOT_PROMPT[sel.shot] || '') });
  if (sel.lighting) parts.push({ cls:'c', text: norm(LIGHTING_PROMPT[sel.lighting] || '') });
  if (sel.composition) parts.push({ cls:'t', text: norm(COMPOSITION_PROMPT[sel.composition] || '') });
  if (state.manualTags.size) {
    const templateLower = String(sceneTemplate||'').toLowerCase();
    const manual = Array.from(state.manualTags).filter(t => !templateLower.includes(String(t).toLowerCase()));
    if (manual.length) parts.push({ cls:'t', text: norm(manual.join(', ')) });
  }
  // 智能 tail:按镜头/场景决定附加,避免 POV+looking_at_viewer 矛盾 / 夜景+cinematic_lighting 违和
  if (tail && !state.concise) {
    const sceneTags = state.manualTags;
    const isPov = sel.shot === 'pov' || sceneTags.has('pov');
    const isNight = sceneTags.has('night') || sceneTags.has('night') || sel.lighting === 'moonlight' || sel.lighting === 'night_lamp' || sel.lighting === 'neon';
    const tailToks = ['depth_of_field'].filter(t => {
      if (t === 'looking_at_viewer' && isPov) return false;
      return true;
    });
    if (tailToks.length) parts.push({ cls:'c', text: norm(tailToks.join(', ')) });
  }
  loraSpecs.forEach(function(spec){ parts.push({ cls:'l', text:'<lora:' + loraSpecText(spec) + '>' }); });
  if (neg) parts.push({ cls:'n', text:'[NEG] ' + sceneNegative });
  return dedupePromptParts(parts);
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

  // Active Sync Protocol: 实时替换占位符
  const currentScene = SCENES.find(sc => sc.id === state.__sceneId);
  if (currentScene && currentScene.category === 'Active_Sync_Scenes' && typeof ActiveSyncProtocol !== 'undefined') {
    const syncParams = ActiveSyncProtocol.interpret(state.story || '');
    parts.forEach(p => { p.text = ActiveSyncProtocol.applyProtocol(p.text, syncParams); });
  }

  document.getElementById('preview').innerHTML = colorizeParts(parts);
  document.getElementById('preview').dataset.raw = parts.map(p => p.text).join('\n');
  var finalPrompt = document.getElementById('finalPrompt');
  if (finalPrompt && document.body.classList.contains('step-4') && finalPrompt.style.display !== 'none') {
    finalPrompt.innerHTML = colorizeParts(parts);
  }
  // token 计数 + 进度条 (SD1.5 CLIP 窗口 ~77)
  const tokCount = parts.reduce((n,p)=> n + p.text.split(',').filter(t=>t.trim()).length, 0);
  const pct = Math.min(100, Math.round(tokCount/77*100));
  const lvl = tokCount > 77 ? 'over' : tokCount > 60 ? 'warn' : 'ok';
  ['liveTokCount','resultTokCount'].forEach(id=>{
    const el = document.getElementById(id); if(!el) return;
    el.className = 'token-counter ' + lvl;
    el.querySelector('.num').textContent = tokCount;
    el.querySelector('.bar > i').style.width = pct + '%';
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
  if (!state.__sceneId && !state.story.trim()) { flash('⚠️ 请先写一句故事，或选一张场景卡'); document.getElementById('storyInput')?.focus(); return; }
  const s = state.selections;
  window.__lastSeed__ = Math.floor(Math.random() * 999999999);
  const charName = CHARACTER.find(c => c.id === state.char)?.name || state.char;
  const resultEl = document.getElementById('stepResult');
  const parts = buildParts();
  let fullText = parts.map(p => p.text).join(', ');

  // Active Sync Protocol: 替换 Active_Sync_Scenes 中的占位符
  const currentScene = SCENES.find(sc => sc.id === state.__sceneId);
  if (currentScene && currentScene.category === 'Active_Sync_Scenes' && typeof ActiveSyncProtocol !== 'undefined') {
    const syncParams = ActiveSyncProtocol.interpret(state.story || '');
    fullText = ActiveSyncProtocol.applyProtocol(fullText, syncParams);
    // 更新 parts 中的文本以便 colorize 正确显示
    parts.forEach(p => { p.text = ActiveSyncProtocol.applyProtocol(p.text, syncParams); });
  }

  const violations = checkArtDirection(fullText);
  const artWarn = document.getElementById('artWarn');
  artWarn.style.display = violations.length ? 'flex' : 'none';
  artWarn.textContent = violations.length ? '⚠️ 检测到 '+violations.length+' 个标签违反美术规范: '+violations.join(', ') : '';
  document.getElementById('finalPrompt').innerHTML = colorizeParts(parts);
  document.getElementById('finalPrompt').style.display = 'block';
  goStep(4);
  if (typeof finishFirstCreation === 'function') finishFirstCreation();
  refreshVoiceText(false);
  if(resultEl) resultEl.scrollIntoView({ behavior:'smooth', block:'start' });
  flash('✨ Prompt 已生成');
}

