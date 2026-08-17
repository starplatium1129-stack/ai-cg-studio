'use strict';
/* 诊断 v3：长 system + 思考档位交叉，定位挂起边界。 */
const BASE = 'http://127.0.0.1:8317/v1/chat/completions';
const KEY = 'sk-local-proxy-key-2024';
const SYSTEM = '你是夏目，星光咖啡馆的店员。温柔沉静、说话轻声细语，偶尔会露出淡淡的微笑。' +
  '你的设定：黑色长发、金色眼睛、戴红色发夹；喜欢阅读，观察入微。' +
  '对话时保持角色的语气与性格，不要跳出角色。';

async function test(name, messages, extra) {
  const body = Object.assign({ model: 'gemini-3.7-flash-high', messages, stream: false }, extra);
  const t0 = Date.now();
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY, accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40000),
    });
    const text = await res.text();
    const ms = Date.now() - t0;
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const rt = json && json.usage && json.usage.completion_tokens_details
      ? json.usage.completion_tokens_details.reasoning_tokens : null;
    console.log(`[${name}] HTTP ${res.status} ${ms}ms rt=${rt} content=${json && json.choices && json.choices[0] ? String(json.choices[0].message.content).slice(0, 60) : text.slice(0, 80)}`);
  } catch (e) {
    console.log(`[${name}] ERROR ${Date.now() - t0}ms ${e.name}: ${e.message.slice(0, 100)}`);
  }
}

(async () => {
  // 对照组：非流式 + 长 system，不带思考参数（默认）
  await test('longsys_default', [{ role: 'system', content: SYSTEM }, { role: 'user', content: '你好' }]);
  // 关思考：reasoning_effort low
  await test('longsys_effort_low', [{ role: 'system', content: SYSTEM }, { role: 'user', content: '你好' }], { reasoning_effort: 'low' });
  // 短 system 对照组
  await test('shortsys_default', [{ role: 'system', content: '你是助手' }, { role: 'user', content: '你好' }]);
  // 无 system 对照组
  await test('nosys_default', [{ role: 'user', content: '你好' }]);
})();