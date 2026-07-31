const fs = require('fs');
const path = require('path');
const http = require('http');

const SHOTS = 'E:/code/2/lora/AI-CG-Studio/scripts/maintenance/ui-shots';
const files = ['01-home-v3.png', '05-showcase-v3.png', '02-prompt-builder-v3.png'];

const body = JSON.stringify({
  model: 'gemini-3.6-flash-high',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: '这是"绫季绘境"（明日方舟风格 Galgame CG 工坊）的 3 张界面截图。刚做了美术调整：圆角整体收紧（8-16px → 4-8px）、卡片边框从弱变强、阴影收敛、主操作卡加 45° 斜切角。请回答：1) 圆角/边框/切角的战术感是否提升了？2) 相比上一版（大圆角+柔阴影），是否更接近明日方舟的锐利档案风格？3) 还有哪些明显不足？用中文回答，简洁。' },
      ...files.map(f => ({
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, f)).toString('base64') },
      })),
    ],
  }],
  max_tokens: 700,
});

const req = http.request({
  hostname: '127.0.0.1', port: 8317, path: '/v1/chat/completions', method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-local-proxy-key-2024',
    'Content-Length': Buffer.byteLength(body),
  },
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log(j.choices[0].message.content);
    } catch (e) { console.error('RAW:', d.slice(0, 800)); }
  });
});
req.on('error', e => console.error('ERR', e.message));
req.write(body);
req.end();
setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 120000).unref();
