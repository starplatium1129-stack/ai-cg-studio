/* Prompt Builder module: shared state and data loading.
 * This file intentionally uses classic script globals for inline HTML handlers.
 */

// ========== GLOBAL STATE (declared before all functions to avoid TDZ) ==========
var DATA_READY = false;
var CHARACTER = [];
var TRAITS = {};
var LORA_ID = {};
var SCENES = [];
var PRESETS = [];
var MODEL_PROFILES = [];
var LORA_META = [];
var ACTIVE_MODEL_PROFILE = null;
var SCENE_THEME = 'all';
var SCENE_LIBRARY_MODE = localStorage.getItem('aics_scene_library_mode') === 'all' ? 'all' : 'curated';
var TAGS = {};
var TAG_CN = {};
var CURRENT_STEP = 1;
var SCENE_FILTER_TIMER = null;
var BUILDER_SCENE_LIMIT = 30;
var _maturePreference = localStorage.getItem('aics_show_mature');
var _localOwner = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
var SHOW_MATURE_SCENES = _maturePreference == null ? _localOwner : _maturePreference === '1';
var CURATION_DATA = { curatedSceneIds:[], signatureSceneIds:[], reviewSceneIds:[], recommendationReasons:{}, searchAliases:{} };
var PERSONAL_PROFILE = AICSceneUX.buildPreferenceProfile([]);
var DRAFT_KEY = 'aics_pb_last_draft';
var DRAFT_SAVE_TIMER = null;
var DRAFT_RESTORING = false;
var QUICK_CREATE_BUSY = false;
var SCENE_THEME_DEFS = [
  { id:'all', label:'全部', icon:'✦', categories:[] },
  { id:'romance', label:'恋爱', icon:'♡', categories:['恋爱'] },
  { id:'daily', label:'日常', icon:'☕', categories:['日常'] },
  { id:'intimate', label:'亲密', icon:'🌙', categories:['亲密','R15'] },
  { id:'school', label:'校园', icon:'🎓', categories:['校园'] },
  { id:'travel', label:'旅行', icon:'🧳', categories:['旅行'] },
  { id:'festival', label:'节日', icon:'🎐', categories:['祭典・节日'] },
  { id:'story', label:'剧情', icon:'🎬', categories:['战斗','Active Sync'] },
  { id:'fanwork', label:'同人', icon:'✧', categories:['同人'] }
];
var _cachedHistory = [];
var _cachedProjects = [];
var toastTimer;
var HIS_KEY = 'aics_pb_history';
var PRJ_KEY = 'aics_projects';
var HIS_SCHEMA_VERSION = 4;
var NEGATIVE = 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, extra arms, extra legs, deformed, cropped, duplicate';
var state = {
  story: '',
  char: 'nene',
  selections: { emotion:[], shot:null, lighting:null, composition:null },
  colorMood: null,
  manualTags: new Set(),
  storyIntent: { tags:[], matched:[] },
  concise: false,
  history: []
};

function loadData(){
  function initStorage(){
    return AICKVStore.init().then(function(){
      return Promise.all([AICKVStore.get(HIS_KEY), AICKVStore.get(PRJ_KEY)]);
    }).then(function(vals){
      var histRaw = vals[0], prjRaw = vals[1];
      // localStorage → IndexedDB 一次性迁移
      if(!histRaw){
        try{var ls=JSON.parse(localStorage.getItem(HIS_KEY));if(Array.isArray(ls)&&ls.length){histRaw=ls;AICKVStore.set(HIS_KEY,ls);localStorage.removeItem(HIS_KEY);}}catch(e){}
      }
      if(!prjRaw){
        try{var lp=JSON.parse(localStorage.getItem(PRJ_KEY));if(Array.isArray(lp)&&lp.length){prjRaw=lp;AICKVStore.set(PRJ_KEY,lp);localStorage.removeItem(PRJ_KEY);}}catch(e){}
      }
      var raw = Array.isArray(histRaw) ? histRaw : [];
      var res = migrateHistory(raw);
      _cachedHistory = res.list;
      state.history = res.list;
      PERSONAL_PROFILE = AICSceneUX.buildPreferenceProfile(res.list);
      _cachedProjects = Array.isArray(prjRaw) ? prjRaw : [];
      if(res.changed) AICKVStore.set(HIS_KEY, res.list);
    }).catch(function(e){console.warn('storage init fail, fallback to memory',e);});
  }
  return Promise.all([
    initStorage(),
    fetch('../data/scenes.json?v=9').then(r=>r.json()).then(d=>SCENES=d).catch(e=>{console.warn('scenes load fail',e);}),
    fetch('../data/curation.json?v=3').then(r=>r.json()).then(d=>CURATION_DATA=d||CURATION_DATA).catch(e=>{console.warn('curation load fail',e);}),
    fetch('../data/characters.json?v=6').then(r=>r.json()).then(d=>CHARACTER=d).catch(e=>{console.warn('characters load fail',e);}),
    fetch('../data/loras.json?v=2').then(r=>r.json()).then(d=>LORA_META=Array.isArray(d)?d:[]).catch(e=>{console.warn('loras load fail',e);}),
    fetch('../data/presets.json?v=2').then(r=>r.json()).then(d=>{
      PRESETS = Array.isArray(d) ? d : (Array.isArray(d.presets) ? d.presets : []);
      MODEL_PROFILES = Array.isArray(d && d.model_profiles) ? d.model_profiles : [];
    }).catch(e=>{console.warn('presets load fail',e);}),
    fetch('../data/tags.json').then(r=>r.json()).then(d=>{
      TAGS = { clothes:[], pose:[], expression:[], scene_env:[], lighting_tag:[], details:[], camera:[] };
      TAG_CN = {};
      const clsMap = { Clothing:'clothes', Action:'pose', Emotion:'expression', Scene:'scene_env', Lighting:'lighting_tag', Camera:'camera', Appearance:'details' };
      d.forEach(t=>{
        TAG_CN[t.en] = t.cn || TAG_CN[t.en] || '';
        const grp = clsMap[t.cat];
        if (grp && TAGS[grp]) TAGS[grp].push({t:t.en, c:t.cn});
      });
    }).catch(e=>{console.warn('tags load fail',e);})
  ]).then(()=>{
    DATA_READY = true;
    initPresetSelect();
    const grid = document.getElementById('sceneGrid');
    if (grid && SCENES.length === 0) { grid.innerHTML = '<div class="empty-state">⚠️ 数据加载失败，请通过 localhost 访问，不要直接打开本地文件。</div>'; }
    try { init(); } catch(e){ console.error('init error', e); }
  }).catch(e=>console.error('loadData error', e));
}
function buildTraits(){
  TRAITS = {};
  LORA_ID = {};
  (CHARACTER||[]).forEach(c=>{
    // derive the short key state.char uses (nene / natsume) from lora name prefix
    var key = c.id;
    if (c.lora && c.lora.name){ var parts = c.lora.name.split('_'); key = parts[parts.length-2] || parts[0] || c.id; }
    // fallback: match known names
    if (/ayachi/i.test(c.lora ? c.lora.name : '') || /ayachi/i.test(c.id)) key = 'nene';
    if (/shiki/i.test(c.lora ? c.lora.name : '') || /shiki/i.test(c.id)) key = 'natsume';
    if (c.traits) TRAITS[key] = c.traits.map(t=> ({tag:t.tag, label:t.label, icon: t.icon||'✨'}));
    if (c.lora) LORA_ID[key] = c.lora.name + ':' + c.lora.weight;
  });
  // triad 组合：合并双角色 LoRA，traits 为空
  if (LORA_ID.nene && LORA_ID.natsume) LORA_ID.triad = LORA_ID.nene + ', ' + LORA_ID.natsume;
  if (!TRAITS.triad) TRAITS.triad = [];
}

// ========== DATA ==========

const EMOTION = [
  { id:'happy',   icon:'😊', name:'开心', en:'Happy' },
  { id:'shy',     icon:'🙈', name:'害羞', en:'Shy' },
  { id:'miss',    icon:'🥺', name:'思念', en:'Missing' },
  { id:'expect',  icon:'✨', name:'期待', en:'Expectant' },
  { id:'nervous', icon:'😅', name:'紧张', en:'Nervous' },
  { id:'gentle',  icon:'🤗', name:'温柔', en:'Gentle' },
  { id:'moved',   icon:'😢', name:'感动', en:'Moved' },
  { id:'sad',     icon:'😞', name:'失落', en:'Sad' },
  { id:'calm',    icon:'🍃', name:'平静', en:'Calm' },
  { id:'joyful',  icon:'🥰', name:'幸福', en:'Joyful' },
  { id:'relaxed', icon:'😌', name:'放松', en:'Relaxed' },
  { id:'serious', icon:'😤', name:'认真', en:'Serious' },
  { id:'love',    icon:'💗', name:'恋爱', en:'In Love' },
  { id:'sleepy',  icon:'😴', name:'困倦', en:'Sleepy' },
  { id:'spoiled', icon:'🍭', name:'撒娇', en:'Spoiled' },
  { id:'wronged', icon:'😢', name:'委屈', en:'Wronged' }
];
const EMOTION_REASON = {
  happy:'笑容/开朗/日常', shy:'初次见面/暗恋/羞怯', miss:'远距离/等待/深夜',
  expect:'等待/渴望/期盼', nervous:'第一次/告白/重要时刻', gentle:'陪伴/倾听/治愈',
  moved:'被理解/被安慰/眼泪', sad:'雨天/离别/回忆', calm:'独自/安静/阅读',
  joyful:'幸福/被爱/礼物', relaxed:'休息/私人时间/无压力', serious:'面对/决断/告白',
  love:'对视/牵手/心跳', sleepy:'睡前/刚起床/慵懒', spoiled:'撒娇/被宠/俏皮',
  wronged:'被误解/委屈/想哭'
};
const SHOT = [
  { id:'close',  icon:'🔍', name:'近景特写', en:'Close-up' },
  { id:'medium', icon:'👤', name:'半身中景', en:'Medium Shot' },
  { id:'wide',   icon:'🌄', name:'全身远景', en:'Wide Shot' },
  { id:'pov',    icon:'👁', name:'第一人称', en:'POV' },
  { id:'low',    icon:'⬆', name:'仰视', en:'Low Angle' },
  { id:'high',   icon:'⬇', name:'俯视', en:'High Angle' },
  { id:'side',   icon:'↔', name:'侧面', en:'Side View' },
  { id:'turn',   icon:'↩', name:'回头', en:'Turn Back' },
  { id:'over',   icon:'🤳', name:'自拍', en:'Selfie' },
  { id:'detail', icon:'🔬', name:'局部', en:'Detail' }
];
const SHOT_REASON = {
  close:'表情/内心/亲密', medium:'上半身/对话/自然', wide:'环境/全身/氛围',
  pov:'沉浸/第一视角/对面', low:'仰望/力量/高大', high:'俯瞰/可爱/脆弱',
  side:'剪影/侧颜/神秘', turn:'回眸/转身/离别', over:'亲切/日常/俏皮',
  detail:'手部/眼神/小动作'
};
const SHOT_PROMPT = {
  close:'close_up', medium:'medium_shot', wide:'wide_shot',
  pov:'pov', low:'low_angle', high:'high_angle',
  side:'side_view', turn:'looking_back', over:'selfie', detail:'close_up_detail'
};
const LIGHTING = [
  { id:'golden',   icon:'🌅', name:'夕阳 Golden Hour', en:'Golden Hour' },
  { id:'window',   icon:'🪟', name:'窗光 Window Light', en:'Window Light' },
  { id:'back',     icon:'🌄', name:'逆光 Backlight', en:'Backlight' },
  { id:'moon',     icon:'🌙', name:'月光 Moonlight', en:'Moonlight' },
  { id:'lantern',  icon:'🏮', name:'夜灯 Lantern', en:'Lantern' },
  { id:'overcast', icon:'☁️', name:'阴天柔光 Overcast', en:'Overcast' }
];
const LIGHTING_REASON = {
  golden:'放学/黄昏/温馨/回忆', window:'室内/安静/治愈/独处',
  back:'神秘/回忆/感动/剪影', moon:'夜晚/孤独/宁静/思念',
  lantern:'夜祭/温馨/安全感/传统', overcast:'平静/文艺/清新/日常'
};
const LIGHTING_PROMPT = {
  golden:'golden hour', window:'window light',
  back:'backlit', moon:'moonlight',
  lantern:'lantern light', overcast:'overcast'
};
const COMPOSITION = [
  { id:'center',     icon:'🎯', name:'居中', en:'Center' },
  { id:'rule3',      icon:'⊞', name:'三分法', en:'Rule of Thirds' },
  { id:'left',       icon:'⬅', name:'左构图', en:'Left' },
  { id:'right',      icon:'➡', name:'右构图', en:'Right' },
  { id:'foreground', icon:'🌿', name:'前景遮挡', en:'Foreground' },
  { id:'frame',      icon:'🪟', name:'框架构图', en:'Frame' },
  { id:'bywindow',   icon:'🏔', name:'窗边', en:'By Window' }
];
const COMPOSITION_PROMPT = {
  center:'centered composition', rule3:'rule of thirds',
  left:'left composition', right:'right composition',
  foreground:'foreground framing', frame:'framed composition',
  bywindow:'by window'
};

const COLOR_MOODS = [
  { id:'joy',     icon:'☀️', name:'快乐', en:'Joy',     colors:['#FFE082','#FFD54F','#FFB300','#FF8F00','#FFF8E1'], desc:'暖黄/浅橙/明亮', prompt:'warm yellow tones' },
  { id:'love',    icon:'💕', name:'恋爱', en:'Love',    colors:['#F8BBD0','#F06292','#EC407A','#AD1457','#FFF0F5'], desc:'夕阳/粉色/暖光', prompt:'pink tone, warm light' },
  { id:'calm',    icon:'🍃', name:'平静', en:'Calm',    colors:['#C8E6C9','#81C784','#4CAF50','#2E7D32','#F1F8E9'], desc:'淡绿/青绿/奶白', prompt:'soft green tones, window light' },
  { id:'sad',     icon:'🌧', name:'忧伤', en:'Sad',     colors:['#BBDEFB','#64B5F6','#1E88E5','#0D47A1','#E3F2FD'], desc:'蓝色/灰蓝/冷调', prompt:'blue tones, cool palette' },
  { id:'tension', icon:'🌙', name:'神秘', en:'Mystery', colors:['#E1BEE7','#BA68C8','#8E24AA','#4A148C','#F3E5F5'], desc:'紫蓝/深紫/冷调', prompt:'purple and blue tones' },
  { id:'warmth',  icon:'🏮', name:'温馨', en:'Warmth',  colors:['#FFE0B2','#FFB74D','#F57C00','#E65100','#FFF3E0'], desc:'暖橙/橘红/米黄', prompt:'warm orange tones, candlelight' }
];
const MOOD_EMOTION_MAP = { joy:['happy','joyful','relaxed'], love:['love','shy','expect'], calm:['calm','gentle','relaxed'], sad:['sad','miss','wronged'], tension:['nervous','serious','calm'], warmth:['gentle','moved','joyful'] };

const PROMPT_MAP = {
  emotion: {
    happy:'bright_smile', shy:'shy, blushing', miss:'longing_look', expect:'expectant, bright_eyes',
    nervous:'nervous, blushing', gentle:'gentle_expression', moved:'teary_eyes', sad:'sad',
    calm:'calm', joyful:'in_love, blush', relaxed:'relaxed', serious:'serious',
    love:'in_love, blush', sleepy:'sleepy', spoiled:'pouting', wronged:'teary_eyes, pout'
  },
  character: {
    nene:'1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, hair_ribbon',
    natsume:'1girl, solo, shiki_natsume, black_hair, long_hair, yellow_eyes, mole_under_eye, hairclip',
    // 双人 DNA 由 Prompt Policy 写入各自 BREAK 分区，避免发色/瞳色串到另一人。
    triad:'2girls'
  }
};

const BANNED_TAGS = ['neon','glowing','oversaturated','vivid_colors','vivid','rainbow','high_contrast','harsh_lighting','extremely_detailed','ultra_detailed'];
const RECOMMENDED_TAGS = [
  'golden_hour','window_light','soft_shadows','cinematic_composition','depth_of_field',
  'hair_blowing','beautiful_detailed_eyes','warm_atmosphere','soft_colors','pastel_tones',
  'muted_tones','harmonious_colors','warm_lighting','soft_lighting'
];


