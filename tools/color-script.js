/* ============================================================
   色彩情绪 v1.0 — Art-direction aligned
   情绪 → 色相 → 光照 → Prompt token 自动映射
   ============================================================ */

const MOODS = [
  { id:'joy', icon:'☀️', name:'快乐', en:'Joy', color:'#FFD54F', palette:['#FFE082','#FFD54F','#FFB300','#FF8F00','#FFF8E1'], mapping:{'色相':'暖黄色 / 浅橙色 / 柔粉','光照':'Golden Hour / 午后阳光 / 明亮','氛围':'活力 / 温暖 / 清爽','天气':'晴天 / 微风'}, prompt:'warm yellow tones, golden hour, bright sunlight, cheerful atmosphere, soft breeze, warm color palette, vibrant but soft' },
  { id:'love', icon:'💕', name:'恋爱', en:'Love', color:'#F06292', palette:['#F8BBD0','#F06292','#EC407A','#AD1457','#FFF0F5'], mapping:{'色相':'夕阳 / 粉色 / 暖光','光照':'Golden Hour / 逆光 / 柔光','氛围':'暧昧 / 心跳 / 羞怯','天气':'黄昏 / 樱花季'}, prompt:'pink tone, golden hour, warm light, backlit, romantic atmosphere, soft glow, blush, cherry blossom color, dreamy' },
  { id:'calm', icon:'🍃', name:'平静', en:'Calm', color:'#81C784', palette:['#C8E6C9','#81C784','#4CAF50','#2E7D32','#F1F8E9'], mapping:{'色相':'淡绿 / 青绿 / 奶白','光照':'阴天柔光 / 窗光 / 自然光','氛围':'安静 / 治愈 / 文艺','天气':'多云 / 雨后'}, prompt:'soft green tones, overcast light, window light, calm atmosphere, peaceful, gentle colors, clean aesthetic, healing' },
  { id:'sad', icon:'🌧', name:'忧伤', en:'Sad', color:'#64B5F6', palette:['#BBDEFB','#64B5F6','#1E88E5','#0D47A1','#E3F2FD'], mapping:{'色相':'蓝色 / 灰蓝 / 冷调','光照':'月光 / 阴天 / 冷调窗光','氛围':'孤独 / 回忆 / 思念','天气':'雨天 / 阴天 / 夜晚'}, prompt:'blue tones, cool color palette, rainy day, overcast, melancholic atmosphere, lonely, nostalgic, soft blue light' },
  { id:'tension', icon:'🌙', name:'神秘', en:'Mystery', color:'#BA68C8', palette:['#E1BEE7','#BA68C8','#8E24AA','#4A148C','#F3E5F5'], mapping:{'色相':'紫蓝 / 深紫 / 冷调','光照':'月光 / 逆光 / 暗调','氛围':'神秘 / 距离 / 梦幻','天气':'夜晚 / 雾 / 雨'}, prompt:'purple and blue tones, moonlight, backlit, rim light, mysterious atmosphere, ethereal, dreamlike, cool shadows' },
  { id:'warmth', icon:'🏮', name:'温馨', en:'Warmth', color:'#FFB74D', palette:['#FFE0B2','#FFB74D','#F57C00','#E65100','#FFF3E0'], mapping:{'色相':'暖橙 / 橘红 / 米黄','光照':'夜灯 / 烛光 / 室内暖光','氛围':'安全感 / 家庭 / 治愈','天气':'夜晚 / 秋雨'}, prompt:'warm orange tones, lantern light, indoor warm light, cozy atmosphere, candlelight, safe feeling, homely, autumn warmth' }
];

const BANNED_TAGS = ['neon','glowing','oversaturated','vivid colors','vivid','rainbow','high contrast','harsh lighting','extremely detailed','ultra detailed'];

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function checkViolation(text){
  var lower=text.toLowerCase();
  return BANNED_TAGS.filter(function(b){ return lower.indexOf(b.toLowerCase())>-1; });
}
function norm(t){ return t.split(',').map(function(s){ return s.trim().replace(/[\s-]+/g,'_'); }).join(', '); }
function colorizePrompt(text){
  return norm(text).split(',').map(function(tk){
    var t=tk.trim(); var low=t.toLowerCase().replace(/[\s\/]+/g,'_');
    var isBad=BANNED_TAGS.some(function(b){ return low===b.toLowerCase().replace(/[\s\/]+/g,'_') || low.indexOf(b.toLowerCase().replace(/[\s\/]+/g,'_'))>-1; });
    return isBad ? '<span class="violate">'+escapeHtml(t)+'</span>' : escapeHtml(t);
  }).join(',');
}
function copyText(text){
  navigator.clipboard.writeText(text).then(function(){ showToast('📋 已复制到剪贴板'); }, function(){ prompt('请手动复制', text); });
}
function showToast(msg){
  var t=document.getElementById('cs-toast');
  if(!t){ t=document.createElement('div'); t.id='cs-toast'; t.className='cs-toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show'); clearTimeout(showToast._tid); showToast._tid=setTimeout(function(){ t.classList.remove('show'); },1600);
}

var selectedMood = null;

function init(){
  var grid=document.getElementById('moodGrid');
  grid.innerHTML=MOODS.map(function(m){
    return '<button type="button" class="mood-card" data-action="select-mood" data-id="'+m.id+'" style="--mood-color:'+m.color+'"><div class="mood-strip">'+m.palette.map(function(c){return '<div class="mood-swatch" style="--swatch:'+c+'"></div>';}).join('')+'</div><div class="mood-body"><div class="mood-name">'+m.icon+' '+m.name+'</div><div class="mood-en">'+m.en+'</div></div></button>';
  }).join('');
}

function selectMood(id){
  document.querySelectorAll('.mood-card').forEach(function(c){ c.classList.toggle('active', c.dataset.id===id); });
  var mood=MOODS.find(function(m){ return m.id===id; });
  if(!mood) return;
  selectedMood = mood;
  var panel=document.getElementById('resultPanel');
  panel.classList.add('show');
  document.getElementById('resultTitle').innerHTML='<span class="mood-icon" style="--mood-color:'+mood.color+'">'+mood.icon+'</span> '+mood.name+' → 色彩 → 光照';
  document.getElementById('paletteStrip').innerHTML=mood.palette.map(function(c){ return '<div class="palette-swatch" style="--swatch:'+c+'">'+c+'</div>'; }).join('');
  var mapEl=document.getElementById('mappingGrid');
  mapEl.innerHTML=Object.entries(mood.mapping).map(function(e){ return '<div class="mapping-item"><div class="mapping-label">'+e[0]+'</div><div class="mapping-value">'+e[1]+'</div></div>'; }).join('');
  var violations=checkViolation(mood.prompt);
  var artWarn=document.getElementById('artWarn');
  artWarn.classList.toggle('show', violations.length>0);
  artWarn.textContent=violations.length ? '⚠️ 检测到 '+violations.length+' 个违反美术规范的标签: '+violations.join(', ') : '';
  document.getElementById('promptOutput').innerHTML=colorizePrompt(mood.prompt);
  // update director link
  var link=document.getElementById('csDirectorLink');
  if(link) link.href='../tools/prompt-builder.html?mood='+mood.id;
  panel.scrollIntoView({ behavior:'smooth', block:'start' });
}

function reset(){
  document.querySelectorAll('.mood-card').forEach(function(c){ c.classList.remove('active'); });
  document.getElementById('resultPanel').classList.remove('show');
  selectedMood=null;
  window.scrollTo({ top:0, behavior:'smooth' });
}

// bind copy + export + mood cards
document.addEventListener('click', function(event){
  var el = event.target.closest('[data-action]');
  if (!el) return;
  var action = el.getAttribute('data-action');
  if (action === 'select-mood') return selectMood(el.getAttribute('data-id'));
  if (action === 'reset') return reset();
  if (action === 'copy-mood') {
    if (!selectedMood) return;
    return copyText(selectedMood.prompt);
  }
  if (action === 'export-mood') {
    if (!selectedMood) return;
    var body = selectedMood.prompt + '\n\n# mood: ' + selectedMood.id + '\n# usage: 复制到 Prompt Builder v5 Step 4 色彩氛围';
    var blob = new Blob([body], { type:'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'color-' + selectedMood.id + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('⬇️ 已导出');
  }
});
document.addEventListener('DOMContentLoaded', function(){
  var cBtn = document.getElementById('csCopyBtn');
  var eBtn = document.getElementById('csExportBtn');
  if (cBtn) cBtn.setAttribute('data-action', 'copy-mood');
  if (eBtn) eBtn.setAttribute('data-action', 'export-mood');
});

init();
