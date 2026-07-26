/* ============================================================
   Scene Explorer — 独立场景探索页
   数据从 data/scenes.json 加载(与 prompt-builder.html 共享)
   ============================================================ */

let SCENES = [];
let SCENE_THEME = 'all';
let SCENE_VISIBLE = 24;
let FILTER_TIMER = null;
const SCENE_PAGE_SIZE = 24;
const MATURE_KEY = 'aics_show_mature';
const FAVORITE_KEY = 'aics_scene_favorites';
const HISTORY_KEY = 'aics_pb_history';
let CURATION_DATA = { curatedSceneIds:[], moodRails:[] };
const DEFAULT_MOOD_RAILS = [
  { character:'nene', icon:'🌙', title:'宁宁的月光秘密', subtitle:'图书馆 · 樱色 · 魔女', query:'nene library' },
  { character:'natsume', icon:'☕', title:'夏目的夜灯关心', subtitle:'咖啡馆 · 雨夜 · 琥珀', query:'natsume cafe' },
  { character:'shared', icon:'🌅', title:'夏日远行', subtitle:'海风 · 黄昏 · 纪念', query:'beach sunset' }
];
let CURATED_IDS = [];
let PERSONAL_PROFILE = AICSceneUX.buildPreferenceProfile([]);
let SCENE_FAVORITES = new Set(JSON.parse(localStorage.getItem(FAVORITE_KEY) || '[]'));
const LOCAL_OWNER = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
let SHOW_MATURE = localStorage.getItem(MATURE_KEY) == null ? LOCAL_OWNER : localStorage.getItem(MATURE_KEY) === '1';
const SCENE_THEME_DEFS = [
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

function init(){
  renderMoodRails();
  renderSceneCats();
  var initialParams = new URLSearchParams(window.location.search);
  var initialCharacter = initialParams.get('character');
  if (['nene','natsume','triad'].indexOf(initialCharacter) >= 0) {
    document.getElementById('sceneCharacter').value = initialCharacter;
  }
  var reviewOption = document.querySelector('#sceneTier option[value="review"]');
  if (reviewOption && reviewIds().length === 0) reviewOption.remove();
  var matureToggle = document.getElementById('showMature');
  matureToggle.checked = SHOW_MATURE;
  matureToggle.addEventListener('change', function(){
    if (this.checked && !SHOW_MATURE && !window.confirm('此区域包含成人向文字内容。请确认你已成年并希望继续查看。')) {
      this.checked = false;
      return;
    }
    SHOW_MATURE = this.checked;
    localStorage.setItem(MATURE_KEY, SHOW_MATURE ? '1' : '0');
    renderSceneCats(); renderScenes(true);
  });
  document.getElementById('loadMoreScenes').addEventListener('click', function(){
    SCENE_VISIBLE += SCENE_PAGE_SIZE;
    renderScenes(false);
  });
  renderScenes(true);
  document.getElementById('sceneTotal').textContent = SCENES.length + ' 个精选场景';
  document.getElementById('sceneFooterCount').textContent = '灵感场景 · ' + SCENES.length + ' 个瞬间';
  document.getElementById('matureCount').textContent = '(' + SCENES.filter(function(s){return s.mature;}).length + ')';
}

// 从共享 JSON 加载场景(file:// 因 CORS 失败,需 localhost)
function loadScenes(){
  const grid = document.getElementById('sceneGrid');
  renderMoodRails();
  // Loading 状态
  if (grid) grid.innerHTML = '<div class="sc-empty"><div class="ic" style="animation:pulse 1.5s infinite">⏳</div><p>正在加载灵感场景…</p></div>';
  Promise.all([
    fetch('../data/scenes.json?v=9').then(r => { if (!r.ok) throw new Error('Scenes HTTP ' + r.status); return r.json(); }),
    fetch('../data/curation.json?v=3').then(r => { if (!r.ok) throw new Error('Curation HTTP ' + r.status); return r.json(); }).catch(function(){ return { curatedSceneIds:[], moodRails:[] }; }),
    loadPreferenceProfile()
  ])
    .then(function(result){
      SCENES = result[0];
      if (!Array.isArray(SCENES) || SCENES.length === 0) throw new Error('场景数据为空');
      CURATION_DATA = result[1] || CURATION_DATA;
      PERSONAL_PROFILE = result[2] || PERSONAL_PROFILE;
      CURATED_IDS = Array.isArray(CURATION_DATA.curatedSceneIds) ? CURATION_DATA.curatedSceneIds : [];
      init();
      var qp = new URLSearchParams(window.location.search);
      var focusId = qp.get('scene');
      var pendingScene = localStorage.getItem('aics_pending_scene');
      if (focusId && pendingScene){
        try { var s = JSON.parse(pendingScene); if (s.id === focusId) { showDetail(s.id); } } catch(e){}
        localStorage.removeItem('aics_pending_scene');
      } else if (focusId) {
        // 无 pending 时: 滚动到目标卡 + 高亮 2s
        setTimeout(function(){ scrollToScene(focusId); }, 100);
      }
    })
    .catch(function(err){
      if (grid) grid.innerHTML = '<div class="sc-empty"><div class="ic">⚠️</div><p>场景数据加载失败。<br>请通过 <code>localhost</code> 访问(不要用 file:// 直接打开)。<br><small>' + esc(err.message) + '</small></p></div>';
    });
}

function loadPreferenceProfile(){
  function fallback(){
    try { return AICSceneUX.buildPreferenceProfile(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')); }
    catch(e) { return AICSceneUX.buildPreferenceProfile([]); }
  }
  if (!window.AICKVStore) return Promise.resolve(fallback());
  return AICKVStore.init().then(function(){ return AICKVStore.get(HISTORY_KEY); })
    .then(function(history){ return Array.isArray(history) ? AICSceneUX.buildPreferenceProfile(history) : fallback(); })
    .catch(function(){ return fallback(); });
}
loadScenes();

function renderMoodRails(){
  var host = document.getElementById('moodRails');
  if (!host) return;
  host.innerHTML = '';
  var rails = Array.isArray(CURATION_DATA.moodRails) && CURATION_DATA.moodRails.length
    ? CURATION_DATA.moodRails
    : DEFAULT_MOOD_RAILS;
  rails.forEach(function(rail){
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'mood-rail' + (rail.character === 'nene' || rail.character === 'natsume' ? ' ' + rail.character : '');
    var icon = document.createElement('span');
    icon.className = 'mood-icon'; icon.textContent = rail.icon || '✦';
    var title = document.createElement('strong'); title.textContent = rail.title || '未命名灵感';
    var subtitle = document.createElement('small'); subtitle.textContent = rail.subtitle || '';
    button.append(icon, title, subtitle);
    button.addEventListener('click', function(){ applyMoodRail(rail.query || ''); });
    host.appendChild(button);
  });
}

function renderSceneCats(){
  var el = document.getElementById('sceneCats'); el.innerHTML = '';
  var available = SCENES.filter(function(scene){ return SHOW_MATURE || !scene.mature; });
  SCENE_THEME_DEFS.forEach(function(def){
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.sceneTheme = def.id;
    b.className = 'scene-cat' + (def.id === SCENE_THEME ? ' active' : '');
    var count = available.filter(function(scene){ return matchesTheme(scene, def.id); }).length;
    b.textContent = def.icon + ' ' + def.label + ' ' + count;
    b.setAttribute('aria-pressed', def.id === SCENE_THEME ? 'true' : 'false');
    b.onclick = function(){ SCENE_THEME = def.id; renderSceneCats(); renderScenes(true); };
    el.appendChild(b);
  });
}

function primaryCategory(scene){
  var category = scene.category || '其他';
  if (category === 'Active_Sync_Scenes') return 'Active Sync';
  return category.split('/')[0];
}
function themeDef(id){ return SCENE_THEME_DEFS.find(function(def){ return def.id === id; }) || SCENE_THEME_DEFS[0]; }
function matchesTheme(scene, themeId){ return themeId === 'all' || themeDef(themeId).categories.indexOf(primaryCategory(scene)) >= 0; }
function matchesSeries(scene, series){
  var category = scene.category || '';
  if (series === 'after') return /After_Story/i.test(category);
  if (series === 'fanwork') return /同人/.test(category);
  if (series === 'active') return category === 'Active_Sync_Scenes';
  return true;
}
function sceneCharacterName(scene){
  if (scene.char === 'nene' || scene.char === 'ayachi_nene') return '宁宁';
  if (scene.char === 'natsume' || scene.char === 'shiki_natsume') return '夏目';
  if (scene.char === 'triad') return '双人';
  return scene.char || '';
}
function sceneTimeName(value){ return ({morning:'清晨',afternoon:'午后',sunset:'黄昏',night:'夜晚',late_night:'深夜',dawn:'黎明',evening:'夜晚',all_day:'全天'})[value] || value || ''; }
function matchesTime(scene, value){
  if (value === 'all') return true;
  if (value === 'night') return ['night','late_night','evening'].indexOf(scene.timeOfDay) >= 0;
  return scene.timeOfDay === value;
}
function signatureIds(){ return Array.isArray(CURATION_DATA.signatureSceneIds) ? CURATION_DATA.signatureSceneIds : []; }
function reviewIds(){ return Array.isArray(CURATION_DATA.reviewSceneIds) ? CURATION_DATA.reviewSceneIds : []; }
function sceneTier(scene){ return AICSceneUX.tier(scene, CURATION_DATA); }
function tierLabel(tier){ return ({signature:'招牌',curated:'精选',standard:'普通',review:'待返工'})[tier] || '普通'; }
function matchesSemanticQuery(scene, query){
  return AICSceneUX.matchesSearch(scene, query, CURATION_DATA, [primaryCategory(scene), sceneTimeName(scene.timeOfDay)]);
}
function renderSearchIntent(query){
  var host = document.getElementById('sceneSearchIntent'); if (!host) return;
  var analysis = AICSceneUX.analyzeQuery(query, CURATION_DATA);
  var tier = document.getElementById('sceneTier');
  var expanded = query && tier && tier.value === 'featured' ? '已自动扩展至完整场景库。' : '';
  var understood = analysis.intents.length ? '已理解为：<strong>' + analysis.intents.map(escHtml).join(' · ') + '</strong>。' : (query ? '正在搜索标题、故事、情绪、地点和视觉标签。' : '可以直接描述想画的完整句子。');
  var personal = PERSONAL_PROFILE.entries ? ' 已结合本机 ' + PERSONAL_PROFILE.entries + ' 条创作记录排序。' : ' 完成作品评分后，推荐会逐渐贴近你的偏好。';
  host.innerHTML = expanded + understood + personal;
}
function curationScore(scene){
  var fixed = CURATED_IDS.indexOf(scene.id);
  if (signatureIds().indexOf(scene.id) >= 0) return 20000 - signatureIds().indexOf(scene.id);
  if (fixed >= 0) return 10000 - fixed;
  var complete = [scene.story,scene.emotion,scene.camera,scene.lighting,scene.location].filter(Boolean).length;
  return complete * 100 + Math.min((scene.story || '').length, 500) + (scene.rating === 'All' ? 20 : 0);
}
function filteredScenes(){
  var q = (document.getElementById('sceneSearch').value || '').trim().toLowerCase();
  var character = document.getElementById('sceneCharacter').value;
  var season = document.getElementById('sceneSeason').value;
  var time = document.getElementById('sceneTime').value;
  var series = document.getElementById('sceneSeries').value;
  var rating = document.getElementById('sceneRating').value;
  var tier = document.getElementById('sceneTier').value;
  var sort = document.getElementById('sceneSort').value;
  var results = SCENES.filter(function(s){
    if (!SHOW_MATURE && s.mature) return false;
    if (!matchesTheme(s, SCENE_THEME)) return false;
    if (!matchesSeries(s, series)) return false;
    if (character !== 'all' && s.char !== character) return false;
    if (season !== 'all' && s.season !== season) return false;
    if (!matchesTime(s, time)) return false;
    if (rating !== 'all' && (s.rating || (s.mature ? 'R18' : 'All')) !== rating) return false;
    var currentTier = sceneTier(s);
    if (!q && tier === 'featured' && currentTier !== 'signature' && currentTier !== 'curated') return false;
    if (tier !== 'all' && tier !== 'featured' && currentTier !== tier) return false;
    if (sort === 'favorite' && !SCENE_FAVORITES.has(s.id) && !AICSceneUX.isPersonalFavorite(s, PERSONAL_PROFILE)) return false;
    return matchesSemanticQuery(s, q);
  });
  return results.sort(function(a,b){
    if (q) {
      var relevance = AICSceneUX.searchScore(b, q, CURATION_DATA, [primaryCategory(b), sceneTimeName(b.timeOfDay)]) - AICSceneUX.searchScore(a, q, CURATION_DATA, [primaryCategory(a), sceneTimeName(a.timeOfDay)]);
      if (relevance) return relevance;
    }
    if (sort === 'newest') return String(b.id).localeCompare(String(a.id), undefined, {numeric:true});
    if (sort === 'title') return String(a.title).localeCompare(String(b.title), 'zh-CN');
    if (sort === 'favorite') return AICSceneUX.personalScore(b, PERSONAL_PROFILE) - AICSceneUX.personalScore(a, PERSONAL_PROFILE) || String(a.title).localeCompare(String(b.title), 'zh-CN');
    if (sort === 'smart') return (AICSceneUX.personalScore(b, PERSONAL_PROFILE) * 500 + curationScore(b)) - (AICSceneUX.personalScore(a, PERSONAL_PROFILE) * 500 + curationScore(a));
    return curationScore(b) - curationScore(a);
  });
}

function toggleSceneFavorite(id, event){
  if (event) { event.preventDefault(); event.stopPropagation(); }
  if (SCENE_FAVORITES.has(id)) SCENE_FAVORITES.delete(id); else SCENE_FAVORITES.add(id);
  localStorage.setItem(FAVORITE_KEY, JSON.stringify(Array.from(SCENE_FAVORITES)));
  renderScenes(false);
}
function applyMoodRail(query){
  var input = document.getElementById('sceneSearch');
  input.value = query; SCENE_THEME = 'all'; renderSceneCats(); renderScenes(true);
  input.scrollIntoView({behavior:'smooth', block:'center'}); input.focus();
}

function renderScenes(reset){
  if (reset) SCENE_VISIBLE = SCENE_PAGE_SIZE;
  var grid = document.getElementById('sceneGrid'); grid.innerHTML = '';
  var matches = filteredScenes();
  var query = (document.getElementById('sceneSearch').value || '').trim().toLowerCase();
  renderSearchIntent(query);
  matches.slice(0, SCENE_VISIBLE).forEach(function(s){
    var seasonMap = {'春':'🌸','夏':'☀️','秋':'🍂','冬':'❄️'};
    var season = s.season ? (seasonMap[s.season]||'') + s.season : '';
    var todMap = {morning:'清晨',afternoon:'午后',sunset:'黄昏',night:'夜晚',late_night:'深夜',dawn:'黎明',evening:'夜晚',all_day:'全天'};
    var tod = s.timeOfDay ? (todMap[s.timeOfDay]||s.timeOfDay) : '';
    var charName = sceneCharacterName(s);
    var decision = decisionPreview(s);
    grid.appendChild(createSceneCard(s, {
      mode: 'grid',
      clickable: false,
      suppressTags: true,
      dataAttrs: { sceneId: s.id },
      onPick: function(){ openDirector(s.id); },
      bandExtra: function(scene){
        var tier = sceneTier(scene);
        return (tier === 'signature' || tier === 'curated')
          ? '<span class="sc-tier ' + tier + '">' + tierLabel(tier) + '</span>'
          : '';
      },
      beforeActions: function(scene){
        var reason = AICSceneUX.personalReason(scene, PERSONAL_PROFILE) || (CURATION_DATA.recommendationReasons || {})[scene.id] || '';
        // 审核流程说明不是场景亮点,不占用卡片篇幅
        if (/实机生成与直接视觉复核/.test(reason)) reason = '';
        // 默认只露:角色·情绪·时间 + 一句亮点 + 主按钮。
        // 镜头/光线/色调 与次要操作收到 .ex-more,悬停/聚焦时展开 —— 五层压三层。
        return '' +
          '<div class="ex-scene-line">' +
            '<span><strong>' + escHtml(charName) + '</strong></span>' +
            '<span>' + escHtml(scene.emotion||'情绪待定') + '</span>' +
            '<span>' + escHtml([season,tod].filter(Boolean).join(' · ')||'时间不限') + '</span>' +
          '</div>' +
          (reason ? '<div class="ex-curation"><span>' + escHtml(reason) + '</span></div>' : '') +
          '<div class="ex-actions">' +
            '<a class="btn btn-primary" href="prompt-builder.html?scene=' + encodeURIComponent(scene.id) + '">✦ 开始绘制</a>' +
          '</div>' +
          '<div class="ex-more">' +
            '<div class="ex-decision" title="开始绘制后仍可继续调整">' +
              '<span>镜头 <strong>' + escHtml(decision.shot) + '</strong></span>' +
              '<span>光线 <strong>' + escHtml(decision.lighting) + '</strong></span>' +
              '<span>色调 <strong>' + escHtml(decision.color) + '</strong></span>' +
            '</div>' +
            '<div class="ex-secondary">' +
              '<a class="btn btn-ghost btn-sm" href="' + AICQuickCreate.url(scene.id) + '">⚡ 直接出图</a>' +
              '<button class="btn btn-ghost btn-sm" data-detail="' + scene.id + '" type="button" aria-label="查看故事">📖 故事</button>' +
              '<button type="button" class="btn btn-ghost btn-sm scene-fav' + (SCENE_FAVORITES.has(scene.id) ? ' saved' : '') + '" data-action="toggle-favorite" data-id="' + scene.id + '">' + (SCENE_FAVORITES.has(scene.id) ? '♥ 已收' : '♡ 收藏') + '</button>' +
            '</div>' +
          '</div>';
      }
    }));
    grid.lastChild.setAttribute('data-scene-id', s.id);
  });
  if (!grid.children.length) { grid.innerHTML = '<div class="sc-empty"><div class="ic">🌸</div><p>没有匹配的场景。<br>试试切到其他分类或清除搜索。</p></div>'; }
  var shown = Math.min(SCENE_VISIBLE, matches.length);
  document.getElementById('sceneCount').innerHTML = '显示 <strong>' + shown + '</strong> / ' + matches.length + ' 个场景';
  var load = document.getElementById('sceneLoad');
  load.hidden = shown >= matches.length;
  document.getElementById('loadMoreScenes').textContent = '加载更多（剩余 ' + Math.max(0, matches.length - shown) + '）';
}

// 事件委托(explorer 卡由 createSceneCard 生成,按钮用 data 属性)
document.addEventListener('click', function(e){
  var drawerBackdrop = e.target.closest('[data-action="drawer-backdrop"]');
  if (drawerBackdrop && e.target === drawerBackdrop) { closeStory(); return; }
  var actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    var action = actionEl.getAttribute('data-action');
    if (action === 'clear-search') { clearSceneSearch(); return; }
    if (action === 'reset-filters') { resetSceneFilters(); return; }
    if (action === 'close-story') { closeStory(); return; }
    if (action === 'toggle-favorite') {
      e.preventDefault();
      e.stopPropagation();
      toggleSceneFavorite(actionEl.getAttribute('data-id'), e);
      return;
    }
  }
  var direct = e.target.closest('a[href*="prompt-builder.html?scene="]');
  if (direct) {
    try {
      var directId = new URL(direct.href, window.location.href).searchParams.get('scene');
      var directScene = SCENES.find(function(scene){ return scene.id === directId; });
      if (directScene) rememberRecentScene(directScene);
    } catch(err) {}
  }
  var dir = e.target.closest('[data-dir]');
  if (dir){ openDirector(dir.getAttribute('data-dir')); return; }
  var det = e.target.closest('[data-detail]');
  if (det){ showDetail(det.getAttribute('data-detail')); }
});
document.addEventListener('change', function(e){
  if (e.target && (e.target.getAttribute('data-filter') === 'scenes' || /^(sceneCharacter|sceneSeason|sceneTime|sceneSeries|sceneRating|sceneTier|sceneSort)$/.test(e.target.id))) {
    filterScenes();
  }
});
document.addEventListener('input', function(e){
  if (e.target && (e.target.getAttribute('data-filter') === 'scenes' || e.target.id === 'sceneSearch')) {
    filterScenes();
  }
});

function filterScenes(){
  clearTimeout(FILTER_TIMER);
  FILTER_TIMER = setTimeout(function(){ renderScenes(true); }, 180);
}
function clearSceneSearch(){
  var input = document.getElementById('sceneSearch');
  if (input) { input.value = ''; input.focus(); }
  renderScenes(true);
}
function resetSceneFilters(){
  SCENE_THEME = 'all';
  var search = document.getElementById('sceneSearch'); if (search) search.value = '';
  ['sceneCharacter','sceneSeason','sceneTime','sceneSeries','sceneRating'].forEach(function(id){ var select=document.getElementById(id); if(select) select.value='all'; });
  var tier = document.getElementById('sceneTier'); if (tier) tier.value = 'featured';
  var sort = document.getElementById('sceneSort'); if (sort) sort.value = 'smart';
  renderSceneCats(); renderScenes(true);
}

function openDirector(id){
  var s = SCENES.find(function(x){ return x.id === id; });
  if (!s) return;
  rememberRecentScene(s);
  localStorage.setItem('aics_pending_scene', JSON.stringify(s));
  window.location.href = 'prompt-builder.html?scene=' + encodeURIComponent(id) + '&step=4&generate=1';
}

function rememberRecentScene(scene){
  AICSceneUX.rememberRecent(scene, localStorage);
}

function showDetail(id){
  var s = SCENES.find(function(x){ return x.id === id; });
  if (!s) return;
  var drawer = document.getElementById('storyDrawer');
  var card = document.getElementById('storyCard');
  if (!drawer || !card) { alert(s.story || ''); return; }
  var charName = sceneCharacterName(s);
  var seasonMap = {'春':'🌸','夏':'☀️','秋':'🍂','冬':'❄️'};
  var season = s.season ? (seasonMap[s.season]||'') + s.season : '';
  card.innerHTML = '' +
    '<h3>🌸 ' + escHtml(s.title) + '</h3>' +
    '<div class="story-meta">' + escHtml(charName) + ' · ' + escHtml(season||'') + ' · ' + escHtml(s.timeOfDay||'') + ' · ' + escHtml(s.emotion||'') + '</div>' +
    '<div class="story-body">' + escHtml(s.story || '') + '</div>' +
    '<div class="story-actions">' +
      '<a class="btn btn-primary" href="' + AICQuickCreate.url(s.id) + '">⚡ 快速出图</a>' +
      '<a class="btn btn-ghost" href="prompt-builder.html?scene=' + encodeURIComponent(s.id) + '&step=4&generate=1">🎬 调整后生成</a>' +
      '<button class="btn btn-ghost" type="button" data-action="close-story">关闭</button>' +
    '</div>';
  drawer.classList.add('open');
}
function closeStory(){ var d=document.getElementById('storyDrawer'); if(d) d.classList.remove('open'); }
document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeStory(); });

// 导演决策本地推断 (与 prompt-builder CAMERA_TO_SHOT_* + sceneColorMood 对齐,轻量版)
function decisionPreview(scene){
  var cameraMap = { '半身中景':'半身', '全身远景':'远景', '全身中景':'全身', '特写':'特写', '特写镜头':'特写', '面部特写':'特写', '远景':'远景', '中景':'半身', '全身':'全身', '半身':'半身' };
  var lightMap = { '窗光':'窗光', '黄金时刻':'黄昏光', '逆光':'逆光', '月光':'月光', '夜灯':'夜灯', '霓虹':'霓虹', '烛光':'烛光', '阴天':'阴天光', '夕阳光':'黄昏光', '晨光':'晨光' };
  var camera = String(scene.camera||'');
  var shot = (scene.camera && cameraMap[scene.camera]) ||
    (/第一人称|主观/i.test(camera) ? '第一人称' : /俯视|俯瞰/.test(camera) ? '俯视' : /仰视|微仰/.test(camera) ? '仰视' : /侧面|侧方|镜面/.test(camera) ? '侧面' : /近景|特写/.test(camera) ? '特写' : /全身|远景|全景/.test(camera) ? '远景' : '半身');
  var light = String(scene.lighting||'');
  var lighting = (scene.lighting && lightMap[scene.lighting]) ||
    (/夕阳|黄昏|黄金|落日/.test(light) ? '黄昏光' : /逆光|背光|边缘光/.test(light) ? '逆光' : /月光|星光/.test(light) ? '月光' : /窗光|晨光|晨曦|朝阳|阳光/.test(light) ? '窗光' : /阴天|雨天|漫射|柔光/.test(light) ? '柔光' : /灯|烛|暖光|霓虹|荧幕/.test(light) ? '夜灯' : '自然光');
  // 色调: 基于 tags + emotion 粗略判断
  var tags = (scene.tags || []).join(',').toLowerCase();
  var em = (scene.emotion||'').toLowerCase();
  var color = '自然';
  if (/sunset|dusk|golden|黄昏|夕阳|浪漫/.test(tags) || /love|shy|love|恋爱|害羞/.test(em)) color = '暖橙';
  else if (/night|月|夜|星空|moon/.test(tags)) color = '冷蓝';
  else if (/spring|cherry|flower|樱花|春/.test(tags)) color = '粉嫩';
  else if (/autumn|red_leaves|秋/.test(tags)) color = '琥珀';
  else if (/rain|雨|cloudy/.test(tags)) color = '灰蓝';
  else if (/winter|snow|雪|冬/.test(tags)) color = '冷白';
  return { shot: shot, lighting: lighting, color: color };
}

function escHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function scrollToScene(id){
  var grid = document.getElementById('sceneGrid');
  if (!grid) return;
  var card = grid.querySelector('[data-scene-id="' + id + '"]');
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('scene-flash');
  setTimeout(function(){ card.classList.remove('scene-flash'); }, 2000);
}
