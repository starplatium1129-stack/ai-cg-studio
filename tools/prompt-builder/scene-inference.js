// 场景元数据 → 导演台推荐项。保持纯推断逻辑，便于单独维护和验证。
const SCENE_LIGHT_HINT = { sunset:'golden', golden_hour:'golden', dusk:'golden', sunset_glow:'golden', golden:'golden', warm_light:'golden', backlit:'back', backlighting:'back', window:'window', window_light:'window', soft_light:'window', soft_lighting:'window', afternoon_light:'window', afternoon:'window', sunlight:'window', sunbeam:'window', sun_flare:'golden', morning_light:'window', morning:'window', sunrise:'window', first_light:'window', from_behind:'back', silhouette:'back', rim_light:'back', moonlight:'moon', moon:'moon', night:'lantern', dim_lighting:'lantern', warm_lighting:'lantern', lantern:'lantern', lanterns:'lantern', lantern_light:'lantern', festival:'lantern', fireworks:'lantern', hot_spring:'lantern', neon:'lantern', camping:'moon', candle:'lantern', candlelight:'lantern', overcast:'overcast', soft_diffused:'overcast', cloudy:'overcast', starry_sky:'moon', starry:'moon', blue_lighting:'moon', rain:'overcast', wet:'overcast', after_rain:'window', diffused:'overcast', dramatic:'back', soft_shadows:'window', bokeh:'window' };
const CAMERA_TO_SHOT = { '半身中景':'medium','全身远景':'wide','全身中景':'wide','特写':'close','特写镜头':'close','面部特写':'close','远景':'wide','中景':'medium','全身':'wide','半身':'medium' };
const CAMERA_TO_SHOT_BY_TAG = { close_up:'close', close_up_detail:'detail', pov:'pov', wide_shot:'wide', full_body:'wide', medium_shot:'medium', upper_face:'close', hands_or_face:'detail', profile:'side', from_the_side:'side' };

function sceneColorMood(s) {
  var visual = [s.lighting, s.weather].concat(s.tags || []).join(' ').toLowerCase();
  // 暖灯、烛光与灯笼优先于时间标签，避免温馨夜景被染成统一紫蓝。
  if (/暖|烛|蜡烛|灯笼|夜灯|candle|lantern|warm_light/.test(visual)) return 'warmth';
  if (s.weather==='彩虹') return 'joy';
  if (s.weather==='雨'||s.weather==='雪') return 'calm';
  const emoMap = { '恋爱':'love','开心':'joy','幸福':'joy','期待':'love','害羞':'love','感动':'warmth','温柔':'warmth','思念':'sad','失落':'sad','委屈':'sad','平静':'calm','放松':'calm','认真':'calm','困倦':'calm','紧张':'tension','生气':'tension','惊讶':'tension' };
  if (s.emotion && emoMap[s.emotion]) return emoMap[s.emotion];
  const emotion = String(s.emotion||'').toLowerCase();
  if (/幸福|joy|极乐/.test(emotion)) return 'joy';
  if (/依恋|恋爱|动情|亲密|诱惑|占有|独占|沦陷|love|dependency/.test(emotion)) return 'love';
  if (/羞|紧张|崩溃|过载|collapse/.test(emotion)) return 'tension';
  if (/温柔|治愈|平静/.test(emotion)) return 'warmth';
  if (s.timeOfDay==='night'||s.timeOfDay==='late_night') return 'tension';
  if (s.season==='春') return 'joy';
  if (s.season==='夏') return 'warmth';
  if (s.season==='秋') return 'calm';
  if (s.season==='冬') return 'sad';
  return null;
}

function sceneShot(s) {
  if (s.camera && CAMERA_TO_SHOT[s.camera]) return CAMERA_TO_SHOT[s.camera];
  const camera = String(s.camera||'');
  if (/第一人称|主观|pov/i.test(camera)) return 'pov';
  if (/局部/.test(camera)) return 'detail';
  if (/俯视|俯瞰/.test(camera)) return 'high';
  if (/仰视|微仰/.test(camera)) return 'low';
  if (/侧面|侧方|镜面/.test(camera)) return 'side';
  if (/近景|特写/.test(camera)) return 'close';
  if (/全身|远景|全景/.test(camera)) return 'wide';
  if (/半身|中景|平视/.test(camera)) return 'medium';
  for (const t of (s.tags || [])) { if (CAMERA_TO_SHOT_BY_TAG[t]) return CAMERA_TO_SHOT_BY_TAG[t]; }
  return null;
}

function sceneLighting(s) {
  const lighting = String(s.lighting||'');
  if (/夕阳|黄昏|黄金|落日/.test(lighting)) return 'golden';
  if (/逆光|背光|边缘光/.test(lighting)) return 'back';
  if (/月光|星光|月夜/.test(lighting)) return 'moon';
  if (/窗光|窗边|晨光|晨曦|朝阳|阳光|清晨/.test(lighting)) return 'window';
  if (/阴天|雨天|漫射|阴影/.test(lighting)) return 'overcast';
  if (/夜灯|灯笼|烛|床头灯|台灯|吊灯|暖光|局部|霓虹|荧幕/.test(lighting)) return 'lantern';
  for (const t of (s.tags||[])) { if (SCENE_LIGHT_HINT[t]) return SCENE_LIGHT_HINT[t]; }
  return null;
}

function sceneComposition(s) {
  const tagComp = { framed:'frame', door:'frame', torii_gate:'frame', archway:'frame', window:'bywindow', looking_at_viewer:'center', standing:'center', centered:'center', layered:'foreground', depth:'foreground', through:'frame', bokeh:'foreground' };
  for (const t of (s.tags || [])) { if (tagComp[t]) return tagComp[t]; }
  return null;
}
