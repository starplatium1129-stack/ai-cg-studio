/* Scene-specific canvas recommendations. Kept global to match the existing
   Prompt Builder module style without changing its runtime architecture. */
function sceneRecommendedSize(scene){
  var value = scene && scene.recommendedSize ? String(scene.recommendedSize).trim() : '';
  if (/^\d{3,4}×\d{3,4}$/.test(value)) return value;
  var prompt = String(scene && scene.prompt || '').toLowerCase();
  var tags = Array.isArray(scene && scene.tags) ? scene.tags.join(' ').toLowerCase() : '';
  var source = prompt + ' ' + tags;
  if (/\b(full_body|wide_shot|standing_apart|side_by_side|landscape|wide_angle)\b/.test(source)) return '1344×896';
  if (/\b(close_up|face_focus|portrait|upper_body|medium_close_up|lying_on_bed|sitting_on_bed)\b/.test(source)) return '896×1152';
  return '';
}

function applySceneGenerationPreset(scene){
  var select = document.getElementById('size');
  var hint = document.getElementById('sceneSizeHint');
  if (!select) return '';
  var recommended = sceneRecommendedSize(scene);
  _sdApplyingScenePreset = true;
  if (recommended) {
    ensureSelectValue('size', recommended);
    select.dataset.scenePreset = '1';
    if (hint) {
      hint.hidden = false;
      hint.textContent = '场景推荐 · ' + recommended + (Number(recommended.split('×')[0]) > Number(recommended.split('×')[1]) ? ' 横版' : ' 竖版');
    }
  } else {
    if (select.dataset.scenePreset === '1') ensureSelectValue('size', _sdUserPreferredSize || '832×1216');
    delete select.dataset.scenePreset;
    if (hint) { hint.hidden = true; hint.textContent = ''; }
  }
  _sdApplyingScenePreset = false;
  updateSDBudgetHint();
  return recommended;
}
