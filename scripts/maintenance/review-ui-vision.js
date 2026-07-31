const fs = require('fs');
const path = require('path');
const http = require('http');

const SHOTS = 'E:/code/2/lora/AI-CG-Studio/scripts/maintenance/ui-shots';
const files = fs.readdirSync(SHOTS).filter(f => f.endsWith('.png')).sort();

// 本地 CLIProxyAPI 转发 Gemini，走 OpenAI 兼容接口
const body = JSON.stringify({
  model: 'gemini-3.6-flash-high',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: `你是资深 UI/视觉设计师。请逐张审查以下 8 张网页界面截图（这是"绫季绘境"——一个明日方舟官网风格启发的 Galgame AI CG 创作工坊），对照"明日方舟官网"的设计语言给出评估：

明日方舟官网设计语言要点：
- 瑞士国际主义排版：大量留白、网格对齐、无衬线字体（细字重标题）、克制的排版层次
- 深色底 + 单一强调色（青/白/红点缀），大面积低饱和背景
- 战术/档案感：编号系统（01/02/03）、等宽字体元数据、细线分隔、档案卡片
- 动效克制：淡入、位移小、无花哨动画

请对每张截图分别打分（0-10）并点评：
1. 排版与网格（留白、对齐、层次）
2. 色彩运用（品牌色一致性、对比度、克制度）
3. 视觉细节（边框、分隔线、档案感元素）
4. 整体是否达到"明日方舟官网"级别的精致度
最后给出总分与最需要改进的 3 个具体问题。请用中文回答。` },
      ...files.map(f => ({
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, f)).toString('base64') },
      })),
    ],
  }],
  max_tokens: 4000,
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
setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 180000).unref();
