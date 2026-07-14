/* ============================================================
   Scene Card — 统一场景卡片组件
   JS create: window.createSceneCard(scene, opt)
     opt.mode      'grid'(默认) | 'strip'(首页胶片窄卡) | 'recent'(作品卡)
     opt.clickable  true → 整卡 click 触发 onPick
     opt.onPick     scene => void      整卡点击
     opt.actions   [{label,icon,primary(true|false),href?,onclick?}] 最多 2 个按钮
     opt.suppressTags  true → 不渲染默认 .sc-tags,全交给 beforeActions(explorer 用它接管标签区)
     opt.rating    0..5
     opt.meta      覆盖底部 meta(默认 scene.category + weather)
     opt.beforeActions(html, scene)  钩子:注入 extra markup(在 .sc-actions 位之前),
                                      返回 html 字符串追加到 .sc-body。Explorer 用它插 spec/标签/按钮。
   ============================================================ */
(function () {
  'use strict';
  if (window.createSceneCard) return;

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function stars(r){
    r = Math.round(r || 0);
    return '<span class="sc-stars">' + [1,2,3,4,5].map(function(i){ return '<span class="' + (i<=r?'on':'') + '">★</span>'; }).join('') + '</span>';
  }

  window.createSceneCard = function (scene, opt) {
    opt = opt || {};
    var mode = opt.mode || 'grid';
    var clickable = opt.clickable !== false && mode !== 'strip';

    var card = document.createElement('div');
    card.className = 'sc sc-' + mode;
    card.setAttribute('role', 'button');
    card.tabIndex = 0;

    // 视觉预览色带(按分类着色)
    var theme = {
      '校园':'linear-gradient(135deg,#81C784,#388E3C)','祭典':'linear-gradient(135deg,#FF8A65,#D84315)',
      '节日':'linear-gradient(135deg,#F06292,#C2185B)','日常':'linear-gradient(135deg,#4FC3F7,#0288D1)',
      '旅行':'linear-gradient(135deg,#80DEEA,#00838F)','恋爱':'linear-gradient(135deg,#CE93D8,#6A1B9A)',
      '亲密':'linear-gradient(135deg,#FF80AB,#AD1457)','R15':'linear-gradient(135deg,#CFD8DB,#37474F)'
    };
    var band = theme[scene.category] || 'linear-gradient(135deg,var(--bg-deep),var(--bg-elevated))';

    var html = '';

    // 预览条
    html += '<div class="sc-band" style="background:' + band + '">';
    if (scene.mature) html += '<span class="sc-badge">🔞</span>';
    if (mode === 'grid') html += '<span class="sc-cat">' + esc(scene.category || '场景') + '</span>';
    html += '</div>';

    // 主体
    html += '<div class="sc-body">';
    html += '<div class="sc-title">' + esc(scene.title || '未命名') + '</div>';
    if (mode !== 'strip') html += '<div class="sc-story">' + esc(scene.story || '') + '</div>';

    // 标签(最多 3 条,strip 模式 2 条)
    var limit = mode === 'strip' ? 2 : 3;
    var tags = (scene.tags || []).slice(0, limit);
    if (scene.emotion && tags.length < limit) tags.push(scene.emotion);
    if (!opt.suppressTags) html += '<div class="sc-tags">' + tags.map(function(t){ return '<span class="sc-tag">' + esc(t) + '</span>'; }).join('') + '</div>';

    // meta 行
    var ratingHtml = (opt.rating != null && opt.rating > 0) ? stars(opt.rating) : '';
    var metaText = opt.meta || [(scene.season||''), (scene.weather||'')].filter(Boolean).join(' · ');
    html += '<div class="sc-meta"><span class="sc-meta-l">' + ratingHtml + '</span><span class="sc-meta-r">' + esc(metaText) + '</span></div>';

    // 钩子:在按钮位前注入自定义 markup(Explorer 用它插 spec/标签/footer)
    if (typeof opt.beforeActions === 'function') html += opt.beforeActions(scene);

    // 操作按钮
    if (opt.actions && opt.actions.length) {
      html += '<div class="sc-actions">';
      opt.actions.forEach(function(a){
        var cls = 'sc-btn' + (a.primary ? ' sc-btn-primary' : '');
        var attrs = '';
        if (a.href) attrs += ' href="' + esc(a.href) + '"';
        if (a.onclick) attrs += ' data-onclick="1"';
        html += '<a class="' + cls + '"' + attrs + '>' + (a.icon||'') + ' ' + esc(a.label) + '</a>';
      });
      html += '</div>';
    }

    html += '</div>'; // .sc-body
    card.innerHTML = html;

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
