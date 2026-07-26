(function () {
  'use strict';

  var HISTORY_KEY = 'aics_pb_history';
  var PROJECT_KEY = 'aics_projects';
  var scenes = [];
  var loras = [];
  var history = [];
  var projects = [];
  var visibleHistory = [];
  var favoriteOnly = false;
  var projectFilter = '';
  var renderGeneration = 0;
  var cardObjectUrls = new Set();
  var viewerObjectUrl = '';
  var viewerIndex = -1;
  var viewerReturnFocus = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeImageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      var url = new URL(value.trim(), location.href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (error) { return ''; }
  }

  function sceneFor(id) { return scenes.find(function (scene) { return scene.id === id; }); }
  function sceneTitle(id) { var scene = sceneFor(id); return scene ? scene.title : (id || '未命名作品'); }
  function loraName(id) {
    if (!id) return '—';
    var item = loras.find(function (lora) { return lora.id === id || (lora.name && (lora.name === id || String(id).indexOf(lora.name) === 0)); });
    return item ? item.name : id;
  }
  function modelName(value) {
    if (!value) return 'WebUI 当前模型';
    var name = String(value).split(/[\\/]/).pop().replace(/\s*\[[a-f0-9]+\]\s*$/i, '');
    return name.length > 42 ? name.slice(0, 39) + '…' : name;
  }
  function characterName(value) {
    return value === 'nene' ? '绫地宁宁' : value === 'natsume' ? '四季夏目' : value === 'triad' || value === 'both' ? '宁宁与夏目' : value || '—';
  }
  function formatDate(timestamp) {
    var date = new Date(timestamp);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '时间未记录';
  }
  function dayGroup(timestamp) {
    var date = new Date(timestamp);
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var diff = (start - date) / 86400000;
    return diff < 1 ? '今天' : diff < 7 ? '本周' : '更早';
  }
  function grouped(items) {
    var order = ['今天', '本周', '更早'];
    var groups = {};
    items.forEach(function (item) {
      var key = dayGroup(item.timestamp);
      (groups[key] = groups[key] || []).push(item);
    });
    return order.filter(function (key) { return groups[key] && groups[key].length; })
      .map(function (key) { return { key:key, items:groups[key] }; });
  }

  function artworkRatio(item) {
    var width = Number(item.width || item.image_width || item.actual && item.actual.width);
    var height = Number(item.height || item.image_height || item.actual && item.actual.height);
    if (!(width > 0 && height > 0)) {
      var match = String(item.size || '').match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i);
      if (match) { width = Number(match[1]); height = Number(match[2]); }
    }
    var ratio = width > 0 && height > 0 ? width / height : 3 / 4;
    return Math.max(.36, Math.min(2.8, ratio));
  }

  function revokeCardUrls() {
    cardObjectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    cardObjectUrls.clear();
  }
  function revokeViewerUrl() {
    if (viewerObjectUrl) URL.revokeObjectURL(viewerObjectUrl);
    viewerObjectUrl = '';
  }

  function attachImage(slot, source, alt, className, fallbackUrl, onFailure) {
    var image = document.createElement('img');
    image.className = className;
    image.alt = alt;
    image.decoding = 'async';
    image.loading = className === 'artwork-image' ? 'lazy' : 'eager';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('load', function () {
      if (slot.classList.contains('artwork-media') && image.naturalWidth && image.naturalHeight) {
        slot.style.aspectRatio = image.naturalWidth + ' / ' + image.naturalHeight;
      }
    });
    image.addEventListener('error', function () {
      if (fallbackUrl && image.src !== fallbackUrl) {
        image.src = fallbackUrl;
        fallbackUrl = '';
        return;
      }
      if (onFailure) onFailure();
      var fallback = document.createElement('div');
      fallback.className = className === 'viewer-image' ? 'viewer-fallback' : 'artwork-placeholder';
      fallback.textContent = '✦';
      image.replaceWith(fallback);
    });
    image.src = source;
    slot.replaceChildren(image);
  }

  async function hydrateCard(item, index, generation) {
    var slot = document.querySelector('[data-artwork-slot="' + index + '"]');
    if (!slot) return;
    var fallback = safeImageUrl(item.image_url);
    try {
      var blob = item.image_id ? await AICGImageStore.get(item.image_id) : null;
      if (generation !== renderGeneration || !slot.isConnected) return;
      if (blob) {
        var objectUrl = URL.createObjectURL(blob);
        cardObjectUrls.add(objectUrl);
        attachImage(slot, objectUrl, sceneTitle(item.scene), 'artwork-image', fallback, function () {
          URL.revokeObjectURL(objectUrl); cardObjectUrls.delete(objectUrl);
        });
      } else if (fallback) {
        attachImage(slot, fallback, sceneTitle(item.scene), 'artwork-image', '');
      } else if (item.image_data && String(item.image_data).indexOf('data:image/') === 0) {
        attachImage(slot, item.image_data, sceneTitle(item.scene), 'artwork-image', '');
      }
    } catch (error) {
      if (generation === renderGeneration && fallback) attachImage(slot, fallback, sceneTitle(item.scene), 'artwork-image', '');
    }
  }

  function artworkCard(item, index) {
    var placeholder = '<div class="artwork-placeholder">✦</div>';
    var direct = safeImageUrl(item.image_url);
    if (!item.image_id && direct) placeholder = '<img class="artwork-image" src="' + escapeHtml(direct) + '" alt="' + escapeHtml(sceneTitle(item.scene)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
    return '<article class="artwork" style="--art-ratio:' + artworkRatio(item) + '">' +
      '<button class="artwork-button" type="button" data-artwork-index="' + index + '" aria-label="欣赏作品：' + escapeHtml(sceneTitle(item.scene)) + '">' +
        '<div class="artwork-media" data-artwork-slot="' + index + '" style="aspect-ratio:' + artworkRatio(item) + '">' + placeholder +
          '<div class="artwork-caption"><span><span class="artwork-name">' + escapeHtml(sceneTitle(item.scene)) + '</span><span class="artwork-date">' + escapeHtml(formatDate(item.timestamp)) + '</span></span>' +
          '<span class="artwork-mark">' + (item.favorite ? '♥' : '＋') + '</span></div>' +
        '</div>' +
      '</button></article>';
  }

  function emptyMarkup() {
    return '<div class="empty-state"><div class="empty-state-icon">✦</div><h2>展墙还在等第一幅作品</h2>' +
      '<p>完成绘制后，原图会按自己的横竖比例进这里。作品只存在这台电脑，参数不挡画面。</p>' +
      '<a class="btn btn-primary" href="prompt-builder.html">开始绘制</a></div>';
  }

  function renderToolbar() {
    var favoriteCount = history.filter(function (item) { return item.favorite; }).length;
    var projectOptions = projects.map(function (project) {
      return '<option value="' + escapeHtml(project.id) + '"' + (project.id === projectFilter ? ' selected' : '') + '>' + escapeHtml(project.title) + '</option>';
    }).join('');
    document.getElementById('galleryToolbar').innerHTML =
      '<button class="gallery-filter' + (favoriteOnly ? ' active' : '') + '" type="button" data-gallery-action="favorites">♥ 收藏 ' + favoriteCount + '</button>' +
      '<select class="gallery-project" id="galleryProjectFilter" aria-label="按项目筛选"><option value="">全部项目</option>' + projectOptions + '</select>' +
      '<span class="gallery-toolbar-note">点作品进入沉浸观画</span>';
  }

  function render() {
    var generation = ++renderGeneration;
    revokeCardUrls();
    renderToolbar();
    var source = favoriteOnly ? history.filter(function (item) { return item.favorite; }) : history.slice();
    if (projectFilter) {
      var project = projects.find(function (item) { return item.id === projectFilter; });
      if (project) source = source.filter(function (item) { return Array.isArray(project.history_ids) && project.history_ids.indexOf(item.id) >= 0; });
    }
    visibleHistory = source;
    document.getElementById('galleryCount').textContent = source.length + ' 幅作品';
    var gallery = document.getElementById('gallery');
    if (!source.length) { gallery.innerHTML = emptyMarkup(); return; }
    var position = new Map();
    source.forEach(function (item, index) { position.set(item, index); });
    gallery.innerHTML = '<div class="gallery-wall">' + grouped(source).map(function (group) {
      return '<div class="gallery-section">' + group.key + '</div>' + group.items.map(function (item) { return artworkCard(item, position.get(item)); }).join('');
    }).join('') + '</div>';
    source.forEach(function (item, index) {
      if (item.image_id || item.image_data) hydrateCard(item, index, generation);
    });
  }

  function fact(label, value) {
    return '<div class="viewer-fact"><small>' + escapeHtml(label) + '</small><strong title="' + escapeHtml(value || '—') + '">' + escapeHtml(value || '—') + '</strong></div>';
  }

  function renderViewerInfo(item) {
    var rating = item.rating || {};
    var ratingText = ['face', 'expression', 'composition', 'hands', 'atmosphere']
      .map(function (key) { return Number(rating[key]) || 0; }).filter(Boolean);
    var average = ratingText.length ? (ratingText.reduce(function (sum, value) { return sum + value; }, 0) / ratingText.length).toFixed(1) + ' / 5' : '未评分';
    document.getElementById('viewerInfo').innerHTML =
      '<div class="viewer-kicker">Artwork ' + (viewerIndex + 1) + '</div>' +
      '<h2 class="viewer-title">' + escapeHtml(sceneTitle(item.scene)) + '</h2>' +
      '<div class="viewer-meta">' + escapeHtml(characterName(item.character)) + ' · ' + escapeHtml(formatDate(item.timestamp)) + ' · v' + escapeHtml(item.version || 1) + '</div>' +
      '<div class="viewer-story">' + escapeHtml(item.story || '这幅作品还没有附加文字。') + '</div>' +
      '<div class="viewer-facts">' + fact('尺寸', item.size) + fact('评分', average) + fact('LoRA', loraName(item.lora)) + fact('模型', modelName(item.checkpoint)) + fact('Seed', item.seed) + fact('Sampler', item.sampler) + '</div>' +
      '<details class="viewer-details"><summary>创作参数与 Prompt</summary><div class="viewer-prompt">' + escapeHtml(item.prompt || '未保存 Prompt') + '</div></details>' +
      '<div class="viewer-actions"><a class="btn btn-primary" href="prompt-builder.html?scene=' + encodeURIComponent(item.scene || '') + '&regen=' + encodeURIComponent(item.id || '') + '">重新生成</a>' +
      '<a class="btn btn-ghost" href="prompt-builder.html?scene=' + encodeURIComponent(item.scene || '') + '&variant=' + encodeURIComponent(item.id || '') + '">生成变体</a>' +
      '<button class="btn btn-ghost" type="button" data-viewer-action="copy">复制 Prompt</button></div>';
  }

  async function hydrateViewer(item, sequence) {
    var slot = document.getElementById('viewerImageSlot');
    var fallback = safeImageUrl(item.image_url);
    try {
      var blob = item.image_id ? await AICGImageStore.get(item.image_id) : null;
      if (sequence !== viewerIndex || !document.getElementById('artViewer').classList.contains('open')) return;
      if (blob) {
        viewerObjectUrl = URL.createObjectURL(blob);
        attachImage(slot, viewerObjectUrl, sceneTitle(item.scene), 'viewer-image', fallback, revokeViewerUrl);
      } else if (fallback) attachImage(slot, fallback, sceneTitle(item.scene), 'viewer-image', '');
      else if (item.image_data && String(item.image_data).indexOf('data:image/') === 0) attachImage(slot, item.image_data, sceneTitle(item.scene), 'viewer-image', '');
      else slot.innerHTML = '<div class="viewer-fallback">✦</div>';
    } catch (error) {
      slot.innerHTML = '<div class="viewer-fallback">✦</div>';
    }
  }

  function openViewer(index) {
    if (!visibleHistory[index]) return;
    viewerIndex = index;
    if (!document.getElementById('artViewer').classList.contains('open')) {
      viewerReturnFocus = document.activeElement;
    }
    revokeViewerUrl();
    var item = visibleHistory[index];
    var viewer = document.getElementById('artViewer');
    viewer.classList.add('open');
    viewer.classList.remove('info-open');
    viewer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('viewer-open');
    document.getElementById('viewerImageSlot').innerHTML = '<div class="viewer-fallback">✦</div>';
    document.getElementById('viewerPosition').textContent = (index + 1) + ' / ' + visibleHistory.length;
    document.querySelector('.viewer-prev').disabled = index <= 0;
    document.querySelector('.viewer-next').disabled = index >= visibleHistory.length - 1;
    renderViewerInfo(item);
    hydrateViewer(item, index);
    function focusViewerChrome() {
      if (!document.getElementById('artViewer').classList.contains('open')) return;
      var closeBtn = document.querySelector('.viewer-close');
      if (closeBtn && typeof closeBtn.focus === 'function') {
        try { closeBtn.focus({ preventScroll:true }); } catch (error) { closeBtn.focus(); }
      }
    }
    requestAnimationFrame(function () {
      focusViewerChrome();
      setTimeout(focusViewerChrome, 200);
    });
  }

  function closeViewer() {
    var viewer = document.getElementById('artViewer');
    viewer.classList.remove('open', 'info-open');
    viewer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('viewer-open');
    revokeViewerUrl();
    viewerIndex = -1;
    if (viewerReturnFocus && typeof viewerReturnFocus.focus === 'function') {
      try { viewerReturnFocus.focus({ preventScroll:true }); } catch (error) { viewerReturnFocus.focus(); }
    }
    viewerReturnFocus = null;
  }

  function viewerAction(action) {
    if (action === 'close') return closeViewer();
    if (action === 'prev' && viewerIndex > 0) return openViewer(viewerIndex - 1);
    if (action === 'next' && viewerIndex < visibleHistory.length - 1) return openViewer(viewerIndex + 1);
    if (action === 'info') return document.getElementById('artViewer').classList.toggle('info-open');
    if (action === 'copy') {
      var item = visibleHistory[viewerIndex];
      if (item && item.prompt) navigator.clipboard.writeText(item.prompt);
    }
  }

  document.addEventListener('click', function (event) {
    var artwork = event.target.closest('[data-artwork-index]');
    if (artwork) return openViewer(Number(artwork.getAttribute('data-artwork-index')));
    var galleryAction = event.target.closest('[data-gallery-action]');
    if (galleryAction && galleryAction.getAttribute('data-gallery-action') === 'favorites') { favoriteOnly = !favoriteOnly; render(); return; }
    var action = event.target.closest('[data-viewer-action]');
    if (action) viewerAction(action.getAttribute('data-viewer-action'));
  });
  document.addEventListener('change', function (event) {
    if (event.target.id === 'galleryProjectFilter') { projectFilter = event.target.value; render(); }
  });
  document.addEventListener('keydown', function (event) {
    var viewer = document.getElementById('artViewer');
    if (!viewer.classList.contains('open')) return;
    if (event.key === 'Escape') {
      closeViewer();
      return;
    }
    if (event.key === 'Tab') {
      var focusable = Array.from(viewer.querySelectorAll(
        'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter(function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      });
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!viewer.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key === 'ArrowLeft') viewerAction('prev');
    else if (event.key === 'ArrowRight') viewerAction('next');
    else if (event.key.toLowerCase() === 'i') viewerAction('info');
  });
  document.getElementById('viewerStage').addEventListener('click', function (event) {
    if (event.target === this) document.getElementById('artViewer').classList.remove('info-open');
  });
  window.addEventListener('pagehide', function () { renderGeneration += 1; revokeCardUrls(); revokeViewerUrl(); });

  AICKVStore.init().then(function () {
    return Promise.all([AICKVStore.get(HISTORY_KEY), AICKVStore.get(PROJECT_KEY)]);
  }).then(function (values) {
    var historyRaw = values[0];
    var projectRaw = values[1];
    if (!historyRaw) {
      try { historyRaw = JSON.parse(localStorage.getItem(HISTORY_KEY)); } catch (error) {}
      if (Array.isArray(historyRaw) && historyRaw.length) { AICKVStore.set(HISTORY_KEY, historyRaw); localStorage.removeItem(HISTORY_KEY); }
    }
    if (!projectRaw) {
      try { projectRaw = JSON.parse(localStorage.getItem(PROJECT_KEY)); } catch (error) {}
      if (Array.isArray(projectRaw) && projectRaw.length) { AICKVStore.set(PROJECT_KEY, projectRaw); localStorage.removeItem(PROJECT_KEY); }
    }
    history = Array.isArray(historyRaw) ? historyRaw.filter(function (item) {
      if (!(item && typeof item === 'object')) return false;
      if (typeof AICStorageHealth !== 'undefined') return AICStorageHealth.validateHistoryEntry(item).ok;
      return true;
    }) : [];
    projects = Array.isArray(projectRaw) ? projectRaw : [];
  }).catch(function (error) {
    console.warn('gallery storage init failed', error);
  }).then(function () {
    return Promise.all([
      fetch('../data/scenes.json?v=9').then(function (response) { return response.json(); }).then(function (data) { scenes = data; }).catch(function () {}),
      fetch('../data/loras.json?v=6').then(function (response) { return response.json(); }).then(function (data) { loras = data; }).catch(function () {})
    ]);
  }).then(render);
})();
