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
    { id:'scene',     label:'Scene Library', href:'tools/scene-explorer.html', icon:'🌸' },
    { id:'director',  label:'Create',        href:'tools/prompt-builder.html', icon:'✨' },
    { id:'gallery',   label:'Gallery',       href:'tools/gallery.html',        icon:'🎞' },
    { id:'character', label:'Character',     href:'tools/character.html',      icon:'👤' },
    { id:'style',     label:'Style',         href:'tools/style.html',          icon:'🎨' },
    { id:'lora',      label:'LoRA',          href:'tools/lora.html',           icon:'🧪' },
    { id:'docs',      label:'Docs',          href:'docs/philosophy.html',      icon:'📖' }
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
  window.__navRender = render;
})();
