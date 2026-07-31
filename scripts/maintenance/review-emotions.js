const fs = require('fs');
const http = require('http');

const shot = 'E:/code/2/lora/AI-CG-Studio/scripts/maintenance/ui-shots/02-prompt-builder-emotions.png';

const body = JSON.stringify({
  model: 'gemini-3.6-flash-high',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: '这是绫季绘境绘制台页面截图（明日方舟风格 UI）。重点看左侧/中间"情绪 Emotion"面板的图标：之前是彩色系统 Emoji，现在换成了单色线性矢量图标。请回答：1) 情绪面板的图标是否已是单色线框风格？2) 与明日方舟的冷硬档案语言是否一致？3) 还有哪些地方明显残留彩色 Emoji 破坏整体风格？请具体指出。用中文回答，简洁。' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,' + fs.readFileSync(shot).toString('base64') } },
    ],
  }],
  max_tokens: 800,
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
