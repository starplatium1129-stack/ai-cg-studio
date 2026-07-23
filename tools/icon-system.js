/* 绫季绘境 icon system
 * Rounded, lightweight line icons for the director workspace.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var icons = {
    more: [['circle',{cx:5,cy:12,r:1}],['circle',{cx:12,cy:12,r:1}],['circle',{cx:19,cy:12,r:1}]],
    focus: [['path',{d:'M8 3H5a2 2 0 0 0-2 2v3'}],['path',{d:'M16 3h3a2 2 0 0 1 2 2v3'}],['path',{d:'M21 16v3a2 2 0 0 1-2 2h-3'}],['path',{d:'M8 21H5a2 2 0 0 1-2-2v-3'}]],
    export: [['path',{d:'M12 16V3'}],['path',{d:'m7 8 5-5 5 5'}],['path',{d:'M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'}]],
    restore: [['path',{d:'M12 3v13'}],['path',{d:'m7 11 5 5 5-5'}],['path',{d:'M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2'}]],
    story: [['path',{d:'M6 3h9l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z'}],['path',{d:'M14 3v4h4'}],['path',{d:'M8 11h6'}],['path',{d:'M8 15h5'}]],
    character: [['circle',{cx:12,cy:8,r:4}],['path',{d:'M4.5 21a7.5 7.5 0 0 1 15 0'}]],
    scene: [['rect',{x:3,y:4,width:18,height:16,rx:3}],['circle',{cx:8.5,cy:9,r:1.5}],['path',{d:'m5 17 4.5-4 3.5 3 2.5-2 3.5 3'}]],
    tag: [['path',{d:'M20 13 13 20l-9-9V4h7Z'}],['circle',{cx:8.5,cy:8.5,r:1.5}]],
    emotion: [['path',{d:'M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z'}]],
    camera: [['path',{d:'M15 4H9L7 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2Z'}],['circle',{cx:12,cy:13,r:4}]],
    light: [['circle',{cx:12,cy:12,r:4}],['path',{d:'M12 2v2'}],['path',{d:'M12 20v2'}],['path',{d:'m4.93 4.93 1.42 1.42'}],['path',{d:'m17.65 17.65 1.42 1.42'}],['path',{d:'M2 12h2'}],['path',{d:'M20 12h2'}],['path',{d:'m6.35 17.65-1.42 1.42'}],['path',{d:'m19.07 4.93-1.42 1.42'}]],
    composition: [['rect',{x:3,y:3,width:18,height:18,rx:3}],['path',{d:'M8 3v18'}],['path',{d:'M16 3v18'}],['path',{d:'M3 8h18'}],['path',{d:'M3 16h18'}]],
    color: [['path',{d:'M12 2s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z'}],['path',{d:'M9 15.5a3.5 3.5 0 0 0 5.5 1'}]],
    flower: [['circle',{cx:12,cy:12,r:2}],['path',{d:'M12 10c-4-1-4-6-1-7 3-1 4 3 2 7'}],['path',{d:'M14 12c1-4 6-4 7-1 1 3-3 4-7 2'}],['path',{d:'M12 14c4 1 4 6 1 7-3 1-4-3-2-7'}],['path',{d:'M10 12c-1 4-6 4-7 1-1-3 3-4 7-2'}]],
    leaf: [['path',{d:'M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z'}],['path',{d:'M5 20c3-5 7-8 12-11'}]],
    both: [['circle',{cx:9,cy:8,r:3}],['circle',{cx:16,cy:9,r:2.5}],['path',{d:'M3 20a6 6 0 0 1 12 0'}],['path',{d:'M14 15.5A5 5 0 0 1 21 20'}]],
    sparkle: [['path',{d:'m12 3 1.1 3.4a5 5 0 0 0 3.2 3.2L20 11l-3.7 1.4a5 5 0 0 0-3.2 3.2L12 19l-1.1-3.4a5 5 0 0 0-3.2-3.2L4 11l3.7-1.4a5 5 0 0 0 3.2-3.2Z'}],['path',{d:'m19 3 .4 1.2a2 2 0 0 0 1.3 1.3L22 6l-1.3.5a2 2 0 0 0-1.3 1.3L19 9l-.4-1.2a2 2 0 0 0-1.3-1.3L16 6l1.3-.5a2 2 0 0 0 1.3-1.3Z'}]],
    history: [['path',{d:'M3 12a9 9 0 1 0 3-6.7L3 8'}],['path',{d:'M3 3v5h5'}],['path',{d:'M12 7v5l3 2'}]],
    settings: [['path',{d:'M4 7h10'}],['path',{d:'M18 7h2'}],['circle',{cx:16,cy:7,r:2}],['path',{d:'M4 17h2'}],['path',{d:'M10 17h10'}],['circle',{cx:8,cy:17,r:2}]],
    prompt: [['path',{d:'m8 9-3 3 3 3'}],['path',{d:'m16 9 3 3-3 3'}],['path',{d:'m14 5-4 14'}]],
    recommend: [['path',{d:'M9 18h6'}],['path',{d:'M10 22h4'}],['path',{d:'M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.7-1.5 1.8-1.5 2.5h-4c0-.7-.6-1.8-1.5-2.5Z'}]],
    copy: [['rect',{x:8,y:8,width:12,height:12,rx:2}],['path',{d:'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2'}]],
    save: [['path',{d:'M5 3h12l2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z'}],['path',{d:'M8 3v6h8V3'}],['rect',{x:8,y:14,width:8,height:7,rx:1}]],
    download: [['path',{d:'M12 3v12'}],['path',{d:'m7 10 5 5 5-5'}],['path',{d:'M5 21h14'}]],
    image: [['rect',{x:3,y:4,width:18,height:16,rx:3}],['circle',{cx:8.5,cy:9,r:1.5}],['path',{d:'m5 17 4-4 3 3 2-2 5 4'}]],
    queue: [['path',{d:'M8 6h13'}],['path',{d:'M8 12h13'}],['path',{d:'M8 18h13'}],['path',{d:'M3 6h.01'}],['path',{d:'M3 12h.01'}],['path',{d:'M3 18h.01'}]],
    refresh: [['path',{d:'M20 6v5h-5'}],['path',{d:'M4 18v-5h5'}],['path',{d:'M6.1 9a7 7 0 0 1 11.8-2.6L20 11'}],['path',{d:'m4 13 2.1 4.6A7 7 0 0 0 17.9 15'}]],
    microphone: [['rect',{x:9,y:3,width:6,height:12,rx:3}],['path',{d:'M5 11a7 7 0 0 0 14 0'}],['path',{d:'M12 18v3'}],['path',{d:'M9 21h6'}]],
    volume: [['path',{d:'M11 5 6 9H3v6h3l5 4Z'}],['path',{d:'M15.5 8.5a5 5 0 0 1 0 7'}],['path',{d:'M18 6a8 8 0 0 1 0 12'}]],
    translate: [['path',{d:'M4 5h9'}],['path',{d:'M8 3v2'}],['path',{d:'M6 5c.5 3 2.2 5.3 5 7'}],['path',{d:'M11 5c-.5 3-2.2 5.3-5 7'}],['path',{d:'m13 21 4-10 4 10'}],['path',{d:'M14.5 17h5'}]],
    star: [['path',{d:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z'}]],
    seed: [['circle',{cx:12,cy:12,r:3}],['path',{d:'M12 2v3'}],['path',{d:'M12 19v3'}],['path',{d:'M2 12h3'}],['path',{d:'M19 12h3'}],['path',{d:'m4.9 4.9 2.2 2.2'}],['path',{d:'m16.9 16.9 2.2 2.2'}]],
    redo: [['path',{d:'M20 7v5h-5'}],['path',{d:'M20 12a8 8 0 1 0-2.3 5.7'}]]
  };

  function create(name) {
    var definition = icons[name];
    if (!definition) return null;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    definition.forEach(function (item) {
      var node = document.createElementNS(NS, item[0]);
      Object.keys(item[1]).forEach(function (key) { node.setAttribute(key, item[1][key]); });
      svg.appendChild(node);
    });
    return svg;
  }

  function hydrate(root) {
    var scope = root || document;
    var nodes = [];
    if (scope.nodeType === 1 && scope.matches('[data-icon]')) nodes.push(scope);
    if (scope.querySelectorAll) nodes = nodes.concat(Array.from(scope.querySelectorAll('[data-icon]')));
    nodes.forEach(function (host) {
      if (host.dataset.iconRendered === 'true') return;
      var svg = create(host.dataset.icon);
      if (!svg) return;
      host.replaceChildren(svg);
      host.classList.add('aic-icon');
      host.dataset.iconRendered = 'true';
    });
  }

  window.AICIcons = { create: create, hydrate: hydrate, names: Object.keys(icons) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { hydrate(document); });
  else hydrate(document);
}());
