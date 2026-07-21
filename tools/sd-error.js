(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AICSDError = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  function clean(value){ return String(value || '').replace(/\s+/g, ' ').trim(); }
  function errorText(error){
    var message = clean(error && error.message);
    var detail = clean(error && error.detail);
    if (detail && message.indexOf(detail) < 0) message += (message ? ' · ' : '') + detail;
    return message.slice(0, 1200);
  }
  function has(text, pattern){ return pattern.test(text); }
  function result(kind, title, message, action, details){
    return { kind:kind, title:title, message:message, action:action || null, details:details || '' };
  }

  function classify(error){
    var text = errorText(error);
    var lower = text.toLowerCase();
    var status = Number(error && error.status) || 0;
    var name = String(error && error.name || '');

    if (name === 'AbortError') return result('cancelled', '已停止生成', '本次任务已停止，参数和 Prompt 都保留在当前页面。', null, text);
    if (has(lower, /cuda out of memory|out of memory|outofmemory|显存不足|显存溢出|vram/)) {
      return result('oom', '显存不足', '当前尺寸或高清修复占用过高。可先关闭 hires.fix 并降低尺寸后重试。', { id:'retry_light', label:'降低负载后重试' }, text);
    }
    if (has(lower, /lora.*(not found|missing|could not|cannot find)|could not find.*lora|unknown lora|找不到.*lora/)) {
      return result('lora', 'LoRA 不可用', '当前角色 LoRA 在 WebUI 中不可用。可临时跳过 LoRA 生成，之后再检查文件和模型路径。', { id:'retry_without_lora', label:'跳过 LoRA 重试' }, text);
    }
    if (has(lower, /checkpoint.*(not found|missing|could not|cannot find)|model.*(not found|missing|could not find)|找不到.*模型|找不到.*checkpoint/)) {
      return result('model', '模型不可用', '上次选择的模型在当前 WebUI 中不可用。可切换为 WebUI 当前模型后重试。', { id:'retry_current_model', label:'改用当前模型重试' }, text);
    }
    if (has(lower, /sampler.*(not found|invalid|unknown)|scheduler.*(not found|invalid|unknown)|采样器.*(不存在|无效)|调度器.*(不存在|无效)/)) {
      return result('sampler', '采样器设置不可用', '当前 WebUI 不支持这组采样器或调度器。可恢复为通用稳定组合后重试。', { id:'retry_safe_sampler', label:'恢复稳定采样器重试' }, text);
    }
    if (name === 'TimeoutError' || has(lower, /请求超时|timed out|timeout/)) {
      return result('timeout', '生成超时', 'WebUI 可能仍在加载模型或当前负载过高。降低尺寸和高清修复后通常更容易完成。', { id:'retry_light', label:'降低负载后重试' }, text);
    }
    if (status === 404) {
      return result('gateway', 'SD 网关不可用', '当前页面没有可用的 SD API 代理。请从控制面板或 node server.js 打开工作台。', { id:'open_settings', label:'查看出图参数' }, text);
    }
    if (name === 'NetworkError' || status === 502 || status === 503 || has(lower, /未响应|无法连接|connection refused|econnrefused|network/)) {
      return result('offline', 'SD WebUI 未连接', '请确认 WebUI 已启动并启用 --api；恢复后可重新检测连接，不会自动提交生成。', { id:'recheck_connection', label:'重新检测连接' }, text);
    }
    if (status === 400 || has(lower, /validationerror|invalid request|bad request|参数.*无效/)) {
      return result('parameters', '出图参数被拒绝', '模型端拒绝了当前参数组合。请检查模型、尺寸、采样器和 hires.fix 设置。', { id:'open_settings', label:'查看出图参数' }, text);
    }
    return result('unknown', '生成失败', '已保留 Prompt 和当前参数。可检查出图参数后再次提交。', { id:'open_settings', label:'查看出图参数' }, text);
  }

  return { classify:classify, errorText:errorText };
});
