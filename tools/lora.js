(function(){
  var grid = document.getElementById('loraGrid');
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function pct(n){ return Math.round((n||0)*100)+'%'; }
  fetch('../data/loras.json?v=6')
    .then(function(r){ return r.json(); })
    .then(function(loras){
      grid.innerHTML = loras.map(function(l){
        var dt = l.dataset || {}, tr = l.training || {}, rw = l.recommended_weight || {};
        // 触发词 + 角色 + 兼容模型 + 版本 —— 样式全部来自 .lora-pill 变体,
        // 不再内联(内联复制了 lora.html 里已有的同一套值,页面已有 ?v= 缓存版本号机制)
        var pills = '';
        if(l.trigger) pills += '<span class="lora-pill trigger">触发词: '+esc(l.trigger)+'</span>';
        if(l.character) pills += '<span class="lora-pill char">角色: '+esc(l.character)+'</span>';
        if(l.version) pills += '<span class="lora-pill">v'+esc(l.version)+'</span>';
        (l.compatible_models||[]).forEach(function(m){ pills += '<span class="lora-pill">'+esc(m)+'</span>'; });

        // 推荐强度进度条（默认 strength 为主，分镜权重作为补充信息）
        // 宽度是数据值,用 --fill 自定义属性载体传递,样式规则留在 CSS
        var strengthBar = '';
        if(l.strength){
          strengthBar = '<div class="lora-row"><span class="lab">推荐强度</span>'+
            '<div class="weight-bar"><div class="weight-track"><div class="weight-fill" style="--fill:'+pct(l.strength.default)+'"></div></div>'+
            '<span class="weight-num">'+esc(l.strength.default)+'</span></div>'+
            '<span class="weight-range">(范围 '+esc(l.strength.min)+'–'+esc(l.strength.max)+')</span>'+
            '</div>';
        }
        var subWeights = '';
        Object.keys(rw).forEach(function(k){
          subWeights += '<div class="lora-row"><span class="lab">'+esc(k)+'</span>'+
            '<div class="weight-bar"><div class="weight-track"><div class="weight-fill" style="--fill:'+pct(rw[k])+'"></div></div>'+
            '<span class="weight-num">'+esc(rw[k])+'</span></div></div>';
        });

        return '<div class="lora-card card-info card-level-1">' +
          '<div class="lora-name">'+esc(l.name)+'</div>' +
          (l.description ? '<div class="lora-desc">'+esc(l.description)+'</div>':'') +
          (pills ? '<div class="lora-pill-row">'+pills+'</div>':'') +
          strengthBar +
          (subWeights ? '<div class="lora-subweights'+(strengthBar?' is-divided':'')+'">'+subWeights+'</div>' :'') +
          '<div class="lora-trainer">'+esc(l.trainer)+' · '+esc(dt.images)+' imgs @ '+esc(dt.resolution)+'px · rank '+esc(tr.rank)+' · '+(l.base_model||'')+'</div>' +
          '<div class="lora-row"><span class="lab">测试场景</span><div class="val">'+esc((l.test_scene||[]).slice(0,5).join(', '))+'</div></div>' +
        '</div>';
      }).join('');
    })
    .catch(function(e){ grid.innerHTML = '<p class="muted">⚠️ LoRA 数据加载失败:'+e.message+'</p>'; });
})();
