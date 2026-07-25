(function(){
  var grid = document.getElementById('loraGrid');
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function pct(n){ return Math.round((n||0)*100)+'%'; }
  fetch('../data/loras.json?v=6')
    .then(function(r){ return r.json(); })
    .then(function(loras){
      grid.innerHTML = loras.map(function(l){
        var dt = l.dataset || {}, tr = l.training || {}, rw = l.recommended_weight || {};
        // 触发词 + 角色 + 兼容模型 + 版本(pills 样式内联,避 CSS 缓存)
        var pills = '';
        if(l.trigger) pills += '<span style="padding:2px 8px;border-radius:12px;font-size:0.68rem;color:var(--accent);border:1px solid var(--accent);background:var(--accent-soft);margin-right:4px;">触发词: '+esc(l.trigger)+'</span>';
        if(l.character) pills += '<span style="padding:2px 8px;border-radius:12px;font-size:0.68rem;color:var(--info);background:var(--bg-elevated);margin-right:4px;">角色: '+esc(l.character)+'</span>';
        if(l.version) pills += '<span style="padding:2px 8px;border-radius:12px;font-size:0.68rem;color:var(--text-secondary);background:var(--bg-elevated);margin-right:4px;">v'+esc(l.version)+'</span>';
        (l.compatible_models||[]).forEach(function(m){ pills += '<span style="padding:2px 8px;border-radius:12px;font-size:0.68rem;color:var(--text-secondary);background:var(--bg-elevated);margin-right:4px;">'+esc(m)+'</span>'; });

        // 推荐强度进度条（默认 strength 为主，分镜权重作为补充信息）
        var strengthBar = '';
        if(l.strength){
          strengthBar = '<div class="lora-row"><span class="lab">推荐强度</span>'+
            '<div class="weight-bar"><div class="weight-track"><div class="weight-fill" style="width:'+pct(l.strength.default)+'"></div></div>'+
            '<span class="weight-num">'+esc(l.strength.default)+'</span></div>'+
            '<span style="font-size:0.7rem;color:var(--text-muted);margin-left:6px;">(范围 '+esc(l.strength.min)+'–'+esc(l.strength.max)+')</span>'+
            '</div>';
        }
        var subWeights = '';
        Object.keys(rw).forEach(function(k){
          subWeights += '<div class="lora-row"><span class="lab">'+esc(k)+'</span>'+
            '<div class="weight-bar"><div class="weight-track"><div class="weight-fill" style="width:'+pct(rw[k])+'"></div></div>'+
            '<span class="weight-num">'+esc(rw[k])+'</span></div></div>';
        });

        return '<div class="lora-card card-info card-level-1">' +
          '<div class="lora-name">'+esc(l.name)+'</div>' +
          (l.description ? '<div class="lora-desc">'+esc(l.description)+'</div>':'') +
          (pills ? '<div class="lora-pill-row">'+pills+'</div>':'') +
          strengthBar +
          (subWeights ? '<div style="margin-top:var(--s-2);'+ (strengthBar?'border-top:1px solid var(--border-soft);padding-top:var(--s-2);':'') +'">'+subWeights+'</div>' :'') +
          '<div class="lora-trainer">'+esc(l.trainer)+' · '+esc(dt.images)+' imgs @ '+esc(dt.resolution)+'px · rank '+esc(tr.rank)+' · '+(l.base_model||'')+'</div>' +
          '<div class="lora-row"><span class="lab">测试场景</span><div class="val">'+esc((l.test_scene||[]).slice(0,5).join(', '))+'</div></div>' +
        '</div>';
      }).join('');
    })
    .catch(function(e){ grid.innerHTML = '<p class="muted">⚠️ LoRA 数据加载失败:'+e.message+'</p>'; });
})();
