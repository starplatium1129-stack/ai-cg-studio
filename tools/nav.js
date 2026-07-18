/* ============================================================
   AI CG Studio — 统一导航(Scene-first)
   理念:隐藏 Prompt/Preset/Director-flow 等内部概念,
   用户只看到创作流:Scene → Character → Style → LoRA

   用法:导航位放空壳 <nav class="nav"><div class="nav-inner"><div class="nav-brand">…</div><div class="nav-links"></div></div></nav>
   每个页面 <body> 加 data-nav="当前项"(scene / director / character / style / lora / gallery / docs)
   路径层级自动推断(根目录 / tools/ / docs/ 自动回退 ../)
   ============================================================ */
(function () {
  'use strict';

  // 用户可见的导航项(创作流,概念已折叠)
  // Create = 全站最大入口,Director 为内部实现名,对用户隐身
  var NAV = [
    { id:'scene',     label:'场景库',         href:'tools/scene-explorer.html', icon:'🌸' },
    { id:'director',  label:'开始创作',       href:'tools/prompt-builder.html', icon:'✨' },
    { id:'gallery',   label:'作品',           href:'tools/gallery.html',        icon:'🎞' },
    { id:'character', label:'角色',           href:'tools/character.html',      icon:'👤' },
    { id:'style',     label:'风格',           href:'tools/style.html',          icon:'🎨' },
    { id:'lora',      label:'LoRA',          href:'tools/lora.html',           icon:'🧪' },
    { id:'docs',      label:'文档',           href:'docs/index.html',           icon:'📖' }
  ];

  function depth(){
    // pathname 含 /tools/ 或 /docs/ → 回退一层
    var p = window.location.pathname.replace(/\\/g,'/');
    return (/\/tools\//.test(p) || /\/docs\//.test(p)) ? '../' : '';
  }

  function brandLink(){ var d=depth(); return d + 'index.html'; }

  function render(){
    var host = document.querySelector('.nav-links');
    if (!host) return;
    var d = depth();
    var current = document.body.getAttribute('data-nav');
    host.innerHTML = NAV.map(function (item) {
      var cls = (item.id === current) ? ' class="active"' : '';
      return '<a' + cls + ' href="' + d + item.href + '">' + item.icon + ' ' + item.label + '</a>';
    }).join('');

    var inner = host.closest('.nav-inner');
    if (inner && !inner.querySelector('.nav-menu-toggle')) {
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'nav-menu-toggle';
      toggle.setAttribute('aria-label', '打开导航菜单');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
      toggle.addEventListener('click', function(){
        var open = host.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
        toggle.textContent = open ? '✕' : '☰';
      });
      inner.appendChild(toggle);
      host.addEventListener('click', function(e){
        if (!e.target.closest('a')) return;
        host.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
      });
      document.addEventListener('keydown', function(e){
        if (e.key === 'Escape' && host.classList.contains('open')) {
          host.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-label', '打开导航菜单');
          toggle.textContent = '☰';
          toggle.focus();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
  window.__navRender = render;
})();
