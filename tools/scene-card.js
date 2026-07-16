/* ============================================================
   Scene Card — 统一场景卡片组件 (Template 模式)
   JS create: window.createSceneCard(scene, opt)
     opt.mode      'grid'(默认) | 'strip'(首页胶片窄卡) | 'recent'(作品卡)
     opt.clickable  true → 整卡 click 触发 onPick
     opt.onPick     scene => void      整卡点击
     opt.actions   [{label,icon,primary(true|false),href?,onclick?}] 最多 2 个按钮
     opt.suppressTags  true → 不渲染默认 .sc-tags
     opt.rating    0..5
     opt.meta      覆盖底部 meta(默认 scene.category + weather)
     opt.beforeActions(scene)  钩子:返回 html 字符串注入 .sc-inject
   ============================================================ */
(function () {
  'use strict';
  if (window.createSceneCard) return;

  // 注入 template 到 DOM（只执行一次）
  function ensureTemplate(){
    if (document.getElementById('sc-template')) return;
    var tpl = document.createElement('template');
    tpl.id = 'sc-template';
    tpl.innerHTML =
      '<div class="sc" role="button" tabindex="0">' +
        '<div class="sc-band"><span class="sc-badge" hidden>🔞</span><span class="sc-cat"></span></div>' +
        '<div class="sc-body">' +
          '<div class="sc-title"></div>' +
          '<div class="sc-story"></div>' +
          '<div class="sc-tags"></div>' +
          '<div class="sc-meta"><span class="sc-meta-l"></span><span class="sc-meta-r"></span></div>' +
          '<div class="sc-inject"></div>' +
          '<div class="sc-actions"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(tpl);
  }

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function stars(r){
    r = Math.round(r || 0);
    return '<span class="sc-stars">' + [1,2,3,4,5].map(function(i){ return '<span class="' + (i<=r?'on':'') + '">★</span>'; }).join('') + '</span>';
  }

  var THEME = {
    '校园':'linear-gradient(135deg,#81C784,#388E3C)','祭典・节日':'linear-gradient(135deg,#FF8A65,#D84315)',
    '祭典':'linear-gradient(135deg,#FF8A65,#D84315)','节日':'linear-gradient(135deg,#F06292,#C2185B)',
    '日常':'linear-gradient(135deg,#4FC3F7,#0288D1)','旅行':'linear-gradient(135deg,#80DEEA,#00838F)',
    '恋爱':'linear-gradient(135deg,#CE93D8,#6A1B9A)','亲密':'linear-gradient(135deg,#FF80AB,#AD1457)',
    'R15':'linear-gradient(135deg,#CFD8DB,#37474F)','Active_Sync_Scenes':'linear-gradient(135deg,#FFD54F,#F57F17)'
  };

  window.createSceneCard = function (scene, opt) {
    opt = opt || {};
    ensureTemplate();
    var mode = opt.mode || 'grid';
    var clickable = opt.clickable !== false && mode !== 'strip';

    // 克隆模板
    var tpl = document.getElementById('sc-template');
    var frag = tpl.content.cloneNode(true);
    var card = frag.querySelector('.sc');
    card.className = 'sc sc-' + mode;

    // 色带
    var band = card.querySelector('.sc-band');
    band.style.background = THEME[scene.category] || 'linear-gradient(135deg,var(--bg-deep),var(--bg-elevated))';
    if (scene.mature) card.querySelector('.sc-badge').hidden = false;
    var catEl = card.querySelector('.sc-cat');
    if (mode === 'grid') { catEl.textContent = scene.category || '场景'; }
    else { catEl.remove(); }

    // 标题 + 故事
    card.querySelector('.sc-title').textContent = scene.title || '未命名';
    var storyEl = card.querySelector('.sc-story');
    if (mode !== 'strip' && scene.story) { storyEl.textContent = scene.story; }
    else { storyEl.remove(); }

    // 标签
    var tagsEl = card.querySelector('.sc-tags');
    if (opt.suppressTags) {
      tagsEl.remove();
    } else {
      var limit = mode === 'strip' ? 2 : 3;
      var tags = (scene.tags || []).slice(0, limit);
      if (scene.emotion && tags.length < limit) tags.push(scene.emotion);
      tagsEl.innerHTML = tags.map(function(t){ return '<span class="sc-tag">' + esc(t) + '</span>'; }).join('');
    }

    // meta
    var ratingHtml = (opt.rating != null && opt.rating > 0) ? stars(opt.rating) : '';
    var metaText = opt.meta || [(scene.season||''), (scene.weather||'')].filter(Boolean).join(' · ');
    card.querySelector('.sc-meta-l').innerHTML = ratingHtml;
    card.querySelector('.sc-meta-r').textContent = metaText;

    // 钩子
    var injectEl = card.querySelector('.sc-inject');
    if (typeof opt.beforeActions === 'function') {
      injectEl.innerHTML = opt.beforeActions(scene);
    } else {
      injectEl.remove();
    }

    // 操作按钮
    var actionsEl = card.querySelector('.sc-actions');
    if (opt.actions && opt.actions.length) {
      actionsEl.innerHTML = opt.actions.map(function(a){
        var cls = 'sc-btn' + (a.primary ? ' sc-btn-primary' : '');
        var attrs = '';
        if (a.href) attrs += ' href="' + esc(a.href) + '"';
        if (a.onclick) attrs += ' data-onclick="1"';
        return '<a class="' + cls + '"' + attrs + '>' + (a.icon||'') + ' ' + esc(a.label) + '</a>';
      }).join('');
    } else {
      actionsEl.remove();
    }

    // 事件绑定
    function firePick(e){
      e.preventDefault();
      if (opt.onPick) opt.onPick(scene, e);
    }
    if (clickable && opt.onPick) {
      card.addEventListener('click', firePick);
      card.addEventListener('keydown', function(e){ if (e.key==='Enter' || e.key===' ') firePick(e); });
    }
    if (opt.actions) {
      card.querySelectorAll('.sc-btn[data-onclick]').forEach(function(btn, i){
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          if (opt.actions[i] && opt.actions[i].onclick) opt.actions[i].onclick(scene, e);
        });
      });
    }
    return card;
  };
})();
