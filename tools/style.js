(function(){
  // 与 prompt-builder 内置 COLOR_MOODS 对齐的独立副本(避免跨页面依赖)
  var MOODS = [
    { id:'joy', color:'#FFD54F', name:'Joy 喜悦', desc:'明亮、温暖、希望' },
    { id:'love', color:'#F06292', name:'Love 恋爱', desc:'樱粉、羞涩、心动' },
    { id:'calm', color:'#81C784', name:'Calm 平静', desc:'柔和、治愈、安静' },
    { id:'sad', color:'#64B5F6', name:'Sad 忧郁', desc:'冷蓝、雨夜、思念' },
    { id:'tension', color:'#BA68C8', name:'Tension 紧张', desc:'紫红、戏剧、冲突' },
    { id:'warmth', color:'#FFB74D', name:'Warmth 温馨', desc:'橙金、炉火、归属' }
  ];
  var grid = document.getElementById('moodGrid');
  grid.innerHTML = MOODS.map(function(m){
    return '<div class="mood-card" onclick="window.location.href=\'prompt-builder.html?mood='+m.id+'\'">' +
      '<div class="mood-strip" style="background:'+m.color+'"></div>' +
      '<div class="mood-body"><div class="mood-name">'+m.name+'</div><div class="mood-desc">'+m.desc+'</div></div>' +
    '</div>';
  }).join('');
})();
