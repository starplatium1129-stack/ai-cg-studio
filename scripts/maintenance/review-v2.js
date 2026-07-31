const fs = require('fs');
const path = require('path');
const http = require('http');

const SHOTS = 'E:/code/2/lora/AI-CG-Studio/scripts/maintenance/ui-shots';
const files = ['02-prompt-builder-v2.png', '09-color-script.png', '10-scenario.png'];

const body = JSON.stringify({
  model: 'gemini-3.6-flash-high',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: '这是"绫季绘境"（明日方舟风格 Galgame CG 工坊）的 3 张界面截图。此前审查指出彩色系统 Emoji 破坏方舟冷硬档案风格，现已改为单色符号/矢量图标。请回答：1) 这 3 张里是否还有明显的彩色 3D Emoji 出现在 UI 控件上？2) 单色图标/符号与方舟风格是否协调？3) 还有什么残余破坏点？用中文回答，简洁。' },
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
