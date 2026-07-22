/* Prompt Builder module: local export, restore, and backup migration. */

var BACKUP_SETTINGS_KEYS = [
  'aics_theme', 'aics_show_mature', 'aics_scene_favorites',
  'aics_sd_last_success_v1', 'aics_sd_settings_v1', 'aics_pb_last_draft',
  'aics_first_creation_v2', 'aics_first_success_v1', 'aics_director_mode',
  'aics_recent_scenes', 'aics_scene_library_mode', 'aics_tunnel_off'
];
var _pendingBackup = null;

function blobToDataUrl(blob){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(){ resolve(String(reader.result || '')); };
    reader.onerror = function(){ reject(reader.error || new Error('图片编码失败')); };
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl){
  var parts = String(dataUrl || '').split(',');
  if (parts.length !== 2) throw new Error('图片备份格式无效');
  var mime = (parts[0].match(/^data:([^;]+);base64$/i) || [])[1] || 'application/octet-stream';
  var binary = atob(parts[1]);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type:mime });
}

function collectBackupSettings(){
  var settings = {};
  BACKUP_SETTINGS_KEYS.forEach(function(key){
    try { var value = localStorage.getItem(key); if (value != null) settings[key] = value; } catch(e) {}
  });
  return settings;
}

async function encodeBackupImages(records){
  var images = [];
  for (var i = 0; i < records.length; i++) {
    var record = records[i];
    if (!record || !(record.blob instanceof Blob) || !record.blob.size) continue;
    images.push({
      id:record.id, name:record.name || '', type:record.type || record.blob.type || '',
      size:record.blob.size, created_at:record.created_at || 0,
      dataUrl:await blobToDataUrl(record.blob)
    });
  }
  return images;
}

function downloadBackup(backup){
  var stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  var blob = new Blob([JSON.stringify(backup)], { type:'application/json;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'lingji-backup-' + stamp + '.json';
  link.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  return blob.size;
}

async function exportLocalData(){
  var button = document.getElementById('backupExportBtn');
  if (button && button.disabled) return;
  var buttonLabel = button ? button.textContent : '';
  if (button) { button.disabled = true; button.textContent = '整理中…'; }
  try {
    var values = await Promise.all([
      AICKVStore.get(HIS_KEY), AICKVStore.get(PRJ_KEY), AICGImageStore.listRecords()
    ]);
    var backup = AICDataBackup.create({
      appVersion:'1.5.0',
      history:Array.isArray(values[0]) ? values[0] : [],
      projects:Array.isArray(values[1]) ? values[1] : [],
      settings:collectBackupSettings(),
      images:await encodeBackupImages(values[2] || [])
    });
    var bytes = downloadBackup(backup);
    var info = AICDataBackup.summary(backup);
    flash('备份完成：' + info.history + ' 条记录 · ' + info.images + ' 张图片 · ' + Math.max(1, Math.round(bytes / 1024)) + ' KB');
  } catch(error) {
    console.error('backup export failed', error);
    flash('备份失败：' + (error.message || '请检查浏览器存储'));
  } finally {
    if (button) { button.disabled = false; button.textContent = buttonLabel || '导出备份'; }
  }
}

function closeUtilityMenu(){
  var menu = document.getElementById('utilityMenu');
  var popover = document.getElementById('utilityPopover');
  var trigger = document.getElementById('utilityTrigger');
  if (menu) menu.classList.remove('open');
  if (popover) popover.hidden = true;
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function toggleUtilityMenu(event){
  if (event) event.stopPropagation();
  var menu = document.getElementById('utilityMenu');
  var popover = document.getElementById('utilityPopover');
  var trigger = document.getElementById('utilityTrigger');
  if (!menu || !popover || !trigger) return;
  var open = !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  popover.hidden = !open;
  trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function openBackupPicker(){
  var input = document.getElementById('backupFileInput');
  if (input) { input.value = ''; input.click(); }
}

async function previewBackupFile(){
  var input = document.getElementById('backupFileInput');
  var file = input && input.files && input.files[0];
  if (!file) return;
  if (file.size > 512 * 1024 * 1024) { flash('备份文件超过 512 MB，暂不支持直接恢复'); return; }
  try {
    _pendingBackup = AICDataBackup.normalize(JSON.parse(await file.text()));
    var info = AICDataBackup.summary(_pendingBackup);
    document.getElementById('backupSummary').innerHTML =
      '<strong>' + esc(file.name) + '</strong><span>' + info.history + ' 条历史 · ' + info.projects + ' 个项目 · ' + info.images + ' 张图片 · 数据版本 v' + _pendingBackup.schemaVersion + '</span>';
    window.__backupReturnFocus = document.activeElement;
    document.getElementById('backupOverlay').classList.add('open');
    document.body.classList.add('modal-open');
    requestAnimationFrame(function(){ var card=document.querySelector('#backupOverlay .backup-card'); if(card)card.focus(); });
  } catch(error) {
    _pendingBackup = null;
    flash('无法读取备份：' + (error.message || '文件已损坏'));
  }
}

function closeBackupRestore(){
  if (document.getElementById('backupRestoreBtn').disabled) return;
  document.getElementById('backupOverlay').classList.remove('open');
  document.body.classList.remove('modal-open');
  if (window.__backupReturnFocus && typeof window.__backupReturnFocus.focus === 'function') window.__backupReturnFocus.focus();
  window.__backupReturnFocus = null;
  _pendingBackup = null;
}

function restoreBackupSettings(settings, replace){
  if (replace) BACKUP_SETTINGS_KEYS.forEach(function(key){ try { localStorage.removeItem(key); } catch(e) {} });
  Object.keys(settings || {}).forEach(function(key){
    if (BACKUP_SETTINGS_KEYS.indexOf(key) !== -1) try { localStorage.setItem(key, String(settings[key])); } catch(e) {}
  });
}

function decodeBackupImages(images){
  return (images || []).map(function(record){
    return {
      id:record.id, name:record.name || '', type:record.type || '',
      created_at:record.created_at || 0, blob:dataUrlToBlob(record.dataUrl)
    };
  });
}

async function restoreLocalData(mode){
  if (!_pendingBackup) return;
  var replace = mode === 'replace';
  if (replace && !window.confirm('覆盖恢复会替换当前项目、历史记录和本地图片。建议先导出一份当前备份。确定继续吗？')) return;
  var button = document.getElementById('backupRestoreBtn');
  var mergeButton = document.getElementById('backupMergeBtn');
  button.disabled = true; mergeButton.disabled = true;
  button.textContent = replace ? '覆盖中…' : '恢复中…';
  try {
    var imported = _pendingBackup;
    var current = await Promise.all([AICKVStore.get(HIS_KEY), AICKVStore.get(PRJ_KEY)]);
    var history = replace ? imported.data.history : AICDataBackup.mergeById(current[0] || [], imported.data.history);
    var projects = replace ? imported.data.projects : AICDataBackup.mergeById(current[1] || [], imported.data.projects);
    var images = decodeBackupImages(imported.images);
    if (replace) await AICGImageStore.replaceAll(images);
    else for (var i = 0; i < images.length; i++) await AICGImageStore.putRecord(images[i]);
    await Promise.all([AICKVStore.set(HIS_KEY, history), AICKVStore.set(PRJ_KEY, projects)]);
    restoreBackupSettings(imported.data.settings, replace);
    _cachedHistory = migrateHistory(history).list;
    _cachedProjects = projects;
    state.history = _cachedHistory;
    PERSONAL_PROFILE = AICSceneUX.buildPreferenceProfile(_cachedHistory);
    refreshProjectSelect(); renderHistory(); renderScenes();
    document.getElementById('backupOverlay').classList.remove('open');
    document.body.classList.remove('modal-open');
    _pendingBackup = null;
    flash((replace ? '覆盖' : '合并') + '恢复完成，即将刷新页面…');
    window.setTimeout(function(){ window.location.reload(); }, 700);
  } catch(error) {
    console.error('backup restore failed', error);
    flash('恢复失败：' + (error.message || '备份数据无效'));
  } finally {
    button.disabled = false; mergeButton.disabled = false;
    button.textContent = '覆盖本地';
  }
}

function initBackupUI(){
  var overlay = document.getElementById('backupOverlay');
  if (overlay) overlay.addEventListener('click', function(event){ if (event.target === overlay) closeBackupRestore(); });
  if (overlay) overlay.addEventListener('keydown', function(event){
    if (event.key !== 'Tab') return;
    var focusable = Array.from(overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function(item){ return item.offsetParent !== null; });
    if (!focusable.length) return;
    var first=focusable[0], last=focusable[focusable.length-1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.addEventListener('click', function(event){
    var menu = document.getElementById('utilityMenu');
    if (menu && menu.classList.contains('open') && !menu.contains(event.target)) closeUtilityMenu();
  });
}
