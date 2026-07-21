/* Prompt Builder module: page initialization, bindings, onboarding, and presets.
 * This file intentionally uses classic script globals for inline HTML handlers.
 */

// ========== INIT ==========
function init() {
  buildTraits();
  renderEmotion(); renderShot(); renderLighting(); renderComposition();
  renderColorMoods(); renderTraits(); renderManualTags();
  bindControls();
  initBackupUI();
  initKeyboardShortcuts();
  CURRENT_STEP = 1; updateGuideBar();
  ['quality','tail','negative','cfg','steps','sampler','scheduler','size'].forEach(id => {
    const el = document.getElementById(id); if (el) el.onchange = updateLivePreview;
  });
  initSDSettings();
  initVoiceStudio();
  loadSceneLibrary(); renderHistory(); updateLivePreview();
  var matureInput = document.getElementById('builderShowMature');
  if (matureInput) {
    matureInput.checked = SHOW_MATURE_SCENES;
    matureInput.addEventListener('change', function(){
      if (this.checked && !SHOW_MATURE_SCENES && !window.confirm('此区域包含成人向文字内容。请确认你已成年并希望继续查看。')) {
        this.checked = false;
        return;
      }
      SHOW_MATURE_SCENES = this.checked;
      localStorage.setItem('aics_show_mature', SHOW_MATURE_SCENES ? '1' : '0');
      renderSceneCats(); renderScenes();
    });
  }
  // URL params: ?mood=xxx -> step 4 select mood; ?scene=xxx -> load scene by id; ?regen=ID / ?variant=ID -> restore from history
  var quickRequested = false;
  try {
    var qp = new URLSearchParams(window.location.search);
    var mood = qp.get('mood');
    var sceneId = qp.get('scene');
    var resumeDraft = qp.get('resume') === '1';
    quickRequested = qp.get('quick') === '1';
    var charId = qp.get('char');
    if (charId) {
      var key = (charId === 'NENE_001' || charId === 'nene' || charId === 'ayachi_nene') ? 'nene' : (charId === 'NAT_001' || charId === 'natsume' || charId === 'shiki_natsume' ? 'natsume' : '');
      if (key && key !== state.char) setChar(key);
      if (key) flash('已切换至 ' + (key === 'nene' ? '宁宁' : '夏目'));
    }
    if (mood) { selectMood(mood); }
    if (sceneId && SCENES.length) {
      var sf = SCENES.find(function(s){ return s.id === sceneId; });
      if (sf && sf.mature && !SHOW_MATURE_SCENES) {
        if (window.confirm('该场景包含成人向文字内容。请确认你已成年并希望继续查看。')) {
          SHOW_MATURE_SCENES = true;
          localStorage.setItem('aics_show_mature', '1');
          var _matureToggle = document.getElementById('builderShowMature');
          if (_matureToggle) _matureToggle.checked = true;
          renderScenes();
        } else {
          sf = null;
        }
      }
      if (sf) loadScene(sf);
    }
    var regenId = qp.get('regen'), variantId = qp.get('variant');
    var refId = regenId || variantId;
    if (refId) {
      var ref = state.history.find(function(x){ return String(x.id) === String(refId); });
      if (ref) restoreFromEntry(ref, !!variantId);
    }
    if (resumeDraft && !sceneId && !refId) restoreLastDraft();
    if (quickRequested) {
      var quickUrl = new URL(window.location.href);
      quickUrl.searchParams.delete('quick');
      history.replaceState(null, '', quickUrl.pathname + quickUrl.search);
    }
  } catch(e) {}

  // SD WebUI 连通性检测
  if (quickRequested) showQuickCreateStatus('正在检查 SD，并准备最近成功参数…', false);
  checkSDStatus().then(function(connected){ if (quickRequested) quickCreateCurrent(connected); });
  document.getElementById('sd-status-badge').addEventListener('click', checkSDStatus);
}

// 从 history 条目恢复导演选择(regen=保持;variant=小幅扰动)
function restoreFromEntry(h, isVariant){
  state.__sceneId = h.scene || state.__sceneId;
  setChar(h.character);
  state.story = h.story || '';
  var si = document.getElementById('storyInput'); if(si) si.value = state.story;
  state.selections.emotion = Array.isArray(h.emotion) ? h.emotion.slice() : [];
  state.selections.shot = h.shot || null;
  state.selections.lighting = h.lighting || null;
  state.selections.composition = h.composition || null;
  state.colorMood = h.colorMood || null;
  state.manualTags = new Set();
  // variant: 小幅扰动 — 随机加一条推荐标签
  if (isVariant && RECOMMENDED_TAGS && RECOMMENDED_TAGS.length) {
    var add = RECOMMENDED_TAGS[Math.floor(Math.random()*RECOMMENDED_TAGS.length)];
    if (add) state.manualTags.add(add);
  }
  // 同步 UI
  document.querySelectorAll('#chip-emotion .chip-select').forEach(function(c){ c.classList.toggle('selected', state.selections.emotion.includes(c.dataset.id)); });
  document.querySelectorAll('#opt-shot .option').forEach(function(o){ o.classList.toggle('selected', o.dataset.id === state.selections.shot); });
  document.querySelectorAll('#opt-lighting .option').forEach(function(o){ o.classList.toggle('selected', o.dataset.id === state.selections.lighting); });
  document.querySelectorAll('#opt-composition .option').forEach(function(o){ o.classList.toggle('selected', o.dataset.id === state.selections.composition); });
  document.querySelectorAll('#moodGrid .mood-card').forEach(function(m){ m.classList.toggle('selected', m.dataset.id === state.colorMood); });
  // 恢复出图参数:cfg / steps / sampler / size / seed / negative
  if (h.cfg!=null){ var _cfg=document.getElementById('cfg'); if(_cfg) _cfg.value=h.cfg; }
  if (h.steps!=null){ var _st=document.getElementById('steps'); if(_st) _st.value=h.steps; }
  if (h.sampler!=null) ensureSelectValue('sampler', h.sampler);
  if (h.scheduler!=null) ensureSelectValue('scheduler', h.scheduler);
  if (h.checkpoint!=null) ensureSelectValue('sdModel', h.checkpoint);
  if (h.hires_upscaler!=null) ensureSelectValue('sdHiresUpscaler', h.hires_upscaler);
  if (h.hires_fix!=null){ var _hr=document.getElementById('sdHiresFix'); if(_hr) _hr.checked=!!h.hires_fix; }
  if (h.size!=null){ var _sz=document.getElementById('size'); if(_sz) _sz.value=h.size; }
  if (h.seed!=null && isFinite(Number(h.seed))){ window.__lastSeed__=Number(h.seed); var _si=document.getElementById('sdSeedInput'); if(_si) _si.value=String(h.seed); }
  var _neg=document.getElementById('negative'); if(_neg){ _neg.checked = h.negative ? true : false; }
  saveSDSettings();
  renderManualTags(); renderTraits(); renderSelRow(); updateLivePreview();
  flash('↩️ 已载入' + (isVariant ? '变体' : '重新生成') + ': v' + (h.version||1));
}


function bindControls() {
  document.querySelectorAll('.pb-tab').forEach(tab => {
    tab.onclick = () => switchTab(tab.dataset.tab, tab);
  });
  document.getElementById('sceneSearch').oninput = e => filterScenes(e.target.value);
  document.getElementById('storyInput').oninput = e => { state.story = e.target.value; clearStorySuggestions(); refreshVoiceText(false); updateLivePreview(); };
  document.querySelector('.story-chips').addEventListener('click', e => { if (e.target.classList.contains('story-chip')) setTimeout(clearStorySuggestions, 0); });
  document.getElementById('sceneGrid').addEventListener('dblclick', function(e) {
    var card = e.target.closest('.scene-card');
    if (card) {
      var idx = parseInt(card.dataset.idx, 10);
      if (SCENES[idx]) { loadScene(SCENES[idx]); generate(); }
    }
  });
  document.getElementById('storyInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (typeof suggestTagsFromStory === 'function') suggestTagsFromStory();
    }
  });
}

function initKeyboardShortcuts(){
  document.addEventListener('keydown', function(event){
    var target = event.target;
    var editing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      generate();
      if (event.shiftKey) enqueueSDGenerate();
      else callSDGenerate();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveHistory();
      return;
    }
    if (event.key === '/' && !editing) {
      event.preventDefault();
      var search = document.getElementById('sceneSearch');
      if (search) search.focus();
      return;
    }
    if (event.key.toLowerCase() === 'f' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      toggleFocusMode();
      return;
    }
    if (event.key === 'Escape') {
      if (_sdGeneration) { cancelSDGenerate(); return; }
      if (document.body.classList.contains('focus-mode')) { toggleFocusMode(false); return; }
      var utility = document.getElementById('utilityMenu');
      if (utility && utility.classList.contains('open')) { closeUtilityMenu(); return; }
      var backup = document.getElementById('backupOverlay');
      if (backup && backup.classList.contains('open')) { closeBackupRestore(); return; }
      var review = document.getElementById('reviewOverlay');
      if (review && review.classList.contains('open')) closeReview();
    }
  });
}


const OB_KEY = 'aics_pb_onboarded';
const OB_STEPS = [
  { sel: '#stepScene', title: '选一张场景卡 = 一键种子', sub: '自动填故事/情绪/光照' },
  { sel: '#stepDecisions', title: '已预填情绪/镜头/光照', sub: '可改可不改' },
  { sel: '.generate-btn', title: '点这里出 Prompt', sub: 'Prompt 实时生成' },
];
var OB_IDX = 0;
function startOnboard() { if (localStorage.getItem(OB_KEY)) return; document.body.setAttribute('data-ob-active', '1'); OB_IDX = 0; renderOnboard(); }
function renderOnboard() {
  const step = OB_STEPS[OB_IDX]; if (!step) { endOnboard(); return; }
  const spot = document.getElementById('obSpot'), card = document.getElementById('obCard'), tgt = document.querySelector(step.sel);
  if (!tgt) { endOnboard(); return; }
  const r = tgt.getBoundingClientRect();
  spot.style.top = (r.top - 6) + 'px'; spot.style.left = (r.left - 6) + 'px'; spot.style.width = (r.width + 12) + 'px'; spot.style.height = (r.height + 12) + 'px';
  let cx = r.right + 16, cy = r.top;
  if (cx + 320 > window.innerWidth) {
    cx = Math.max(16, r.left - 320);
  }
  if (cx < 16) cx = 16;

  // 检查是否会超出屏幕底部，超出时显示在目标元素上方
  const cardHeight = 200; // 预估卡片高度
  const bottomSpace = window.innerHeight - cy;
  if (bottomSpace < cardHeight && cy > cardHeight) {
    cy = r.top - cardHeight - 12; // 显示在元素上方
  }
  card.style.left = cx + 'px'; card.style.top = cy + 'px';
  document.getElementById('obStepNum').textContent = (OB_IDX + 1) + '/' + OB_STEPS.length;
  document.getElementById('obTitle').textContent = step.title;
  document.getElementById('obNext').textContent = OB_IDX === OB_STEPS.length - 1 ? '完成' : '下一步';
}
function nextOnboard() { OB_IDX++; if (OB_IDX >= OB_STEPS.length) { endOnboard(); return; } renderOnboard(); }
function endOnboard() { localStorage.setItem(OB_KEY, '1'); document.body.removeAttribute('data-ob-active'); }
document.getElementById('obNext').addEventListener('click', nextOnboard);
document.getElementById('obSkip').addEventListener('click', endOnboard);
window.addEventListener('resize', function () { if (document.body.hasAttribute('data-ob-active')) renderOnboard(); });
/* preset select */
function initPresetSelect() {
  const sel = document.getElementById('presetSelect'); if (!sel) return;
  sel.innerHTML = '<option value="">— 自定义 —</option>';
  PRESETS.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; sel.appendChild(o); });
  sel.onchange = function () { applyPreset(this.value); };
}
function applyPreset(id) {
  const p = PRESETS.find(x => x.id === id); if (!p) return;
  document.getElementById('cfg').value = p.cfg;
  document.getElementById('steps').value = p.steps;
  ensureSelectValue('sampler', p.sampler);
  ensureSelectValue('scheduler', p.scheduler || '');
  document.getElementById('size').value = p.size;
  saveSDSettings(); flash('🎚 已应用预设: ' + p.name); updateLivePreview();
}
setTimeout(startOnboard, 800);
window.__bootProbe = { stateHistLen: (state.history||[]).length };

loadData();
refreshProjectSelect();
