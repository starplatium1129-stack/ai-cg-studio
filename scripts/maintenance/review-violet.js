const fs = require('fs');
const path = require('path');
const http = require('http');

const SHOTS = 'E:/code/2/lora/AI-CG-Studio/scripts/maintenance/ui-shots';
const files = ['01-home-violet.png', '02-prompt-builder-violet.png', '05-showcase-violet.png', '03-chat-violet.png'];

const body = JSON.stringify({
  model: 'gemini-3.7-flash-high',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: '这是"绫季绘境"（明日方舟风格 Galgame CG 工坊）的 4 张深色模式截图。暗色刚刚重做：从标准的深蓝灰紫（像普通 AI 网站）改为浓郁紫罗兰色调（#191230 基底、紫罗兰玻璃卡片、微品红倾向，呼应宁宁粉品牌色）。请回答：1) 新的暗色调是否比普通 AI 网站的深蓝灰更有辨识度？2) 紫罗兰暗底与宁宁粉/夏目金的点缀是否协调？3) 有没有对比度过低、发糊或刺眼的地方？用中文回答，简洁。' },
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
