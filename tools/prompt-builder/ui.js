/* Prompt Builder module: actions, review UI, and shared feedback.
 * This file intentionally uses classic script globals for inline HTML handlers.
 */

// ========== ACTIONS ==========
function toggleFocusMode(force) {
  var body = document.body;
  var button = document.getElementById('focusModeBtn');
  var label = button && button.querySelector('.focus-mode-label');
  var active = typeof force === 'boolean' ? force : !body.classList.contains('focus-mode');
  body.classList.toggle('focus-mode', active);
  if (button) {
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.setAttribute('aria-label', active ? '退出专注成片模式' : '进入专注成片模式');
    button.title = active ? '退出专注（Esc 或 F）' : '专注成片（F）';
  }
  if (label) label.textContent = active ? '退出专注' : '专注成片';
  if (active) {
    if (typeof closeUtilityMenu === 'function') closeUtilityMenu();
    requestAnimationFrame(function () { window.scrollTo({ top:0, behavior:'smooth' }); });
  }
  return active;
}

function toggleConcise(on) {
  state.concise = !!on;
  // 精简模式下隐藏次要模块参数 (保留 quality/tail/negative, 其他 UI 不动但 buildParts 忽略)
  ['emotion','shot','lighting','composition'].forEach(k => {
    const row = document.querySelector('#opt-' + (k==='emotion'?'emotion':k));
  });
  document.querySelectorAll('#chip-emotion .chip-select,#moodGrid .mood-card').forEach(o => o.style.opacity = on ? '0.4' : '1');
  document.querySelectorAll('#opt-shot .option,#opt-lighting .option,#opt-composition .option').forEach(o => o.style.opacity = on ? '0.4' : '1');
  updateLivePreview();
}
function copyPrompt() {
  const text = getPlainPrompt(); if (!text) return;
  navigator.clipboard.writeText(text).then(() => flash('📋 已复制'));
}
function clearAll() {
  if (typeof clearSceneContext === 'function') clearSceneContext({ keepStory:false, silent:true });
  else {
    state.selections = { emotion:[], shot:null, lighting:null, composition:null }; state.colorMood = null; state.story = '';
    state.manualTags.clear(); document.getElementById('storyInput').value = '';
    document.querySelectorAll('#chip-emotion .chip-select,#opt-shot .option,#opt-lighting .option,#opt-composition .option,#moodGrid .mood-card').forEach(function(control){
      control.classList.remove('selected'); control.setAttribute('aria-pressed','false');
    });
  }
  try { if (typeof DRAFT_KEY !== 'undefined') localStorage.removeItem(DRAFT_KEY); } catch(e) {}
  renderManualTags(); renderTraits(); renderSelRow(); renderDirectorModeSummary(); refreshVoiceText(true); goStep(1); updateLivePreview();
}
function exportPrompt() {
  const text = getPlainPrompt(); if (!text) return;
  const char = state.char;
  const body = text + '\n\n# char: ' + char + '\n# cfg: ' + document.getElementById('cfg').value + '\n# steps: ' + document.getElementById('steps').value + '\n# sampler: ' + document.getElementById('sampler').value + '\n# scheduler: ' + document.getElementById('scheduler').value + '\n# checkpoint: ' + (document.getElementById('sdModel').value || 'WebUI current');
  const blob = new Blob([body], { type:'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'prompt_' + char + '_' + Date.now() + '.txt';
  a.click(); URL.revokeObjectURL(a.href); flash('⬇️ 已导出');
}
const PNG_BG = '#1A1A2E', PNG_ACCENT = '#F06292', PNG_TEXT = '#E8E8F0', PNG_DIM = '#A8A8C0';
const CLS_COLOR = { q:'#FFD54F', c:'#F06292', t:'#42A5F5', l:'#66BB6A', n:'#EF5350' };
function exportPNG() {
  const parts = buildParts(); if (!parts.length) return;
  const W = 900, pad = 40, lineH = 30, headH = 100, footH = 80;
  const lines = parts.map(p => ({ cls:p.cls, text:p.text }));
  const H = headH + pad + lines.length * lineH + pad + footH + pad;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = PNG_BG; x.fillRect(0, 0, W, H);
  x.fillStyle = PNG_ACCENT; x.font = 'bold 26px system-ui, sans-serif';
  x.fillText('🌸 Prompt Builder · 导演工作台', pad, 44);
  x.fillStyle = PNG_DIM; x.font = '14px monospace';
  x.fillText('Story: ' + (state.story || '—'), pad, 72);
  x.strokeStyle = PNG_ACCENT; x.lineWidth = 2; x.beginPath(); x.moveTo(pad, headH); x.lineTo(W - pad, headH); x.stroke();
  x.font = '18px monospace';
  let y = headH + pad + 20;
  lines.forEach(ln => {
    x.fillStyle = CLS_COLOR[ln.cls] || PNG_TEXT;
    const maxChars = 62; let rest = ln.text;
    while (rest.length) { let chunk = rest.length > maxChars ? rest.slice(0, maxChars) : rest; x.fillText(chunk, pad, y); rest = rest.slice(maxChars); if (rest.length) y += lineH; }
    y += lineH;
  });
  y += 10;
  x.strokeStyle = '#3A3A55'; x.lineWidth = 1; x.beginPath(); x.moveTo(pad, y); x.lineTo(W - pad, y); x.stroke();
  y += 32; x.fillStyle = PNG_DIM; x.font = '15px system-ui, sans-serif';
  const cfg = document.getElementById('cfg').value, steps = document.getElementById('steps').value, sampler = document.getElementById('sampler').value;
  x.fillText('char: ' + state.char + '  ·  CFG ' + cfg + '  ·  Steps ' + steps, pad, y); y += 24;
  x.fillText('sampler: ' + sampler, pad, y);
  const a = document.createElement('a'); a.download = 'prompt_' + state.char + '_' + Date.now() + '.png';
  cv.toBlob(blob => { a.href = URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href); }, 'image/png');
  flash('📷 已导出 PNG');
}


// ========== TRAIN ==========
function toggleTrain() {
  var c = document.getElementById('trainContent');
  var b = document.querySelector('.collapsible-btn');
  if (c) c.classList.toggle('open');
  if (b) b.classList.toggle('open');
}
function toggleMonitor() { const m=document.getElementById('promptMonitor'); const t=document.getElementById('monitorToggle'); m.classList.toggle('monitor-preview-collapsed'); const collapsed=m.classList.contains('monitor-preview-collapsed'); if(t) t.textContent = collapsed ? '展开' : '收起'; }
function toggleResult() { const d=document.getElementById('promptDetails'); if(!d) return; d.open=!d.open; if(event.target && event.target.tagName==='BUTTON') event.target.textContent = d.open?'收起 Prompt':'展开 Prompt'; }

// ========== TOAST ==========
function flash(msg) {
  let t = document.getElementById('pb-toast');
  if (!t) { t = document.createElement('div'); t.id = 'pb-toast'; t.setAttribute('role','status'); t.setAttribute('aria-live','polite'); t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:9999;background:var(--bg-surface);border:1px solid var(--accent);color:var(--text-primary);padding:var(--s-2) var(--s-4);border-radius:var(--r-md);font-size:0.85rem;box-shadow:var(--shadow-lg);opacity:0;transition:opacity .2s;'; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1'; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.style.opacity = '0', 1400);
}

// ========== REVIEW ==========
const REVIEW_AXES=[{key:'face',label:'人物一致性'},{key:'expression',label:'表情'},{key:'composition',label:'构图'},{key:'hands',label:'手部'},{key:'atmosphere',label:'氛围'}];
const REVIEW_IMAGE_TYPES={'image/png':['png'],'image/jpeg':['jpg','jpeg'],'image/webp':['webp']};
let reviewState=newReviewState();
let reviewReturnFocus=null;
function newReviewState(){return{ratings:{face:0,expression:0,composition:0,hands:0,atmosphere:0},favorite:false,notes:'',image_file:null,image_url:'',preview_url:'',submitting:false};}
function revokeReviewPreview(){if(reviewState.preview_url){URL.revokeObjectURL(reviewState.preview_url);reviewState.preview_url='';}}
function clearReviewPreview(){var p=document.getElementById('reviewImagePreview');p.onerror=null;p.className='review-image-preview';p.removeAttribute('src');}
function showReviewPreview(src,isLocal){var p=document.getElementById('reviewImagePreview');p.onerror=function(){if(p.getAttribute('src')!==src)return;p.className='review-image-preview';document.getElementById('reviewImageFeedback').textContent=isLocal?'图片无法解码，请重新导出后再试':'图片加载失败，仍可保存此 URL';};p.src=src;p.className='review-image-preview show';}
function openReview(){reviewReturnFocus=document.activeElement;revokeReviewPreview();reviewState=newReviewState();renderReviewAxes();document.getElementById('reviewFav').className='review-fav-toggle';document.getElementById('reviewFav').textContent='💜 收藏';document.getElementById('reviewFav').setAttribute('aria-pressed','false');document.getElementById('reviewNotes').value='';document.getElementById('reviewImageFile').value='';document.getElementById('reviewImageFileName').textContent='未选择图片';document.getElementById('reviewImageRemove').classList.remove('show');document.getElementById('reviewImageUrl').value='';document.getElementById('reviewImageFeedback').textContent='';document.getElementById('reviewSubmit').disabled=false;document.getElementById('reviewSubmit').textContent='保存评价';clearReviewPreview();document.getElementById('reviewOverlay').classList.add('open');document.body.classList.add('modal-open');requestAnimationFrame(function(){document.getElementById('reviewCard').focus();});}
function validateImageFile(file){if(!file||!file.size)return'图片文件为空';var allowed=REVIEW_IMAGE_TYPES[file.type];if(!allowed)return'请选择 PNG、JPG 或 WebP 图片';var ext=(file.name.split('.').pop()||'').toLowerCase();return allowed.includes(ext)?'':'图片扩展名与文件类型不匹配';}
function decodeImageFile(file){if(typeof createImageBitmap==='function')return createImageBitmap(file).then(function(b){var ok=b.width>0&&b.height>0;b.close();if(!ok)throw Error();});return new Promise(function(resolve,reject){var url=URL.createObjectURL(file),img=new Image();img.onload=function(){URL.revokeObjectURL(url);img.naturalWidth&&img.naturalHeight?resolve():reject();};img.onerror=function(){URL.revokeObjectURL(url);reject();};img.src=url;});}
async function updateReviewImageFile(){var input=document.getElementById('reviewImageFile'),file=input.files&&input.files[0],feedback=document.getElementById('reviewImageFeedback'),error=validateImageFile(file);if(error){input.value='';feedback.textContent=error;return;}try{await decodeImageFile(file);}catch(e){input.value='';feedback.textContent='图片无法解码，请重新导出后再试';return;}revokeReviewPreview();reviewState.image_file=file;reviewState.preview_url=URL.createObjectURL(file);document.getElementById('reviewImageFileName').textContent=file.name+' · '+Math.max(1,Math.round(file.size/1024))+' KB';document.getElementById('reviewImageRemove').classList.add('show');feedback.textContent='';showReviewPreview(reviewState.preview_url,true);}
function removeReviewImageFile(){revokeReviewPreview();reviewState.image_file=null;document.getElementById('reviewImageFile').value='';document.getElementById('reviewImageFileName').textContent='未选择图片';document.getElementById('reviewImageRemove').classList.remove('show');updateReviewImageUrl();}
function updateReviewImageUrl(){var input=document.getElementById('reviewImageUrl'),feedback=document.getElementById('reviewImageFeedback'),url=normalizeImageUrl(input.value);reviewState.image_url=url;if(reviewState.image_file){feedback.textContent=input.value.trim()&&!url?'URL 无效；保存时仍使用本地图片':'';return;}clearReviewPreview();if(!input.value.trim()){feedback.textContent='';return;}if(!url){feedback.textContent='仅支持 http 或 https 图片 URL';return;}feedback.textContent='';showReviewPreview(url,false);}
function closeReview(){if(reviewState.submitting)return;revokeReviewPreview();document.getElementById('reviewOverlay').classList.remove('open');document.body.classList.remove('modal-open');if(reviewReturnFocus&&typeof reviewReturnFocus.focus==='function')reviewReturnFocus.focus();reviewReturnFocus=null;}
function renderReviewAxes(){document.getElementById('reviewAxes').innerHTML=REVIEW_AXES.map(ax=>`<div class="review-axis"><div class="review-axis-label" id="review-${ax.key}">${ax.label}</div><div class="review-stars" data-axis="${ax.key}" role="group" aria-labelledby="review-${ax.key}">${[1,2,3,4,5].map(n=>`<button type="button" class="review-star" data-n="${n}" aria-label="${n} 星" aria-pressed="false" onclick="setRating('${ax.key}',${n})">★</button>`).join('')}</div></div>`).join('');}
function setRating(axis,n){reviewState.ratings[axis]=n;document.querySelectorAll('.review-stars[data-axis="'+axis+'"] .review-star').forEach(s=>{const on=+s.dataset.n<=n;s.classList.toggle('on',on);s.setAttribute('aria-pressed',on?'true':'false');});}
function toggleFav(){reviewState.favorite=!reviewState.favorite;const el=document.getElementById('reviewFav');el.classList.toggle('on',reviewState.favorite);el.setAttribute('aria-pressed',reviewState.favorite?'true':'false');el.textContent=reviewState.favorite?'💜 已收藏':'💜 收藏';}
async function submitReview(){if(reviewState.submitting)return;reviewState.notes=document.getElementById('reviewNotes').value;reviewState.submitting=true;var button=document.getElementById('reviewSubmit'),imageId='';button.disabled=true;button.textContent='保存中…';try{if(reviewState.image_file)imageId=await AICGImageStore.put(reviewState.image_file);try{await saveHistoryWithRating(reviewState.ratings,reviewState.favorite,reviewState.notes,reviewState.image_url,imageId);}catch(error){if(imageId)await AICGImageStore.delete(imageId).catch(function(err){console.warn('[B4] 回滚 image 删除失败，可能残留孤儿 blob',err);});throw error;}reviewState.submitting=false;closeReview();flash('⭐ 评价已保存');}catch(error){reviewState.submitting=false;button.disabled=false;button.textContent='保存评价';document.getElementById('reviewImageFeedback').textContent='保存失败，记录未保存，请检查浏览器存储空间';}}
document.getElementById('reviewOverlay').addEventListener('click',function(e){if(e.target===this)closeReview();});
document.getElementById('reviewOverlay').addEventListener('keydown',function(e){
  if(e.key!=='Tab')return;
  var focusable=Array.from(this.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function(el){return el.offsetParent!==null;});
  if(!focusable.length)return;
  var first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
window.addEventListener('pagehide',revokeReviewPreview);

window.AICG_Pipeline = {
  getWorkbenchState: function() {
    return {
      currentStory: state.story,
      selectedCharacter: state.char,
      activeSceneId: state.__sceneId,
      decisions: JSON.parse(JSON.stringify(state.selections)),
      colorMood: state.colorMood,
      customManualTags: Array.from(state.manualTags),
      compiledPositivePrompt: getPlainPrompt(),
      compiledNegativePrompt: getPlainNegative()
    };
  },
  injectAISmartDecisions: function(aiData) {
    if (!aiData) return false;
    if (aiData.story) {
      state.story = aiData.story;
      var inputEl = document.getElementById('storyInput');
      if (inputEl) inputEl.value = aiData.story;
    }
    if (aiData.emotion) state.selections.emotion = Array.isArray(aiData.emotion) ? aiData.emotion : [aiData.emotion];
    if (aiData.shot) selectShot(aiData.shot);
    if (aiData.lighting) selectLighting(aiData.lighting);
    if (aiData.composition) selectComposition(aiData.composition);
    if (aiData.colorMood) selectMood(aiData.colorMood);
    if (Array.isArray(aiData.tags)) {
      aiData.tags.forEach(function(t) { state.manualTags.add(t); });
    }
    renderManualTags(); renderTraits(); renderSelRow(); updateLivePreview(); updateGuideBar();
    flash("AI 智能导演决策已注入");
    return true;
  }
};
