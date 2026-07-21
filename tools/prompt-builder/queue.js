/* Prompt Builder module: sequential SD generation queue and same-seed iteration. */

var SD_QUEUE_LIMIT = 8;
var _sdQueue = [];
var _sdActiveQueueJob = null;
var _sdQueuePaused = false;

function readQueueSeed(){
  var input = document.getElementById('sdSeedInput');
  var manual = input ? input.value.trim() : '';
  if (manual !== '' && isFinite(Number(manual))) return Number(manual);
  var lock = document.getElementById('sdSeedLock');
  if (lock && lock.checked && window.__lastSeed__ != null) return Number(window.__lastSeed__);
  return -1;
}

function captureSDJob(){
  var prompt = getPlainPrompt();
  if (!prompt) return null;
  var scene = SCENES.find(function(item){ return item.id === state.__sceneId; });
  var story = String(state.story || '').trim();
  var selections = state.selections || {};
  return {
    id:'queue_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    title:scene ? scene.title : (story ? story.slice(0, 28) : (state.char === 'natsume' ? '夏目构图' : '宁宁构图')),
    prompt:prompt,
    negative:getPlainNegative(),
    sceneId:state.__sceneId || null,
    sceneTitle:scene ? scene.title : '',
    char:state.char,
    story:story,
    selections:{
      emotion:Array.isArray(selections.emotion) ? selections.emotion.slice() : [],
      shot:selections.shot || '',
      lighting:selections.lighting || '',
      composition:selections.composition || ''
    },
    colorMood:state.colorMood || '',
    projectId:state.__projectId || '',
    lora:resolveLoraSpecs(state.char, scene).map(loraSpecText).join(', '),
    checkpoint:document.getElementById('sdModel').value || '',
    sampler:document.getElementById('sampler').value || 'DPM++ 2M',
    scheduler:document.getElementById('scheduler').value || '',
    cfg:Number(document.getElementById('cfg').value) || 5.5,
    steps:Number(document.getElementById('steps').value) || 28,
    size:document.getElementById('size').value || '832×1216',
    seed:readQueueSeed(),
    hiresFix:document.getElementById('sdHiresFix').checked,
    hiresUpscaler:document.getElementById('sdHiresUpscaler').value || 'Latent',
    hiresScale:Number(document.getElementById('sdHiresScale').value) || 1.5
  };
}

function renderSDQueue(){
  var panel = document.getElementById('sdQueue');
  var list = document.getElementById('sdQueueList');
  var count = document.getElementById('sdQueueCount');
  var resume = document.getElementById('sdQueueResumeBtn');
  if (!panel || !list || !count) return;
  var total = _sdQueue.length + (_sdActiveQueueJob ? 1 : 0);
  panel.hidden = total === 0;
  count.textContent = total + ' 项';
  if (resume) resume.hidden = !_sdQueuePaused || !_sdQueue.length;
  var rows = [];
  if (_sdActiveQueueJob) rows.push(
    '<div class="sd-queue-item"><span class="sd-queue-index">生成中</span><div class="sd-queue-copy"><div class="sd-queue-title">' + escapeHtml(_sdActiveQueueJob.title) + '</div><div class="sd-queue-meta">' + escapeHtml(_sdActiveQueueJob.size) + ' · seed ' + escapeHtml(_sdActiveQueueJob.seed < 0 ? '随机' : _sdActiveQueueJob.seed) + '</div></div><span></span></div>'
  );
  _sdQueue.forEach(function(job, index){
    rows.push('<div class="sd-queue-item"><span class="sd-queue-index">' + (index + 1) + '</span><div class="sd-queue-copy"><div class="sd-queue-title">' + escapeHtml(job.title) + '</div><div class="sd-queue-meta">' + escapeHtml(job.size) + ' · seed ' + escapeHtml(job.seed < 0 ? '随机' : job.seed) + '</div></div><button class="sd-queue-remove" type="button" onclick="removeSDQueueJob(\'' + job.id + '\')" aria-label="移出队列">×</button></div>');
  });
  list.innerHTML = rows.join('');
}

function enqueueSDGenerate(){
  if (_sdQueue.length + (_sdActiveQueueJob ? 1 : 0) >= SD_QUEUE_LIMIT) { flash('生成队列最多保留 ' + SD_QUEUE_LIMIT + ' 项'); return false; }
  var job = captureSDJob();
  if (!job) { flash('⚠️ 请先生成 Prompt'); return false; }
  _sdQueue.push(job);
  renderSDQueue();
  flash('已加入队列：' + job.title);
  processSDQueue();
  return true;
}

function removeSDQueueJob(id){
  _sdQueue = _sdQueue.filter(function(job){ return job.id !== id; });
  renderSDQueue();
}

function processSDQueue(){
  if (_sdQueuePaused || _sdGeneration || _sdActiveQueueJob || !_sdQueue.length) return;
  _sdActiveQueueJob = _sdQueue.shift();
  renderSDQueue();
  var task = callSDGenerate({ job:_sdActiveQueueJob });
  if (!task || typeof task.finally !== 'function') {
    _sdActiveQueueJob = null;
    renderSDQueue();
    return;
  }
  task.finally(function(){
    _sdActiveQueueJob = null;
    renderSDQueue();
    processSDQueue();
  });
}

function pauseSDQueue(){
  _sdQueuePaused = true;
  renderSDQueue();
}

function resumeSDQueue(){
  _sdQueuePaused = false;
  renderSDQueue();
  processSDQueue();
}

function useLastSeedForTweak(){
  var seed = _sdLastResult && _sdLastResult.seed != null ? Number(_sdLastResult.seed) : Number(window.__lastSeed__);
  if (!Number.isFinite(seed) || seed < 0) { flash('还没有可复用的 Seed'); return; }
  var input = document.getElementById('sdSeedInput');
  var lock = document.getElementById('sdSeedLock');
  if (input) input.value = String(Math.floor(seed));
  if (lock) lock.checked = true;
  saveSDSettings();
  flash('已锁定 Seed ' + Math.floor(seed) + '，现在微调 Prompt 或参数后再生成');
  var decisions = document.getElementById('stepDecisions');
  if (decisions && window.innerWidth < 900) decisions.scrollIntoView({ behavior:'smooth', block:'start' });
}
