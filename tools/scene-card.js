/* ============================================================
   Scene Card — 统一场景卡片组件 (ES6 Template Literals)
   JS create: window.createSceneCard(scene, opt)
     opt.mode      'grid'(默认) | 'strip'(首页胶片窄卡) | 'recent'(作品卡)
     opt.clickable  true → 整卡 click 触发 onPick
     opt.onPick     scene => void      整卡点击
     opt.actions   [{label,icon,primary(true|false),href?,onclick?}] 最多 2 个按钮
     opt.suppressTags  true → 不渲染默认 .sc-tags
     opt.rating    0..5
     opt.meta      覆盖底部 meta(默认 scene.category + weather)
     opt.beforeActions(scene)  钩子:返回 html 字符串注入 .sc-body
     opt.bandExtra   注入图区角标 html(如 tier 徽标)
     opt.imgVersion  缩略图缓存版本(优先级高于自动版本)
    预览图:网关提供 /scene-showcase/thumbs/{id}.jpg(逐场景审核样张),
    加载失败时自动回退分类渐变;R18 预览默认模糊,悬停/聚焦后清晰。
    缓存版本由页面加载时间自动生成,替换样张后刷新页面即取新图。
   ============================================================ */
(function () {
  'use strict';
  if (window.createSceneCard) return;

  // 自动缓存版本:样张替换后刷新页面即取新图,无需手动改号
  window.AICS_THUMB_VERSION = Date.now();

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function stars(r){
    r = Math.round(r || 0);
    const starItems = [1,2,3,4,5].map(i => `<span class="${i<=r?'on':''}">★</span>`).join('');
    return `<span class="sc-stars">${starItems}</span>`;
  }

  const THEME = {
    '校园':'linear-gradient(135deg,#81C784,#388E3C)','祭典・节日':'linear-gradient(135deg,#FF8A65,#D84315)',
    '祭典':'linear-gradient(135deg,#FF8A65,#D84315)','节日':'linear-gradient(135deg,#F06292,#C2185B)',
    '日常':'linear-gradient(135deg,#4FC3F7,#0288D1)','旅行':'linear-gradient(135deg,#80DEEA,#00838F)',
    '恋爱':'linear-gradient(135deg,#CE93D8,#6A1B9A)','亲密':'linear-gradient(135deg,#FF80AB,#AD1457)',
    'R15':'linear-gradient(135deg,#CFD8DB,#37474F)','Active_Sync_Scenes':'linear-gradient(135deg,#FFD54F,#F57F17)',
    '恋爱/After_Story':'linear-gradient(135deg,#F48FB1,#8E24AA)','同人/After_Story':'linear-gradient(135deg,#B39DDB,#5E35B1)',
    '日常/同人':'linear-gradient(135deg,#80CBC4,#00897B)','恋爱/同人':'linear-gradient(135deg,#FF80AB,#8E24AA)',
    '战斗':'linear-gradient(135deg,#EF5350,#6D1B1B)'
  };

  window.createSceneCard = function (scene, opt) {
    opt = opt || {};
    const mode = opt.mode || 'grid';
    const clickable = opt.clickable === true || (opt.clickable !== false && mode !== 'strip');

    const card = document.createElement('div');
    card.className = `sc sc-${mode}`;
    const contentRating = scene.rating || (scene.mature ? 'R18' : 'All');
    card.dataset.rating = contentRating;
    if (clickable && opt.onPick) {
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
    } else {
      card.classList.add('sc-static');
    }

    const band = THEME[scene.category] || 'linear-gradient(135deg,var(--bg-deep),var(--bg-elevated))';

    // 逐场景审核样张预览(纯静态服务器无此目录时 onerror 回退渐变)
    const thumbId = String(scene.id || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const imgV = (opt.imgVersion || window.AICS_THUMB_VERSION || '');
    const cacheStr = imgV ? '?v=' + encodeURIComponent(String(imgV)) : '';
    const thumbHtml = thumbId
      ? `<img class="sc-thumb${contentRating === 'R18' ? ' sc-thumb-r18' : ''}" src="/scene-showcase/thumbs/${thumbId}.jpg${cacheStr}" alt="" loading="lazy" decoding="async" onerror="this.classList.add('sc-thumb-missing')">`
      : '';
    const idBadge = thumbId ? `<span class="sc-id">${esc(thumbId.toUpperCase())}</span>` : '';
    const bandExtra = typeof opt.bandExtra === 'function' ? opt.bandExtra(scene) : (opt.bandExtra || '');

    // 子模块预计算
    const categoryBadge = mode === 'grid' ? `<span class="sc-cat">${esc(scene.category||'场景')}</span>` : '';
    const ratingBadge = contentRating === 'R18'
      ? '<span class="sc-badge sc-rating r18">R18</span>'
      : (contentRating === 'R15' ? '<span class="sc-badge sc-rating r15">R15</span>' : '');
    const storyBlock = mode !== 'strip' ? `<div class="sc-story">${esc(scene.story||'')}</div>` : '';

    const limit = mode === 'strip' ? 2 : 3;
    // 内部审核标记不参与展示
    const TAG_BLOCKLIST = ['official_cg', 'visual_audited'];
    const tags = (scene.tags || []).filter(function (t) { return TAG_BLOCKLIST.indexOf(t) < 0; }).slice(0, limit);
    if (scene.emotion && tags.length < limit) tags.push(scene.emotion);
    const tagsBlock = !opt.suppressTags
      ? `<div class="sc-tags">${tags.map(t => `<span class="sc-tag">${esc(t)}</span>`).join('')}</div>`
      : '';

    const ratingHtml = (opt.rating != null && opt.rating > 0) ? stars(opt.rating) : '';
    const metaText = opt.meta || [(scene.season||''), (scene.weather||'')].filter(Boolean).join(' · ');
    const beforeActionsHtml = typeof opt.beforeActions === 'function' ? opt.beforeActions(scene) : '';

    let actionsBlock = '';
    if (opt.actions && opt.actions.length) {
      const buttons = opt.actions.map((a, idx) => {
        const cls = 'sc-btn' + (a.primary ? ' sc-btn-primary' : '');
        let attrs = '';
        if (a.href) attrs += ` href="${esc(a.href)}"`;
        // 把原始数组的索引 idx 绑到 DOM 上
        if (a.onclick) attrs += ` data-onclick="1" data-index="${idx}"`;
        return `<a class="${cls}"${attrs}>${a.icon||''} ${esc(a.label)}</a>`;
      }).join('');
      actionsBlock = `<div class="sc-actions">${buttons}</div>`;
    }

    card.innerHTML = `
      <div class="sc-band" style="background:${band}">
        ${thumbHtml}${idBadge}${ratingBadge}${categoryBadge}${bandExtra}
      </div>
      <div class="sc-body">
        <div class="sc-title">${esc(scene.title||'未命名')}</div>
        ${storyBlock}
        ${tagsBlock}
        <div class="sc-meta">
          <span class="sc-meta-l">${ratingHtml}</span>
          <span class="sc-meta-r">${esc(metaText)}</span>
        </div>
        ${beforeActionsHtml}
        ${actionsBlock}
      </div>
    `;

    // --- 事件绑定修正 ---
    function firePick(e){
      e.preventDefault();
      if (opt.onPick) opt.onPick(scene, e);
    }
    if (clickable && opt.onPick) {
      card.addEventListener('click', firePick);
      card.addEventListener('keydown', function(e){ if (e.key==='Enter' || e.key===' ') firePick(e); });
    }
    if (opt.actions) {
      card.querySelectorAll('.sc-btn[data-onclick]').forEach(function(btn){
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          // 读取之前存进去的原始索引
          const realIndex = btn.getAttribute('data-index');
          if (realIndex != null && opt.actions[realIndex] && opt.actions[realIndex].onclick) {
            opt.actions[realIndex].onclick(scene, e);
          }
        });
      });
    }
    return card;
  };
})();
