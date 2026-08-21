'use strict';
/* 快速健康检查：claude 通道（7.2.132 升级后）。 */
const B = 'http://127.0.0.1:8317/v1/chat/completions';
async function t(name, model) {
  const t0 = Date.now();
  try {
    const res = await fetch(B, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer sk-local-proxy-key-2024' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], stream: false }),
      signal: AbortSignal.timeout(25000),
    });
    const txt = await res.text();
    console.log(name + ': HTTP ' + res.status + ' ' + (Date.now() - t0) + 'ms ' + (txt.includes('"error"') ? txt.slice(0, 120) : 'OK'));
  } catch (e) {
    console.log(name + ': ERR ' + (Date.now() - t0) + 'ms ' + e.name);
  }
}
(async () => {
  await t('claude-sonnet-4-6', 'claude-sonnet-4-6');
  await new Promise(r => setTimeout(r, 2000));
  await t('claude-opus-4-6-thinking', 'claude-opus-4-6-thinking');
})();