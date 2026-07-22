/* Prompt Builder module: history, projects, and persisted records.
 * This file intentionally uses classic script globals for inline HTML handlers.
 */

// ========== HISTORY ==========
function normalizeImageUrl(value){
  if(typeof value !== 'string' || !value.trim()) return '';
  try { var url=new URL(value.trim(),window.location.href); return url.protocol==='http:'||url.protocol==='https:'?url.href:''; } catch(e){ return ''; }
}
function migrateHistory(list){
  var changed=false, axes=['face','expression','composition','hands','atmosphere'];
  var out=list.filter(function(h){return h&&typeof h==='object';}).map(function(h){
    var e=Object.assign({},h);
    if(e.id==null){e.id=e.timestamp||0;changed=true;} if(e.timestamp==null){e.timestamp=e.id;changed=true;}
    var seed=Number(e.seed); if(!Number.isFinite(seed)){e.seed=Math.floor(Math.random()*4294967295);changed=true;} else {seed=Math.max(0,Math.min(4294967295,Math.floor(seed)));if(seed!==e.seed){e.seed=seed;changed=true;}}
    var r=e.rating||{},nr={},dirty=false; axes.forEach(function(k){var v=Number(r[k]);if(!Number.isFinite(v)){v=0;dirty=true;}nr[k]=Math.max(0,Math.min(5,Math.round(v)));}); if(dirty){e.rating=nr;changed=true;}
    if(typeof e.favorite!=='boolean'){e.favorite=!!e.favorite;changed=true;} if(typeof e.notes!=='string'){e.notes=e.notes==null?'':String(e.notes);changed=true;} if(e.negative==null){e.negative=NEGATIVE;changed=true;}
    var imageId=typeof e.image_id==='string'?e.image_id.trim():''; if(e.image_id!==imageId){e.image_id=imageId;changed=true;}
    var imageUrl=normalizeImageUrl(e.image_url); if(e.image_url!==imageUrl){e.image_url=imageUrl;changed=true;}
    if(!Array.isArray(e.manual_tags)&&Array.isArray(e.manualTags)){e.manual_tags=e.manualTags.slice();changed=true;}
    if(e.manual_tags!=null&&!Array.isArray(e.manual_tags)){delete e.manual_tags;changed=true;}
    if(e.lora==null&&e.character&&LORA_ID&&LORA_ID[e.character]){e.lora=LORA_ID[e.character];changed=true;} return e;
  });
  if(out.length!==list.length)changed=true; return {list:out,changed:changed};
}
function loadHistory(){return _cachedHistory;}
function historyVersionValue(entry){var value=Number(entry&&entry.version);return Number.isFinite(value)&&value>0?Math.floor(value):0;}
function nextVersion(history,scene,character){const same=history.filter(h=>h.scene===scene&&h.character===character);if(!same.length)return{version:1,parent_id:null};const latest=same.reduce((a,b)=>historyVersionValue(b)>historyVersionValue(a)?b:a);return{version:historyVersionValue(latest)+1,parent_id:latest.id};}
function nextHistoryId(history,preferredId){
  var used=new Set();
  (history||[]).forEach(function(item){var id=Number(item&&item.id);if(Number.isSafeInteger(id))used.add(id);});
  var preferred=Number(preferredId);
  if(preferredId!=null&&preferredId!==''&&Number.isSafeInteger(preferred)&&!used.has(preferred))return preferred;
  var candidate=Math.floor(Date.now());
  while(used.has(candidate)&&candidate<Number.MAX_SAFE_INTEGER)candidate+=1;
  if(!used.has(candidate)&&Number.isSafeInteger(candidate))return candidate;
  candidate=1;
  while(used.has(candidate)&&candidate<Number.MAX_SAFE_INTEGER)candidate+=1;
  if(!used.has(candidate))return candidate;
  throw new Error('No safe numeric history id is available');
}
function baseEntry(useActual){
  var result=useActual&&_sdLastResult?_sdLastResult:null,queueJob=result&&result.queueJob?result.queueJob:null;
  const sel=queueJob&&queueJob.selections?queueJob.selections:state.selections,sceneId=queueJob?queueJob.sceneId:state.__sceneId;
  const sceneTitle=(SCENES||[]).find(s=>s.id===sceneId);
  var payload=result&&result.payload?result.payload:null,info=result&&result.info?result.info:{};
  var seed=Number(payload&&payload.seed>=0?payload.seed:(result&&result.seed!=null?result.seed:window.__lastSeed__));if(!Number.isFinite(seed))seed=Math.floor(Math.random()*4294967295);seed=Math.max(0,Math.min(4294967295,Math.floor(seed)));
  var prompt=payload&&payload.prompt?payload.prompt:getPlainPrompt(),negative=payload&&typeof payload.negative_prompt==='string'?payload.negative_prompt:getPlainNegative();
  var loras=[];String(prompt||'').replace(/<lora:([^>]+)>/gi,function(_,value){loras.push(value);return _;});
  var width=payload&&payload.width,height=payload&&payload.height,size=width&&height?(width+'×'+height):(document.getElementById('size')?.value||'');
  var checkpoint=payload&&payload.override_settings&&payload.override_settings.sd_model_checkpoint?payload.override_settings.sd_model_checkpoint:(info.sd_model_name||document.getElementById('sdModel')?.value||'');
  var actual=result?{model_name:info.sd_model_name||'',model_hash:info.sd_model_hash||'',all_seeds:Array.isArray(result.seeds)?result.seeds:[],infotext:Array.isArray(result.infotexts)&&result.infotexts.length?result.infotexts[0]:'',parameters:result.parameters||{},payload:payload}:null;
  var manualTags=queueJob&&Array.isArray(queueJob.manualTags)?queueJob.manualTags:Array.from(state.manualTags||[]);
  return {id:null,timestamp:Date.now(),scene:sceneId||null,sceneTitle:queueJob&&queueJob.sceneTitle?queueJob.sceneTitle:(sceneTitle?sceneTitle.title:null),character:queueJob?queueJob.char:state.char,lora:loras.length?loras.join(', '):(queueJob&&queueJob.lora?queueJob.lora:(resolveLoraSpecs(queueJob?queueJob.char:state.char,sceneTitle).map(loraSpecText).join(', ')||null)),emotion:Array.isArray(sel.emotion)?sel.emotion.slice():[],shot:sel.shot,lighting:sel.lighting,composition:sel.composition,colorMood:queueJob?queueJob.colorMood:state.colorMood,story:queueJob?queueJob.story:state.story,manual_tags:manualTags.slice(),prompt:prompt,negative:negative,cfg:payload?payload.cfg_scale:(document.getElementById('cfg')?.value||''),steps:payload?payload.steps:(document.getElementById('steps')?.value||''),sampler:payload?payload.sampler_name:(document.getElementById('sampler')?.value||''),scheduler:payload?(payload.scheduler||''):(document.getElementById('scheduler')?.value||''),checkpoint:checkpoint,hires_fix:payload?!!payload.enable_hr:!!document.getElementById('sdHiresFix')?.checked,hires_upscaler:payload?(payload.hr_upscaler||''):(document.getElementById('sdHiresUpscaler')?.value||''),size:size,seed:seed,actual:actual,rating:{face:0,expression:0,composition:0,hands:0,atmosphere:0},favorite:false,notes:'',image_id:'',image_url:'',version:1,parent_id:null,project:queueJob?queueJob.projectId:(state.__projectId||'')};
}

function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function loadProjects(){return _cachedProjects;}
async function saveProjects(list){
  var snapshot=list.map(function(project){return Object.assign({},project,{history_ids:Array.isArray(project.history_ids)?project.history_ids.slice():[]});});
  await AICKVStore.set(PRJ_KEY,snapshot);
  _cachedProjects=snapshot;
  return snapshot;
}
function getProject(id){return loadProjects().find(function(p){return p.id===id;});}
function refreshProjectSelect(){
  var sel=document.getElementById('projectSelect');if(!sel)return;
  var projects=loadProjects();var cur=state.__projectId||'';
  sel.innerHTML='<option value="">— 无项目 —</option>'+projects.map(function(p){return '<option value="'+p.id+'"'+(p.id===cur?' selected':'')+'>'+esc(p.title)+'</option>';}).join('');
}
function switchProject(id){
  state.__projectId=id;
  if(id){var prj=getProject(id);if(prj)flash('切换到项目：'+prj.title);}
  updateGuideBar();
}
async function createProject(){
  var title=prompt('项目名称','');if(!title||!title.trim())return;
  var id='prj_'+Date.now();
  var prj={id:id,title:title.trim(),character:state.char,cover:'',createdAt:Date.now(),updatedAt:Date.now(),history_ids:[]};
  var projects=loadProjects().slice();projects.push(prj);
  try{await saveProjects(projects);state.__projectId=id;refreshProjectSelect();updateGuideBar();flash('已创建项目：'+prj.title);}
  catch(error){console.warn('project create save fail',error);flash('项目创建失败，请检查浏览器存储空间');}
}
function addHistoryToProject(projectId,entryId){
  var prj=getProject(projectId);if(!prj)return Promise.resolve(false);
  var updated=Object.assign({},prj,{history_ids:(prj.history_ids||[]).slice(),updatedAt:Date.now()});
  if(updated.history_ids.indexOf(entryId)<0)updated.history_ids.push(entryId);
  var projects=loadProjects().map(function(p){return p.id===updated.id?updated:p;});
  return saveProjects(projects).then(function(){return true;});
}
function removeHistoryFromProject(projectId,entryId){
  var prj=getProject(projectId);if(!prj)return Promise.resolve(false);
  var updated=Object.assign({},prj,{history_ids:(prj.history_ids||[]).filter(function(x){return x!==entryId;}),updatedAt:Date.now()});
  var projects=loadProjects().map(function(p){return p.id===updated.id?updated:p;});
  return saveProjects(projects).then(function(){return true;});
}
async function deleteProject(){
  var id=state.__projectId;if(!id)return;
  var prj=getProject(id);if(!prj)return;
  if(!confirm('删除项目「'+prj.title+'」？历史条目不会被删除。'))return;
  var projects=loadProjects().filter(function(p){return p.id!==id;});
  try{await saveProjects(projects);state.__projectId='';refreshProjectSelect();updateGuideBar();flash('已删除项目');}
  catch(error){console.warn('project delete save fail',error);flash('项目删除失败，原项目已保留');}
}
function unreferencedImageIds(entries,kept){var refs=new Set(kept.map(h=>h.image_id).filter(Boolean));return entries.map(h=>h.image_id).filter(id=>id&&!refs.has(id));}
async function cleanupImages(entries,kept){var ids=unreferencedImageIds(entries,kept);if(ids.length)await AICGImageStore.deleteMany(ids);}
var _historyWriteChain=Promise.resolve();
function queueHistoryWrite(action){
  var operation=_historyWriteChain.then(action);
  _historyWriteChain=operation.catch(function(){});
  return operation;
}
function applyPersistedHistory(history){
  _cachedHistory=history;
  state.history=history;
  PERSONAL_PROFILE=AICSceneUX.buildPreferenceProfile(history);
  renderHistory();
  renderScenes();
}
function commitHistoryEntry(entry){
  return queueHistoryWrite(async function(){
    var base=state.history||[];
    entry.id=nextHistoryId(base,entry.id);
    var version=nextVersion(base,entry.scene,entry.character);
    entry.version=version.version;
    entry.parent_id=version.parent_id;
    var merged=[entry].concat(base.filter(function(h){return h&&h.id!==entry.id;}));
    await AICKVStore.set(HIS_KEY,merged);
    applyPersistedHistory(merged);
    if(entry.project){
      try{await addHistoryToProject(entry.project,entry.id);}
      catch(error){console.warn('project history link save fail',error);flash('记录已保存，但项目关联更新失败');}
    }
    return entry;
  });
}
async function saveHistory(){const entry=baseEntry();try{await commitHistoryEntry(entry);flash('💾 已保存');}catch(e){flash('保存失败，请检查浏览器存储空间');}}
async function saveHistoryWithRating(rating,favorite,notes,imageUrl,imageId,useActual){const entry=baseEntry(!!useActual);entry.rating=rating;entry.favorite=!!favorite;entry.notes=notes||'';entry.image_id=imageId||'';entry.image_url=normalizeImageUrl(imageUrl);await commitHistoryEntry(entry);}
var HISTORY_THUMB_URLS=[];
var HISTORY_PAGE_SIZE=30,HISTORY_VISIBLE_LIMIT=HISTORY_PAGE_SIZE;
function revokeHistoryThumbUrls(){HISTORY_THUMB_URLS.forEach(function(url){URL.revokeObjectURL(url);});HISTORY_THUMB_URLS=[];}
function historyCharacterLabel(value){return value==='natsume'?'夏目':value==='nene'?'宁宁':value==='triad'||value==='both'?'双人':value||'—';}
function historyFallbackImage(value){return value==='natsume'?'../assets/characters/natsume-official.webp':'../assets/characters/nene-official.webp';}
function useHistoryFallback(image){if(!image)return;image.onerror=null;image.src=image.dataset.fallback||'../assets/characters/nene-official.webp';image.classList.add('history-placeholder');var badge=image.parentElement&&image.parentElement.querySelector('.history-thumb-badge');if(badge)badge.textContent='Prompt 快照';}
function hydrateHistoryImages(list){
  list.querySelectorAll('img[data-image-id]').forEach(function(image){
    var imageId=image.dataset.imageId;if(!imageId)return;
    AICGImageStore.get(imageId).then(function(blob){
      if(!blob||!image.isConnected)return;
      var url=URL.createObjectURL(blob);HISTORY_THUMB_URLS.push(url);image.src=url;image.classList.remove('history-placeholder');
      var badge=image.parentElement&&image.parentElement.querySelector('.history-thumb-badge');if(badge)badge.textContent='生成图';
    }).catch(function(){});
  });
}
function renderHistory(){
  const list=document.getElementById('historyList');document.getElementById('hisCount').textContent=state.history.length;revokeHistoryThumbUrls();
  if(!state.history.length){list.innerHTML='<div class="history-empty">尚无记录。生成后保存，作品会在这里变成可继续编辑的卡片。</div>';return;}
  var visibleHistory=state.history.slice(0,HISTORY_VISIBLE_LIMIT);
  list.innerHTML=visibleHistory.map(function(h){
    const avg=h.rating?Math.round(((Number(h.rating.face)||0)+(Number(h.rating.expression)||0)+(Number(h.rating.composition)||0)+(Number(h.rating.hands)||0)+(Number(h.rating.atmosphere)||0))/5):0;
    const sourceScene=(SCENES||[]).find(function(scene){return scene.id===h.scene;});
    const title=escapeHtml(h.sceneTitle||(sourceScene&&sourceScene.title)||h.scene||'未命名场景'),character=escapeHtml(historyCharacterLabel(h.character)),version=escapeHtml(h.version||1),seed=escapeHtml(h.seed||'—'),id=Number(h.id),ratingText=avg?avg+'/5':'未评分';
    const fallback=historyFallbackImage(h.character),hasImage=!!(h.image_id||h.image_url),src=h.image_url||fallback,imageAttrs=h.image_id?' data-image-id="'+escapeHtml(h.image_id)+'"':'';
    return '<article class="history-item"><div class="history-thumb"><img class="'+(h.image_url?'':'history-placeholder')+'" src="'+escapeHtml(src)+'" data-fallback="'+fallback+'"'+imageAttrs+' alt="'+title+' 缩略图" loading="lazy" onerror="useHistoryFallback(this)"><span class="history-thumb-badge">'+(hasImage?'生成图':'Prompt 快照')+'</span></div><div class="history-main"><div class="history-card-title">'+title+'</div><div class="history-text" title="'+escapeHtml(h.prompt||'')+'">'+escapeHtml(h.story||h.prompt||'')+'</div><div class="history-meta"><span class="primary">'+character+'</span><span class="sep" aria-hidden="true">·</span><span>v'+version+'</span><span class="sep" aria-hidden="true">·</span><span>seed '+seed+'</span></div><div class="history-side"><div class="history-rating'+(avg?' rated':'')+'" aria-label="'+(avg?'平均评分 '+avg+' 分':'未评分')+'"><span class="star" aria-hidden="true">★</span><span>'+ratingText+'</span>'+(h.favorite?'<span class="favorite" title="已收藏" aria-label="已收藏">♥</span>':'')+'</div><div class="history-actions"><button type="button" class="history-action primary" onclick="continueHistoryId('+id+')">继续编辑</button><button type="button" class="history-action" onclick="copyHistoryId('+id+')" aria-label="复制提示词">复制</button><button type="button" class="history-action delete" onclick="deleteHistoryId('+id+')" title="删除记录" aria-label="删除记录">×</button></div></div></div></article>';
  }).join('')+(state.history.length>visibleHistory.length?'<div class="history-empty"><button type="button" class="history-action" onclick="showMoreHistory()">显示更早的 '+Math.min(HISTORY_PAGE_SIZE,state.history.length-visibleHistory.length)+' 条</button><div>全部 '+state.history.length+' 条记录均保存在本地</div></div>':'');
  hydrateHistoryImages(list);
}
function showMoreHistory(){HISTORY_VISIBLE_LIMIT+=HISTORY_PAGE_SIZE;renderHistory();}
function continueHistoryId(id){const h=state.history.find(x=>x.id===id);if(!h)return;restoreFromEntry(h,false);goStep(1);var workspace=document.querySelector('.director-workspace');if(workspace)workspace.scrollIntoView({behavior:'smooth',block:'start'});flash('已继续编辑「'+(h.sceneTitle||'历史快照')+'」');}
function loadHistoryId(id){continueHistoryId(id);}
function copyHistoryId(id){const h=state.history.find(x=>x.id===id);if(h)navigator.clipboard.writeText(h.prompt||'').then(()=>flash('已复制提示词'));}
async function deleteHistoryId(id){
  var selected=(state.history||[]).find(function(h){return h.id===id;});
  if(!selected)return false;
  if(!confirm('删除「'+(selected.sceneTitle||'这条历史记录')+'」？此操作不可撤销。'))return false;
  return queueHistoryWrite(async function(){
    var removed=(state.history||[]).filter(function(h){return h.id===id;});
    if(!removed.length)return false;
    var entry=removed[0],prjId=entry&&entry.project;
    var kept=(state.history||[]).filter(function(h){return h.id!==id;});
    try{await AICKVStore.set(HIS_KEY,kept);}
    catch(error){console.warn('history delete save fail',error);flash('删除失败，记录和图片均已保留');return false;}
    applyPersistedHistory(kept);
    if(prjId){
      try{await removeHistoryFromProject(prjId,id);}
      catch(error){console.warn('project history unlink save fail',error);flash('记录已删除，但项目索引更新失败');}
    }
    try{await cleanupImages(removed,kept);}
    catch(error){console.warn('history image cleanup fail',error);flash('记录已删除，图片清理失败');}
    return true;
  });
}
window.addEventListener('pagehide',revokeHistoryThumbUrls);
