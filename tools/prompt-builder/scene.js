/* Prompt Builder module: scene workflow and scene library.
 * This file intentionally uses classic script globals for inline HTML handlers.
 */

// ========== WORKFLOW STEPS (Scene → Char → Decisions → Result) ==========
function updateGuideBar() {
  const guide = document.getElementById('guideBar'); if (!guide) return;
  const charLabel = state.char === 'nene' ? '宁宁' : '夏目';
  const filled = ['emotion','shot','lighting','composition'].filter(k => state.selections[k] && (k === 'emotion' ? state.selections[k].length > 0 : true)).length + (state.colorMood ? 1 : 0);
  let txt = '写一个故事，或选一张场景卡';
  if (document.body.getAttribute('data-first-creation') === 'ready') txt = '精选场景和稳定参数已准备好，直接点「导演这张 CG」';
  else if (state.__sceneId && filled === 0) txt = `已选「${charLabel}」场景，再定情绪/镜头或点导演`;
  else if (filled > 0) txt = `已填 ${filled} 项决策，点「导演这张 CG」出 Prompt`;
  else if (state.story.trim()) txt = '已写故事，可直接做导演决策，也可再选场景卡补充细节';
  guide.textContent = txt;
}
function markStepDone(n) { updateGuideBar(); }
function goStep(n) {
  var nextStep = Math.max(1, Math.min(4, n));
  var changed = nextStep !== CURRENT_STEP;
  CURRENT_STEP = nextStep;
  document.body.classList.toggle('step-4', CURRENT_STEP >= 4);
  if (changed && (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    document.body.classList.remove('workspace-enter-result', 'workspace-enter-studio');
    void document.body.offsetWidth;
    document.body.classList.add(CURRENT_STEP >= 4 ? 'workspace-enter-result' : 'workspace-enter-studio');
    clearTimeout(window.__workspaceTransitionTimer);
    window.__workspaceTransitionTimer = setTimeout(function () {
      document.body.classList.remove('workspace-enter-result', 'workspace-enter-studio');
    }, 520);
  }
  updateGuideBar();
}

const DIRECTOR_MODE_KEY = 'aics_director_mode';
function initDirectorMode() { setDirectorMode(localStorage.getItem(DIRECTOR_MODE_KEY) === 'pro' ? 'pro' : 'basic', false); }
function setDirectorMode(mode, persist) {
  mode = mode === 'pro' ? 'pro' : 'basic';
  document.body.setAttribute('data-director-mode', mode);
  var basic = document.getElementById('directorModeBasic'), pro = document.getElementById('directorModePro');
  if (basic) { basic.classList.toggle('active', mode === 'basic'); basic.setAttribute('aria-pressed', mode === 'basic' ? 'true' : 'false'); }
  if (pro) { pro.classList.toggle('active', mode === 'pro'); pro.setAttribute('aria-pressed', mode === 'pro' ? 'true' : 'false'); }
  if (persist !== false) localStorage.setItem(DIRECTOR_MODE_KEY, mode);
  renderDirectorModeSummary();
}
function directorChoiceName(list, id) { var item=(list||[]).find(function(value){return value.id===id;}); return item ? item.name.replace(/\s+(Golden Hour|Window Light|Backlight|Moonlight|Lantern|Overcast)$/,'') : ''; }
function renderDirectorModeSummary() {
  var summary = document.getElementById('directorAutoSummary'); if (!summary) return;
  var mood = COLOR_MOODS.find(function(item){ return item.id === state.colorMood; });
  var parts = [];
  var light = directorChoiceName(LIGHTING, state.selections.lighting); if (light) parts.push('光照 ' + light);
  var composition = directorChoiceName(COMPOSITION, state.selections.composition); if (composition) parts.push('构图 ' + composition);
  if (mood) parts.push('色彩 ' + mood.name);
  summary.textContent = parts.length ? '场景已自动准备：' + parts.join(' · ') : '场景会自动准备光照、构图和色彩';
}

function signatureScenePool() {
  var ids = Array.isArray(CURATION_DATA.signatureSceneIds) && CURATION_DATA.signatureSceneIds.length ? CURATION_DATA.signatureSceneIds : (CURATION_DATA.curatedSceneIds || []);
  return ids.map(function(id){ return SCENES.find(function(scene){ return scene.id === id; }); }).filter(function(scene){ return scene && !scene.mature; });
}
function sceneCharacterKey(scene) {
  if (!scene) return '';
  if (scene.char === 'nene' || scene.char === 'ayachi_nene') return 'nene';
  if (scene.char === 'natsume' || scene.char === 'shiki_natsume') return 'natsume';
  return scene.char === 'triad' ? 'triad' : '';
}
function pickSignatureScene(preferredChar) {
  var pool = signatureScenePool();
  var matching = pool.filter(function(scene){ return sceneCharacterKey(scene) === preferredChar; });
  return (matching.length ? matching : pool)[0] || null;
}
function loadRandomSignatureScene() {
  var pool = signatureScenePool();
  if (!pool.length) { flash('精选场景暂时不可用'); return; }
  var recentIds = AICSceneUX.readRecent(localStorage).map(function(item){ return item.id; });
  var fresh = pool.filter(function(scene){ return scene.id !== state.__sceneId && recentIds.indexOf(scene.id) < 0; });
  var choices = fresh.length ? fresh : pool.filter(function(scene){ return scene.id !== state.__sceneId; });
  var scene = (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length || pool.length))];
  loadScene(scene);
  flash('已换成精选场景「' + scene.title + '」');
}
function renderRecentSceneShortcuts() {
  var host = document.getElementById('recentSceneShortcuts'); if (!host) return;
  var recent = AICSceneUX.readRecent(localStorage).map(function(item){ return SCENES.find(function(scene){ return scene.id === item.id; }); }).filter(Boolean).slice(0,3);
  host.innerHTML = recent.map(function(scene){ var icon=sceneCharacterKey(scene)==='natsume'?'leaf':sceneCharacterKey(scene)==='triad'?'both':'flower'; return '<button class="recent-scene-chip" type="button" onclick="loadRecentScene(\'' + escapeHtml(scene.id) + '\')"><span data-icon="' + icon + '"></span>' + escapeHtml(scene.title) + '</button>'; }).join('');
  if (window.AICIcons) AICIcons.hydrate(host);
}
function loadRecentScene(id) { var scene=SCENES.find(function(item){return item.id===id;}); if(scene) loadScene(scene); }
function focusSceneSearch() { var input=document.getElementById('sceneSearch'); if(input){ input.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(function(){input.focus();},220); } }

function setStory(el) {
  const txt = el.textContent;
  document.getElementById('storyInput').value = txt;
  state.story = txt;
  if (typeof suggestTagsFromStory === 'function') suggestTagsFromStory();
  highlightScenesByStory(txt);
  refreshVoiceText(true);
  updateLivePreview();
}
const SCENE_KW = ['海边','神社','祭典','烟花','浴衣','咖啡馆','樱花','教室','日落','夜晚','雪','雨','回眸','微笑','脸红','闭眼','和服','泳装','卧室','天台','车站','公园','图书馆','月亮','烛光','厨房','商场','海边','神社','烟花','夕阳','清晨'];
function highlightScenesByStory(txt) {
  const hit = SCENE_KW.filter(w => txt.includes(w));
  document.querySelectorAll('.scene-card').forEach(card => {
    const idx = parseInt(card.dataset.idx, 10); const s = SCENES[idx]; if (!s) return;
    const hay = (s.title + s.story + (s.tags||[]).join('') + (s.season||'') + (s.timeOfDay||''));
    card.dataset.recommended = hit.some(w => hay.includes(w)) ? '1' : '0';
  });
  clearTimeout(window.__obSceneHL);
  window.__obSceneHL = setTimeout(() => document.querySelectorAll('.scene-card[data-recommended="1"]').forEach(c => c.dataset.recommended = '0'), 2500);
}
function setChar(c) {
  if (state.char === c) return;
  state.char = c;
  document.body.classList.remove('character-shifting');
  void document.body.offsetWidth;
  document.body.classList.add('character-shifting');
  document.body.setAttribute('data-character', c);
  clearTimeout(window.__characterThemeTimer);
  window.__characterThemeTimer = setTimeout(function () { document.body.classList.remove('character-shifting'); }, 760);
  document.querySelectorAll('.char-btn').forEach(b => {
    const on = b.dataset.char === c;
    b.classList.toggle('active', on);
    b.style.background = on ? 'var(--accent-soft)' : 'var(--bg-surface)';
    b.style.borderColor = on ? 'var(--accent)' : 'var(--border-soft)';
  });
  highlightCharScenes(c);
  const _scf=document.getElementById('sceneCharFilter'); if(_scf){_scf.value=c;}
  filterScenes(document.getElementById('sceneSearch').value);
  renderTraits(); renderManualTags();
  updateLivePreview();
  updateGuideBar();
  syncVoiceCharacter(true);
  flash('已切换至 ' + (c === 'nene' ? '宁宁' : (c === 'natsume' ? '夏目' : '双人')) + '，推荐场景已高亮');
}
function highlightCharScenes(c) {
  const label = c === 'triad' ? 'triad' : (c === 'nene' ? 'nene' : 'natsume');
  let count = 0;
  document.querySelectorAll('.scene-card').forEach(card => {
    const idx = parseInt(card.dataset.idx, 10); const s = SCENES[idx];
    const alias = c === 'nene' ? 'ayachi_nene' : (c === 'natsume' ? 'shiki_natsume' : 'triad');
    const match = s && (s.char === label || s.char === alias || (c !== 'triad' && Array.isArray(s.character) && s.character.includes(c)));
    card.dataset.charMatch = match ? '1' : '0';
    if (match) count++;
  });
  clearTimeout(window.__charHL);
  window.__charHL = setTimeout(() => document.querySelectorAll('.scene-card[data-char-match="1"]').forEach(card => card.dataset.charMatch = '0'), 3000);
  document.getElementById('sceneGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function resetSceneAndDecisions() {
  state.__sceneId = null; state.story = '';
  document.getElementById('storyInput').value = '';
  state.selections.emotion = []; state.selections.shot = null; state.selections.lighting = null; state.selections.composition = null;
  state.colorMood = null; state.manualTags = new Set();
  document.querySelectorAll('#chip-emotion .chip-select.selected,#opt-shot .option.selected,#opt-lighting .option.selected,#opt-composition .option.selected,#moodGrid .mood-card.selected').forEach(o => o.classList.remove('selected'));
  try { localStorage.removeItem(DRAFT_KEY); } catch(e) {}
  renderDirectorModeSummary();
  updateLivePreview();
}

// ===== Render options =====
function renderEmotion() {
  const el = document.getElementById('chip-emotion'); el.innerHTML = '';
  EMOTION.forEach(em => {
    const d = document.createElement('div');
    d.className = 'chip-select'; d.dataset.id = em.id;
    d.textContent = em.name;
    d.title = EMOTION_REASON[em.id] || '';
    d.onclick = () => toggleEmotion(em.id);
    el.appendChild(d);
  });
}
function renderShot() {
  const el = document.getElementById('opt-shot'); el.innerHTML = '';
  SHOT.forEach(s => {
    const d = document.createElement('div'); d.className = 'option'; d.dataset.id = s.id;
    d.innerHTML = `<div class="option-name">${s.name}</div><div class="option-en">${s.en}</div><div class="option-reason">${SHOT_REASON[s.id]||''}</div>`;
    d.onclick = () => selectShot(s.id); el.appendChild(d);
  });
}
function renderLighting() {
  const el = document.getElementById('opt-lighting'); el.innerHTML = '';
  LIGHTING.forEach(l => {
    const d = document.createElement('div'); d.className = 'option'; d.dataset.id = l.id;
    d.innerHTML = `<div class="option-name">${l.name}</div><div class="option-reason">${LIGHTING_REASON[l.id]||''}</div>`;
    d.onclick = () => selectLighting(l.id); el.appendChild(d);
  });
}
function renderComposition() {
  const el = document.getElementById('opt-composition'); el.innerHTML = '';
  COMPOSITION.forEach(c => {
    const d = document.createElement('div'); d.className = 'option'; d.dataset.id = c.id;
    d.innerHTML = `<div class="option-name">${c.name}</div><div class="option-en">${c.en}</div>`;
    d.onclick = () => selectComposition(c.id); el.appendChild(d);
  });
}

function toggleEmotion(id) {
  const d = document.querySelector(`#chip-emotion .chip-select[data-id="${id}"]`);
  d.classList.toggle('selected');
  const arr = state.selections.emotion;
  if (d.classList.contains('selected')) arr.push(id); else state.selections.emotion = arr.filter(x => x !== id);
  updateLivePreview();
}
function selectShot(id) {
  document.querySelectorAll('#opt-shot .option').forEach(o => o.classList.toggle('selected', o.dataset.id === id));
  state.selections.shot = id; updateLivePreview();
}
function selectLighting(id) {
  document.querySelectorAll('#opt-lighting .option').forEach(o => o.classList.toggle('selected', o.dataset.id === id));
  state.selections.lighting = id; renderDirectorModeSummary(); updateLivePreview();
}
function selectComposition(id) {
  document.querySelectorAll('#opt-composition .option').forEach(o => o.classList.toggle('selected', o.dataset.id === id));
  state.selections.composition = id; renderDirectorModeSummary(); updateLivePreview();
}

// ===== Color moods =====
function renderColorMoods() {
  const el = document.getElementById('moodGrid'); el.innerHTML = '';
  COLOR_MOODS.forEach(m => {
    const d = document.createElement('div'); d.className = 'mood-card'; d.dataset.id = m.id;
    d.innerHTML = `<div class="mood-strip">${m.colors.map(c=>`<div class="mood-swatch" style="background:${c}"></div>`).join('')}</div>
      <div class="mood-body"><div class="mood-name">${m.name}</div><div class="mood-desc">${m.desc}</div></div>`;
    d.onclick = () => selectMood(m.id); el.appendChild(d);
  });
}
function selectMood(id) {
  document.querySelectorAll('#moodGrid .mood-card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
  state.colorMood = id;
  renderDirectorModeSummary();
  const suggested = MOOD_EMOTION_MAP[id] || [];
  if (suggested.length) {
    document.querySelectorAll('#chip-emotion .chip-select').forEach(c => {
      c.style.boxShadow = suggested.includes(c.dataset.id) ? '0 0 0 2px var(--accent)' : '';
    });
    setTimeout(() => document.querySelectorAll('#chip-emotion .chip-select').forEach(c => c.style.boxShadow = ''), 2000);
  }
  updateLivePreview();
}

// ===== TRAITS =====
function renderTraits() {
  const row = document.getElementById('traitsRow'); if(!row) return; row.innerHTML = '';
  const list = TRAITS[state.char] || [];
  if(!list) return;
  list.forEach(tr => {
    const chip = document.createElement('span');
    chip.className = 'trait-chip' + (state.manualTags.has(tr.tag) ? ' active' : '');
    chip.innerHTML = `${tr.icon} ${tr.label}`;
    chip.onclick = () => toggleTag(tr.tag);
    row.appendChild(chip);
  });
}

// ========== SCENE LIBRARY ==========
function renderSceneMini() {
  const grid = document.getElementById('sceneMiniGrid'); if (!grid) return;
  const ids = Array.isArray(CURATION_DATA.signatureSceneIds) && CURATION_DATA.signatureSceneIds.length ? CURATION_DATA.signatureSceneIds : (CURATION_DATA.curatedSceneIds || []);
  const picks = ids.map(function(id){ return SCENES.find(function(scene){ return scene.id === id; }); }).filter(Boolean).slice(0, 6);
  grid.innerHTML = picks.map((s) => `
    <div class="scene-mini-card" onclick="window._loadSceneByIdx(${SCENES.indexOf(s)})">
      <div class="scene-mini-name">${s.title}</div>
      <div class="scene-mini-story">${s.story}</div>
    </div>`).join('');
}
function scenePrimaryCategory(scene) {
  var category = scene.category || '其他';
  if (category === 'Active_Sync_Scenes') return 'Active Sync';
  return category.split('/')[0];
}
function sceneThemeDef(id) {
  return SCENE_THEME_DEFS.find(function(def){ return def.id === id; }) || SCENE_THEME_DEFS[0];
}
function sceneMatchesTheme(scene, themeId) {
  if (themeId === 'all') return true;
  return sceneThemeDef(themeId).categories.indexOf(scenePrimaryCategory(scene)) >= 0;
}
function sceneThemeLabel(scene) {
  var match = SCENE_THEME_DEFS.find(function(def){ return def.id !== 'all' && sceneMatchesTheme(scene, def.id); });
  return match ? match.label : '其他';
}
function sceneMatchesSeries(scene, series) {
  var category = scene.category || '';
  if (series === 'after') return /After_Story/i.test(category);
  if (series === 'fanwork') return /同人/.test(category);
  if (series === 'active') return category === 'Active_Sync_Scenes';
  return true;
}
function sceneCharacterLabel(scene) {
  var value = scene.char || '';
  if (value === 'nene' || value === 'ayachi_nene') return '宁宁';
  if (value === 'natsume' || value === 'shiki_natsume') return '夏目';
  if (value === 'triad') return '双人';
  return value;
}
function sceneTimeLabel(value) {
  return ({morning:'清晨',afternoon:'午后',sunset:'黄昏',night:'夜晚',late_night:'深夜',dawn:'黎明',evening:'夜晚',all_day:'全天'})[value] || value || '';
}
function sceneTier(scene) {
  return AICSceneUX.tier(scene, CURATION_DATA);
}
function scenePriority(scene) {
  return AICSceneUX.priority(scene, CURATION_DATA);
}
function semanticSceneMatch(scene, query) {
  return AICSceneUX.matchesSearch(scene, query, CURATION_DATA, [scenePrimaryCategory(scene), sceneTimeLabel(scene.timeOfDay)]);
}
function renderSceneCats() {
  const el = document.getElementById('sceneCats'); el.innerHTML = '';
  const available = SCENES.filter(function(scene){ return SHOW_MATURE_SCENES || !scene.mature; });
  SCENE_THEME_DEFS.forEach(function(def){
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.sceneTheme = def.id;
    b.className = 'scene-cat' + (def.id === SCENE_THEME ? ' active' : '');
    const count = available.filter(function(scene){ return sceneMatchesTheme(scene, def.id); }).length;
    b.textContent = def.label + ' ' + count;
    b.setAttribute('aria-pressed', def.id === SCENE_THEME ? 'true' : 'false');
    b.onclick = function(){ SCENE_THEME = def.id; renderSceneCats(); renderScenes(); };
    el.appendChild(b);
  });
  var _cb=document.getElementById('sceneCountBadge'); if(_cb) _cb.textContent = '· '+SCENES.length+' Scenes';
}
function toggleSceneFilters(){
  var container = document.getElementById('sceneFilterMore');
  var body = document.getElementById('sceneFilterMoreBody');
  var trigger = document.getElementById('sceneFilterMoreToggle');
  if (!container || !body || !trigger) return;
  var open = !container.classList.contains('open');
  container.classList.toggle('open', open);
  body.hidden = !open;
  trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function renderScenes() {
  const grid = document.getElementById('sceneGrid'); if (!grid) return;
  grid.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const q = (document.getElementById('sceneSearch')?.value || '').trim().toLowerCase();
  const charSel = (document.getElementById('sceneCharFilter') || {}).value || 'all';
  const seasonSel = (document.getElementById('sceneSeasonFilter') || {}).value || 'all';
  const seriesSel = (document.getElementById('sceneSeriesFilter') || {}).value || 'all';
  const ratingSel = (document.getElementById('sceneRatingFilter') || {}).value || 'all';
  const activeFilterCount = [charSel, seasonSel, seriesSel, ratingSel].filter(function(value){ return value !== 'all'; }).length;
  const filterMore = document.getElementById('sceneFilterMore');
  const filterMoreState = document.getElementById('sceneFilterMoreState');
  if (filterMore) filterMore.classList.toggle('has-active', activeFilterCount > 0);
  if (filterMoreState) filterMoreState.textContent = activeFilterCount ? activeFilterCount + ' 项已启用' : '角色 / 季节 / 系列 / 分级';
  const matches = SCENES.map((s, idx) => ({s, idx})).filter(({s}) => {
    if (!SHOW_MATURE_SCENES && s.mature) return false;
    const themeOk = sceneMatchesTheme(s, SCENE_THEME);
    const charAlias = ({nene:'ayachi_nene',natsume:'shiki_natsume',triad:'triad'})[charSel] || charSel;
    const charOk = charSel === 'all' || s.char === charSel || s.char === charAlias || (Array.isArray(s.character) && s.character.includes(charSel));
    const seasonOk = seasonSel === 'all' || s.season === seasonSel;
    const seriesOk = sceneMatchesSeries(s, seriesSel);
    const ratingOk = ratingSel === 'all' || (s.rating || (s.mature ? 'R18' : 'All')) === ratingSel;
    return themeOk && charOk && seasonOk && seriesOk && ratingOk && semanticSceneMatch(s, q);
  }).sort(function(a,b){
    if (q) {
      var relevance = AICSceneUX.searchScore(b.s, q, CURATION_DATA, [scenePrimaryCategory(b.s), sceneTimeLabel(b.s.timeOfDay)]) - AICSceneUX.searchScore(a.s, q, CURATION_DATA, [scenePrimaryCategory(a.s), sceneTimeLabel(a.s.timeOfDay)]);
      if (relevance) return relevance;
    }
    var preference = AICSceneUX.personalScore(b.s, PERSONAL_PROFILE) - AICSceneUX.personalScore(a.s, PERSONAL_PROFILE);
    return preference || scenePriority(b.s) - scenePriority(a.s);
  });
  const countEl = document.getElementById('sceneResultCount');
  const analysis = AICSceneUX.analyzeQuery(q, CURATION_DATA);
  if (countEl) countEl.innerHTML = '找到 <strong>' + matches.length + '</strong> 个场景' + (analysis.intents.length ? ' · 已理解：' + analysis.intents.map(escapeHtml).join('、') : '') + (PERSONAL_PROFILE.entries ? ' · 已结合 ' + PERSONAL_PROFILE.entries + ' 条本机记录' : '');
  matches.slice(0, BUILDER_SCENE_LIMIT).forEach(({s, idx}) => {
    const card = document.createElement('div'); card.className = 'scene-card'; card.dataset.idx = idx; card.dataset.category = s.category || '日常'; card.dataset.rating = s.rating || (s.mature ? 'R18' : 'All');
    const season = s.season ? ({春:'🌸',夏:'☀️',秋:'🍂',冬:'❄️'}[s.season]||'') + s.season : '';
    const tod = s.timeOfDay ? ({morning:'清晨',afternoon:'午后',sunset:'黄昏',night:'夜晚',late_night:'深夜',dawn:'拂晓'}[s.timeOfDay]||s.timeOfDay) : '';
    const personalNote = AICSceneUX.personalReason(s, PERSONAL_PROFILE);
    card.innerHTML = `
      <div class="scene-name">${escapeHtml(s.title)}${s.mature ? ' <span class="mature-dot">🔞</span>' : ''}</div>
      <div class="scene-story">${escapeHtml(s.story)}</div>
      <div class="scene-meta">
        ${personalNote ? `<span class="scene-tag emotion" title="${escapeHtml(personalNote)}">为你推荐</span>` : ''}
        ${sceneTier(s) === 'signature' ? '<span class="scene-tag emotion">招牌</span>' : sceneTier(s) === 'curated' ? '<span class="scene-tag">精选</span>' : ''}
        <span class="scene-tag emotion">${escapeHtml(s.emotion)}</span>
        <span class="scene-tag char-color">${escapeHtml(sceneCharacterLabel(s))}</span>
        ${(s.rating || (s.mature ? 'R18' : 'All')) !== 'All' ? `<span class="scene-tag rating ${(s.rating || (s.mature ? 'R18' : 'All')).toLowerCase()}">${escapeHtml(s.rating || (s.mature ? 'R18' : 'All'))}</span>` : ''}
        ${s.category ? `<span class="scene-tag">${escapeHtml(sceneThemeLabel(s))}</span>` : ''}
        ${season ? `<span class="scene-tag">${escapeHtml(season)}</span>` : ''}
        ${tod ? `<span class="scene-tag">${escapeHtml(tod)}</span>` : ''}
        ${s.tags.slice(0,3).map(t => `<span class="scene-tag raw">${escapeHtml(t)}</span>`).join('')}
      </div>`;
    card.onclick = () => loadScene(s);
    const directBtn = document.createElement('button'); directBtn.className = 'scene-direct-btn'; directBtn.textContent = '快速出图'; directBtn.type = 'button';
    directBtn.addEventListener('click', (e) => { e.stopPropagation(); loadScene(s); quickCreateCurrent(); });
    card.appendChild(directBtn);
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
  if (SCENES.length === 0) {
    grid.innerHTML = '<div class="history-empty">⚠️ 场景库加载失败，请检查 data/scenes.json 是否存在。</div>';
  } else if (matches.length === 0) {
    grid.innerHTML = '<div class="history-empty">🔍 没有匹配的场景，请调整搜索或筛选条件。</div>';
  } else if (matches.length > BUILDER_SCENE_LIMIT) {
    const tip = document.createElement('div');
    tip.className = 'history-empty';
    tip.style.cssText = 'padding:var(--s-3);text-align:center;font-size:.78rem;';
    tip.textContent = '已显示前 ' + BUILDER_SCENE_LIMIT + ' / ' + matches.length + ' 个结果，请继续输入关键词缩小范围。';
    grid.appendChild(tip);
  }
}
function filterScenes(q) {
  clearTimeout(SCENE_FILTER_TIMER);
  SCENE_FILTER_TIMER = setTimeout(renderScenes, 180);
}
function clearSceneSearch() {
  var input = document.getElementById('sceneSearch');
  if (input) { input.value = ''; input.focus(); }
  renderScenes();
}
function resetSceneFilters() {
  SCENE_THEME = 'all';
  var search = document.getElementById('sceneSearch'); if (search) search.value = '';
  ['sceneCharFilter','sceneSeasonFilter','sceneSeriesFilter','sceneRatingFilter'].forEach(function(id){ var select=document.getElementById(id); if(select) select.value='all'; });
  renderSceneCats(); renderScenes();
}
window._loadSceneByIdx = function(idx) { if (SCENES[idx]) loadScene(SCENES[idx]); };
// scene tag → 推荐光照 (scene-aware)
const SCENE_LIGHT_HINT = { sunset:'golden', golden_hour:'golden', dusk:'golden', sunset_glow:'golden', golden:'golden', warm_light:'golden', backlit:'back', backlighting:'back', window:'window', window_light:'window', soft_light:'window', soft_lighting:'window', afternoon_light:'window', afternoon:'window', sunlight:'window', sunbeam:'window', sun_flare:'golden', morning_light:'window', morning:'window', sunrise:'window', first_light:'window', from_behind:'back', silhouette:'back', rim_light:'back', moonlight:'moon', moon:'moon', night:'lantern', dim_lighting:'lantern', warm_lighting:'lantern', lantern:'lantern', lanterns:'lantern', lantern_light:'lantern', festival:'lantern', fireworks:'lantern', hot_spring:'lantern', neon:'lantern', camping:'moon', candle:'lantern', candlelight:'lantern', overcast:'overcast', soft_diffused:'overcast', cloudy:'overcast', starry_sky:'moon', starry:'moon', blue_lighting:'moon', rain:'overcast', wet:'overcast', after_rain:'window', diffused:'overcast', dramatic:'back', soft_shadows:'window', bokeh:'window' };
const CAMERA_TO_SHOT = { '半身中景':'medium','全身远景':'wide','全身中景':'wide','特写':'close','特写镜头':'close','面部特写':'close','远景':'wide','中景':'medium','全身':'wide','半身':'medium' };
const CAMERA_TO_SHOT_BY_TAG = { close_up:'close', close_up_detail:'detail', pov:'pov', wide_shot:'wide', full_body:'wide', medium_shot:'medium', upper_face:'close', hands_or_face:'detail', profile:'side', from_the_side:'side' };
function sceneColorMood(s) {
  if (s.weather==='雨'||s.weather==='彩虹') return 'sad';
  if (s.timeOfDay==='night'||s.timeOfDay==='late_night') return 'tension';
  if (s.weather==='雪') return 'calm';
  const emoMap = { '恋爱':'love','开心':'joy','幸福':'joy','期待':'love','害羞':'love','感动':'warmth','温柔':'warmth','思念':'sad','失落':'sad','委屈':'sad','平静':'calm','放松':'calm','认真':'calm','困倦':'calm','紧张':'tension','生气':'tension','惊讶':'tension' };
  if (s.emotion && emoMap[s.emotion]) return emoMap[s.emotion];
  const emotion = String(s.emotion||'').toLowerCase();
  if (/幸福|joy|极乐/.test(emotion)) return 'joy';
  if (/依恋|恋爱|动情|亲密|诱惑|占有|独占|沦陷|love|dependency/.test(emotion)) return 'love';
  if (/羞|紧张|崩溃|过载|collapse/.test(emotion)) return 'tension';
  if (/温柔|治愈|平静/.test(emotion)) return 'warmth';
  if (s.season==='春') return 'joy';
  if (s.season==='夏') return 'warmth';
  if (s.season==='秋') return 'calm';
  if (s.season==='冬') return 'sad';
  return null;
}
function sceneShot(s) {
  if (s.camera && CAMERA_TO_SHOT[s.camera]) return CAMERA_TO_SHOT[s.camera];
  const camera = String(s.camera||'');
  if (/第一人称|主观|pov/i.test(camera)) return 'pov';
  if (/局部/.test(camera)) return 'detail';
  if (/俯视|俯瞰/.test(camera)) return 'high';
  if (/仰视|微仰/.test(camera)) return 'low';
  if (/侧面|侧方|镜面/.test(camera)) return 'side';
  if (/近景|特写/.test(camera)) return 'close';
  if (/全身|远景|全景/.test(camera)) return 'wide';
  if (/半身|中景|平视/.test(camera)) return 'medium';
  for (const t of s.tags) { if (CAMERA_TO_SHOT_BY_TAG[t]) return CAMERA_TO_SHOT_BY_TAG[t]; }
  return null;
}
function sceneLighting(s) {
  const lighting = String(s.lighting||'');
  if (/夕阳|黄昏|黄金|落日/.test(lighting)) return 'golden';
  if (/逆光|背光|边缘光/.test(lighting)) return 'back';
  if (/月光|星光|月夜/.test(lighting)) return 'moon';
  if (/阴天|雨天|漫射|柔光/.test(lighting)) return 'overcast';
  if (/窗光|窗边|晨光|晨曦|朝阳|阳光/.test(lighting)) return 'window';
  if (/夜灯|灯笼|烛|床头灯|台灯|吊灯|暖光|局部|霓虹|荧幕/.test(lighting)) return 'lantern';
  for (const t of (s.tags||[])) { if (SCENE_LIGHT_HINT[t]) return SCENE_LIGHT_HINT[t]; }
  return null;
}
function sceneComposition(s) {
  const tagComp = { framed:'frame', door:'frame', torii_gate:'frame', archway:'frame', window:'bywindow', looking_at_viewer:'center', standing:'center', centered:'center', profile:'side', from_the_side:'side', layered:'foreground', depth:'foreground', through:'frame', bokeh:'foreground' };
  for (const t of s.tags) { if (tagComp[t]) return tagComp[t]; }
  return null;
}
function rememberRecentScene(scene) {
  AICSceneUX.rememberRecent(scene, localStorage);
  renderRecentSceneShortcuts();
}
function scheduleDraftSave() {
  clearTimeout(DRAFT_SAVE_TIMER);
  if (!DATA_READY || DRAFT_RESTORING || (!state.__sceneId && !String(state.story || '').trim())) return;
  DRAFT_SAVE_TIMER = setTimeout(function(){
    var scene = SCENES.find(function(item){ return item.id === state.__sceneId; });
    var draft = {
      version:1,
      updatedAt:Date.now(),
      sceneId:state.__sceneId || '',
      sceneTitle:scene ? scene.title : '',
      char:state.char,
      story:state.story || '',
      selections:{
        emotion:(state.selections.emotion || []).slice(),
        shot:state.selections.shot || null,
        lighting:state.selections.lighting || null,
        composition:state.selections.composition || null
      },
      colorMood:state.colorMood || null,
      manualTags:Array.from(state.manualTags || []).slice(0,120),
      step:CURRENT_STEP
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch(e) {}
  }, 180);
}
function restoreLastDraft() {
  var draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch(e) { draft = null; }
  if (!draft || (!draft.sceneId && !draft.story)) { flash('没有可继续的创作'); return; }
  DRAFT_RESTORING = true;
  var source = SCENES.find(function(scene){ return scene.id === draft.sceneId; });
  if (source) loadScene(source);
  if (draft.char && draft.char !== state.char) setChar(draft.char);
  state.__sceneId = draft.sceneId || state.__sceneId || null;
  state.story = draft.story || state.story || '';
  var storyInput = document.getElementById('storyInput'); if (storyInput) storyInput.value = state.story;
  var selections = draft.selections || {};
  state.selections.emotion = Array.isArray(selections.emotion) ? selections.emotion.slice() : [];
  state.selections.shot = selections.shot || null;
  state.selections.lighting = selections.lighting || null;
  state.selections.composition = selections.composition || null;
  state.colorMood = draft.colorMood || null;
  state.manualTags = new Set(Array.isArray(draft.manualTags) ? draft.manualTags : []);
  document.querySelectorAll('#chip-emotion .chip-select').forEach(function(item){ item.classList.toggle('selected', state.selections.emotion.indexOf(item.dataset.id) >= 0); });
  document.querySelectorAll('#opt-shot .option').forEach(function(item){ item.classList.toggle('selected', item.dataset.id === state.selections.shot); });
  document.querySelectorAll('#opt-lighting .option').forEach(function(item){ item.classList.toggle('selected', item.dataset.id === state.selections.lighting); });
  document.querySelectorAll('#opt-composition .option').forEach(function(item){ item.classList.toggle('selected', item.dataset.id === state.selections.composition); });
  document.querySelectorAll('#moodGrid .mood-card').forEach(function(item){ item.classList.toggle('selected', item.dataset.id === state.colorMood); });
  renderManualTags(); renderTraits(); renderSelRow(); renderDirectorModeSummary(); updateGuideBar();
  goStep(Number(draft.step) || 3);
  DRAFT_RESTORING = false;
  updateLivePreview();
  flash('↩️ 已继续「' + (draft.sceneTitle || '上次创作') + '」');
}
function loadScene(s) {
  state.__sceneId = s.id;
  rememberRecentScene(s);
  var artWarn = document.getElementById('artWarn'); if(artWarn) artWarn.style.display = 'none';
  document.getElementById('storyInput').value = s.story; state.story = s.story;
  const charId = (s.char === 'ayachi_nene' || s.char === 'nene') ? 'nene' : (s.char === 'shiki_natsume' || s.char === 'natsume' ? 'natsume' : (s.char === 'triad' ? 'triad' : 'nene'));
  if (charId !== state.char) setChar(charId);
  state.__sceneId = s.id;
  document.getElementById('storyInput').value = s.story;
  state.story = s.story;
  const emoId = s.emotion ? findEmotionId(s.emotion) : null;
  state.selections.emotion = emoId ? [emoId] : [];
  document.querySelectorAll('#chip-emotion .chip-select').forEach(c => c.classList.toggle('selected', state.selections.emotion.includes(c.dataset.id)));
  state.manualTags = new Set(s.tags);
  renderManualTags(); renderTraits(); renderSelRow();
  state.selections.shot = null; state.selections.lighting = null; state.selections.composition = null; state.colorMood = null;
  document.querySelectorAll('#opt-shot .option,#opt-lighting .option,#opt-composition .option,#moodGrid .mood-card').forEach(o => o.classList.remove('selected'));
  // scene-aware lighting:从 scene tag 推断并自动预填光照
  let hintLight = sceneLighting(s);
  if (hintLight) { selectLighting(hintLight); state.selections.lighting = hintLight; document.querySelector('#opt-lighting .option[data-id="'+hintLight+'"]')?.classList.add('selected'); }
  // scene-aware color mood
  const mood = sceneColorMood(s);
  if (mood) { state.colorMood = mood; document.querySelectorAll('#moodGrid .mood-card').forEach(c => c.classList.toggle('selected', c.dataset.id === mood)); }
  // scene-aware shot
  const shot = sceneShot(s);
  if (shot) { state.selections.shot = shot; document.querySelectorAll('#opt-shot .option').forEach(o => o.classList.toggle('selected', o.dataset.id === shot)); }
  // scene-aware composition
  const comp = sceneComposition(s);
  if (comp) { state.selections.composition = comp; selectComposition(comp); }
  renderLightHint(hintLight, s.title);
  renderDirectorModeSummary();
  if (document.body.getAttribute('data-first-creation') === 'welcome') {
    document.body.setAttribute('data-first-creation', 'ready');
    localStorage.setItem('aics_first_creation_v2', 'started');
    setDirectorMode('basic', false);
  }
  switchTab('director', document.querySelectorAll('.pb-tab')[0]);
  markStepDone(1); // 场景选完 → 进入角色步骤
  flash('Scene 已加载: ' + s.title);
  updateLivePreview();
  syncVoiceCharacter(true);
  // URL 路由入参: ?step=N → 加载后跳到指定步骤（explorer 一键直达结果）
  try {
    var _stepQP = new URLSearchParams(window.location.search).get('step');
    var _stepN = parseInt(_stepQP, 10);
    if (_stepN && _stepN >= 1 && _stepN <= 4) goStep(_stepN);
    if (new URLSearchParams(window.location.search).get('generate') === '1') {
      generate();
      var _cleanQP = new URL(window.location.href);
      _cleanQP.searchParams.delete('generate');
      history.replaceState(null, '', _cleanQP.pathname + _cleanQP.search);
    }
  } catch(e){}
}
function renderLightHint(hint, title) {
  const el = document.getElementById('sceneLightHint'); if (!el) return;
  if (!hint) { el.classList.remove('show'); return; }
  const lm = { sunset:'夕阳光', window_light:'窗光', backlighting:'逆光', moonlight:'月光', night_lamp:'夜灯', neon:'霓虹', candlelight:'烛光', overcast:'阴天' };
  el.classList.add('show');
  el.innerHTML = '<span>场景建议光照：<b>' + (lm[hint]||hint) + '</b></span><button onclick="clearLightHint()" aria-label="关闭光照建议">×</button>';
}
function clearLightHint() { const el=document.getElementById('sceneLightHint'); if(el) el.classList.remove('show'); }
function findEmotionId(name) {
  const m = { '开心':'happy','害羞':'shy','思念':'miss','期待':'expect','紧张':'nervous','温柔':'gentle','感动':'moved','失落':'sad','平静':'calm','幸福':'joyful','放松':'relaxed','认真':'serious','恋爱':'love','困倦':'sleepy','撒娇':'spoiled','委屈':'wronged',
    /* scenes.json 中额外的情绪值映射到最接近的 EMOTION */
    '惊喜':'expect','忧郁':'sad','悲伤':'sad','坚强':'serious','日常':'calm','羞怯':'shy','诱惑':'love','热烈':'love','亲密':'love' };
  if (m[name]) return m[name];
  const value = String(name||'').toLowerCase();
  if (/羞|羞怯|羞耻|羞嗔|慌张/.test(value)) return 'shy';
  if (/幸福|joy|极乐/.test(value)) return 'joyful';
  if (/温柔|治愈/.test(value)) return 'gentle';
  if (/思念|依赖/.test(value)) return 'miss';
  if (/惊|期待/.test(value)) return 'expect';
  if (/紧张|崩溃|过载|collapse/.test(value)) return 'nervous';
  if (/依恋|恋爱|动情|亲密|诱惑|占有|独占|沦陷|服从|love|dependency/.test(value)) return 'love';
  return null;
}
// ========== SCENE LIBRARY (内联, file:// / http:// 通用) ==========
function loadSceneLibrary(){
  buildTraits();
  renderSceneCats(); renderScenes(); renderSceneMini();
}

