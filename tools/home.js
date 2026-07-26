(function(){
  const PRJ_KEY='aics_projects';
  const DRAFT_KEY='aics_pb_last_draft';
  let _cachedProjects = [];
  function esc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function charName(id){ return id==='nene'?'宁宁':(id==='natsume'?'夏目':(id||'·')); }
  function fmtDate(ts){ return new Date(ts).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}); }
  function getProject(id){return _cachedProjects.find(function(p){return p.id===id;});}

  function setContinueLink(href, label, hint){
    const cta=document.getElementById('continueCta'),copy=document.getElementById('continueHint');
    if(!cta)return;
    cta.href=href;cta.innerHTML='<span class="ic">↩</span> '+esc(label);
    if(copy)copy.innerHTML=hint?'<strong>'+esc(hint)+'</strong>':' ';
  }

  function initContinueDraft(){
    try{
      const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
      if(!draft||!draft.updatedAt||(!draft.sceneId&&!draft.story))return false;
      const title=draft.sceneTitle||draft.story||'未完成创作';
      setContinueLink('tools/prompt-builder.html?resume=1','继续上次创作','上次停在「'+String(title).slice(0,24)+'」');
      return true;
    }catch(e){return false;}
  }

  function renderRecentScenes(scenes){
    const section=document.getElementById('recentScenesSection'),host=document.getElementById('recentScenes');
    let recent=AICSceneUX.readRecent(localStorage);
    if(!Array.isArray(recent)||!recent.length||!section||!host)return;
    const picks=recent.map(function(item){return scenes.find(function(scene){return scene.id===item.id;});}).filter(Boolean).slice(0,6);
    if(!picks.length)return;
    section.hidden=false;host.innerHTML='';
    picks.forEach(function(scene){host.appendChild(createSceneCard(scene,{mode:'strip',clickable:true,onPick:function(s){window.location.href='tools/prompt-builder.html?scene='+encodeURIComponent(s.id)+'&step=4&generate=1';}}));});
  }

  function renderSceneHighlights(){
    var host = document.getElementById('featuredScenes');
    if (host) host.innerHTML = '<div class="strip-state">⏳ 正在加载场景…</div>';
    return Promise.all([
      fetch('data/scenes.json?v=9').then(function(r){if(!r.ok)throw new Error('Scenes HTTP '+r.status);return r.json();}),
      fetch('data/curation.json?v=3').then(function(r){if(!r.ok)throw new Error('Curation HTTP '+r.status);return r.json();})
    ]).then(function(result){
      var scenes=result[0],curation=result[1]||{};
      if (!Array.isArray(scenes) || !scenes.length) throw new Error('场景数据为空');
      var signatures=Array.isArray(curation.signatureSceneIds)?curation.signatureSceneIds:[];
      var curated=Array.isArray(curation.curatedSceneIds)?curation.curatedSceneIds:[];
      var ids=signatures.concat(curated.filter(function(id){return signatures.indexOf(id)<0;}));
      document.getElementById('sceneCountCopy').textContent = ids.length + ' 个精选场景';
      document.getElementById('sceneLibraryCopy').textContent = ids.length + ' 个招牌与精选，完整库共 ' + scenes.length + ' 个。';
      if (host) host.innerHTML = '';
      ids.map(function(id){return scenes.find(function(scene){return scene.id===id;});}).filter(function(scene){return scene&&!scene.mature;}).slice(0,6).forEach(function(scene){
        host.appendChild(createSceneCard(scene, {
          mode:'strip', clickable:true,
          onPick:function(s){ window.location.href='tools/prompt-builder.html?scene='+encodeURIComponent(s.id)+'&step=4&generate=1'; }
        }));
      });
      renderRecentScenes(scenes);
    }).catch(function(err){
      if (host) host.innerHTML = '<div class="strip-state strip-state-error">⚠️ 场景加载失败：' + esc(err.message) + '</div>';
      document.getElementById('sceneCountCopy').textContent = '精选场景';
    });
  }

  async function renderRecent(){
    const el = document.getElementById('recentWorks');
    let history = [];
    try {
      history = await AICKVStore.get('aics_pb_history') || [];
      _cachedProjects = await AICKVStore.get(PRJ_KEY) || [];
      if(!history.length){
        const old = JSON.parse(localStorage.getItem('aics_pb_history')) || [];
        if(old.length){ history = old; await AICKVStore.set('aics_pb_history', old); localStorage.removeItem('aics_pb_history'); }
      }
    } catch(e){ console.warn('读取历史失败', e); }

    if(!history.length){
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎞</div>' +
        '<p>作品册还是空的。去开始绘制，留下第一张 CG。</p>' +
        '<a href="tools/prompt-builder.html" class="btn btn-primary">✦ 开始绘制</a></div>';
      return;
    }
    const recent = history.slice(0, 3);
    if(!initContinueDraft()&&recent[0])setContinueLink('tools/prompt-builder.html?regen='+encodeURIComponent(recent[0].id),'继续最近作品','最近保存「'+(recent[0].sceneTitle||recent[0].scene||'未命名')+'」');
    el.innerHTML = recent.map(h=>{
      const seed = h.seed ? ' · seed ' + h.seed : '';
      return `<a class="recent-card" href="tools/prompt-builder.html?regen=${encodeURIComponent(h.id)}">
        <div class="recent-cover" data-image-id="${esc(h.image_id)}"><span class="placeholder">🎬</span></div>
        <div class="recent-body"><div class="recent-title">${esc(h.sceneTitle||h.scene||'未命名')}</div>
        <div class="recent-meta">${esc(charName(h.character))} · ${fmtDate(h.timestamp)}${seed}${h.project?(function(){var p=getProject(h.project);return p?" · "+esc(p.title):"";}()):""}</div></div>
      </a>`;
    }).join('');
    recent.forEach(h=>{
      if(!h.image_id) return;
      AICGImageStore.get(h.image_id).then(function(blob){
        if(!blob) return;
        const cover = el.querySelector('[data-image-id="'+h.image_id+'"]');
        if(!cover) return;
        const url = URL.createObjectURL(blob);
        cover.innerHTML = '<img src="'+url+'" alt="">';
      }).catch(function(){});
    });
  }

  initContinueDraft();
  renderSceneHighlights();
  AICKVStore.init().then(function(){ return renderRecent(); });
})();
