'use strict';
/* 并发压测：8 路并发 gemini 请求，观察是否触发反代卡死（130 版本假设）。 */
const BASE = 'http://127.0.0.1:8317/v1/chat/completions';
const KEY = 'sk-local-proxy-key-2024';

async function one(i) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY },
      body: JSON.stringify({ model: 'gemini-3.7-flash-high', messages: [{ role: 'user', content: '第' + i + '个请求，回复OK' }], stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const txt = await res.text();
    const err = /"message":"([^"]+)"/.exec(txt);
    console.log('req' + i + ': HTTP ' + res.status + ' ' + (Date.now() - t0) + 'ms ' + (err ? 'ERR:' + err[1] : 'OK'));
  } catch (e) {
    console.log('req' + i + ': ' + e.name + ' ' + (Date.now() - t0) + 'ms');
  }
}

(async () => {
  // 第一轮：串行 2 个确认健康
  await one('a'); await one('b');
  // 第二轮：8 路并发
  console.log('--- concurrent 8 ---');
  await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(one));
  // 第三轮：并发后再串行 2 个，看是否被卡死污染
  console.log('--- after concurrent ---');
  await one('c'); await one('d');
})();