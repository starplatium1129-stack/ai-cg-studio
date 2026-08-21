'use strict';
const BASE = 'http://127.0.0.1:8317/v1/chat/completions';
const KEY = 'sk-local-proxy-key-2024';
const models = ['gemini-3.7-flash-high', 'gemini-3.6-flash-high', 'gemini-3.5-flash-low',
  'gemini-3.5-flash-extra-low', 'gemini-3-flash', 'gemini-3.1-pro-low', 'gemini-3.1-flash-lite'];
async function t(model) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: '你好' }], stream: false }),
      signal: AbortSignal.timeout(25000),
    });
    const txt = await res.text();
    const err = /"message":"([^"]+)"/.exec(txt);
    console.log(model + ': HTTP ' + res.status + ' ' + (Date.now() - t0) + 'ms ' + (err ? 'ERR: ' + err[1] : 'OK'));
  } catch (e) {
    console.log(model + ': TIMEOUT ' + (Date.now() - t0) + 'ms ' + e.name);
  }
}
(async () => {
  for (const m of models) {
    await t(m);
    await new Promise(r => setTimeout(r, 2500));
  }
})();