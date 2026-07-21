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
    if(e.lora==null&&e.character&&LORA_ID&&LORA_ID[e.character]){e.lora=LORA_ID[e.character];changed=true;} return e;
  });
  if(out.length!==list.length)changed=true; return {list:out,changed:changed};
}
function loadHistory(){return _cachedHistory;}
function nextVersion(history,scene,character){const same=history.filter(h=>h.scene===scene&&h.character===character);if(!same.length)return{version:1,parent_id:null};const latest=same.reduce((a,b)=>(b.version||0)>(a.version||0)?b:a);return{version:(latest.version||0)+1,parent_id:latest.id};}
function baseEntry(useActual){
  var result=useActual&&_sdLastResult?_sdLastResult:null,queueJob=result&&result.queueJob?result.queueJob:null;
  const sel=queueJob&&queueJob.selections?queueJob.selections:state.selections,sceneId=queueJob?queueJob.sceneId:state.__sceneId;
  const sceneTitle=(window.__scenes__||[]).find(s=>s.id===sceneId);
  var payload=result&&result.payload?result.payload:null,info=result&&result.info?result.info:{};
  var seed=Number(payload&&payload.seed>=0?payload.seed:(result&&result.seed!=null?result.seed:window.__lastSeed__));if(!Number.isFinite(seed))seed=Math.floor(Math.random()*4294967295);seed=Math.max(0,Math.min(4294967295,Math.floor(seed)));
  var prompt=payload&&payload.prompt?payload.prompt:getPlainPrompt(),negative=payload&&typeof payload.negative_prompt==='string'?payload.negative_prompt:getPlainNegative();
  var loras=[];String(prompt||'').replace(/<lora:([^>]+)>/gi,function(_,value){loras.push(value);return _;});
  var width=payload&&payload.width,height=payload&&payload.height,size=width&&height?(width+'×'+height):(document.getElementById('size')?.value||'');
  var checkpoint=payload&&payload.override_settings&&payload.override_settings.sd_model_checkpoint?payload.override_settings.sd_model_checkpoint:(info.sd_model_name||document.getElementById('sdModel')?.value||'');
  var actual=result?{model_name:info.sd_model_name||'',model_hash:info.sd_model_hash||'',all_seeds:Array.isArray(result.seeds)?result.seeds:[],infotext:Array.isArray(result.infotexts)&&result.infotexts.length?result.infotexts[0]:'',parameters:result.parameters||{},payload:payload}:null;
  return {id:Date.now(),timestamp:Date.now(),scene:sceneId||null,sceneTitle:queueJob&&queueJob.sceneTitle?queueJob.sceneTitle:(sceneTitle?sceneTitle.title:null),character:queueJob?queueJob.char:state.char,lora:loras.length?loras.join(', '):(queueJob&&queueJob.lora?queueJob.lora:(resolveLoraSpecs(queueJob?queueJob.char:state.char,sceneTitle).map(loraSpecText).join(', ')||null)),emotion:Array.isArray(sel.emotion)?sel.emotion.slice():[],shot:sel.shot,lighting:sel.lighting,composition:sel.composition,colorMood:queueJob?queueJob.colorMood:state.colorMood,story:queueJob?queueJob.story:state.story,prompt:prompt,negative:negative,cfg:payload?payload.cfg_scale:(document.getElementById('cfg')?.value||''),steps:payload?payload.steps:(document.getElementById('steps')?.value||''),sampler:payload?payload.sampler_name:(document.getElementById('sampler')?.value||''),scheduler:payload?(payload.scheduler||''):(document.getElementById('scheduler')?.value||''),checkpoint:checkpoint,hires_fix:payload?!!payload.enable_hr:!!document.getElementById('sdHiresFix')?.checked,hires_upscaler:payload?(payload.hr_upscaler||''):(document.getElementById('sdHiresUpscaler')?.value||''),size:size,seed:seed,actual:actual,rating:{face:0,expression:0,composition:0,hands:0,atmosphere:0},favorite:false,notes:'',image_id:'',image_url:'',version:1,parent_id:null,project:queueJob?queueJob.projectId:(state.__projectId||'')};
}

function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function loadProjects(){return _cachedProjects;}
function saveProjects(list){_cachedProjects=list;AICKVStore.set(PRJ_KEY,list).catch(function(e){console.warn('projects save fail',e);});}
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
function createProject(){
  var title=prompt('项目名称','');if(!title||!title.trim())return;
  var id='prj_'+Date.now();
  var prj={id:id,title:title.trim(),character:state.char,cover:'',createdAt:Date.now(),updatedAt:Date.now(),history_ids:[]};
  var projects=loadProjects();projects.push(prj);saveProjects(projects);
  state.__projectId=id;refreshProjectSelect();updateGuideBar();flash('已创建项目：'+prj.title);
}
function addHistoryToProject(projectId,entryId){
  var prj=getProject(projectId);if(!prj)return;
  if(prj.history_ids.indexOf(entryId)<0)prj.history_ids.push(entryId);
  prj.updatedAt=Date.now();
  var projects=loadProjects().map(function(p){return p.id===prj.id?prj:p;});
  saveProjects(projects);
}
function removeHistoryFromProject(projectId,entryId){
  var prj=getProject(projectId);if(!prj)return;
  prj.history_ids=prj.history_ids.filter(function(x){return x!==entryId;});
  prj.updatedAt=Date.now();
  var projects=loadProjects().map(function(p){return p.id===prj.id?prj:p;});
  saveProjects(projects);
}
function deleteProject(){
  var id=state.__projectId;if(!id)return;
  var prj=getProject(id);if(!prj)return;
  if(!confirm('删除项目「'+prj.title+'」？历史条目不会被删除。'))return;
  var projects=loadProjects().filter(function(p){return p.id!==id;});
  saveProjects(projects);
  state.__projectId='';refreshProjectSelect();updateGuideBar();flash('已删除项目');
}
function unreferencedImageIds(entries,kept){var refs=new Set(kept.map(h=>h.image_id).filter(Boolean));return entries.map(h=>h.image_id).filter(id=>id&&!refs.has(id));}
async function cleanupImages(entries,kept){var ids=unreferencedImageIds(entries,kept);if(ids.length)await AICGImageStore.deleteMany(ids);}
async function commitHistoryEntry(entry){
  var base=state.history||[];
  var merged=[entry].concat(base.filter(h=>h&&h.id!==entry.id));
  var kept=merged.slice(0,30);
  var evicted=merged.slice(30);
  _cachedHistory=kept;
  state.history=kept;
  PERSONAL_PROFILE=AICSceneUX.buildPreferenceProfile(kept);
  AICKVStore.set(HIS_KEY,kept).catch(function(e){console.warn('history save fail',e);});
  renderHistory();
  renderScenes();
  if(entry.project)addHistoryToProject(entry.project,entry.id);
  cleanupImages(evicted,kept).catch(function(e){flash('记录已保存，旧图片清理失败');});
}
async function saveHistory(){const entry=baseEntry(),v=nextVersion(state.history,entry.scene,entry.character);entry.version=v.version;entry.parent_id=v.parent_id;try{await commitHistoryEntry(entry);flash('💾 已保存');}catch(e){flash('保存失败，请检查浏览器存储空间');}}
async function saveHistoryWithRating(rating,favorite,notes,imageUrl,imageId,useActual){const entry=baseEntry(!!useActual),v=nextVersion(state.history,entry.scene,entry.character);entry.version=v.version;entry.parent_id=v.parent_id;entry.rating=rating;entry.favorite=!!favorite;entry.notes=notes||'';entry.image_id=imageId||'';entry.image_url=normalizeImageUrl(imageUrl);await commitHistoryEntry(entry);}
function renderHistory(){const list=document.getElementById('historyList');document.getElementById('hisCount').textContent=state.history.length;if(!state.history.length){list.innerHTML='<div class="history-empty">尚无记录。每次点击「保存」生成一条快照。</div>';return;}list.innerHTML=state.history.map(h=>{const avg=h.rating?Math.round(((Number(h.rating.face)||0)+(Number(h.rating.expression)||0)+(Number(h.rating.composition)||0)+(Number(h.rating.hands)||0)+(Number(h.rating.atmosphere)||0))/5):0;const title=escapeHtml(h.sceneTitle||h.scene||'未命名场景');const character=escapeHtml(h.character==='natsume'?'夏目':h.character==='nene'?'宁宁':h.character==='both'?'双人':h.character||'—');const version=escapeHtml(h.version||1);const seed=escapeHtml(h.seed||'—');const id=Number(h.id);const ratingText=avg?avg+'/5':'未评分';return `<div class="history-item"><div class="history-main"><div class="history-text" title="${escapeHtml(h.prompt||'')}">${escapeHtml(h.prompt||'')}</div><div class="history-meta"><span class="primary">${title}</span><span class="sep" aria-hidden="true">·</span><span>${character}</span><span class="sep" aria-hidden="true">·</span><span>v${version}</span><span class="sep" aria-hidden="true">·</span><span>seed ${seed}</span></div></div><div class="history-side"><div class="history-rating${avg?' rated':''}" aria-label="${avg?'平均评分 '+avg+' 分':'未评分'}"><span class="star" aria-hidden="true">★</span><span>${ratingText}</span>${h.favorite?'<span class="favorite" title="已收藏" aria-label="已收藏">♥</span>':''}</div><div class="history-actions"><button type="button" class="history-action primary" onclick="loadHistoryId(${id})">载入</button><button type="button" class="history-action" onclick="copyHistoryId(${id})">复制</button><button type="button" class="history-action delete" onclick="deleteHistoryId(${id})" title="删除记录" aria-label="删除记录">×</button></div></div></div>`;}).join('');}
function loadHistoryId(id){const h=state.history.find(x=>x.id===id);if(h)restoreFromEntry(h,false);} function copyHistoryId(id){const h=state.history.find(x=>x.id===id);if(h)navigator.clipboard.writeText(h.prompt||'').then(()=>flash('📋 已复制'));}
async function deleteHistoryId(id){var removed=state.history.filter(h=>h.id===id);var entry=removed[0];var prjId=entry&&entry.project;var kept=state.history.filter(h=>h.id!==id);_cachedHistory=kept;state.history=kept;PERSONAL_PROFILE=AICSceneUX.buildPreferenceProfile(kept);AICKVStore.set(HIS_KEY,kept).catch(function(e){flash('删除失败');return;});renderHistory();renderScenes();if(prjId)removeHistoryFromProject(prjId,id);cleanupImages(removed,kept).catch(function(e){flash('记录已删除，图片清理失败');});}
