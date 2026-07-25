/* Prompt Builder module: voice studio.
 * This file intentionally uses classic script globals for inline HTML handlers.
 */

// ========== VOICE STUDIO ==========
var _voiceRequest = null;
var _voiceAudioUrl = '';
var _voiceBlob = null;
var _voicePlaybackSegments = [];
var _voicePrepareKey = '';
var _voicePreparePromise = null;
var _voicePreviewContext = null;
var _voicePreviewSources = [];
var _voicePreviewTimers = [];
var _voicePreviewCursor = 0;
var _voiceGenerationActive = false;

function voiceCharacterData(id) {
  return (CHARACTER || []).find(function(character){ return character.id === id; }) || null;
}

function extractSceneDialogue(story) {
  var source = String(story || '');
  var lines = [];
  var patterns = [/「([^」]+)」/g, /“([^”]+)”/g];
  patterns.forEach(function(pattern) {
    var match;
    while ((match = pattern.exec(source))) {
      var line = String(match[1] || '').trim();
      if (line && lines.indexOf(line) === -1) lines.push(line);
    }
  });
  return lines.join('\n');
}

function voiceTextForMode(story, fallback) {
  var mode = document.getElementById('voiceMode') ? document.getElementById('voiceMode').value : 'dialogue';
  story = String(story || '').trim();
  if (mode === 'story') return story.replace(/^【[^】]+】\s*/, '');
  return extractSceneDialogue(story) || String(fallback || '').trim() || story.replace(/^【[^】]+】\s*/, '');
}

function defaultVoiceCaptionText() {
  var voice = document.getElementById('voiceCharacter') ? document.getElementById('voiceCharacter').value : 'nene';
  var character = voiceCharacterData(voice) || {};
  return voiceTextForMode(state.story, character.voice);
}

function defaultVoiceText() {
  var voice = document.getElementById('voiceCharacter') ? document.getElementById('voiceCharacter').value : 'nene';
  var language = document.getElementById('voiceLanguage') ? document.getElementById('voiceLanguage').value : 'ja';
  var scene = SCENES.find(function(item){ return item.id === state.__sceneId; });
  var character = voiceCharacterData(voice) || {};
  if (language === 'zh') return voiceTextForMode(state.story, character.voice);
  if (scene && scene.storyJa) return voiceTextForMode(scene.storyJa, character.voiceJa);
  if (String(state.story || '').trim()) return '';
  return voiceTextForMode(character.voiceJa, character.voiceJa);
}

function updateVoiceScriptLabel() {
  var label = document.getElementById('voiceScriptLabel');
  var language = document.getElementById('voiceLanguage') ? document.getElementById('voiceLanguage').value : 'ja';
  if (label) label.textContent = (language === 'ja' ? '日文配音稿' : '中文配音稿') + ' · 只影响声音';
}

function refreshVoiceScript(force) {
  var textArea = document.getElementById('voiceText');
  if (!textArea) return;
  if (force || textArea.dataset.dirty !== '1') {
    textArea.value = defaultVoiceText();
    textArea.dataset.dirty = '0';
  }
  updateVoiceScriptLabel();
  var status = document.getElementById('voiceStatus');
  var language = document.getElementById('voiceLanguage') ? document.getElementById('voiceLanguage').value : 'ja';
  if (status) {
    if (textArea.value) status.textContent = language === 'ja'
      ? '中文字幕保持不变；已准备对应的日文角色配音。'
      : '中文字幕保持不变；已切换为中文角色配音。';
    else if (language === 'ja' && String(state.story || '').trim()) status.textContent = '中文内容已保留。自定义故事请补充日文配音稿，或把配音语言切换为中文。';
    else status.textContent = '写下故事或选择场景后，会自动准备中文内容与配音稿。';
  }
  checkVoiceStatus();
}

function refreshVoiceText(force) {
  var caption = document.getElementById('voiceCaptionText');
  if (caption && (force || caption.dataset.dirty !== '1')) {
    caption.value = defaultVoiceCaptionText();
    caption.dataset.dirty = '0';
  }
  refreshVoiceScript(force);
}

function syncVoiceCharacter(forceText) {
  var select = document.getElementById('voiceCharacter');
  if (!select) return;
  if (state.char === 'nene' || state.char === 'natsume') select.value = state.char;
  refreshVoiceText(!!forceText);
}

function setVoiceState(kind, label, detail) {
  var badge = document.getElementById('voiceState');
  var status = document.getElementById('voiceStatus');
  if (badge) { badge.className = 'voice-state' + (kind ? ' ' + kind : ''); badge.textContent = label; }
  if (status && detail) status.textContent = detail;
}

function prepareVoiceStudio(voice, needsTranslation) {
  var key = voice + ':' + (needsTranslation ? 'translate' : 'voice');
  if (_voicePreparePromise && _voicePrepareKey === key) return _voicePreparePromise;
  _voicePrepareKey = key;
  _voicePreparePromise = fetch('../api/voice/prepare', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ voice:voice, translation:needsTranslation })
  }).then(function(response) {
    if (response.ok) return response.json();
    return response.json().catch(function(){ return {}; }).then(function(data) {
      throw new Error(data.error || '声线预热失败');
    });
  }).then(function(data) {
    return data;
  }).catch(function() {
    return null;
  }).finally(function() {
    if (_voicePrepareKey === key) _voicePreparePromise = null;
  });
  return _voicePreparePromise;
}

function checkVoiceStatus() {
  var voice = document.getElementById('voiceCharacter');
  var button = document.getElementById('voiceGenerateBtn');
  var translateButton = document.getElementById('voiceTranslateBtn');
  if (!voice || !button) return Promise.resolve(null);
  return fetch('../api/tts-status', { cache:'no-store' }).then(function(response) {
    if (!response.ok) throw new Error('status unavailable');
    return response.json();
  }).then(function(data) {
    var configured = !!(data.voices && data.voices[voice.value]);
    var script = document.getElementById('voiceText');
    var caption = document.getElementById('voiceCaptionText');
    var language = document.getElementById('voiceLanguage').value;
    var hasScript = !!(script && script.value.trim());
    var canTranslate = language === 'ja' && !!(caption && caption.value.trim());
    if (translateButton) translateButton.disabled = !canTranslate;
    button.disabled = !(data.online && configured && (hasScript || canTranslate));
    if (data.online && configured && hasScript) {
      setVoiceState('ready', 'AI 声线就绪', 'GPT-SoVITS 已连接；正在后台预热当前角色，屏幕保持中文。');
      prepareVoiceStudio(voice.value, language === 'ja');
    }
    else if (data.online && configured && canTranslate) {
      setVoiceState('ready', '可自动翻译', '正在后台预热翻译与角色声线；生成时无需再等冷启动。');
      prepareVoiceStudio(voice.value, true);
    }
    else if (data.online && configured) setVoiceState('warn', '待补配音稿', '中文内容已保留；请展开并补充日文配音稿，或切换为中文配音。');
    else if (data.online) setVoiceState('warn', '待配参考音频', 'GPT-SoVITS 已连接，请在启动控制面板配置该角色的参考音频与原文。');
    else setVoiceState('warn', '系统试听可用', 'GPT-SoVITS 未连接；仍可用本机系统声音试听文本节奏。');
    return data;
  }).catch(function() {
    button.disabled = true;
    setVoiceState('warn', '系统试听可用', '当前不是语音网关环境，仍可用本机系统声音试听。');
    return null;
  });
}

function initVoiceStudio() {
  var textArea = document.getElementById('voiceText');
  var caption = document.getElementById('voiceCaptionText');
  if (!textArea) return;
  textArea.addEventListener('input', function(){ this.dataset.dirty = '1'; delete this.dataset.translationSegments; });
  if (caption) caption.addEventListener('input', function(){ this.dataset.dirty = '1'; delete textArea.dataset.translationSegments; checkVoiceStatus(); });
  document.getElementById('voiceCharacter').addEventListener('change', checkVoiceStatus);
  syncVoiceCharacter(true);
  window.addEventListener('pagehide', function() {
    stopVoice();
    if (_voiceAudioUrl) URL.revokeObjectURL(_voiceAudioUrl);
  }, { once:true });
}

function translateVoiceCaption() {
  var caption = document.getElementById('voiceCaptionText');
  var script = document.getElementById('voiceText');
  var language = document.getElementById('voiceLanguage').value;
  var button = document.getElementById('voiceTranslateBtn');
  if (language !== 'ja') {
    flash('切换到日语配音后才需要翻译。');
    return Promise.resolve('');
  }
  var text = caption && caption.value.trim();
  if (!text) { flash('请先写下中文台词或故事。'); return Promise.resolve(''); }
  if (button) { button.disabled = true; button.textContent = '翻译中…'; }
  document.getElementById('voiceStatus').textContent = '正在本机翻成日语，中文正文不会被改动…';
  return fetch('../api/translate', {
    method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ text:text })
  }).then(function(response) {
    if (response.ok) return response.json();
    return response.json().catch(function(){ return {}; }).then(function(data){ throw new Error(data.error || '日语翻译失败'); });
  }).then(function(data) {
    var translation = String(data.translation || '').trim();
    if (!translation) throw new Error('没有得到可用的日语译文。');
    script.value = translation;
    script.dataset.dirty = '1';
    script.dataset.translationSegments = JSON.stringify(Array.isArray(data.segments) ? data.segments : []);
    document.querySelector('.voice-script-details').open = true;
    document.getElementById('voiceStatus').textContent = '已生成日语配音稿；可直接生成角色语音，也可以先手动微调。';
    checkVoiceStatus();
    return translation;
  }).catch(function(error) {
    document.getElementById('voiceStatus').textContent = error.message;
    flash('日语翻译失败: ' + error.message);
    return '';
  }).finally(function() {
    if (button) { button.textContent = '翻成日语'; checkVoiceStatus(); }
  });
}

function showVoiceCaption(text, index, total) {
  var box = document.getElementById('voiceLiveCaption');
  if (!box) return;
  if (!text) { box.classList.remove('show'); box.innerHTML = '<small>同步字幕</small>翻成日语后的多句台词，会在播放时于这里逐句显示对应中文。'; return; }
  box.innerHTML = '<small>正在朗读 · 第 ' + (index + 1) + ' / ' + total + ' 句</small>' + escapeHtml(text).replace(/\n/g, '<br>');
  box.classList.add('show');
}

function clearVoiceCaption() {
  showVoiceCaption('', 0, 0);
  _voicePlaybackSegments = [];
}

function syncVoiceCaptionToAudio(audio) {
  if (!_voicePlaybackSegments.length) return;
  var time = audio.currentTime;
  var index = _voicePlaybackSegments.findIndex(function(segment){ return time < segment.end; });
  if (index < 0) index = _voicePlaybackSegments.length - 1;
  var current = _voicePlaybackSegments[index];
  if (current) showVoiceCaption(current.source, index, _voicePlaybackSegments.length);
}

function voicePayload(text) {
  var emotion = voiceEmotionCategory();
  return {
    voice:document.getElementById('voiceCharacter').value,
    language:document.getElementById('voiceLanguage').value,
    text:text,
    emotion:emotion,
    referenceEmotion:emotion,
    consistency:'locked',
    speed:Number(document.getElementById('voiceSpeed').value) || 1
  };
}

function fixVoiceWavBuffer(buffer) {
  try {
    var view = new DataView(buffer);
    if (buffer.byteLength < 44 ||
        view.getUint32(0, false) !== 0x52494646 ||
        view.getUint32(8, false) !== 0x57415645) return buffer;
    view.setUint32(4, buffer.byteLength - 8, true);
    var position = 12;
    while (position + 8 <= buffer.byteLength) {
      var tag = view.getUint32(position, false);
      var size = view.getUint32(position + 4, true);
      if (tag === 0x64617461) {
        view.setUint32(position + 4, buffer.byteLength - position - 8, true);
        break;
      }
      if (size > buffer.byteLength || position + 8 + size > buffer.byteLength + 1) break;
      position += 8 + size + (size % 2);
    }
  } catch (error) {}
  return buffer;
}

function requestVoiceBlob(text) {
  return fetch('../api/tts', {
    method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(voicePayload(text)), signal:_voiceRequest.signal
  }).then(function(response) {
    if (response.ok) {
      var contentType = response.headers.get('Content-Type') || 'audio/wav';
      return response.arrayBuffer().then(function(buffer) {
        return new Blob([fixVoiceWavBuffer(buffer)], { type:contentType });
      });
    }
    return response.json().catch(function(){ return {}; }).then(function(data){ throw new Error(data.error || '语音生成失败'); });
  });
}

function wavBlobFromBuffers(buffers) {
  var sampleRate = buffers[0].sampleRate;
  var channels = Math.max.apply(null, buffers.map(function(buffer){ return buffer.numberOfChannels; }));
  var length = buffers.reduce(function(sum, buffer){ return sum + buffer.length; }, 0);
  var output = new ArrayBuffer(44 + length * channels * 2);
  var view = new DataView(output);
  function write(offset, value) { for (var i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); }
  write(0, 'RIFF'); view.setUint32(4, 36 + length * channels * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length * channels * 2, true);
  var position = 44;
  buffers.forEach(function(buffer) {
    for (var frame = 0; frame < buffer.length; frame++) {
      for (var channel = 0; channel < channels; channel++) {
        var source = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
        var sample = Math.max(-1, Math.min(1, source[frame] || 0));
        view.setInt16(position, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        position += 2;
      }
    }
  });
  return new Blob([output], { type:'audio/wav' });
}

function splitVoiceScript(text) {
  var source = String(text || '').replace(/\r/g, '').trim();
  var parts = source.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) || [];
  var result = [];
  parts.forEach(function(part) {
    part = part.trim();
    while (part.length > 100) {
      var marks = ['，', '、', ',', ' '];
      var splitAt = -1;
      marks.forEach(function(mark) { splitAt = Math.max(splitAt, part.lastIndexOf(mark, 100)); });
      if (splitAt < 24) splitAt = 100;
      result.push(part.slice(0, splitAt + 1).trim());
      part = part.slice(splitAt + 1).trim();
    }
    if (part) result.push(part);
  });
  return result.length ? result : (source ? [source] : []);
}

function stopVoicePreview() {
  _voicePreviewTimers.forEach(function(timer){ clearTimeout(timer); });
  _voicePreviewTimers = [];
  _voicePreviewSources.forEach(function(source) {
    source.onended = null;
    try { source.stop(); } catch (error) {}
    try { source.disconnect(); } catch (error) {}
  });
  _voicePreviewSources = [];
  if (_voicePreviewContext) _voicePreviewContext.close().catch(function(){});
  _voicePreviewContext = null;
  _voicePreviewCursor = 0;
}

function ensureVoicePreviewContext() {
  if (_voicePreviewContext && _voicePreviewContext.state !== 'closed') return _voicePreviewContext;
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error('当前浏览器不支持低延迟音频播放。');
  _voicePreviewContext = new AudioContext();
  _voicePreviewContext.resume().catch(function(){});
  _voicePreviewCursor = _voicePreviewContext.currentTime + .04;
  return _voicePreviewContext;
}

function finishVoicePreviewIfIdle() {
  if (_voiceGenerationActive || _voicePreviewSources.length) return;
  clearVoiceCaption();
  var status = document.getElementById('voiceStatus');
  if (status && _voiceBlob) status.textContent = 'AI 声线已生成，可以播放或下载 WAV。';
  if (_voicePreviewContext) _voicePreviewContext.close().catch(function(){});
  _voicePreviewContext = null;
  _voicePreviewCursor = 0;
}

function scheduleVoicePreview(buffer, caption, index, total) {
  var context = ensureVoicePreviewContext();
  var source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  var startAt = Math.max(context.currentTime + .04, _voicePreviewCursor);
  _voicePreviewCursor = startAt + buffer.duration;
  _voicePreviewSources.push(source);
  var delay = Math.max(0, (startAt - context.currentTime) * 1000);
  var timer = setTimeout(function() {
    if (caption) showVoiceCaption(caption, index, total);
    var status = document.getElementById('voiceStatus');
    if (status) {
      status.textContent = index + 1 < total
        ? '正在播放第 ' + (index + 1) + ' / ' + total + ' 句；后续语音在后台继续生成…'
        : '正在播放最后一句；完整语音已可重播和下载。';
    }
  }, delay);
  _voicePreviewTimers.push(timer);
  source.onended = function() {
    var sourceIndex = _voicePreviewSources.indexOf(source);
    if (sourceIndex >= 0) _voicePreviewSources.splice(sourceIndex, 1);
    try { source.disconnect(); } catch (error) {}
    finishVoicePreviewIfIdle();
  };
  source.start(startAt);
}

function generateSegmentedVoice(segments, language) {
  var context = ensureVoicePreviewContext();
  var buffers = [];
  var completed = 0;
  return segments.reduce(function(chain, segment) {
    return chain.then(function() {
      document.getElementById('voiceStatus').textContent = '正在生成第 ' + (completed + 1) + ' / ' + segments.length + ' 句角色语音…';
      var ttsText = segment.ttsText || (language === 'zh' ? segment.source : segment.translation);
      return requestVoiceBlob(ttsText).then(function(blob) { return blob.arrayBuffer(); }).then(function(data) { return context.decodeAudioData(data); }).then(function(buffer) {
        buffers.push(buffer);
        scheduleVoicePreview(buffer, segment.caption || segment.source || '', completed, segments.length);
        completed += 1;
      });
    });
  }, Promise.resolve()).then(function() {
    var cursor = 0;
    _voicePlaybackSegments = segments.map(function(segment, index) {
      var duration = buffers[index].duration;
      var value = { source:segment.source, start:cursor, end:cursor + duration };
      cursor += duration;
      return value;
    });
    _voiceBlob = wavBlobFromBuffers(buffers);
  });
}

function stopVoice() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (_voiceRequest) { _voiceRequest.abort(); _voiceRequest = null; }
  _voiceGenerationActive = false;
  stopVoicePreview();
  var audio = document.getElementById('voiceAudio');
  if (audio) { audio.pause(); audio.currentTime = 0; }
  clearVoiceCaption();
  var status = document.getElementById('voiceStatus');
  if (status) status.textContent = '已停止播放或生成。';
}

function previewVoice() {
  var text = document.getElementById('voiceText').value.trim();
  if (!text) { flash('请先准备配音文本'); return; }
  if (!('speechSynthesis' in window)) { setVoiceState('warn', '浏览器不支持', '当前浏览器没有系统语音朗读能力。'); return; }
  stopVoice();
  var voiceId = document.getElementById('voiceCharacter').value;
  var speed = Number(document.getElementById('voiceSpeed').value) || 1;
  var utterance = new SpeechSynthesisUtterance(text);
  var language = document.getElementById('voiceLanguage').value;
  utterance.lang = language === 'ja' ? 'ja-JP' : 'zh-CN';
  utterance.rate = speed;
  utterance.pitch = voiceId === 'nene' ? 1.08 : .95;
  var voices = window.speechSynthesis.getVoices();
  var localVoice = voices.find(function(item){ return language === 'ja' ? /^ja[-_]/i.test(item.lang) : /^zh[-_]/i.test(item.lang); });
  if (localVoice) utterance.voice = localVoice;
  utterance.onstart = function(){ document.getElementById('voiceStatus').textContent = '正在用本机系统声音试听（仅用于检查语速与文本）。'; };
  utterance.onend = function(){ document.getElementById('voiceStatus').textContent = '试听结束。满意后可生成 AI 角色声线。'; };
  utterance.onerror = function(){ document.getElementById('voiceStatus').textContent = '系统声音试听失败，请检查浏览器语音设置。'; };
  window.speechSynthesis.speak(utterance);
}

function generateAIVoice() {
  var text = document.getElementById('voiceText').value.trim();
  var language = document.getElementById('voiceLanguage').value;
  var caption = document.getElementById('voiceCaptionText').value.trim();
  if (!text && language === 'ja' && caption) {
    translateVoiceCaption().then(function(translation) { if (translation) generateAIVoice(); });
    return;
  }
  if (!text) { flash('请先准备配音文本'); return; }
  stopVoice();
  _voiceRequest = new AbortController();
  var button = document.getElementById('voiceGenerateBtn');
  button.disabled = true;
  button.textContent = '生成中…';
  document.getElementById('voiceStatus').textContent = '正在生成首句；首句完成后会立即播放，后续在后台衔接…';
  var rawSegments = document.getElementById('voiceText').dataset.translationSegments;
  var translatedSegments = [];
  try { translatedSegments = JSON.parse(rawSegments || '[]'); } catch (error) {}
  var segText = language === 'ja'
    ? translatedSegments.map(function(item){ return item.translation; }).join('\n').trim()
    : translatedSegments.map(function(item){ return item.source; }).join('\n').trim();
  var segments;
  if (translatedSegments.length > 0 && segText === text) {
    segments = translatedSegments.map(function(item) {
      return {
        source:String(item.source || ''),
        translation:String(item.translation || ''),
        ttsText:language === 'zh' ? String(item.source || '') : String(item.translation || ''),
        caption:String(item.source || '')
      };
    });
  } else {
    var textParts = splitVoiceScript(text);
    var captionParts = splitVoiceScript(caption);
    segments = textParts.map(function(part, index) {
      var matchingCaption = captionParts.length === textParts.length ? captionParts[index] : '';
      return {
        source:language === 'zh' ? part : matchingCaption,
        translation:language === 'ja' ? part : '',
        ttsText:part,
        caption:language === 'zh' ? part : matchingCaption
      };
    });
  }
  _voiceGenerationActive = true;
  var generation = generateSegmentedVoice(segments, language);
  generation.then(function() {
    if (_voiceAudioUrl) URL.revokeObjectURL(_voiceAudioUrl);
    _voiceAudioUrl = URL.createObjectURL(_voiceBlob);
    var audio = document.getElementById('voiceAudio');
    audio.src = _voiceAudioUrl;
    audio.ontimeupdate = function(){ syncVoiceCaptionToAudio(audio); };
    audio.onplay = function(){
      stopVoicePreview();
      syncVoiceCaptionToAudio(audio);
    };
    audio.onended = function(){ clearVoiceCaption(); };
    audio.classList.add('show');
    document.getElementById('voiceDownload').classList.add('show');
    document.getElementById('voiceStatus').textContent = _voicePreviewSources.length
      ? '完整语音已生成；正在连续播放，也可以稍后重播或下载。'
      : 'AI 声线已生成，可以播放或下载 WAV。';
  }).catch(function(error) {
    if (error.name !== 'AbortError') {
      stopVoicePreview();
      document.getElementById('voiceStatus').textContent = error.message;
      flash('语音生成失败: ' + error.message);
    }
  }).finally(function() {
    _voiceGenerationActive = false;
    finishVoicePreviewIfIdle();
    _voiceRequest = null;
    button.textContent = 'AI 声线生成';
    button.disabled = false;
  });
}

function voiceEmotionCategory() {
  var override = document.getElementById('voiceEmotion');
  if (override && override.value && override.value !== 'auto') return override.value;
  var selected = state.selections && state.selections.emotion && state.selections.emotion[0];
  var map = {
    happy:'happy', joyful:'happy', expect:'happy', relaxed:'gentle', gentle:'gentle', moved:'gentle',
    shy:'shy', love:'shy', nervous:'shy', serious:'serious', spoiled:'shy',
    sad:'sad', miss:'sad', wronged:'sad', calm:'neutral', sleepy:'neutral'
  };
  if (selected && map[selected]) return map[selected];
  var moodMap = { joy:'happy', love:'shy', warmth:'gentle', tension:'serious', sad:'sad', calm:'neutral' };
  return moodMap[state.colorMood] || 'neutral';
}

function downloadVoice() {
  if (!_voiceAudioUrl || !_voiceBlob) return;
  var link = document.createElement('a');
  link.href = _voiceAudioUrl;
  link.download = 'aics_voice_' + document.getElementById('voiceCharacter').value + '_' + document.getElementById('voiceLanguage').value + '_' + Date.now() + '.wav';
  link.click();
}

