function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '🌙' : '☀️';
  try { localStorage.setItem('aics_theme', theme); } catch (e) {}
}
function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
try { applyTheme(localStorage.getItem('aics_theme') || 'dark'); } catch (e) { applyTheme('dark'); }

var logIndex = 0;
var toastTimer = null;
var lastStatus = null;
var tunnelEnabled = true;
try { tunnelEnabled = localStorage.getItem('aics_tunnel_off') !== '1'; } catch (e) {}

function updateTunnelUI() {
  var btn = document.getElementById('tunnel-switch');
  var hint = document.getElementById('tunnel-hint');
  var startBtn = document.getElementById('btn');
  btn.setAttribute('aria-checked', String(tunnelEnabled));
  hint.textContent = tunnelEnabled ? '朋友可通过临时链接访问' : '关闭后仅本机可访问';
  if (!lastStatus || !lastStatus.running) {
    startBtn.textContent = tunnelEnabled ? '启动并生成分享链接' : '启动（仅本地）';
    startBtn.style.background = '';
    startBtn.style.color = '';
  }
}

function toggleTunnel() {
  tunnelEnabled = !tunnelEnabled;
  try { localStorage.setItem('aics_tunnel_off', tunnelEnabled ? '' : '1'); } catch (e) {}
  updateTunnelUI();
}

updateTunnelUI();

function fmt(seconds) {
  var value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return value + ' 秒';
  var minutes = Math.floor(value / 60);
  if (minutes < 60) return minutes + ' 分钟';
  return Math.floor(minutes / 60) + ' 小时 ' + (minutes % 60) + ' 分钟';
}

function showToast(message, isError) {
  var toastEl = document.getElementById('toast');
  toastEl.textContent = message;
  toastEl.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toastEl.className = 'toast'; }, 2200);
}

function setButtonCopied(button, copiedText, normalText) {
  button.textContent = copiedText;
  setTimeout(function() { button.textContent = normalText; }, 1500);
}

function copyText(text, button, copiedText, normalText) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(function() {
    setButtonCopied(button, copiedText, normalText);
    showToast('已复制到剪贴板');
  }).catch(function() {
    showToast('复制失败，请手动选择地址', true);
  });
}

function copyShareLink() {
  var text = lastStatus && lastStatus.shareLink;
  copyText(text, document.getElementById('btn-copy'), '已复制', '复制分享链接');
}

function copyLocalLink() {
  var text = lastStatus && lastStatus.localLink;
  copyText(text, document.getElementById('copy-local'), '已复制', '复制地址');
}

function setBadge(element, kind, text) {
  element.className = 'badge ' + kind;
  element.innerHTML = '<span class="dot"></span><span></span>';
  element.lastChild.textContent = text;
}

function fmtVram(bytes) {
  var gb = Number(bytes) / (1024 * 1024 * 1024);
  if (!isFinite(gb) || gb <= 0) return '';
  return gb >= 1 ? gb.toFixed(1) + ' GB' : Math.round(gb * 1024) + ' MB';
}

function setServiceDot(id, on, meta) {
  var dot = document.getElementById(id + '-dot');
  var metaEl = document.getElementById(id + '-meta');
  if (dot) dot.className = 'dot' + (on ? ' on' : '');
  if (metaEl) metaEl.textContent = meta || '';
}

function serviceAction(service, action) {
  document.querySelectorAll('.mode-card,.service-row-actions button').forEach(function(button) { button.disabled = true; });
  fetch('/api/service/' + service, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:action})
  }).then(function(response) {
    return response.json();
  }).then(function(data) {
    if (!data.ok) throw new Error(data.error || '操作失败');
    showToast(data.message || '指令已发送');
    setTimeout(function() { pollStatus(true); }, 800);
    setTimeout(pollLogs, 800);
  }).catch(function(error) { showToast(error.message, true); pollStatus(true); });
}

function switchMode(mode) {
  var drawBtn = document.getElementById('mode-draw');
  var chatBtn = document.getElementById('mode-chat');
  drawBtn.disabled = true; chatBtn.disabled = true;
  fetch('/api/mode', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({mode:mode})
  }).then(function(response) { return response.json(); })
  .then(function(data) {
    if (!data.ok) throw new Error(data.error || '切换失败');
    showToast(data.message || '已开始切换模式');
    pollLogs(); setTimeout(function() { pollStatus(true); }, 800);
  }).catch(function(error) { showToast(error.message, true); })
  .finally(function() { setTimeout(function() { pollStatus(true); }, 1000); });
}

function saveAutoStartVoice() {
  var checked = document.getElementById('auto-start-voice').checked;
  fetch('/api/preference', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({autoStartVoice:checked})
  }).then(function(response) { return response.json(); })
  .then(function(data) { showToast(checked ? '已开启：下次打开控制面板时自动启动语音' : '已关闭：语音服务改为按需启动'); })
  .catch(function() { showToast('保存失败', true); });
}

var operationPollTimer = null;
function renderOperation(operation) {
  var panel = document.getElementById('operation-panel');
  if (!operation) {
    panel.className = 'operation-panel';
    return false;
  }
  var stages = Array.isArray(operation.stages) ? operation.stages : [];
  var active = operation.status === 'running';
  var progress = operation.status === 'completed' ? 100 : Math.min(96, Math.round(((Number(operation.stageIndex) + 1) / Math.max(1, stages.length)) * 100));
  panel.className = 'operation-panel show ' + (operation.status || 'running');
  document.getElementById('operation-title').textContent = operation.label || '服务操作';
  document.getElementById('operation-state').textContent = active ? '进行中' : operation.status === 'completed' ? '已完成' : '失败';
  document.getElementById('operation-progress').style.width = progress + '%';
  document.getElementById('operation-message').textContent = operation.error || operation.message || '';
  if (operationPollTimer) { clearTimeout(operationPollTimer); operationPollTimer = null; }
  if (active) operationPollTimer = setTimeout(function() { pollStatus(true); pollLogs(); }, 1200);
  return active;
}

function renderStatus(data) {
  lastStatus = data;
  var button = document.getElementById('btn');
  var runningPanel = document.getElementById('running-panel');
  var input = document.getElementById('sd-host');
  var ttsInput = document.getElementById('tts-host');
  var voiceInputs = {
    neneRef: document.getElementById('voice-nene-ref'), nenePrompt: document.getElementById('voice-nene-prompt'),
    natsumeRef: document.getElementById('voice-natsume-ref'), natsumePrompt: document.getElementById('voice-natsume-prompt')
  };
  var saveButton = document.getElementById('save-config');
  var feedback = document.getElementById('config-feedback');
  var actionNote = document.getElementById('action-note');

  if (document.activeElement !== input && data.sdHost) input.value = data.sdHost;
  if (document.activeElement !== ttsInput && data.ttsHost) ttsInput.value = data.ttsHost;
  var voices = data.voices || {};
  var nene = voices.nene || {};
  var natsume = voices.natsume || {};
  if (document.activeElement !== voiceInputs.neneRef) voiceInputs.neneRef.value = nene.refAudioPath || '';
  if (document.activeElement !== voiceInputs.nenePrompt) voiceInputs.nenePrompt.value = nene.promptText || '';
  if (document.activeElement !== voiceInputs.natsumeRef) voiceInputs.natsumeRef.value = natsume.refAudioPath || '';
  if (document.activeElement !== voiceInputs.natsumePrompt) voiceInputs.natsumePrompt.value = natsume.promptText || '';
  [input, ttsInput, voiceInputs.neneRef, voiceInputs.nenePrompt, voiceInputs.natsumeRef, voiceInputs.natsumePrompt].forEach(function(field) { field.disabled = !!data.running; });
  saveButton.disabled = !!data.running;

  var operationBusy = renderOperation(data.operation);

  if (data.running) {
    setBadge(document.getElementById('badge'), 'running', '运行中');
    button.className = 'btn btn-primary';
    button.style.background = 'var(--danger)';
    button.style.color = 'var(--text-inverse)';
    button.textContent = '停止网站网关';
    button.onclick = doStop;
    runningPanel.style.display = 'block';
  } else {
    setBadge(document.getElementById('badge'), 'stopped', '未启动');
    button.className = 'btn btn-primary';
    button.style.background = ''; button.style.color = '';
    button.style.background = 'var(--accent)';
    button.style.color = 'var(--text-inverse)';
    button.textContent = tunnelEnabled ? '启动并生成分享链接' : '启动（仅本地）';
    button.onclick = doStart;
    runningPanel.style.display = 'none';
  }

  setBadge(document.getElementById('sd-badge'), data.sdOnline ? 'online' : 'offline', data.sdOnline ? (data.webuiManaged ? '已连接 · 自动管理' : '已连接 · 手动') : '未连接');
  setBadge(document.getElementById('tts-badge'), data.ttsOnline ? 'online' : 'offline', data.ttsOnline ? '已连接' : '未连接');
  var ollamaLoaded = (data.ollamaModels || []).length;
  setBadge(document.getElementById('ollama-badge'), data.ollamaOnline ? 'online' : 'offline',
    !data.ollamaOnline ? '未连接' : (ollamaLoaded ? '已加载 ' + ollamaLoaded + ' 个模型' + (fmtVram(data.ollamaVram) ? ' · ' + fmtVram(data.ollamaVram) : '') : '在线 · 模型未加载'));
  setServiceDot('svc-webui', !!data.sdOnline, data.sdOnline ? (data.webuiManaged ? '受控' : '手动') : '');
  setServiceDot('svc-voice', !!data.ttsOnline, '');
  setServiceDot('svc-ollama', !!data.ollamaOnline, ollamaLoaded && fmtVram(data.ollamaVram) ? '占用 ' + fmtVram(data.ollamaVram) : '');
  var autoStartBox = document.getElementById('auto-start-voice');
  if (document.activeElement !== autoStartBox) autoStartBox.checked = !!data.autoStartVoice;
  document.getElementById('mode-draw').disabled = !!data.modeBusy;
  document.getElementById('mode-chat').disabled = !!data.modeBusy;
  document.querySelectorAll('.mode-card,.service-row-actions button').forEach(function(control) { control.disabled = operationBusy; });
  button.disabled = operationBusy;
  var configuredVoices = [nene, natsume].filter(function(p) { return !!(p.refAudioPath && p.promptText); }).length;
  setBadge(document.getElementById('voice-badge'), configuredVoices === 2 ? 'online' : (configuredVoices ? 'offline' : 'stopped'), configuredVoices === 2 ? '宁宁与夏目已配置' : (configuredVoices ? configuredVoices + ' / 2 已配置' : '尚未配置'));
  setBadge(document.getElementById('share-badge'), data.tunnelAvailable ? 'online' : 'stopped', data.tunnelAvailable ? (tunnelEnabled ? '可按需启用' : '已安装 · 当前关闭') : '未安装 · 仅本地');
  setBadge(document.getElementById('ready-badge'), data.sdOnline ? 'running' : 'offline', data.sdOnline ? (data.ttsOnline ? '画面与语音就绪' : '画面创作就绪') : '浏览可用 · 等待 SD');

  if (data.sdOnline && data.ttsOnline) {
    feedback.className = 'config-feedback ok'; feedback.textContent = '画面与语音服务均已连接，可以生成完整的有声场景。';
    actionNote.textContent = 'SD WebUI 与 GPT-SoVITS 已就绪，启动后即可本地使用或按需分享。';
  } else if (data.sdOnline) {
    feedback.className = 'config-feedback warn'; feedback.textContent = 'SD WebUI 已连接；GPT-SoVITS 暂不可用，系统声音试听仍可使用。';
    actionNote.textContent = '现在可以正常出图；需要 AI 角色声线时，再启动并配置 GPT-SoVITS。';
  } else if (data.ttsOnline) {
    feedback.className = 'config-feedback warn'; feedback.textContent = 'GPT-SoVITS 已连接；请启动带有 --api 参数的 SD WebUI 才能直接出图。';
    actionNote.textContent = '语音已经可用，画面生成仍需连接 SD WebUI。';
  } else {
    feedback.className = 'config-feedback warn'; feedback.textContent = '暂未检测到生成服务；网站浏览和系统声音试听仍可使用。';
    actionNote.textContent = '可先启动网站浏览场景，出图和 AI 声线会在对应服务连接后启用。';
  }

  if (!data.running) return;

  var localLink = data.localLink || 'http://127.0.0.1:3000/';
  document.getElementById('local-link').textContent = localLink;
  document.getElementById('local-open').href = localLink;
  document.getElementById('uptime').textContent = '网关已运行 ' + fmt(data.uptime);

  var shareLink = document.getElementById('share-link');
  var shareState = document.getElementById('share-state');
  var shareMessage = document.getElementById('share-message');
  var copyButton = document.getElementById('btn-copy');

  if (data.shareLink) {
    shareState.className = 'share-state ready'; shareState.textContent = '可以分享';
    shareMessage.textContent = '临时公网通道已建立，链接带有随机 Token。';
    shareLink.className = 'link-value'; shareLink.textContent = data.shareLink;
    copyButton.disabled = false;
  } else if (data.tunnelStatus === 'disabled') {
    shareState.className = 'share-state local-only'; shareState.textContent = '仅本地模式';
    shareMessage.textContent = '当前已关闭公网通道，本地网站仍可正常使用。';
    shareLink.className = 'link-value waiting'; shareLink.textContent = '未生成公网链接';
    copyButton.disabled = true;
  } else if (data.tunnelStatus === 'failed') {
    shareState.className = 'share-state unavailable'; shareState.textContent = '连接失败';
    shareMessage.textContent = '未能建立公网通道，请展开运行日志查看原因。';
    shareLink.className = 'link-value waiting'; shareLink.textContent = '未生成公网链接';
    copyButton.disabled = true;
  } else if (data.tunnelStatus === 'unavailable' || data.tunnelAvailable === false) {
    shareState.className = 'share-state unavailable'; shareState.textContent = '不可用';
    shareMessage.textContent = '未检测到 cloudflared。本地网站仍可正常使用。';
    shareLink.className = 'link-value waiting'; shareLink.textContent = '未生成公网链接';
    copyButton.disabled = true;
  } else {
    shareState.className = 'share-state waiting'; shareState.textContent = '正在连接';
    shareMessage.textContent = '网关已经启动，正在等待临时公网通道。';
    shareLink.className = 'link-value waiting'; shareLink.textContent = '等待分享链接…';
    copyButton.disabled = true;
  }
}

function saveSDConfig(showMessage) {
  var payload = {
    sdHost: document.getElementById('sd-host').value.trim(),
    ttsHost: document.getElementById('tts-host').value.trim(),
    voices: {
      nene: {
        refAudioPath: document.getElementById('voice-nene-ref').value.trim(),
        promptText: document.getElementById('voice-nene-prompt').value.trim(),
        promptLang: 'ja', textLang: 'ja',
        gptWeightsPath: lastStatus && lastStatus.voices && lastStatus.voices.nene ? lastStatus.voices.nene.gptWeightsPath : undefined,
        sovitsWeightsPath: lastStatus && lastStatus.voices && lastStatus.voices.nene ? lastStatus.voices.nene.sovitsWeightsPath : undefined,
        references: lastStatus && lastStatus.voices && lastStatus.voices.nene ? lastStatus.voices.nene.references : undefined
      },
      natsume: {
        refAudioPath: document.getElementById('voice-natsume-ref').value.trim(),
        promptText: document.getElementById('voice-natsume-prompt').value.trim(),
        promptLang: 'ja', textLang: 'ja',
        gptWeightsPath: lastStatus && lastStatus.voices && lastStatus.voices.natsume ? lastStatus.voices.natsume.gptWeightsPath : undefined,
        sovitsWeightsPath: lastStatus && lastStatus.voices && lastStatus.voices.natsume ? lastStatus.voices.natsume.sovitsWeightsPath : undefined,
        references: lastStatus && lastStatus.voices && lastStatus.voices.natsume ? lastStatus.voices.natsume.references : undefined
      }
    }
  };
  var feedback = document.getElementById('config-feedback');
  feedback.className = 'config-feedback'; feedback.textContent = '正在保存并重新检测…';
  return fetch('/api/config', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
  }).then(function(response) {
    return response.json().then(function(data) { if (!response.ok) throw new Error(data.error || '保存失败'); return data; });
  }).then(function(data) {
    document.getElementById('sd-host').value = data.sdHost; document.getElementById('tts-host').value = data.ttsHost;
    if (showMessage) showToast('生成服务配置已保存');
    pollStatus(); return data;
  });
}

function doSaveSDConfig() { saveSDConfig(true).catch(function(error) { showToast(error.message, true); pollStatus(); }); }

function pollStatus(force) {
  fetch('/api/status' + (force ? '?fresh=1' : '')).then(function(response) { return response.json(); })
    .then(renderStatus).catch(function() { setBadge(document.getElementById('badge'), 'stopped', '控制面板无响应'); });
}

function pollLogs() {
  fetch('/api/logs?since=' + logIndex).then(function(response) { return response.json(); })
  .then(function(data) {
    var box = document.getElementById('log-box');
    if (data.logs.length && box.querySelector('.log-empty')) box.replaceChildren();
    data.logs.forEach(function(line) {
      var row = document.createElement('div');
      var lower = line.toLowerCase();
      if (lower.indexOf('error') >= 0 || lower.indexOf('failed') >= 0 || lower.indexOf('not found') >= 0) row.className = 'err';
      else if (lower.indexOf('started') >= 0 || lower.indexOf('ready') >= 0 || lower.indexOf('tunnel') >= 0) row.className = 'info';
      var time = document.createElement('span'); time.className = 'time';
      time.textContent = line.substring(0, 10);
      row.appendChild(time); row.appendChild(document.createTextNode(' ' + line.substring(11)));
      box.appendChild(row);
    });
    logIndex += data.logs.length;
    if (data.logs.length) box.scrollTop = box.scrollHeight;
  }).catch(function() {});
}

function clearLogs(event) {
  event.preventDefault(); event.stopPropagation();
  var empty = document.createElement('div'); empty.className = 'log-empty';
  empty.textContent = '已清空当前显示，新日志仍会继续出现。';
  document.getElementById('log-box').replaceChildren(empty);
}

function doStart() {
  if (!lastStatus) { showToast('控制面板仍在读取配置，请稍候再试', true); pollStatus(); return; }
  var button = document.getElementById('btn');
  button.disabled = true; button.textContent = '正在启动…';
  saveSDConfig(false).then(function() {
    return fetch('/api/start', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({enableTunnel: tunnelEnabled})});
  }).then(function(response) { return response.json(); })
  .then(function(data) {
    if (!data.ok) throw new Error(data.msg || '启动失败');
    showToast('本地网关已启动'); startPolling();
  }).catch(function(error) { showToast('启动失败：' + error.message, true); })
  .finally(function() { button.disabled = false; pollStatus(); });
}

function doStop() {
  var button = document.getElementById('btn');
  button.disabled = true; button.textContent = '正在停止…';
  fetch('/api/stop', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({stopManagedServices:false})}).then(function(response) { return response.json(); })
  .then(function(data) {
    if (!data.ok) throw new Error(data.msg || '停止失败');
    showToast('网站网关与分享已停止；绘图、语音和聊天服务保持当前状态');
    stopPolling(); lastStatus = null;
    setBadge(document.getElementById('badge'), 'stopped', '未启动');
    setBadge(document.getElementById('sd-badge'), 'stopped', '未检测');
    setBadge(document.getElementById('tts-badge'), 'stopped', '未检测');
    setBadge(document.getElementById('ollama-badge'), 'stopped', '未检测');
    setBadge(document.getElementById('voice-badge'), 'stopped', '未检测');
    setBadge(document.getElementById('share-badge'), 'stopped', '未检测');
    setBadge(document.getElementById('ready-badge'), 'stopped', '未检测');
  }).catch(function(error) { showToast('停止失败：' + error.message, true); })
  .finally(function() { button.disabled = false; });
}

var pollInterval = null;
function startPolling() { if (!pollInterval) { pollStatus(); pollLogs(); pollInterval = setInterval(function() { pollStatus(); pollLogs(); }, 3000); } }
function stopPolling() { if (pollInterval) clearInterval(pollInterval); pollInterval = null; }
startPolling();
