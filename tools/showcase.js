(function(){
  'use strict';
  const PAGE_SIZE=24;
  const LABELS={nene:'绫地宁宁',natsume:'四季夏目',triad:'宁宁 × 夏目',All:'全年龄',R15:'R15',R18:'R18'};
  const state={entries:[],filtered:[],featured:new Set(),scope:'all',character:'all',rating:'all',visible:PAGE_SIZE,currentId:''};
  const grid=document.getElementById('showcaseGrid'),count=document.getElementById('resultCount'),search=document.getElementById('search'),loadMore=document.getElementById('loadMore'),viewer=document.getElementById('viewer');
  const randomSample=document.getElementById('randomSample');

  function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function normalize(value){return String(value||'').trim().toLocaleLowerCase('zh-CN');}
  var showcaseVersion = Date.now();
  function imagePath(entry,size){return '/scene-showcase/'+size+'/'+encodeURIComponent(entry.id)+'.jpg?cv='+showcaseVersion;}
  function createUrl(entry){return 'prompt-builder.html?scene='+encodeURIComponent(entry.id)+'&step=4&generate=1';}
  function ratingLabel(value){return LABELS[value]||value||'未分级';}
  function characterLabel(value){return LABELS[value]||value||'角色';}

  function matches(entry){
    if(state.scope==='featured'&&!state.featured.has(entry.id))return false;
    if(state.character!=='all'&&entry.char!==state.character)return false;
    if(state.rating!=='all'&&entry.rating!==state.rating)return false;
    const term=normalize(search.value);
    return !term||normalize([entry.id,entry.title,entry.story,entry.category,characterLabel(entry.char),ratingLabel(entry.rating)].join(' ')).includes(term);
  }

  function card(entry){
    const featured=state.featured.has(entry.id)?'<span class="sample-badge">精选</span>':'<span></span>';
    const adult=entry.rating==='R18';
    const sensitive=adult?'<span class="sample-sensitive"><strong>R18</strong><span>悬停或聚焦预览</span></span>':'';
    return '<article class="sample'+(adult?' sample-r18':'')+'" data-rating="'+esc(entry.rating)+'">'+
      '<button class="sample-visual" type="button" data-preview="'+esc(entry.id)+'" aria-label="查看 '+esc(entry.title)+' 大图">'+
        '<img class="sample-image" src="'+imagePath(entry,'thumbs')+'" alt="'+esc(entry.title)+'" loading="lazy" decoding="async">'+
        '<span class="sample-shade"></span><span class="sample-badges">'+featured+'<span class="sample-badge rating-'+esc(entry.rating)+'">'+esc(ratingLabel(entry.rating))+'</span></span>'+sensitive+
        '<span class="sample-caption"><span class="sample-kicker"><span>'+esc(entry.id)+' · '+esc(characterLabel(entry.char))+'</span><span>第 '+esc(entry.attempt)+' 次通过</span></span><strong class="sample-title">'+esc(entry.title)+'</strong></span>'+
      '</button></article>';
  }

  function render(reset){
    if(reset)state.visible=PAGE_SIZE;
    state.filtered=state.entries.filter(matches);
    const visible=state.filtered.slice(0,state.visible);
    count.innerHTML='显示 <strong>'+visible.length+'</strong> / '+state.filtered.length+' 个匹配样张 · R18 默认模糊';
    if(!visible.length){grid.innerHTML='<div class="empty-state"><span class="empty-state-icon">⌕</span><h2>没有找到匹配样张</h2><p>试试更短的关键词，或者切回“全部角色 / 全部分级”。</p><button class="btn btn-ghost" type="button" id="resetFilters">重置筛选</button></div>';document.getElementById('resetFilters').onclick=resetFilters;}
    else grid.innerHTML=visible.map(card).join('');
    loadMore.hidden=visible.length>=state.filtered.length;
  }

  function setExclusive(selector,attribute,value){document.querySelectorAll(selector).forEach(function(button){button.classList.toggle('active',button.getAttribute(attribute)===value);});}
  function resetFilters(){state.scope='all';state.character='all';state.rating='all';search.value='';setExclusive('[data-scope]','data-scope','all');setExclusive('[data-character]','data-character','all');setExclusive('[data-rating]','data-rating','all');render(true);}
  function currentIndex(){return state.filtered.findIndex(function(entry){return entry.id===state.currentId;});}
  function openViewer(id){const entry=state.entries.find(function(item){return item.id===id;});if(!entry)return;state.currentId=id;    document.getElementById('viewerImage').src=imagePath(entry,'images')+'&t='+Date.now();document.getElementById('viewerImage').alt=entry.title;document.getElementById('viewerTitle').textContent=entry.title;document.getElementById('viewerStory').textContent=entry.story;document.getElementById('viewerMeta').innerHTML='<span>'+esc(entry.id)+'</span><span>'+esc(characterLabel(entry.char))+'</span><span>'+esc(ratingLabel(entry.rating))+'</span><span>'+esc(entry.category)+'</span><span>第 '+esc(entry.attempt)+' 次通过</span>';document.getElementById('viewerCreate').href=createUrl(entry);if(!viewer.open)viewer.showModal();}
  function moveViewer(step){const index=currentIndex();if(index<0||!state.filtered.length)return;const next=(index+step+state.filtered.length)%state.filtered.length;openViewer(state.filtered[next].id);}
  function openRandom(){const filtered=state.filtered.length?state.filtered:state.entries;const safe=filtered.filter(function(entry){return entry.rating!=='R18';});const source=state.rating==='R18'?filtered:(safe.length?safe:filtered);if(!source.length)return;const next=source[Math.floor(Math.random()*source.length)];openViewer(next.id);}
  function showUnavailable(){document.getElementById('totalStat').textContent='0';document.getElementById('safeStat').textContent='0';document.getElementById('r15Stat').textContent='0';count.textContent='最终样张目录暂未连接';grid.innerHTML='<div class="empty"><span class="icon">🖼</span><h2>展示素材暂未连接</h2><p>网站功能仍可正常使用；重新启动控制面板后，它会自动连接 AI/SceneShowcase 中最新的审核展示集。</p><a class="btn btn-primary" href="scene-explorer.html">先逛灵感场景</a></div>';}

  document.addEventListener('click',function(event){const preview=event.target.closest('[data-preview]');if(preview)openViewer(preview.getAttribute('data-preview'));});
  document.querySelectorAll('[data-scope]').forEach(function(button){button.onclick=function(){state.scope=button.dataset.scope;setExclusive('[data-scope]','data-scope',state.scope);render(true);};});
  document.querySelectorAll('[data-character]').forEach(function(button){button.onclick=function(){state.character=button.dataset.character;setExclusive('[data-character]','data-character',state.character);render(true);};});
  document.querySelectorAll('[data-rating]').forEach(function(button){button.onclick=function(){state.rating=button.dataset.rating;setExclusive('[data-rating]','data-rating',state.rating);render(true);};});
  document.getElementById('clearSearch').onclick=function(){search.value='';search.focus();render(true);};
  search.oninput=function(){render(true);};
  loadMore.onclick=function(){state.visible+=PAGE_SIZE;render(false);};
  randomSample.onclick=openRandom;
  document.getElementById('viewerClose').onclick=function(){viewer.close();};
  document.getElementById('viewerPrevious').onclick=function(){moveViewer(-1);};
  document.getElementById('viewerNext').onclick=function(){moveViewer(1);};
  viewer.addEventListener('click',function(event){if(event.target===viewer)viewer.close();});
  document.addEventListener('keydown',function(event){if(!viewer.open)return;if(event.key==='ArrowLeft')moveViewer(-1);if(event.key==='ArrowRight')moveViewer(1);});

  Promise.all([
    fetch('/scene-showcase/manifest.json',{cache:'no-cache'}).then(function(response){if(!response.ok)throw new Error('showcase '+response.status);return response.json();}),
    fetch('../data/curation.json?v=2').then(function(response){return response.ok?response.json():{};}).catch(function(){return{};})
  ]).then(function(result){
    const manifest=result[0],curation=result[1]||{};
    if(!manifest||!Array.isArray(manifest.entries))throw new Error('invalid manifest');
    state.entries=manifest.entries.slice().sort(function(a,b){return Number(a.id.slice(2))-Number(b.id.slice(2));});
    state.featured=new Set([].concat(curation.signatureSceneIds||[],curation.curatedSceneIds||[]));
    document.getElementById('totalStat').textContent=manifest.sceneCount||state.entries.length;
    document.getElementById('safeStat').textContent=(manifest.counts&&manifest.counts.All)||state.entries.filter(function(x){return x.rating==='All';}).length;
    document.getElementById('r15Stat').textContent=(manifest.counts&&manifest.counts.R15)||state.entries.filter(function(x){return x.rating==='R15';}).length;
    randomSample.disabled=false;
    render(true);
  }).catch(function(error){console.warn('Showcase unavailable:',error);showUnavailable();});
})();
