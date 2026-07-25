let SCENES = [];
let TAGS = [];
let CURATION = {};
let currentPage = 1;
const PAGE_SIZE = 30;
let imagePage = 1;
const IMAGE_PAGE_SIZE = 60;
let tagPage = 1;
const TAG_PAGE_SIZE = 60;
let editingId = null;
let sceneUsageCount = {};
let hasUnsavedChanges = false;
let pendingChangeCount = 0;
let selectedImageSceneId = '';

const SHOWCASE_DIR = '../scene-showcase';

async function init() {
  const table = document.getElementById('sceneTable');
  if (table) table.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:var(--s-6);color:var(--text-muted)">⏳ 正在加载数据…</td></tr>';

  try {
    const [scenesRes, tagsRes, curationRes] = await Promise.all([
      fetch('../data/scenes.json?v=' + Date.now()),
      fetch('../data/tags.json?v=' + Date.now()),
      fetch('../data/curation.json?v=' + Date.now())
    ]);

    if (!scenesRes.ok) throw new Error('scenes.json 加载失败 (HTTP ' + scenesRes.status + ')');
    if (!tagsRes.ok) throw new Error('tags.json 加载失败 (HTTP ' + tagsRes.status + ')');
    if (!curationRes.ok) throw new Error('curation.json 加载失败 (HTTP ' + curationRes.status + ')');

    SCENES = await scenesRes.json();
    TAGS = await tagsRes.json();
    CURATION = await curationRes.json();

    if (!Array.isArray(SCENES)) throw new Error('scenes.json 格式错误：不是数组');
    if (!Array.isArray(TAGS)) throw new Error('tags.json 格式错误：不是数组');
    if (!CURATION || typeof CURATION !== 'object') throw new Error('curation.json 格式错误：不是对象');
  } catch (err) {
    if (table) table.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:var(--s-6);color:var(--danger)">⚠️ ' + esc(err.message) + '<br><small>请确认通过 localhost 访问且文件存在</small></td></tr>';
    return;
  }

  rebuildTagUsage();

  // Populate category filter
  const cats = [...new Set(SCENES.map(s => s.category))].sort();
  const sel = document.getElementById('filterCategory');
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });

  renderStats();
  renderScenes();
  renderImages();
}

function renderStats() {
  const total = SCENES.length;
  const nene = SCENES.filter(s => s.char === 'nene').length;
  const natsume = SCENES.filter(s => s.char === 'natsume').length;
  const dual = SCENES.filter(s => s.char === 'triad' || s.char === 'both').length;
  const mature = SCENES.filter(s => s.mature).length;
  const allR = SCENES.filter(s => s.rating === 'All').length;
  const r15 = SCENES.filter(s => s.rating === 'R15').length;
  const r18 = SCENES.filter(s => s.rating === 'R18').length;

  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">总场景</div></div>
    <div class="stat-card"><div class="stat-value">${nene}</div><div class="stat-label">宁宁</div></div>
    <div class="stat-card"><div class="stat-value">${natsume}</div><div class="stat-label">夏目</div></div>
    <div class="stat-card"><div class="stat-value">${dual}</div><div class="stat-label">双人</div></div>
    <div class="stat-card"><div class="stat-value">${allR}</div><div class="stat-label">All</div></div>
    <div class="stat-card"><div class="stat-value">${r15}</div><div class="stat-label">R15</div></div>
    <div class="stat-card"><div class="stat-value">${r18}</div><div class="stat-label">R18</div></div>
    <div class="stat-card"><div class="stat-value">${TAGS.length}</div><div class="stat-label">Tags</div></div>
  `;
}

function updatePendingState() {
  const count = document.getElementById('pendingCount');
  if (count) count.textContent = pendingChangeCount;
}

function renderScenes() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const cat = document.getElementById('filterCategory').value;
  const char = document.getElementById('filterChar').value;
  const rating = document.getElementById('filterRating').value;
  const sortBy = document.getElementById('sortBy').value;

  let filtered = SCENES.filter(s => {
    if (cat && s.category !== cat) return false;
    if (char && s.char !== char) return false;
    if (rating && s.rating !== rating) return false;
    if (search) {
      const haystack = [s.id, s.title, s.story, s.category, s.char, ...(s.tags || [])].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'id') return a.id.localeCompare(b.id);
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'category') return a.category.localeCompare(b.category);
    if (sortBy === 'char') return a.char.localeCompare(b.char);
    return 0;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById('sceneTable');
  tbody.innerHTML = page.map(s => `
    <tr>
      <td><strong>${s.id}</strong></td>
      <td>${esc(s.title)}</td>
      <td>${esc(s.category)}</td>
      <td title="${s.char === 'nene' ? '宁宁' : s.char === 'natsume' ? '夏目' : '双人'}">${s.char === 'nene' ? '🌸' : s.char === 'natsume' ? '🍂' : '◇'}</td>
      <td><span class="rating-badge rating-${s.rating}">${s.rating}</span></td>
      <td><div class="story-preview">${esc(s.story)}</div></td>
      <td>
        <div class="action-btns">
          <button class="btn btn-ghost btn-sm" onclick="openEditModal('${s.id}')">编辑</button>
          <button class="btn btn-ghost btn-sm" onclick="duplicateScene('${s.id}')">复制</button>
          <button class="btn btn-danger btn-sm" onclick="deleteScene('${s.id}')">下架</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Pagination
  const pag = document.getElementById('pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }
  let html = `<span style="color:var(--text-muted);font-size:.8rem">${filtered.length} 条 · 第 ${currentPage}/${totalPages} 页</span>`;
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 10 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== totalPages) {
      if (i === currentPage - 3 || i === currentPage + 3) html += '<span style="color:var(--text-muted)">…</span>';
      continue;
    }
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  pag.innerHTML = html;
}

function goPage(p) { currentPage = p; renderScenes(); }

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-scenes').style.display = tab === 'scenes' ? '' : 'none';
  document.getElementById('tab-images').style.display = tab === 'images' ? '' : 'none';
  document.getElementById('tab-import').style.display = tab === 'import' ? '' : 'none';
  document.getElementById('tab-duplicates').style.display = tab === 'duplicates' ? '' : 'none';
  document.getElementById('tab-tags').style.display = tab === 'tags' ? '' : 'none';
  document.getElementById('tab-guide').style.display = tab === 'guide' ? '' : 'none';
  document.getElementById('tab-tools').style.display = tab === 'tools' ? '' : 'none';
  if (tab === 'scenes') { renderScenes(); renderStats(); }
  if (tab === 'images') renderImages();
  if (tab === 'tags') renderTags();
  if (tab === 'tools') renderTools();
}

// Image management
function renderImages(resetPage) {
  if (!SCENES || !SCENES.length) {
    document.getElementById('imageGrid').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:var(--s-7);color:var(--text-muted)">⏳ 正在加载场景数据…</div>';
    return;
  }
  const search = (document.getElementById('imageSearch')?.value || '').toLowerCase();
  const filtered = SCENES.filter(s => {
    if (!search) return true;
    return (s.id + s.title).toLowerCase().includes(search);
  });
  if (resetPage) imagePage = 1;
  const totalPages = Math.max(1, Math.ceil(filtered.length / IMAGE_PAGE_SIZE));
  imagePage = Math.min(imagePage, totalPages);
  const visible = filtered.slice((imagePage - 1) * IMAGE_PAGE_SIZE, imagePage * IMAGE_PAGE_SIZE);

  document.getElementById('imageGrid').innerHTML = visible.map(s => `
    <div style="background:var(--bg-surface);border:1px solid var(--border-soft);border-radius:var(--r-md);padding:var(--s-3);cursor:pointer;transition:all var(--t-fast)" onclick="previewImage('${s.id}','${esc(s.title)}')" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border-soft)'">
      <div style="font-weight:700;font-size:.85rem;margin-bottom:2px">${s.id}</div>
      <div style="font-size:.8rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.title)}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">${s.char === 'nene' ? '🌸' : '🍂'} ${s.rating}</div>
    </div>
  `).join('');
  document.getElementById('imagePagination').innerHTML = totalPages <= 1 ? '' :
    `<span style="color:var(--text-muted);font-size:.8rem">${filtered.length} 个场景 · 第 ${imagePage}/${totalPages} 页</span>` +
    `<button class="page-btn" ${imagePage === 1 ? 'disabled' : ''} onclick="goImagePage(${imagePage - 1})">上一页</button>` +
    `<button class="page-btn" ${imagePage === totalPages ? 'disabled' : ''} onclick="goImagePage(${imagePage + 1})">下一页</button>`;
}

function goImagePage(page) {
  imagePage = page;
  selectedImageSceneId = '';
  document.getElementById('imagePreview').style.display = 'none';
  renderImages();
  document.getElementById('imageGrid').scrollIntoView({ behavior:'smooth', block:'start' });
}

function previewImage(id, title) {
  selectedImageSceneId = id;
  document.getElementById('previewTitle').textContent = id + ' · ' + title;
  const img = document.getElementById('previewImg');
  img.src = SHOWCASE_DIR + '/images/' + id + '.jpg?v=' + Date.now();
  img.onerror = function() { this.src = 'about:blank'; this.alt = '样张未找到'; };
  var panel = document.getElementById('imagePreview');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('showcaseFeedback').textContent = '支持 PNG、JPEG、WebP，最大 15MB；仅本机可以替换。';
}

function uploadShowcaseImage(input) {
  const file = input.files && input.files[0];
  const feedback = document.getElementById('showcaseFeedback');
  if (!file || !selectedImageSceneId) return;
  if (file.size > 15 * 1024 * 1024) { feedback.textContent = '图片超过 15MB，请先压缩。'; input.value = ''; return; }
  feedback.textContent = '正在保存样张…';
  const reader = new FileReader();
  reader.onload = function() {
    const image = new Image();
    image.onload = function() {
      if (image.naturalWidth * image.naturalHeight > 60000000) {
        feedback.textContent = '图片像素过大，请使用不超过 6000 万像素的版本。';
        input.value = '';
        return;
      }
      function jpegAtWidth(maxWidth, quality) {
        const scale = Math.min(1, maxWidth / image.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d', { alpha:false });
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', quality);
      }
      const normalized = jpegAtWidth(4096, .94);
      const thumbnail = jpegAtWidth(560, .86);
      fetch('../api/maintenance/showcase', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ id:selectedImageSceneId, image:normalized, thumbnail:thumbnail })
      }).then(function(response) {
        return response.json().then(function(data) { if (!response.ok) throw new Error(data.error || '保存失败'); return data; });
      }).then(function(data) {
        feedback.textContent = data.message;
        document.getElementById('previewImg').src = '../scene-showcase/' + data.file + '?v=' + Date.now();
      }).catch(function(error) {
        feedback.textContent = '未能直接保存：' + error.message + '。请确认通过本机控制面板打开网站。';
      }).finally(function() { input.value = ''; });
    };
    image.onerror = function() { feedback.textContent = '无法读取这张图片，请换一张再试。'; input.value = ''; };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// Import
function importScenes() {
  const input = document.getElementById('importInput').value.trim();
  if (!input) { document.getElementById('importResult').innerHTML = '<p style="color:var(--danger)">请粘贴 JSON</p>'; return; }

  let data;
  try { data = JSON.parse(input); } catch(e) {
    document.getElementById('importResult').innerHTML = '<p style="color:var(--danger)">JSON 错误：' + e.message + '</p>';
    return;
  }
  if (!Array.isArray(data)) data = [data];

  const existingIds = new Set(SCENES.map(s => s.id));
  const results = { success: [], skipped: [], errors: [] };

  data.forEach((item, idx) => {
    if (!item.id) { results.errors.push({idx, reason:'缺少 id'}); return; }
    if (existingIds.has(item.id)) { results.skipped.push({idx, id:item.id}); return; }

    const scene = {
      id: item.id, title: item.title || '未命名', category: item.category || '恋爱',
      story: item.story || '', char: item.char || 'nene', character: item.char === 'triad' ? ['nene','natsume'] : [item.char || 'nene'],
      lora: item.lora || (item.char === 'natsume' ? 'shiki_natsume_v14' : item.char === 'triad' ? 'ayachi_nene_v14:0.52, shiki_natsume_v14:0.52' : 'ayachi_nene_v14'),
      emotion: item.emotion || '恋爱', season: item.season || '不限', time: item.time || '深夜',
      timeOfDay: item.timeOfDay || 'late_night', tags: item.tags || [], mature: item.mature || false,
      rating: item.rating || (item.mature ? 'R18' : 'All'), location: item.location || '',
      weather: item.weather || '', camera: item.camera || '', lighting: item.lighting || '',
      usage: item.usage || ['壁纸级'], prompt: item.prompt || '',
      negative: item.negative || 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands',
      storyJa: item.storyJa || ''
    };
    SCENES.push(scene); existingIds.add(scene.id); results.success.push(scene.id);
  });

  let html = '<div style="background:var(--bg-surface);border:1px solid var(--border-soft);border-radius:var(--r-md);padding:var(--s-4)">';
  if (results.success.length) html += '<p style="color:var(--success)">✅ 导入 ' + results.success.length + ' 个：' + results.success.join(', ') + '</p>';
  if (results.skipped.length) html += '<p style="color:var(--warning)">⚠️ 跳过 ' + results.skipped.length + ' 个（ID 已存在）</p>';
  if (results.errors.length) html += '<p style="color:var(--danger)">❌ 错误：' + results.errors.map(e => '#' + e.idx + ' ' + e.reason).join('; ') + '</p>';
  html += '</div><p style="color:var(--text-muted);font-size:.8rem;margin-top:var(--s-2)">记得点「导出 JSON」保存。</p>';
  document.getElementById('importResult').innerHTML = html;
  if (results.success.length) markDirty('批量导入已通过基础检查，等待保存到项目');
  renderScenes(); renderStats();
}

// Edit/Add
function sceneCurationTier(id) {
  if ((CURATION.signatureSceneIds || []).includes(id)) return 'signature';
  if ((CURATION.curatedSceneIds || []).includes(id)) return 'curated';
  if ((CURATION.reviewSceneIds || []).includes(id)) return 'review';
  return 'normal';
}

function updateCurationReasonState() {
  const tier = document.getElementById('formCurationTier').value;
  const reason = document.getElementById('formRecommendationReason');
  reason.required = tier === 'signature';
  reason.disabled = tier === 'normal' || tier === 'review';
  if (reason.disabled) reason.value = '';
}

function setSceneCuration(id, tier, reason) {
  ['curatedSceneIds', 'signatureSceneIds', 'reviewSceneIds'].forEach(function(key) {
    CURATION[key] = (CURATION[key] || []).filter(function(sceneId) { return sceneId !== id; });
  });
  CURATION.recommendationReasons = CURATION.recommendationReasons || {};
  delete CURATION.recommendationReasons[id];
  if (tier === 'curated' || tier === 'signature') CURATION.curatedSceneIds.push(id);
  if (tier === 'signature') CURATION.signatureSceneIds.push(id);
  if (tier === 'review') CURATION.reviewSceneIds.push(id);
  if ((tier === 'curated' || tier === 'signature') && reason.trim()) CURATION.recommendationReasons[id] = reason.trim();
}

function updateCharacterDefaults() {
  const character = document.getElementById('formChar').value;
  const field = document.getElementById('formLora');
  const knownBinding = /^(?:ayachi_nene|shiki_natsume)_v\d+(?::[\d.]+)?(?:,\s*(?:ayachi_nene|shiki_natsume)_v\d+(?::[\d.]+)?)?$/.test(field.value.trim());
  if (!field.value.trim() || knownBinding) {
    field.value = character === 'natsume' ? 'shiki_natsume_v14' : character === 'triad' ? 'ayachi_nene_v14:0.52, shiki_natsume_v14:0.52' : 'ayachi_nene_v14';
  }
}

function openEditModal(id) {
  editingId = id;
  const s = SCENES.find(x => x.id === id);
  if (!s) return;
  document.getElementById('modalTitle').textContent = '编辑 ' + id;
  document.getElementById('formId').value = s.id;
  document.getElementById('formTitle').value = s.title || '';
  document.getElementById('formCategory').value = s.category || '';
  document.getElementById('formChar').value = s.char || 'nene';
  document.getElementById('formLora').value = s.lora || '';
  document.getElementById('formEmotion').value = s.emotion || '';
  document.getElementById('formSeason').value = s.season || '不限';
  document.getElementById('formTime').value = s.time || '';
  document.getElementById('formTimeOfDay').value = s.timeOfDay || 'daytime';
  document.getElementById('formRating').value = s.rating || 'All';
  document.getElementById('formMature').value = String(s.mature || false);
  document.getElementById('formCurationTier').value = sceneCurationTier(s.id);
  document.getElementById('formRecommendationReason').value = (CURATION.recommendationReasons || {})[s.id] || '';
  updateCurationReasonState();
  document.getElementById('formLocation').value = s.location || '';
  document.getElementById('formWeather').value = s.weather || '';
  document.getElementById('formCamera').value = s.camera || '';
  document.getElementById('formLighting').value = s.lighting || '';
  document.getElementById('formTags').value = (s.tags || []).join(', ');
  document.getElementById('formUsage').value = (s.usage || []).join(', ');
  document.getElementById('formStory').value = s.story || '';
  document.getElementById('formStoryJa').value = s.storyJa || '';
  document.getElementById('formPrompt').value = s.prompt || '';
  document.getElementById('formNegative').value = s.negative || '';
  document.getElementById('editModal').classList.add('show');
}

function openAddModal() {
  editingId = null;
  const maxId = SCENES.reduce((m, s) => Math.max(m, parseInt(s.id.replace('sc', ''))), 0);
  document.getElementById('modalTitle').textContent = '新增场景';
  document.getElementById('formId').value = 'sc' + String(maxId + 1).padStart(3, '0');
  document.getElementById('formTitle').value = '';
  document.getElementById('formCategory').value = '恋爱';
  document.getElementById('formChar').value = 'nene';
  document.getElementById('formLora').value = 'ayachi_nene_v14';
  document.getElementById('formEmotion').value = '恋爱';
  document.getElementById('formSeason').value = '不限';
  document.getElementById('formTime').value = '深夜';
  document.getElementById('formTimeOfDay').value = 'late_night';
  document.getElementById('formRating').value = 'All';
  document.getElementById('formMature').value = 'false';
  document.getElementById('formCurationTier').value = 'normal';
  document.getElementById('formRecommendationReason').value = '';
  updateCurationReasonState();
  document.getElementById('formLocation').value = '';
  document.getElementById('formWeather').value = '';
  document.getElementById('formCamera').value = '';
  document.getElementById('formLighting').value = '';
  document.getElementById('formTags').value = '';
  document.getElementById('formUsage').value = '';
  document.getElementById('formStory').value = '';
  document.getElementById('formStoryJa').value = '';
  document.getElementById('formPrompt').value = '';
  document.getElementById('formNegative').value = '';
  document.getElementById('editModal').classList.add('show');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('show');
}

function saveScene() {
  const titleInput = document.getElementById('formTitle');
  const storyInput = document.getElementById('formStory');
  const tierInput = document.getElementById('formCurationTier');
  const reasonInput = document.getElementById('formRecommendationReason');
  [titleInput, storyInput].forEach(function(input){ input.classList.toggle('invalid', !input.value.trim()); });
  if (!titleInput.value.trim() || !storyInput.value.trim()) {
    document.getElementById('maintenanceHint').textContent = '请先补齐标题和故事，再保存场景。';
    return;
  }
  reasonInput.classList.toggle('invalid', tierInput.value === 'signature' && !reasonInput.value.trim());
  if (tierInput.value === 'signature' && !reasonInput.value.trim()) {
    document.getElementById('maintenanceHint').textContent = '招牌场景必须填写推荐理由。';
    return;
  }
  const selectedCharacter = document.getElementById('formChar').value;
  const scene = {
    id: document.getElementById('formId').value,
    title: document.getElementById('formTitle').value,
    category: document.getElementById('formCategory').value,
    char: selectedCharacter,
    character: selectedCharacter === 'triad' ? ['nene', 'natsume'] : [selectedCharacter],
    lora: document.getElementById('formLora').value,
    emotion: document.getElementById('formEmotion').value,
    season: document.getElementById('formSeason').value,
    time: document.getElementById('formTime').value,
    timeOfDay: document.getElementById('formTimeOfDay').value,
    rating: document.getElementById('formRating').value,
    mature: document.getElementById('formMature').value === 'true',
    location: document.getElementById('formLocation').value,
    weather: document.getElementById('formWeather').value,
    camera: document.getElementById('formCamera').value,
    lighting: document.getElementById('formLighting').value,
    tags: document.getElementById('formTags').value.split(',').map(t => t.trim()).filter(Boolean),
    usage: document.getElementById('formUsage').value.split(',').map(t => t.trim()).filter(Boolean),
    story: document.getElementById('formStory').value,
    storyJa: document.getElementById('formStoryJa').value,
    prompt: document.getElementById('formPrompt').value,
    negative: document.getElementById('formNegative').value
  };

  if (editingId) {
    const idx = SCENES.findIndex(s => s.id === editingId);
    if (idx >= 0) SCENES[idx] = scene;
  } else {
    SCENES.push(scene);
  }
  setSceneCuration(scene.id, tierInput.value, reasonInput.value);

  closeModal();
  markDirty('场景内容有修改');
  renderScenes();
  renderStats();
}

function deleteScene(id) {
  if (!confirm('确认下架 ' + id + '？保存到项目后，它将不再出现在场景库中。')) return;
  SCENES = SCENES.filter(s => s.id !== id);
  setSceneCuration(id, 'normal', '');
  markDirty('有场景等待下架');
  renderScenes();
  renderStats();
}

function duplicateScene(id) {
  const source = SCENES.find(s => s.id === id);
  if (!source) return;
  const maxId = SCENES.reduce((m, s) => Math.max(m, parseInt(String(s.id).replace('sc', '')) || 0), 0);
  const copy = JSON.parse(JSON.stringify(source));
  copy.id = 'sc' + String(maxId + 1).padStart(3, '0');
  copy.title = source.title + ' · 副本';
  SCENES.push(copy);
  markDirty('已复制场景，请编辑副本内容');
  renderScenes();
  renderStats();
  openEditModal(copy.id);
}

function markDirty(message) {
  hasUnsavedChanges = true;
  pendingChangeCount += 1;
  updatePendingState();
  const state = document.getElementById('maintenanceState');
  state.classList.add('dirty');
  document.getElementById('maintenanceTitle').textContent = '有尚未保存的修改';
  document.getElementById('maintenanceHint').textContent = message || '确认无误后保存到项目。';
  document.getElementById('saveProjectBtn').disabled = false;
}

function saveToProject() {
  if (!hasUnsavedChanges) return;
  const button = document.getElementById('saveProjectBtn');
  button.disabled = true;
  button.textContent = '正在保存并检查…';
  fetch('../api/maintenance/scenes', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ scenes:SCENES, tags:TAGS, curation:CURATION })
  }).then(function(response) {
    return response.json().then(function(data) { if (!response.ok) throw new Error(data.error || '保存失败'); return data; });
  }).then(function(data) {
    hasUnsavedChanges = false;
    pendingChangeCount = 0;
    updatePendingState();
    document.getElementById('maintenanceState').classList.remove('dirty');
    document.getElementById('maintenanceTitle').textContent = '已保存并通过检查';
    document.getElementById('maintenanceHint').textContent = data.count + ' 个场景和 ' + data.tagCount + ' 个 Tag 已同步；备份编号：' + data.backup + '。';
    button.textContent = '保存到项目';
  }).catch(function(error) {
    document.getElementById('maintenanceTitle').textContent = '保存未完成';
    document.getElementById('maintenanceHint').textContent = error.message;
    button.disabled = false;
    button.textContent = '重新保存';
  });
}

window.addEventListener('beforeunload', function(event) {
  if (!hasUnsavedChanges) return;
  event.preventDefault();
  event.returnValue = '';
});

// Duplicates
function detectDuplicates() {
  const groups = {};
  const keywords = ['吊带','丝绸','围裙','泳衣','温泉','旗袍','毛衣','衬衫','图书馆','天台','烟花','神社','巫女','咖啡','卧室','寝室','影音室','休息室','后厨','厨房','吧台','晚礼服','魔女','洛丽塔','浴衣','和服','赛车','冰箱','冷藏','露台','阳台','温泉','泳池','书房','试衣'];

  keywords.forEach(kw => {
    const matches = SCENES.filter(s => s.title.includes(kw) || s.story.includes(kw));
    if (matches.length >= 3) {
      groups[kw] = matches;
    }
  });

  const dupList = document.getElementById('dupList');
  let html = '';
  let totalDups = 0;
  for (const [kw, scenes] of Object.entries(groups)) {
    html += `<div class="dup-group"><h4>「${kw}」— ${scenes.length} 个场景</h4>`;
    scenes.forEach(s => {
      html += `<div class="dup-item">
        <span><strong>${s.id}</strong> ${esc(s.title)} <span class="rating-badge rating-${s.rating}">${s.rating}</span></span>
        <div class="action-btns">
          <button class="btn btn-ghost btn-sm" onclick="openEditModal('${s.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="deleteScene('${s.id}');detectDuplicates()">下架</button>
        </div>
      </div>`;
      totalDups++;
    });
    html += '</div>';
  }

  document.getElementById('dupResult').textContent = `发现 ${Object.keys(groups).length} 组，共 ${totalDups} 个疑似重复`;
  dupList.innerHTML = html || '<p style="color:var(--text-muted)">未发现重复</p>';
}

// Tags
function renderTags(resetPage) {
  const search = document.getElementById('tagSearch').value.toLowerCase();
  const filtered = TAGS.filter(t => {
    if (!search) return true;
    return (t.en + t.cn + t.cat).toLowerCase().includes(search);
  }).sort((a, b) => (sceneUsageCount[b.en] || 0) - (sceneUsageCount[a.en] || 0));
  if (resetPage) tagPage = 1;
  const totalPages = Math.max(1, Math.ceil(filtered.length / TAG_PAGE_SIZE));
  tagPage = Math.min(tagPage, totalPages);
  const visible = filtered.slice((tagPage - 1) * TAG_PAGE_SIZE, tagPage * TAG_PAGE_SIZE);

  document.getElementById('tagTable').innerHTML = visible.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${esc(t.cat)}</td>
      <td>${esc(t.en)}</td>
      <td>${esc(t.cn)}</td>
      <td>${t.weight}</td>
      <td>${sceneUsageCount[t.en] || 0}</td>
      <td><div class="action-btns"><button class="btn btn-ghost btn-sm" onclick="editTag('${t.id}')">编辑</button><button class="btn btn-danger btn-sm" onclick="deleteTag('${t.id}')">删除</button></div></td>
    </tr>
  `).join('');
  document.getElementById('tagPagination').innerHTML = totalPages <= 1 ? '' :
    `<span style="color:var(--text-muted);font-size:.8rem">${filtered.length} 个 Tag · 第 ${tagPage}/${totalPages} 页</span>` +
    `<button class="page-btn" ${tagPage === 1 ? 'disabled' : ''} onclick="goTagPage(${tagPage - 1})">上一页</button>` +
    `<button class="page-btn" ${tagPage === totalPages ? 'disabled' : ''} onclick="goTagPage(${tagPage + 1})">下一页</button>`;
}

function goTagPage(page) {
  tagPage = page;
  renderTags();
  document.getElementById('tagTable').scrollIntoView({ behavior:'smooth', block:'start' });
}

function openAddTagModal() {
  const name = prompt('Tag 英文名：');
  if (!name) return;
  const cn = prompt('Tag 中文名：');
  if (!cn) return;
  const cat = prompt('分类（Clothing/Action/Emotion/Scene/Lighting/Body/Appearance）：', 'Scene');
  if (!cat) return;

  const maxId = TAGS.reduce((m, t) => Math.max(m, parseInt(t.id.replace('tag_', ''))), 0);
  if (TAGS.some(function(tag) { return String(tag.en).toLowerCase() === name.trim().toLowerCase(); })) {
    alert('这个 Tag 英文名已经存在。');
    return;
  }
  TAGS.push({ id: 'tag_' + String(maxId + 1).padStart(3, '0'), cat:cat.trim(), en:name.trim(), cn:cn.trim(), weight:0.8, related:[] });
  markDirty('新增 Tag 等待保存到项目');
  renderTags();
  renderStats();
}

function editTag(id) {
  const tag = TAGS.find(function(item) { return item.id === id; });
  if (!tag) return;
  const name = prompt('Tag 英文名：', tag.en);
  if (!name) return;
  if (TAGS.some(function(item) { return item.id !== id && String(item.en).toLowerCase() === name.trim().toLowerCase(); })) {
    alert('这个 Tag 英文名已经存在。');
    return;
  }
  const cn = prompt('Tag 中文名：', tag.cn || '');
  if (!cn) return;
  const cat = prompt('分类：', tag.cat || 'Scene');
  if (!cat) return;
  const weight = Number(prompt('默认权重：', String(tag.weight == null ? 0.8 : tag.weight)));
  if (!Number.isFinite(weight) || weight <= 0 || weight > 2) {
    alert('权重必须是 0 到 2 之间的数字。');
    return;
  }
  const oldName = tag.en;
  Object.assign(tag, { en:name.trim(), cn:cn.trim(), cat:cat.trim(), weight:weight });
  if (oldName !== tag.en) {
    SCENES.forEach(function(scene) {
      scene.tags = (scene.tags || []).map(function(value) { return value === oldName ? tag.en : value; });
    });
  }
  rebuildTagUsage();
  markDirty('Tag 修改及其场景引用等待保存');
  renderTags();
}

function deleteTag(id) {
  const tag = TAGS.find(function(item) { return item.id === id; });
  if (!tag || !confirm('确认删除 Tag「' + tag.en + '」？场景中的对应引用也会一并移除。')) return;
  TAGS = TAGS.filter(function(item) { return item.id !== id; });
  SCENES.forEach(function(scene) { scene.tags = (scene.tags || []).filter(function(value) { return value !== tag.en; }); });
  rebuildTagUsage();
  markDirty('Tag 删除及其场景引用等待保存');
  renderTags();
  renderStats();
}

function rebuildTagUsage() {
  sceneUsageCount = {};
  SCENES.forEach(function(scene) {
    (scene.tags || []).forEach(function(tag) { sceneUsageCount[tag] = (sceneUsageCount[tag] || 0) + 1; });
  });
}

// Export
function exportJSON() {
  const blob = new Blob([JSON.stringify(SCENES, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'scenes.json'; a.click();
  URL.revokeObjectURL(url);
}

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;'); }

var TOOLS = [
  { id:'lint-colors', icon:'🎨', label:'检查硬编码颜色', desc:'扫描 HTML/CSS 中未用设计 token 的 #XXXXXX 颜色' },
  { id:'validate-scenes', icon:'✅', label:'完整场景校验', desc:'检查场景 ID 唯一性、字段完整性、评级一致性' },
  { id:'classify',    icon:'🏷', label:'更新场景评级', desc:'根据标签内容重新计算 All/R15/R18 评级' },
  { id:'optimize',    icon:'⚙️', label:'规范化提示词', desc:'统一标签命名、补全标准负面词、修复占位符' }
];

function renderTools() {
  var cards = document.getElementById('toolCards');
  cards.innerHTML = TOOLS.map(function(t) {
    return '<div style="background:var(--bg-surface);border:1px solid var(--border-soft);border-radius:var(--r-lg);padding:var(--s-4);cursor:pointer;transition:all var(--t-fast)" onmouseover="this.style.borderColor=\"var(--accent)\"" onmouseout="this.style.borderColor=\"var(--border-soft)\"" onclick="runTool(\'' + t.id + '\')">' +
      '<div style="font-size:1.5rem;margin-bottom:var(--s-2)">' + t.icon + '</div>' +
      '<div style="font-weight:700;font-size:.92rem;margin-bottom:4px">' + esc(t.label) + '</div>' +
      '<div style="font-size:.75rem;color:var(--text-muted);line-height:1.5">' + esc(t.desc) + '</div>' +
      '</div>';
  }).join('');
}

var toolRunning = false;

function runTool(taskId) {
  if (toolRunning) return;
  var tool = TOOLS.find(function(t) { return t.id === taskId; });
  if (!tool) return;
  toolRunning = true;

  var cards = document.getElementById('toolCards');
  var panel = document.getElementById('toolResult');
  var title = document.getElementById('toolResultTitle');
  var badge = document.getElementById('toolResultBadge');
  var out = document.getElementById('toolResultOutput');

  cards.style.opacity = '0.5';
  cards.style.pointerEvents = 'none';
  title.textContent = tool.icon + ' ' + tool.label;
  badge.textContent = '⏳ 运行中…';
  badge.style.cssText = 'background:color-mix(in srgb, var(--warning) 12%, transparent);color:var(--warning)';
  out.textContent = '...';
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior:'smooth', block:'nearest' });

  fetch('../api/maintenance/run', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ task:taskId })
  }).then(function(response) {
    return response.json();
  }).then(function(data) {
    badge.textContent = data.ok ? '✅ 通过' : '⚠️ 有问题';
    badge.style.cssText = data.ok
      ? 'background:color-mix(in srgb, var(--success) 12%, transparent);color:var(--success)'
      : 'background:color-mix(in srgb, var(--danger) 12%, transparent);color:var(--danger)';
    out.textContent = data.output || '(no output)';
    out.scrollTop = 0;
  }).catch(function(error) {
    badge.textContent = '❌ 失败';
    badge.style.cssText = 'background:color-mix(in srgb, var(--danger) 12%, transparent);color:var(--danger)';
    out.textContent = '网络请求失败：' + error.message;
  }).finally(function() {
    toolRunning = false;
    cards.style.opacity = '';
    cards.style.pointerEvents = '';
  });
}

init();
