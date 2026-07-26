(function(){
  var tabs = document.getElementById('characterTabs');
  var center = document.getElementById('characterCenter');
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function chips(items, extra){ return (items || []).map(function(item){ return '<span class="chip '+(extra || '')+'">'+esc(typeof item === 'string' ? item : item.label)+'</span>'; }).join(''); }
  Promise.all([fetch('../data/characters.json?v=6').then(function(r){ return r.json(); }), fetch('../data/scenes.json?v=6').then(function(r){ return r.json(); })])
    .then(function(data){
      var characters = data[0], scenes = data[1], current = characters[0].id;
      function render(){
        var c = characters.filter(function(item){ return item.id === current; })[0];
        var dna = c.visual_dna || {};
        var id = c.identity || {};
        var recommendations = (c.lora && c.lora.recommended_scene || []).map(function(sceneId){ return scenes.filter(function(scene){ return scene.id === sceneId; })[0]; }).filter(Boolean);
        tabs.innerHTML = characters.map(function(item){ return '<button class="character-tab '+(item.id === current ? 'active' : '')+'" role="tab" aria-selected="'+(item.id === current)+'" data-id="'+esc(item.id)+'">'+esc(item.icon)+' '+esc(item.name)+'</button>'; }).join('');
        var moodClasses=['m0','m1','m2','m3','m4','m5'];
        var tagsHtml = (c.tags || []).map(function(t,i){ return '<span class="tag-chip '+moodClasses[i%6]+'">'+esc(t)+'</span>'; }).join('');
        var ageText = id.age ? esc(id.age) + (/^\d+$/.test(String(id.age)) ? '岁' : '') : '';
        var identityHtml = (id.role || id.age || id.occupation || id.faction) ?
          '<div class="identity-row">'+(id.role?'<span class="item role">'+esc(id.role)+'</span>':'')+(id.age?'<span class="item">'+ageText+'</span>':'')+(id.occupation?'<span class="item">'+esc(id.occupation)+'</span>':'')+(id.faction?'<span class="item">'+esc(id.faction)+'</span>':'')+'</div>' : '';
        var voiceHtml = c.voice ? '<div class="voice-block"><span class="voice-label">语气示例</span>'+esc(c.voice)+'</div>' : '';
        var bgHtml = c.bg_story ? '<div class="bg-story" data-action="toggle-bg">'+esc(c.bg_story)+'</div>' : '';
        var portrait = c.portrait || {};
        var portraitHtml = portrait.image ? '<img class="portrait-image" src="'+esc(portrait.image)+'" alt="'+esc(portrait.alt || c.name)+'" loading="eager" decoding="async">' : '';
        center.innerHTML = '<section class="character-hero card-direct card-level-3">'+
          '<div class="portrait '+(c.id === 'natsume' ? 'natsume' : '')+'">'+portraitHtml+'<span class="portrait-badge">'+esc(c.icon)+' 官方角色立绘</span><span class="portrait-source">'+esc(c.source)+'</span></div>'+
          '<div><h2 class="character-name">'+esc(c.name)+'</h2>'+identityHtml+'<div class="character-alias">'+esc((c.alias || []).join(' / '))+'</div>'+voiceHtml+
          '<div class="tags-grid">'+tagsHtml+'</div>'+bgHtml+
          '<div class="detail-grid">'+
            '<section class="detail-section"><div class="lab">性格标签</div><div class="chips">'+chips(c.personality, 'trait')+'</div></section>'+
            '<section class="detail-section"><div class="lab">喜欢的事物</div><div class="chips">'+chips(c.likes)+'</div></section>'+
            '<section class="detail-section"><div class="lab">推荐色彩</div><div class="chips">'+chips(c.palette)+'</div></section>'+
            '<section class="detail-section"><div class="lab">推荐天气</div><div class="chips">'+chips(c.weather)+'</div></section>'+
            '<section class="detail-section"><div class="lab">视觉特征</div><div class="chips">'+chips([dna.hair, dna.eyes, dna.hairstyle, dna.uniform, dna.expression, dna.signature])+'</div></section>'+
            '<section class="detail-section"><div class="lab">角色 LoRA</div><div class="char-lora"><code>'+esc(c.lora.name)+'</code> · 默认强度 '+esc(c.lora.weight)+'</div></section>'+
          '</div>'+
          '<a class="btn btn-lg btn-primary btn-block mt-4" href="prompt-builder.html?char='+encodeURIComponent(c.id)+'">✦ 带此角色开始绘制</a>'+
          '</div></section>'+
          '<section class="cg-card card-info card-level-1"><div class="lab">代表场景</div><div class="cg-title">'+esc(c.classic_cg.title)+'</div><div class="cg-story">'+esc(c.classic_cg.description)+'</div></section>'+
          '<section><h2 class="recommend-title">精选推荐场景 · '+recommendations.length+' 个</h2><div class="recommend-grid" id="recommendGrid"></div></section>';
        tabs.querySelectorAll('[data-id]').forEach(function(tab){ tab.addEventListener('click', function(){ current = tab.getAttribute('data-id'); render(); }); });
        var grid = document.getElementById('recommendGrid');
        recommendations.forEach(function(scene){ grid.appendChild(window.createSceneCard(scene, { actions: [{ label: '用这个场景创作', primary: true, href: 'prompt-builder.html?scene=' + encodeURIComponent(scene.id) }] })); });
        var bg = center.querySelector('[data-action="toggle-bg"]');
        if (bg) bg.addEventListener('click', function(){ bg.classList.toggle('expanded'); });
      }
      render();
    })
    .catch(function(error){ center.innerHTML = '<p class="empty-state">角色数据加载失败：'+esc(error.message)+'</p>'; });
})();
