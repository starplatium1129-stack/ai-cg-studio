'use strict';

var childProcess = require('child_process');
var crypto = require('crypto');
var express = require('express');
var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');
var security = require('../server/security');
var envelope = require('../server/http-envelope');
var comfyClient = require('../server/comfy-client');

var MAX_BODY = '32kb';
var MAX_PENDING = 2;
var MAX_PROMPT_LENGTH = 4000;
var MAX_NEGATIVE_LENGTH = 2000;
var MAX_VIDEO_BYTES = 256 * 1024 * 1024;
var MAX_IMAGE_BYTES = 20 * 1024 * 1024;
var IMAGE_INPUT_PREFIX = 'aics_video_input_';
// 参考图（Ref2VA 角色卡）独立前缀：网关启动清理只删首帧孤儿（aics_video_input_），
// 参考图是跨任务长期资产，不能被启动清理误删（2026-08-17 短片流水线实锤）。
var IMAGE_REF_PREFIX = 'aics_video_ref_';
var JOB_TIMEOUT_MS = 45 * 60 * 1000;
var JOB_TTL_MS = 2 * 60 * 60 * 1000;
// 分镜批量（P5）：单批镜头数、请求体上限、对白长度、批量记录 TTL。
var MAX_BATCH_SHOTS = 30;
var MAX_BATCH_BODY = '1mb';
var MAX_DIALOGUE_LENGTH = 300;
var BATCH_TTL_MS = 24 * 60 * 60 * 1000;
var BATCH_JOB_TTL_MS = 24 * 60 * 60 * 1000;
var POLL_INTERVAL_MS = 1000;
var OUTPUT_NODE_ID = '11';
var OUTPUT_FILENAME_PREFIX = 'aics_video';

var WAN_NEGATIVE = [
  '色调艳丽', '过曝', '静态', '细节模糊不清', '字幕', '水印',
  '整体发灰', '最差质量', '低质量', 'JPEG压缩残留',
  '肢体畸形', '多余的手指', '画得不好的手部', '画得不好的脸部',
  '静止不动的画面', '杂乱的背景',
].join('，');

var MODEL_CATALOG = Object.freeze([
  {
    id:'wan2.2-ti2v-5b',
    label:'Wan 2.2 TI2V 5B',
    family:'wan2.2',
    tier:'本机推荐',
    summary:'16GB 显存优先路线，先从短片稳定闭环开始。',
    executable:true,
    modes:['text'],
    requirements:[
      ['diffusion_models', 'wan2.2_ti2v_5B_fp16.safetensors'],
      ['text_encoders', 'umt5_xxl_fp8_e4m3fn_scaled.safetensors'],
      ['vae', 'wan2.2_vae.safetensors'],
    ],
  },
  {
    id:'minimax-h3',
    label:'MiniMax H3',
    family:'minimax-h3',
    tier:'高上限成片',
    summary:'本地 768p 原生立体声音频与口型，画质上限最高；16GB 显存建议从 3 秒短片起步。',
    executable:true,
    modes:['text', 'image', 'first-last-frame'],
    requirements:[
      ['diffusion_models', 'minimax_h3_fl2va_pruned_int8_convrot.safetensors'],
      ['text_encoders', 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors'],
      ['vae', 'minimax_h3_video_vae_fp16.safetensors'],
      ['vae', 'minimax_h3_audio_vae_fp32.safetensors'],
      ['loras', 'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors'],
      // 2026-08-16 T8 双时钟路径（默认）：4 步加速 LoRA（lightx2v 官方 4step 版），
      // 配合 T8 双时钟采样器；无 T8 节点时回退 8 步 LoRA + 原生采样器。
      ['loras', 'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors'],
    ],
  },
  {
    id:'wan2.2-14b',
    label:'Wan 2.2 14B',
    family:'wan2.2',
    tier:'高质量扩展',
    summary:'更高质量的文生/图生视频路线，需独立工作流和显存实测。',
    executable:false,
    modes:['text', 'image', 'first-last-frame'],
    requirements:[],
  },
  {
    id:'hunyuan-video-1.5',
    label:'HunyuanVideo 1.5',
    family:'hunyuan',
    tier:'高质量扩展',
    summary:'面向 720p 与超分链路，待本机资源和耗时验证。',
    executable:false,
    modes:['text', 'image'],
    requirements:[],
  },
  {
    id:'ltx-2.3',
    label:'LTX-2.3',
    family:'ltx',
    tier:'快速迭代扩展',
    summary:'适合快速预演与音视频扩展，待适配官方子图工作流。',
    executable:false,
    modes:['text', 'image', 'first-last-frame'],
    requirements:[],
  },
]);

var MODEL_BY_ID = Object.freeze(MODEL_CATALOG.reduce(function (result, model) {
  result[model.id] = model;
  return result;
}, {}));

// T8 双时钟采样路径可用性（2026-08-16）：MiniMaxH3DualClockSamplerT8 +
// MiniMaxH3AudioConditioningT8 + MiniMaxH3AVDecodeT8 + 4 步加速 LoRA。
// 真机基准（4070 Ti SUPER）：standard 5s 228s → 4 步 90s / 8 步 110s（≈2.5×），
// 画质抽查可接受；无 T8 节点时回退原生采样器路径（8 步 LoRA）。
// 模块默认 false：单元/网关测试（mock 无 T8）走原生路径不受影响；
// 生产由 createVideoRouter 启动时探测真实 ComfyUI 后置 true。
// 2026-08-17 修复：探测结果此前「启动时一次性、永不刷新」——3123 启动时
// ComfyUI 未就绪/被卡死任务占满会导致探测失败并永久缓存 false，此后所有
// 视频任务错走原生慢路径（15s 503s vs T8 272s）。现在提交任务前带 TTL 重探。
var t8Available = false;
var t8ProbeAt = 0;
var T8_PROBE_TTL_MS = 60 * 1000;
function setT8Available(value) {
  t8Available = Boolean(value);
}
async function probeT8Nodes(config) {
  try {
    // object_info 返回 { <nodeName>: {...} }；必须确认节点键真实存在
    // （mock 对任意路径返回 200 {} 时不得误判为可用）。
    var data = await requestComfyJson(config, 'GET', '/object_info/MiniMaxH3DualClockSamplerT8', null, 10000);
    setT8Available(Boolean(data && data.MiniMaxH3DualClockSamplerT8));
    if (t8Available) {
      console.log('[video] T8 双时钟采样路径可用（4 步加速 LoRA + DualClock）');
    } else {
      console.warn('[video] T8 双时钟节点不可用，回退原生采样路径');
    }
  } catch (error) {
    setT8Available(false);
    console.warn('[video] T8 双时钟节点不可用，回退原生采样路径');
  }
}
// 提交前确保探测是最新的：T8 未启用且超过 TTL 时重探一次（ComfyUI 恢复或
// 节点就绪后，第一次提交自动重新发现 T8，不再需要重启网关）。
async function ensureT8Probe(config) {
  if (t8Available) return;
  if (Date.now() - t8ProbeAt < T8_PROBE_TTL_MS) return;
  t8ProbeAt = Date.now();
  await probeT8Nodes(config);
}

// 视频任务预估时长（秒）：帧数 × 步数 × 每帧每步耗时 + 加载/编码余量。
// 真机校准（4070 Ti SUPER）：T8 双时钟 ≈ 0.125s/帧/步（15s 4 步实测 272s），
// 原生采样 ≈ 0.25s/帧/步（15s 4 步实测 489s，含模型换入）；余量 90s 覆盖
// 模型加载与首帧编码。用于：真实进度外推（替代固定 0.12）、卡死预警
// （elapsed > 预估 × 1.5 提示异常）、动态超时（deadline = 预估 × 3）。
var H3_PER_FRAME_STEP_SECONDS = { t8:0.125, native:0.25 };
var H3_ESTIMATE_MARGIN_SECONDS = 90;
function estimateH3Seconds(input) {
  var rate = t8Available
    ? H3_PER_FRAME_STEP_SECONDS.t8
    : H3_PER_FRAME_STEP_SECONDS.native;
  return Math.round(input.frames * input.steps * rate) + H3_ESTIMATE_MARGIN_SECONDS;
}

var ASPECTS = Object.freeze({
  landscape:{ width:832, height:480, label:'横屏 16:9' },
  portrait:{ width:480, height:832, label:'竖屏 9:16' },
  square:{ width:640, height:640, label:'方形 1:1' },
});

// 画质档位（16GB 显存实测区间 0.2—0.5MP；h3lite 部署矩阵与官方 ResolutionSelector
// 对齐：0.4MP 是官方常规画布，0.5MP 是 16GB 探索上限，720p(≈0.9MP) 需大显存或超分）。
// 所有尺寸均为 32 倍数、短边 ≤768、面积 ≤768×1344。
var QUALITIES = Object.freeze({
  fast:Object.freeze({
    label:'快速',
    summary:'约 1—2 分钟/条 · 试镜与找方向',
    sizes:Object.freeze({
      landscape:Object.freeze({ width:608, height:352 }),
      portrait:Object.freeze({ width:352, height:608 }),
      square:Object.freeze({ width:448, height:448 }),
    }),
  }),
  standard:Object.freeze({
    label:'标准',
    summary:'约 2.5—4.5 分钟/条 · 日常主力（官方常规画布）',
    sizes:Object.freeze({
      landscape:Object.freeze({ width:832, height:480 }),
      portrait:Object.freeze({ width:480, height:832 }),
      square:Object.freeze({ width:640, height:640 }),
    }),
  }),
  fine:Object.freeze({
    label:'精细',
    summary:'约 3.5—6 分钟/条 · 16GB 上限档',
    sizes:Object.freeze({
      landscape:Object.freeze({ width:960, height:544 }),
      portrait:Object.freeze({ width:544, height:960 }),
      square:Object.freeze({ width:768, height:768 }),
    }),
  }),
});

var DURATIONS = Object.freeze({
  3:{ seconds:3, frames:73 },
  5:{ seconds:5, frames:121 },
});

// H3 长镜档：10s/15s 在模型训练区间（124–362 帧）内；16GB 显存可行性
// 2026-08-16 真机实测确认（std10 ≈ 7 分钟，std15 ≈ 11 分钟，见 roadmap）。
// Wan 5B 仍只支持 3/5。
var H3_EXTRA_DURATIONS = new Set([10, 15]);

// MiniMax H3 按 24fps 换算帧数后向上对齐到 17k+5 网格（模型训练网格，
// 与官方模板 ComfyMathExpression 一致：count + (5 - count % 17) % 17）。
function h3FrameCount(seconds) {
  var count = Math.max(5, Math.round(seconds * 24));
  return count + (5 - (count % 17)) % 17;
}

var CAMERA = Object.freeze({
  still:'固定镜头，画面稳定，仅保留自然的微小运动。',
  push:'镜头缓慢推进，保持主体居中且运动连续。',
  pull:'镜头缓慢拉远，逐步显露环境关系。',
  pan:'镜头平稳横移，速度均匀，不要突然变焦。',
  orbit:'镜头轻微环绕主体，运动克制并保持身份稳定。',
});

var MOTION = Object.freeze({
  subtle:'主体只有呼吸、眨眼、发丝和衣摆等细微运动。',
  natural:'主体做一个清晰、自然、连续的动作，避免反复和突变。',
  expressive:'主体动作更有表现力，但肢体结构和身份始终保持一致。',
});

// H3 是自然语言模型：镜头/主体运动按官方提示词规范
// （MiniMax-AI/MiniMax-H3 h3-prompt-writing skill，base-en.txt）写成英文自然句——
// 镜头运动 = 运动类型 + 幅度 + 速度，写进镜头描述而不是堆叠标签。
var H3_CAMERA = Object.freeze({
  still:'The camera holds a static shot.',
  push:'The camera pushes in at a slow, steady pace.',
  pull:'The camera pulls out at a slow, steady pace.',
  pan:'The camera pans steadily to the side, without abrupt zooms.',
  orbit:'The camera arcs around the subject with restrained motion, keeping the composition stable.',
});

var H3_MOTION = Object.freeze({
  subtle:'The subject moves only subtly: breathing, blinking, hair and clothing swaying.',
  natural:'The subject performs one clear, natural, continuous action, avoiding repetition or abrupt changes.',
  expressive:'The subject\'s action is more expressive while body structure and identity stay consistent.',
});

// 景别（H3 是自然语言模型：写成英文自然句，官方 4.1 构图描述规范，不堆标签）。
var H3_SHOT_SIZE = Object.freeze({
  wide:{ label:'全景', line:'The scene is framed as a wide establishing shot with the full environment visible.' },
  medium:{ label:'中景', line:'The subject is framed in a medium shot from the waist up.' },
  closeup:{ label:'特写', line:'The subject is framed in a close-up on the face.' },
});
// 对白语言标签判定（官方 4.4：<d> 内只放语言标签 + 原文，逐字保留）。
// 角色均出自日本动漫：平假名/片假名判定为日语（2026-08-17 用户指示
// 「角色应该说话日语」）；中日韩统一归 CJK，其余归英语。
// auto 判定仅作缺省；显式 dialogueLang 传入时恒优先（zh/ja/en 三个取值）。
var CJK_DIALOGUE_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
var JAPANESE_DIALOGUE_RE = /[\u3040-\u30ff]/;
var DIALOGUE_LANGS = Object.freeze({ auto:true, zh:true, ja:true, en:true });
function resolveDialogueLang(dialogue, dialogueLang) {
  if (dialogueLang === 'zh') return 'Chinese';
  if (dialogueLang === 'ja') return 'Japanese';
  if (dialogueLang === 'en') return 'English';
  return JAPANESE_DIALOGUE_RE.test(dialogue)
    ? 'Japanese'
    : CJK_DIALOGUE_RE.test(dialogue) ? 'Chinese' : 'English';
}

// H3 官方 base-en.txt 要求 [Shot 1] 开头声明整体风格与初始构图（4.1）；
// 本项目出图链路全是二次元风格，默认 2D-animated, cinematic。
// 注意：rella 画师风格属短片测试资产（make-short-film.js 脚本层注入），
// 不作为正式默认（2026-08-17 用户拍板：正式链路保持原样）。
var H3_STYLE = '2D-animated, cinematic';

// 官方 4.6/4.7：soundscape 用 1-4 句具体声音；music 写乐器/速度/节奏/动态，
// 禁止抽象情绪词（"fits the mood" 之类）或解释配乐的情绪功能。
// 无音频输入时用下面这组具体化的默认模板。
var H3_SOUNDSCAPE = 'Quiet ambient room tone with subtle movement sounds — soft fabric rustle and gentle breathing; no dialogue, no voiceover.';
var H3_MUSIC = 'Soft piano notes at a slow tempo joined by sustained low strings, volume gently rising then fading at the end.';

// 控制器句子与用户文案的冲突守卫（2026-08-15 审计：用户文案写「镜头缓慢推进」的
// 同时控制器默认 still 会附加静态镜头句，互相矛盾；H3 是自然语言模型，矛盾指令
// 会造成语义漂移）。文案里已出现明确的镜头运动/主体动作词时，控制器句子不再附加。
// 中文词按字面匹配；英文词用 \b 词边界防误伤（"shade" 不能命中 "she"）。
var CAMERA_MENTION_RE = /(推进|推近|推镜|推入|拉远|拉近|拉镜|横移|平移|环绕|环绕镜头|摇镜|摇摄|俯拍|仰拍|特写|推拉|运镜|镜头移|镜头从|镜头缓慢|镜头慢慢|视角转换|视角变化|\bzoom\s*(?:in|out)\b|\bpush\s*in\b|\bpull\s*out\b|\bpans?\b|\borbit\b|\barc\s*shot\b|\btracking\s*shot\b|\bdolly\b|\btilt\b|\bcamera\s*(?:moves|pushes|pulls|pans|arcs|tracks|zooms)\b|\bpov\b|\bclose-?up\b)/i;
var MOTION_MENTION_RE = /(动作|运动|转身|回头|回眸|回望|站起|起身|坐下|躺下|跳跃|跳起|跳向|起舞|奔跑|跑向|跑进|跑出|走向|走进|走出|走到|走去|走来|举手|举起|挥手|挥动|挥舞|拿起|放下|端起|拾起|扭动|张开|伸出手|抬头|低头|转头|迈步|走动|踱步|舞动|跃起|跪下|跪坐|倚|偎|靠向|推开|拉开|打开|关上|翻页|弹奏|歌唱|哼唱|呼喊|微笑|轻笑|大笑|哭泣|仰望|俯身|弯腰|抱起|行走|跑动|爬出|\bmov(?:e|es|ed|ing)\b|\bwalk(?:s|ed|ing)\b|\brun(?:s|ning)\b|\bjump(?:s|ed|ing)\b|\bturn(?:s|ed|ing)\b|\brais(?:e|es|ed|ing)\b|\breach(?:es|ed|ing)\b|\bstand(?:s|ing)\b|\bsit(?:s|ting)\b|\bdanc(?:e|es|ed|ing)\b|\blift(?:s|ed|ing)\b|\bplac(?:e|es|ed|ing)\b|\bopen(?:s|ed|ing)\b|\bclos(?:e|es|ed|ing)\b|\bblink(?:s|ed|ing)\b|\bwav(?:e|es|ed|ing)\b|\bgrab(?:s|bed|bing)\b|\bstep(?:s|ped|ping)\b|\blean(?:s|ed|ing)\b|\bstretch(?:es|ed|ing)\b|\bbend(?:s|ing)\b|\bkneel(?:s|ing)\b|\bbow(?:s|ing)\b|\bspin(?:s|ning)\b|\bswing(?:s|ing)\b|\bpunch(?:es|ed|ing)\b|\bkick(?:s|ed|ing)\b|\bnod(?:s|ded|ding)\b|\bgestur(?:e|es|ed|ing)\b|\bsmil(?:e|es|ed|ing)\b|\blaugh(?:s|ed|ing)\b|\bwhisper(?:s|ed|ing)\b|\bspeak(?:s|ing)\b|\bsay(?:s|ing)\b|\bsing(?:s|ing)\b|\bsigh(?:s|ed|ing)\b|\bbreath(?:e|es|ed|ing)\b|\bflutter(?:s|ed|ing)\b|\bsway(?:s|ed|ing)\b)/i;

function proseCarriesCameraMention(prompt) {
  return CAMERA_MENTION_RE.test(String(prompt || ''));
}
function proseCarriesMotionMention(prompt) {
  return MOTION_MENTION_RE.test(String(prompt || ''));
}

// 场景感知 soundscape/music（官方 4.6/4.7 要求与画面实际声音对应，固定室内模板
// 会让雨夜/战场/海边的成片拿到错误的「quiet room tone」）。按信号优先级取第一条
// 命中（雨夜 → 雨，而不是夜）；未命中任何信号时回退通用模板。全部为确定性匹配。
var H3_SCENE_SOUND = Object.freeze([
  // 雷/闪电只是视觉信号（幻想场景的紫色雷光 ≠ 雷雨），不派生雨声；雨声只看雨/storm。
  { re:/雨|暴雨|雨水|雨夜|雷雨|雨滴|\brain\b|\brainfall\b|\bstorm\b|\bdownpour\b|\bdrizzle\b/i,
    sound:'Steady rain falls across the scene, drumming on rooftops and pavement, with low thunder rumbling in the distance and water dripping from surfaces.' },
  { re:/海|海滩|海滨|海浪|波浪|沙滩|\bsea\b|\bocean\b|\bbeach\b|\bwave\b/i,
    sound:'Waves roll onto the shore with soft hissing foam, while a light sea breeze carries faint distant gull cries.' },
  // 战斗音效只认明确的交战信号——持剑/佩枪的日常巡逻不该配打斗音（剑本身≠战斗）。
  { re:/战斗|打斗|刀光|决战|战场|厮杀|\bfight\b|\bbattle\b|\bcombat\b/i,
    sound:'Sharp impacts and whooshing blade cuts punctuate the scene, with heavy breathing and the scrape of feet on the ground.' },
  { re:/森林|树林|林间|山间|原野|田野|花田|神社|雪原|鸟居|\bforest\b|\bwoods\b|\bmountain\b|\bmeadow\b|\bfield\b|\bgrass\b|\bsnow\b|\bice\b|\bfrozen\b|\btorii\b|\bshrine\b/i,
    sound:'Wind moves through trees and grass with a soft rustle, while faint birdsong carries across the open space.' },
  // 浴室/温泉只认明确的沐浴词——裸 steam 会误命中咖啡/拉面的热气场景。
  { re:/温泉|浴池|浴缸|汤池|澡堂|泡汤|\bonsen\b|\bbath\b|\btub\b|\bsoak\b/i,
    sound:'Gentle water laps and ripples in the bath while steam hisses softly and warm droplets fall back into the surface.' },
  { re:/街道|街头|便利店|商店|车站|月台|电车|列车|马路|都市|城市|\bstreet\b|\bcity\b|\bshop\b|\bstation\b|\btrain\b|\bneon\b|\btraffic\b/i,
    sound:'Distant city traffic hums beneath footsteps and ambient street noise, with occasional passing vehicles.' },
  { re:/夜|深夜|夜晚|月光|\bmoonlight\b|\bnight\b/i,
    sound:'Quiet night ambience: a soft breeze and distant low hums, with subtle movement sounds nearby.' },
]);
var H3_SCENE_MUSIC = Object.freeze([
  // 配乐同理：剑随身不拔 ≠ 战斗配乐（深夜卧床持剑不该配驱动打击乐）。
  { re:/战斗|决战|战场|刀光|厮杀|\bfight\b|\bbattle\b|\bcombat\b/i,
    music:'Driving orchestral percussion at a fast tempo with surging brass and steady strings.' },
  { re:/夜|深夜|月光|孤独|寂|思念|离别|伤感|\bmoonlight\b|\bnight\b|\blonely\b|\bsad\b|\bmelancholy\b/i,
    music:'Sparse solo piano notes with wide silent gaps at a slow tempo, joined by a sustained low cello line.' },
  { re:/欢快|活力|阳光|午后|集市|庆典|祭典|\bsunny\b|\bfestival\b|\bcelebration\b|\benergetic\b/i,
    music:'Bright acoustic guitar and light percussion at a moderate tempo with a gently rising melody and clean tone.' },
]);

function deriveH3Soundscape(prompt) {
  var source = String(prompt || '');
  for (var i = 0; i < H3_SCENE_SOUND.length; i += 1) {
    if (H3_SCENE_SOUND[i].re.test(source)) return H3_SCENE_SOUND[i].sound;
  }
  return H3_SOUNDSCAPE;
}
function deriveH3Music(prompt) {
  var source = String(prompt || '');
  for (var i = 0; i < H3_SCENE_MUSIC.length; i += 1) {
    if (H3_SCENE_MUSIC[i].re.test(source)) return H3_SCENE_MUSIC[i].music;
  }
  return H3_MUSIC;
}

var ALLOWED_INPUT_KEYS = new Set([
  'prompt', 'negative', 'modelId', 'aspectRatio', 'duration',
  'camera', 'motion', 'seed', 'image', 'quality',
  'dialogue', 'dialogueLang', 'lastFrame', 'shotSize', 'steps', 'references',
]);

function serviceError(status, code, message, detail) {
  var error = new Error(message);
  error.status = status;
  error.code = code;
  error.detail = detail;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function modelRoot(config) {
  return path.resolve(
    config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI'),
    'ComfyUI',
    'models'
  );
}

// 首帧图片写入 ComfyUI/input，由 LoadImage 节点按文件名读取。
function imageInputRoot(config) {
  return path.resolve(
    config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI'),
    'ComfyUI',
    'input'
  );
}

function imageInputAvailable(config, name) {
  if (typeof name !== 'string') return false;
  if (!IMAGE_INPUT_PATTERN.test(name) && !IMAGE_REF_PATTERN.test(name)) return false;
  var target = path.resolve(imageInputRoot(config), name);
  try { return fs.statSync(target).isFile(); } catch (error) { return false; }
}

var IMAGE_INPUT_PATTERN = /^aics_video_input_[a-f0-9]{16,40}\.(png|jpg|jpeg|webp)$/i;
var IMAGE_REF_PATTERN = /^aics_video_ref_[a-f0-9]{16,40}\.(png|jpg|jpeg|webp)$/i;

// 魔数识别：只信任解码后的真实格式，不信任客户端声称的 type。
function sniffImageExtension(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50
    && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// 只读文件头取真实像素尺寸（PNG IHDR / JPEG SOF / WebP VP8*），不整图解码。
function readImageSize(file) {
  var buffer = fs.readFileSync(file);
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50
    && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width:buffer.readUInt32BE(16), height:buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    var offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      var marker = buffer[offset + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { offset += 2; continue; }
      var length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height:buffer.readUInt16BE(offset + 5), width:buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP') {
    var chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8 ' && buffer.length >= 30) {
      return { width:buffer.readUInt16LE(26) & 0x3fff, height:buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && buffer.length >= 25) {
      var bits = buffer.readUInt32LE(21);
      return { width:(bits & 0x3fff) + 1, height:((bits >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return { width:buffer.readUIntLE(24, 3) + 1, height:buffer.readUIntLE(27, 3) + 1 };
    }
  }
  return null;
}

// 按原图比例 + 档位目标面积计算 H3 画布：32 对齐、短边 ≤768、面积 ≤768×1344。
// 比例收敛到 0.5—2 防极端画幅；对齐后比例偏差 ≤~3%，肉眼无感。
function fitCanvasToRatio(width, height, quality) {
  var ratio = Math.min(2, Math.max(0.5, width / height));
  var targetArea = quality.sizes.landscape.width * quality.sizes.landscape.height;
  var canvasW = Math.max(32, Math.round(Math.sqrt(targetArea * ratio) / 32) * 32);
  var canvasH = Math.max(32, Math.round(Math.sqrt(targetArea / ratio) / 32) * 32);
  if (Math.min(canvasW, canvasH) > 768) {
    var edgeScale = 768 / Math.min(canvasW, canvasH);
    canvasW = Math.max(32, Math.round(canvasW * edgeScale / 32) * 32);
    canvasH = Math.max(32, Math.round(canvasH * edgeScale / 32) * 32);
  }
  if (canvasW * canvasH > 768 * 1344) {
    var areaScale = Math.sqrt((768 * 1344) / (canvasW * canvasH));
    canvasW = Math.max(32, Math.round(canvasW * areaScale / 32) * 32);
    canvasH = Math.max(32, Math.round(canvasH * areaScale / 32) * 32);
  }
  return { width:canvasW, height:canvasH };
}

function resourceAvailable(root, kind, file) {
  var base = path.resolve(root, kind);
  var target = path.resolve(base, file);
  if (target.indexOf(base + path.sep) !== 0) return false;
  try { return fs.statSync(target).isFile(); } catch (error) { return false; }
}

function modelAvailability(config, model) {
  var root = modelRoot(config);
  var missing = model.requirements.filter(function (requirement) {
    return !resourceAvailable(root, requirement[0], requirement[1]);
  }).map(function (requirement) {
    return requirement[0] + '/' + requirement[1];
  });
  return {
    available:model.executable && missing.length === 0,
    missing:missing,
    reason:!model.executable ? '适配器待验证' : (missing.length ? '缺少本机模型文件' : ''),
  };
}

function validateInput(body, config) {
  if (!isPlainObject(body)) throw serviceError(400, 'INVALID_BODY', '请求体必须是 JSON 对象');
  Object.keys(body).forEach(function (key) {
    if (!ALLOWED_INPUT_KEYS.has(key)) {
      throw serviceError(400, 'UNKNOWN_PARAMETER', '不支持的参数：' + key);
    }
  });

  ['prompt', 'modelId', 'aspectRatio', 'duration', 'camera', 'motion'].forEach(function (key) {
    if (!hasOwn(body, key)) throw serviceError(400, 'MISSING_PARAMETER', '缺少参数：' + key);
  });
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_LENGTH) {
    throw serviceError(400, 'INVALID_PARAMETER', '画面描述需为 1—' + MAX_PROMPT_LENGTH + ' 字符');
  }
  if (body.negative !== undefined && (typeof body.negative !== 'string' || body.negative.length > MAX_NEGATIVE_LENGTH)) {
    throw serviceError(400, 'INVALID_PARAMETER', '负向描述需为不超过 ' + MAX_NEGATIVE_LENGTH + ' 字符的文本');
  }
  var model = MODEL_BY_ID[body.modelId];
  if (!model) throw serviceError(400, 'UNKNOWN_MODEL', '未知视频模型');
  if (!model.executable) throw serviceError(409, 'MODEL_ADAPTER_UNAVAILABLE', '该模型仍在适配与实测阶段');
  var isH3 = model.family === 'minimax-h3';
  var quality = body.quality === undefined || body.quality === null || body.quality === ''
    ? 'standard'
    : body.quality;
  if (typeof quality !== 'string' || !QUALITIES[quality]) {
    throw serviceError(400, 'INVALID_PARAMETER', '不支持的画质档位');
  }
  var image = body.image;
  if (image !== undefined && image !== null && image !== '') {
    // 只接受本服务上传接口写入的受控文件名，杜绝任意路径/文件名注入。
    if (typeof image !== 'string' || !IMAGE_INPUT_PATTERN.test(image)) {
      throw serviceError(400, 'INVALID_PARAMETER', '图片引用格式不受支持');
    }
    // 模型不含 image 模式时坚决拒绝：buildWanWorkflow 不会消费 first_frame，
    // 放行会导致「上传了首帧但任务静默按文字成片生成」的错误成片。
    if (!model.modes.includes('image')) {
      throw serviceError(400, 'MODEL_INPUT_MODE', '该模型不支持首帧图输入');
    }
    if (config && !imageInputAvailable(config, image)) {
      throw serviceError(400, 'INVALID_PARAMETER', '图片文件不存在或已过期');
    }
  }
  // 尾帧图（FL2VA/L2VA）：与首帧同源受控文件名校验；只允许声明了
  // first-last-frame 模式的模型（H3 原生节点 MiniMaxH3ImageToVideo 支持）。
  var lastFrame = body.lastFrame;
  if (lastFrame !== undefined && lastFrame !== null && lastFrame !== '') {
    if (typeof lastFrame !== 'string' || !IMAGE_INPUT_PATTERN.test(lastFrame)) {
      throw serviceError(400, 'INVALID_PARAMETER', '尾帧图片引用格式不受支持');
    }
    if (!model.modes.includes('first-last-frame')) {
      throw serviceError(400, 'MODEL_INPUT_MODE', '该模型不支持尾帧图输入');
    }
    if (config && !imageInputAvailable(config, lastFrame)) {
      throw serviceError(400, 'INVALID_PARAMETER', '图片文件不存在或已过期');
    }
  }
  // 参考图（Ref2VA 多参考：角色卡）。仅 H3（T8 ref_images autogrow 1-9 槽）；
  // Wan 无此链路，放行会造成「传了参考图但任务静默忽略」的错误成片。
  var references = body.references;
  if (references !== undefined && references !== null) {
    if (!isH3) throw serviceError(400, 'MODEL_INPUT_MODE', '参考图仅支持 MiniMax H3');
    if (!Array.isArray(references) || references.length < 1 || references.length > 9) {
      throw serviceError(400, 'INVALID_PARAMETER', '参考图需为 1—9 张');
    }
    for (var refIndex = 0; refIndex < references.length; refIndex += 1) {
      var refName = references[refIndex];
      if (typeof refName !== 'string' || !IMAGE_REF_PATTERN.test(refName)) {
        throw serviceError(400, 'INVALID_PARAMETER', '参考图引用格式不受支持');
      }
      if (config && !imageInputAvailable(config, refName)) {
        throw serviceError(400, 'INVALID_PARAMETER', '参考图文件不存在或已过期：' + refName);
      }
    }
  } else {
    references = null;
  }
  var hasReferences = Array.isArray(references) && references.length > 0;
  // 对白（P7）：H3 原生音画同步能力（官方 4.4 说话人 ID + <d> 原文块）；
  // Wan 等无口型链路拒绝，避免「写了台词但画面没有对白」的错误成片。
  var dialogue = body.dialogue;
  if (dialogue !== undefined && dialogue !== null && dialogue !== '') {
    if (!isH3) {
      throw serviceError(400, 'MODEL_INPUT_MODE', '对白仅支持 MiniMax H3');
    }
    if (typeof dialogue !== 'string' || !dialogue.trim() || dialogue.length > MAX_DIALOGUE_LENGTH) {
      throw serviceError(400, 'INVALID_PARAMETER', '对白需为 1—' + MAX_DIALOGUE_LENGTH + ' 字符');
    }
  }
  // 对白语言：显式指定优先，auto 按字符自动判定（假名→Japanese、CJK→Chinese、
  // 其余→English）。中文台词写中文即可走 Chinese，无需特殊处理；
  // 需要强制某语言时才传 dialogueLang。
  var dialogueLang = body.dialogueLang === undefined || body.dialogueLang === null || body.dialogueLang === ''
    ? 'auto'
    : body.dialogueLang;
  if (typeof dialogueLang !== 'string' || !DIALOGUE_LANGS[dialogueLang]) {
    throw serviceError(400, 'INVALID_PARAMETER', '对白语言仅支持 auto/zh/ja/en');
  }
  // 景别（P5 分镜字段）：H3 自然语言句；Wan 链路不接受（避免歧义）。
  var shotSize = body.shotSize === undefined || body.shotSize === null || body.shotSize === ''
    ? null
    : body.shotSize;
  if (shotSize !== null) {
    if (!isH3) {
      throw serviceError(400, 'MODEL_INPUT_MODE', '景别仅支持 MiniMax H3');
    }
    if (!H3_SHOT_SIZE[shotSize]) {
      throw serviceError(400, 'INVALID_PARAMETER', '不支持的景别');
    }
  }
  // 步数（2026-08-16 真机实测：H3 Turbo 4 步 ≈ 8 步一半耗时，fast 5s 从 130s → 80s，
  // 质量抽查可接受）。仅 H3；Wan 固定 20 步。
  var steps = body.steps === undefined || body.steps === null || body.steps === ''
    ? 8
    : body.steps;
  if (steps !== 4 && steps !== 8) {
    throw serviceError(400, 'INVALID_PARAMETER', '步数只支持 4（极速）或 8（标准）');
  }
  if (!isH3 && body.steps !== undefined && body.steps !== null && body.steps !== '') {
    throw serviceError(400, 'MODEL_INPUT_MODE', '极速步数仅支持 MiniMax H3');
  }

  var aspect;
  if (body.aspectRatio === 'original') {
    // 跟随首帧图比例：读图片真实尺寸 → 按档位面积 + 原图比例计算画布（等比例无变形）。
    if (!image) throw serviceError(400, 'INVALID_PARAMETER', '跟随原图比例需要先上传首帧图');
    if (!config) throw serviceError(400, 'INVALID_PARAMETER', '缺少图片文件上下文');
    if (!imageInputAvailable(config, image)) throw serviceError(400, 'INVALID_PARAMETER', '图片文件不存在或已过期');
    var imageSize = readImageSize(path.resolve(imageInputRoot(config), image));
    if (!imageSize || !(imageSize.width > 0) || !(imageSize.height > 0)) {
      throw serviceError(400, 'INVALID_PARAMETER', '无法解析首帧图尺寸');
    }
    aspect = fitCanvasToRatio(imageSize.width, imageSize.height, QUALITIES[quality]);
  } else {
    aspect = QUALITIES[quality].sizes[body.aspectRatio];
    if (!aspect) throw serviceError(400, 'INVALID_PARAMETER', '不支持的画面比例');
  }
  var duration = DURATIONS[body.duration];
  if (!duration && isH3 && H3_EXTRA_DURATIONS.has(body.duration)) {
    duration = { seconds:body.duration, frames:0 };
  }
  if (!duration) {
    throw serviceError(400, 'INVALID_PARAMETER', isH3 ? '时长支持 3/5/10/15 秒' : '时长只支持 3 秒或 5 秒');
  }
  if (!CAMERA[body.camera]) throw serviceError(400, 'INVALID_PARAMETER', '不支持的镜头运动');
  if (!MOTION[body.motion]) throw serviceError(400, 'INVALID_PARAMETER', '不支持的主体运动');
  var seed = body.seed;
  if (seed === undefined || seed === null || seed === '') {
    seed = crypto.randomInt(0, 0x7fffffff);
  }
  if (typeof seed !== 'number' || !Number.isSafeInteger(seed) || seed < 0 || seed > 0x7fffffff) {
    throw serviceError(400, 'INVALID_PARAMETER', 'seed 需为 0—2147483647 的整数');
  }

  var isI2va = isH3 && Boolean(image) && !lastFrame;
  var isFl2va = isH3 && Boolean(image) && Boolean(lastFrame);
  var isL2va = isH3 && !image && Boolean(lastFrame);

  // 组装前的派生量：文案自带镜头/动作意图时控制器句子让位；
  // soundscape/music 按场景信号派生（无信号回退通用模板）。
  var userPrompt = body.prompt.trim();
  var h3CameraLine = proseCarriesCameraMention(userPrompt) ? null : H3_CAMERA[body.camera];
  var h3MotionLine = proseCarriesMotionMention(userPrompt) ? null : H3_MOTION[body.motion];
  var wanCameraLine = proseCarriesCameraMention(userPrompt) ? null : CAMERA[body.camera];
  var wanMotionLine = proseCarriesMotionMention(userPrompt) ? null : MOTION[body.motion];

  // H3 景别/对白派生句（官方 4.1/4.4）：景别写成构图自然句；对白用说话人 ID
  // (S1) + <d>[语言标签] 原文</d> 块，逐字保留用户台词（不翻译不改写）。
  var h3ShotLine = shotSize === null ? null : H3_SHOT_SIZE[shotSize].line;
  var dialogueLine = dialogue
    ? ' The subject in the frame (S1) says: <d>[' + resolveDialogueLang(dialogue, dialogueLang) + '] ' + dialogue + '</d>'
    : null;

  // 参考图对齐指令（官方 base-en.txt 2.1）：I2VA 首帧 / FL2VA 首尾帧 / L2VA 尾帧，
  // 均为提示词首行 + 空行后再进三段式。
  var referenceInstruction = null;
  var h3Description;
  if (isFl2va) {
    referenceInstruction = 'How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the ' + duration.seconds.toFixed(2) + '-second mark of the target video.';
    h3Description = 'integrated_multimodal_description: [Shot 1] ' + H3_STYLE + ' — ' + userPrompt
      + ' The shot begins in the position, framing, and scene established by Picture 1 and settles into the final pose, spacing, and composition established by Picture 2 at the end of the shot.';
  } else if (isL2va) {
    referenceInstruction = 'How the reference pictures align with the target video — <Picture 1> (from [Shot 1]) aligns with the ' + duration.seconds.toFixed(2) + '-second mark of the target video.';
    h3Description = 'integrated_multimodal_description: [Shot 1] ' + H3_STYLE + ' — ' + userPrompt
      + ' The scene begins in a plausible earlier state and gradually converges to the pose, composition, lighting, and scene structure established by <Picture 1> by the end of the shot.';
  } else if (isI2va) {
    referenceInstruction = 'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.';
    h3Description = 'integrated_multimodal_description: [Shot 1] ' + H3_STYLE + ' — preserve the subject, clothing, hairstyle, and scene from <Picture 1>, then ' + userPrompt;
  } else {
    h3Description = 'integrated_multimodal_description: [Shot 1] ' + H3_STYLE + ', ' + userPrompt;
  }
  var h3Lines = [
    h3Description,
    h3ShotLine,
    h3CameraLine,
    h3MotionLine,
    dialogueLine,
    hasReferences
      ? 'Character identity anchors: ' + references.map(function (_, i) { return '<Picture ' + (i + 1) + '>'; }).join(', ')
        + (references.length === 1
          ? ' - the shot contains exactly one character: <Picture 1>. No other people, no reflections, no duplicate or mirrored copies.'
          : ' - each <Picture N> is a distinct character: keep every character\'s face, hairstyle, outfit and identity consistent with their own picture, and never swap or merge characters.')
      : null,
    'Character identity, clothing, lighting, and scene structure remain consistent from start to finish.',
  ].filter(function (line) { return line !== null; });
  var h3Prompt = (referenceInstruction ? [referenceInstruction, ''] : []).concat(h3Lines, [
    '',
    'overall_soundscape: ' + deriveH3Soundscape(userPrompt),
    '',
    'non_diegetic_music: ' + deriveH3Music(userPrompt),
  ]).join('\n');

  return Object.freeze({
    // H3 按官方三段式组装（MiniMax-AI/MiniMax-H3 h3-prompt-writing skill，
    // references/base-en.txt）：
    // - I2VA/FL2VA/L2VA 首行参考图对齐指令（逐字按官方模板），空一行再进三段式；
    // - [Shot 1] 开头声明整体风格（官方 4.1）；
    // - 镜头/运动写成自然句（官方 4.3）；文案已自带镜头/动作意图时不重复附加，
    //   避免「用户写推进 + 控制器默认静止」这类矛盾指令（自然语言模型对
    //   相互矛盾的指令会产生语义漂移）；
    // - 景别写成构图句（官方 4.1）；对白用 (S1) + <d> 原文块（官方 4.4）；
    // - soundscape/music 按文案场景信号派生具体声音与器乐节奏（官方 4.6/4.7），
    //   不用抽象情绪词，也不给雨夜/战场错误地配「quiet room tone」。
    prompt:isH3 ? h3Prompt : [
      userPrompt,
      wanCameraLine,
      wanMotionLine,
      '动作从开始到结束保持连续，角色身份、服装、光照和场景结构一致。',
    ].filter(function (line) { return line !== null; }).join('\n'),
    originalPrompt:userPrompt,
    // H3 是自然语言模型：负向词会污染语义，保持空；Wan 仍走中文负面清单。
    negative:isH3 ? '' : [WAN_NEGATIVE, String(body.negative || '').trim()].filter(Boolean).join('，'),
    modelId:model.id,
    aspectRatio:body.aspectRatio,
    quality:quality,
    width:aspect.width,
    height:aspect.height,
    duration:duration.seconds,
    frames:isH3 ? h3FrameCount(duration.seconds) : duration.frames,
    fps:24,
    camera:body.camera,
    motion:body.motion,
    seed:seed,
    image:image || null,
    lastFrame:lastFrame || null,
    references:references,
    dialogue:dialogue || null,
    dialogueLang:dialogueLang === 'auto' ? null : dialogueLang,
    shotSize:shotSize || null,
    steps:isH3 ? steps : 20,
    cfg:5,
  });
}

function buildWorkflow(input) {
  if (input.modelId === 'minimax-h3') {
    return t8Available ? buildH3T8Workflow(input) : buildH3Workflow(input);
  }
  return buildWanWorkflow(input);
}

// T8 双时钟采样路径（2026-08-16，默认当 T8 节点可用时启用）：
// MiniMaxH3AudioConditioningT8（官方三段式提示词 + task_type 显式声明）→
// LoraLoaderBypassModelOnly（4 步加速 LoRA）→ MiniMaxH3DualClockSamplerT8
// （双时钟，steps 4 极速 / 8 标准，shift_video 12 / shift_audio 3）→
// BasicGuider + SamplerCustomAdvanced → MiniMaxH3AVDecodeT8 → CreateVideo → SaveVideo。
// 输出契约不变（SaveVideo 节点 11、aics_video 前缀）。真机实测 2.5× 提速。
function buildH3T8Workflow(input) {
  // Ref2VA / Hybrid：有参考图（角色卡）时按 T8 枚举（大写）传参；
  // 参考图 + 首/尾帧 → Hybrid（参考身份 + 关键帧构图），仅参考 → Ref2VA。
  var hasReferences = Array.isArray(input.references) && input.references.length > 0;
  var taskType = hasReferences
    ? (input.image || input.lastFrame ? 'Hybrid' : 'Ref2VA')
    : input.image && input.lastFrame ? 'FL2VA'
      : input.image ? 'I2VA'
        : input.lastFrame ? 'L2VA'
          : 'T2VA';
  var graph = {
    '1': { class_type:'UNETLoader', inputs:{
      unet_name:'minimax_h3_fl2va_pruned_int8_convrot.safetensors',
      weight_dtype:'default',
    } },
    '2': { class_type:'CLIPLoader', inputs:{
      clip_name:'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
      type:'minimax',
      device:'default',
    } },
    '3': { class_type:'VAELoader', inputs:{ vae_name:'minimax_h3_video_vae_fp16.safetensors' } },
    '4': { class_type:'VAELoader', inputs:{ vae_name:'minimax_h3_audio_vae_fp32.safetensors' } },
    '5': { class_type:'MiniMaxH3AudioConditioningT8', inputs:{
      clip:['2', 0],
      video_vae:['3', 0],
      audio_vae:['4', 0],
      prompt:input.prompt,
      width:input.width,
      height:input.height,
      length:input.frames,
      task_type:taskType,
      audio_mode:'native',
      audio_denoise_strength:1,
      add_source_as_reference:false,
      prompt_primary_audio_ordinal:0,
      strict_prompt_tags:true,
      ref_image_size:'match',
      reference_video_policy:'official_2_to_15s',
    } },
    '15': { class_type:'LoraLoaderBypassModelOnly', inputs:{
      model:['1', 0],
      lora_name:'minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors',
      strength_model:1,
    } },
    '16': { class_type:'MiniMaxH3DualClockSamplerT8', inputs:{
      model:['15', 0],
      av_latent:['5', 1],
      steps:input.steps,
      shift_video:12,
      shift_audio:3,
    } },
    '6': { class_type:'RandomNoise', inputs:{ noise_seed:input.seed } },
    '9': { class_type:'BasicGuider', inputs:{ model:['16', 0], conditioning:['5', 0] } },
    '10': { class_type:'SamplerCustomAdvanced', inputs:{
      noise:['6', 0],
      guider:['9', 0],
      sampler:['16', 1],
      sigmas:['16', 2],
      latent_image:['5', 1],
    } },
    '12': { class_type:'MiniMaxH3AVDecodeT8', inputs:{
      av_latent:['10', 0],
      video_vae:['3', 0],
      audio_vae:['4', 0],
    } },
    '14': { class_type:'CreateVideo', inputs:{
      images:['12', 0],
      audio:['12', 1],
      fps:input.fps,
      bit_depth:8,
    } },
    '11': { class_type:'SaveVideo', inputs:{
      video:['14', 0],
      filename_prefix:OUTPUT_FILENAME_PREFIX,
      format:'auto',
      codec:'auto',
    } },
  };
  if (input.image) {
    graph['17'] = { class_type:'LoadImage', inputs:{ image:input.image } };
    graph['5'].inputs.first_frame = ['17', 0];
  }
  if (input.lastFrame) {
    graph['18'] = { class_type:'LoadImage', inputs:{ image:input.lastFrame } };
    graph['5'].inputs.last_frame = ['18', 0];
  }
  // 参考图（Ref2VA 角色卡）：T8 ref_images autogrow 槽。
  // ComfyUI v0.30 expression API 的动态输入槽名 = Autogrow id 前缀点 + 模板名，
  // 即 ref_images.ref_image_0..N（序号从 0 起，见 _io.py finalize_prefix 展开）。
  // 裸 ref_image_N 会被当成普通 kwarg 交给 execute → TypeError
  // （2026-08-17 短片流水线实锤：9 镜批量全败）。节点 21 起每张一个 LoadImage，
  // 提示词用 <Picture N> 标签（排序后第 N 张）。
  if (hasReferences) {
    input.references.forEach(function (refName, refIndex) {
      var nodeId = String(21 + refIndex);
      graph[nodeId] = { class_type:'LoadImage', inputs:{ image:refName } };
      graph['5'].inputs['ref_images.ref_image_' + refIndex] = [nodeId, 0];
    });
  }
  return graph;
}

// MiniMax H3 原生工作流（lightx2v Turbo 版，官方 ModelTC 推荐 T2VA 图）。
// 节点图与官方模板
// （ModelTC/Minimax-H3-Turbo example_workflows/video_minimax_h3_t2v_lightx2v_turbo.json）
// 保持一致，全部为 ComfyUI 核心节点：
// UNETLoader → LoraLoaderModelOnly（Turbo LoRA，strength 1.0）→
// MiniMaxH3SigmaShift（shift_video 12 / shift_audio 3）→
// BasicGuider + BasicScheduler(simple, 8 步) + KSamplerSelect(euler) +
// SamplerCustomAdvanced + VAEDecode + VAEDecodeAudio + CreateVideo + SaveVideo。
// 20 步 → 8 步蒸馏采样（官方推荐 8 或 4 步）。SaveVideo 固定在节点 11，
// 与任务结果读取（outputs['11'].videos）契约一致。
function buildH3Workflow(input) {
  var graph = {
    '1': { class_type:'UNETLoader', inputs:{
      unet_name:'minimax_h3_fl2va_pruned_int8_convrot.safetensors',
      weight_dtype:'default',
    } },
    '2': { class_type:'CLIPLoader', inputs:{
      clip_name:'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors',
      type:'minimax',
      device:'default',
    } },
    '3': { class_type:'VAELoader', inputs:{ vae_name:'minimax_h3_video_vae_fp16.safetensors' } },
    '4': { class_type:'VAELoader', inputs:{ vae_name:'minimax_h3_audio_vae_fp32.safetensors' } },
    '5': { class_type:'MiniMaxH3ImageToVideo', inputs:{
      clip:['2', 0],
      vae:['3', 0],
      prompt:input.prompt,
      width:input.width,
      height:input.height,
      length:input.frames,
    } },
    '15': { class_type:'LoraLoaderModelOnly', inputs:{
      model:['1', 0],
      lora_name:'minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors',
      strength_model:1,
    } },
    '16': { class_type:'MiniMaxH3SigmaShift', inputs:{
      model:['15', 0],
      shift_video:12,
      shift_audio:3,
    } },
    '6': { class_type:'RandomNoise', inputs:{ noise_seed:input.seed } },
    '7': { class_type:'KSamplerSelect', inputs:{ sampler_name:'euler' } },
    '8': { class_type:'BasicScheduler', inputs:{
      model:['16', 0],
      scheduler:'simple',
      steps:input.steps,
      denoise:1,
    } },
    '9': { class_type:'BasicGuider', inputs:{
      model:['16', 0],
      conditioning:['5', 0],
    } },
    '10': { class_type:'SamplerCustomAdvanced', inputs:{
      noise:['6', 0],
      guider:['9', 0],
      sampler:['7', 0],
      sigmas:['8', 0],
      latent_image:['5', 1],
    } },
    '12': { class_type:'VAEDecode', inputs:{ samples:['10', 0], vae:['3', 0] } },
    '13': { class_type:'VAEDecodeAudio', inputs:{ samples:['10', 0], vae:['4', 0] } },
    '14': { class_type:'CreateVideo', inputs:{
      images:['12', 0],
      audio:['13', 0],
      fps:input.fps,
      bit_depth:8,
    } },
    '11': { class_type:'SaveVideo', inputs:{
      video:['14', 0],
      filename_prefix:OUTPUT_FILENAME_PREFIX,
      // 官方模板值：format/codec 用 'auto'。SaveVideo 的 codec 是 COMFY_DYNAMICCOMBO_V3，
      // 真实执行不接受对象结构（2026-08-15 实测 execution_error: missing 'codec'）。
      format:'auto',
      codec:'auto',
    } },
  };
  // I2VA：首帧图经 LoadImage 读入 ComfyUI/input，作为 <Picture 1> 几何锚点。
  if (input.image) {
    graph['17'] = { class_type:'LoadImage', inputs:{ image:input.image } };
    graph['5'].inputs.first_frame = ['17', 0];
  }
  // FL2VA/L2VA：尾帧图作为 <Picture 2> / 收敛锚点（节点原生支持 last_frame，
  // 2026-08-16 本机 object_info 与 nodes_minimax_h3.py 双重确认）。
  if (input.lastFrame) {
    graph['18'] = { class_type:'LoadImage', inputs:{ image:input.lastFrame } };
    graph['5'].inputs.last_frame = ['18', 0];
  }
  return graph;
}

function buildWanWorkflow(input) {
  return {
    '1': { class_type:'UNETLoader', inputs:{
      unet_name:'wan2.2_ti2v_5B_fp16.safetensors',
      weight_dtype:'default',
    } },
    '2': { class_type:'CLIPLoader', inputs:{
      clip_name:'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
      type:'wan',
      device:'default',
    } },
    '3': { class_type:'VAELoader', inputs:{ vae_name:'wan2.2_vae.safetensors' } },
    '4': { class_type:'CLIPTextEncode', inputs:{ clip:['2', 0], text:input.prompt } },
    '5': { class_type:'CLIPTextEncode', inputs:{ clip:['2', 0], text:input.negative } },
    '6': { class_type:'ModelSamplingSD3', inputs:{ model:['1', 0], shift:8 } },
    '7': { class_type:'Wan22ImageToVideoLatent', inputs:{
      vae:['3', 0],
      width:input.width,
      height:input.height,
      length:input.frames,
      batch_size:1,
    } },
    '8': { class_type:'KSampler', inputs:{
      model:['6', 0],
      positive:['4', 0],
      negative:['5', 0],
      latent_image:['7', 0],
      seed:input.seed,
      steps:input.steps,
      cfg:input.cfg,
      sampler_name:'uni_pc',
      scheduler:'simple',
      denoise:1,
    } },
    '9': { class_type:'VAEDecode', inputs:{ samples:['8', 0], vae:['3', 0] } },
    '10': { class_type:'CreateVideo', inputs:{ images:['9', 0], fps:input.fps, bit_depth:8 } },
    '11': { class_type:'SaveVideo', inputs:{
      video:['10', 0],
      filename_prefix:OUTPUT_FILENAME_PREFIX,
      // 同 H3：format/codec 用官方模板的 'auto'（动态 combo 不接受对象值）。
      format:'auto',
      codec:'auto',
    } },
  };
}

function requestComfy(config, method, pathname, body, timeoutMs, maxBytes) {
  return new Promise(function (resolve, reject) {
    var target;
    try { target = new URL(config.COMFY_HOST); } catch (error) {
      reject(serviceError(502, 'COMFY_CONFIG_INVALID', 'ComfyUI 地址无效'));
      return;
    }
    var rawPath = String(pathname || '/');
    var queryIndex = rawPath.indexOf('?');
    target.pathname = queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath;
    target.search = queryIndex >= 0 ? rawPath.slice(queryIndex) : '';
    var payload = body === undefined || body === null ? null : Buffer.from(JSON.stringify(body));
    var client = target.protocol === 'https:' ? https : http;
    var headers = { Accept:'application/json' };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
    var request = client.request({
      protocol:target.protocol,
      hostname:target.hostname,
      port:target.port,
      method:method,
      path:target.pathname + target.search,
      headers:headers,
      timeout:timeoutMs || 10000,
    }, function (response) {
      var chunks = [];
      var size = 0;
      response.on('data', function (chunk) {
        size += chunk.length;
        if (size > (maxBytes || 2 * 1024 * 1024)) {
          request.destroy(serviceError(502, 'COMFY_RESPONSE_TOO_LARGE', 'ComfyUI 响应过大'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', function () {
        resolve({
          status:response.statusCode || 0,
          headers:response.headers,
          body:Buffer.concat(chunks),
        });
      });
    });
    request.on('error', function (error) {
      if (error && error.code) reject(error);
      else reject(serviceError(502, 'COMFY_UNAVAILABLE', error && error.message || 'ComfyUI 不可用'));
    });
    request.on('timeout', function () {
      request.destroy(serviceError(504, 'COMFY_TIMEOUT', 'ComfyUI 请求超时'));
    });
    if (payload) request.write(payload);
    request.end();
  });
}

async function requestComfyJson(config, method, pathname, body, timeoutMs) {
  var response = await requestComfy(config, method, pathname, body, timeoutMs, 2 * 1024 * 1024);
  var data = null;
  try { data = response.body.length ? JSON.parse(response.body.toString('utf8')) : null; } catch (error) {
    throw serviceError(502, 'COMFY_INVALID_RESPONSE', 'ComfyUI 返回了无效 JSON');
  }
  if (response.status < 200 || response.status >= 300) {
    throw serviceError(502, 'COMFY_UPSTREAM_ERROR', 'ComfyUI 请求失败', {
      upstreamStatus:response.status,
    });
  }
  return data;
}

function requestOwner(req) {
  if (security.isDirectLocalRequest(req)) return 'local';
  var cookie = String(req.headers.cookie || '').match(/(?:^|;\s*)aics_token=([^;]+)/);
  var token = req.headers['x-token'] || cookie && cookie[1] || req.query && req.query.token || '';
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function ensureMediaRoot(config) {
  var outputs = config.RUNTIME && config.RUNTIME.outputs
    ? config.RUNTIME.outputs
    : path.join(config.RUNTIME_ROOT || path.join(config.ROOT_DIR, 'runtime'), 'outputs');
  var root = path.resolve(outputs, 'video');
  fs.mkdirSync(root, { recursive:true });
  return root;
}

function safeMediaPath(root, file) {
  var resolvedRoot = path.resolve(root);
  var resolved = path.resolve(root, file);
  return resolved.indexOf(resolvedRoot + path.sep) === 0 ? resolved : null;
}

function cleanupMediaRoot(config) {
  var root = ensureMediaRoot(config);
  var entries = [];
  try { entries = fs.readdirSync(root); } catch (error) { return; }
  entries.forEach(function (name) {
    var target = safeMediaPath(root, name);
    if (!target) return;
    try {
      var stat = fs.lstatSync(target);
      if (stat.isFile()) fs.unlinkSync(target);
    } catch (error) {}
  });
}

// 启动时清理由本服务写入的孤儿首帧图（网关重启后无活动任务引用它们）。
// 只清 aics_video_input_ 前缀；aics_video_ref_（参考卡）是跨任务资产，保留。
function cleanupImageInput(config) {
  var root = imageInputRoot(config);
  var entries = [];
  try { entries = fs.readdirSync(root); } catch (error) { return; }
  entries.forEach(function (name) {
    if (!IMAGE_INPUT_PATTERN.test(name)) return;
    try { fs.unlinkSync(path.resolve(root, name)); } catch (error) {}
  });
}

// 任务生命周期结束时删除其专属首帧图（文件名唯一、只被本 job 引用）。
function removeInputImage(config, name) {
  if (!IMAGE_INPUT_PATTERN.test(String(name || ''))) return;
  try { fs.unlinkSync(path.resolve(imageInputRoot(config), name)); } catch (error) {}
}

function decodePathValue(value) {
  var decoded = String(value || '');
  for (var i = 0; i < 3; i += 1) {
    var next;
    try { next = decodeURIComponent(decoded); } catch (error) {
      throw serviceError(400, 'INVALID_RESULT', '结果路径编码无效');
    }
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function validateVideoReference(value) {
  if (!isPlainObject(value)) throw serviceError(400, 'INVALID_RESULT', 'ComfyUI 视频描述无效');
  var type = String(value.type || 'output').toLowerCase();
  var filename = decodePathValue(value.filename);
  var subfolder = decodePathValue(value.subfolder || '');
  if (type !== 'output' || subfolder || filename !== path.basename(filename) || /[\\/\0]/.test(filename)) {
    throw serviceError(400, 'INVALID_RESULT', '视频结果路径不在应用允许范围内');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(?:mp4|webm|mov)$/i.test(filename)) {
    throw serviceError(400, 'INVALID_RESULT', '结果必须是受支持的视频文件');
  }
  if (!new RegExp('^' + OUTPUT_FILENAME_PREFIX + '(?:[_.-]|$)', 'i').test(filename)) {
    throw serviceError(400, 'INVALID_RESULT', '视频结果文件名前缀不受支持');
  }
  return { filename:filename, subfolder:'', type:'output' };
}

function videoMimeAndExtension(contentType, body, filename) {
  var mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  var extension = path.extname(filename).slice(1).toLowerCase();
  if ((extension === 'mp4' || extension === 'mov')
    && body.length >= 12
    && body.toString('ascii', 4, 8) === 'ftyp') {
    return { mime:extension === 'mov' ? 'video/quicktime' : 'video/mp4', extension:extension };
  }
  if (extension === 'webm'
    && body.length >= 4
    && body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mime:'video/webm', extension:'webm' };
  }
  if (mime === 'video/mp4' && extension === 'mp4') return { mime:mime, extension:extension };
  return null;
}

async function materializeResult(config, job, output) {
  var reference = validateVideoReference(output);
  var query = '?filename=' + encodeURIComponent(reference.filename) + '&type=output';
  var response = await requestComfy(config, 'GET', '/view' + query, null, 120000, MAX_VIDEO_BYTES);
  if (response.status < 200 || response.status >= 300) {
    throw serviceError(502, 'COMFY_RESULT_ERROR', 'ComfyUI 视频读取失败');
  }
  var info = videoMimeAndExtension(response.headers['content-type'], response.body, reference.filename);
  if (!info || !response.body.length || response.body.length > MAX_VIDEO_BYTES) {
    throw serviceError(502, 'INVALID_RESULT', 'ComfyUI 返回的视频格式无效');
  }
  var root = ensureMediaRoot(config);
  var target = safeMediaPath(root, job.id + '.' + info.extension);
  if (!target) throw serviceError(500, 'VIDEO_STORAGE_INVALID', '视频运行时目录无效');
  var temporary = target + '.tmp';
  fs.writeFileSync(temporary, response.body, { flag:'wx' });
  fs.renameSync(temporary, target);
  return { path:target, mime:info.mime, bytes:response.body.length };
}

function outputReference(entry) {
  var output = entry && entry.outputs && entry.outputs[OUTPUT_NODE_ID];
  var values = output && (output.images || output.videos);
  return Array.isArray(values) && values.length ? values[0] : null;
}

function createVideoService(config, dependencies) {
  dependencies = dependencies || {};
  var jobs = new Map();
  var closed = false;
  var clientId = comfyClient.clientIdFor(config, 'video');
  // 2026-08-16 审计（方案 A）：client_id 持久化复用 + 启动清理重启遗留的 ComfyUI 任务
  // （旧任务无人轮询/取消会继续占 GPU）。立即 + 30s 后各试一次（网关常先于 ComfyUI
  // 启动，重试幂等无害）。
  function sweepOrphanPrompts() {
    void comfyClient.cancelOrphanPrompts(config, clientId).then(function (cancelled) {
      if (cancelled.length) {
        console.warn('[video] 启动清理：已取消 ' + cancelled.length + ' 个重启遗留的 ComfyUI 任务');
      }
    });
  }
  sweepOrphanPrompts();
  var orphanSweepRetry = setTimeout(sweepOrphanPrompts, 30 * 1000);
  if (typeof orphanSweepRetry.unref === 'function') orphanSweepRetry.unref();
  var jobTimeoutMs = dependencies.jobTimeoutMs || JOB_TIMEOUT_MS;
  var jobTtlMs = dependencies.jobTtlMs || JOB_TTL_MS;
  var pollIntervalMs = dependencies.pollIntervalMs || POLL_INTERVAL_MS;

  cleanupMediaRoot(config);
  cleanupImageInput(config);

  function pendingCount() {
    var count = 0;
    jobs.forEach(function (job) {
      if (job.status === 'queued' || job.status === 'running' || job.status === 'cancelling') count += 1;
    });
    return count;
  }

  function publicJob(job) {
    // 进度由时间外推（elapsed/预估），不再用固定 0.12 假值误导等待；
    // 上限 90% 保留采样完成后的编码/落盘余量，succeeded 才归 1。
    var elapsedSeconds = Math.round((Date.now() - job.createdAt) / 1000);
    var progress = job.status === 'succeeded' ? 1
      : job.status === 'running'
        ? Math.min(0.9, Math.max(0.02, elapsedSeconds / job.estimatedSeconds))
        : 0;
    return {
      id:job.id,
      status:job.status,
      provider:'comfy',
      progress:progress,
      estimatedSeconds:job.estimatedSeconds,
      elapsedSeconds:elapsedSeconds,
      modelId:job.input.modelId,
      prompt:job.input.originalPrompt,
      width:job.input.width,
      height:job.input.height,
      duration:job.input.duration,
      fps:job.input.fps,
      seed:job.input.seed,
      createdAt:job.createdAt,
      resultAvailable:Boolean(job.result),
      resultUrl:job.result ? '/api/video/jobs/' + encodeURIComponent(job.id) + '/result' : null,
      error:job.error || null,
      code:job.errorCode || null,
    };
  }

  function removeJob(job) {
    if (job.pollTimer) clearTimeout(job.pollTimer);
    if (job.gcTimer) clearTimeout(job.gcTimer);
    if (job.result && job.result.path) {
      try { fs.unlinkSync(job.result.path); } catch (error) {}
    }
    if (job.input && job.input.image) removeInputImage(config, job.input.image);
    if (job.input && job.input.lastFrame) removeInputImage(config, job.input.lastFrame);
    jobs.delete(job.id);
  }

  function schedulePoll(job, delay) {
    if (closed || job.status !== 'running') return;
    if (job.pollTimer) clearTimeout(job.pollTimer);
    job.pollTimer = setTimeout(function () {
      job.pollTimer = null;
      void poll(job);
    }, delay);
  }

  function failJob(job, error, fallbackCode) {
    if (job.status === 'cancelled') return;
    job.status = 'failed';
    job.errorCode = error && error.code || fallbackCode || 'VIDEO_FAILED';
    job.error = error && error.code === 'INVALID_RESULT'
      ? '视频结果未通过安全校验'
      : (error && error.status >= 500 ? '视频生成上游暂不可用' : error && error.message || '视频生成失败');
    if (job.pollTimer) clearTimeout(job.pollTimer);
    job.pollTimer = null;
  }

  async function poll(job) {
    if (closed || job.status !== 'running' || !job.upstreamId) return;
    if (Date.now() > job.deadline) {
      failJob(job, serviceError(504, 'VIDEO_TIMEOUT',
        '视频任务疑似卡死（超过预估时长 ' + job.estimatedSeconds + ' 秒的 3 倍仍未完成），请检查 ComfyUI 状态后重试'),
        'VIDEO_TIMEOUT');
      return;
    }
    try {
      var history = await requestComfyJson(
        config,
        'GET',
        '/history/' + encodeURIComponent(job.upstreamId),
        null,
        10000
      );
      var entry = history && history[job.upstreamId];
      if (!entry) {
        schedulePoll(job, pollIntervalMs);
        return;
      }
      var status = entry.status && entry.status.status_str;
      if (status === 'error' || status === 'failed') {
        failJob(job, serviceError(502, 'COMFY_EXECUTION_FAILED', 'ComfyUI 执行视频工作流失败'));
        return;
      }
      if (status !== 'success') {
        schedulePoll(job, pollIntervalMs);
        return;
      }
      var output = outputReference(entry);
      if (!output) {
        failJob(job, serviceError(502, 'COMFY_NO_VIDEO', 'ComfyUI 未返回视频'));
        return;
      }
      job.result = await materializeResult(config, job, output);
      // 2026-08-16 审计：materialize 期间用户可能已取消（cancel 与 poll 竞态）——
      // 材料化完成不代表任务仍有效；状态已离开 running 时丢弃结果文件，保持取消态，
      // 避免「取消后任务静默复活为 succeeded」并残留下载文件。
      if (job.status !== 'running') {
        if (job.result && job.result.path) {
          try { fs.unlinkSync(job.result.path); } catch (error) {}
        }
        job.result = null;
        return;
      }
      job.status = 'succeeded';
      job.error = null;
      job.errorCode = null;
    } catch (error) {
      job.pollFailures += 1;
      if (error && (error.code === 'INVALID_RESULT' || error.code === 'COMFY_NO_VIDEO')) {
        failJob(job, error);
        return;
      }
      if (Date.now() > job.deadline || job.pollFailures >= 60) {
        failJob(job, error, 'VIDEO_POLL_FAILED');
        return;
      }
      schedulePoll(job, Math.min(5000, pollIntervalMs * Math.max(1, job.pollFailures)));
    }
  }

  async function submit(job) {
    var availability = modelAvailability(config, MODEL_BY_ID[job.input.modelId]);
    if (!availability.available) {
      throw serviceError(503, 'VIDEO_MODEL_UNAVAILABLE', '视频模型文件尚未安装', {
        missing:availability.missing,
      });
    }
    var response = await requestComfyJson(config, 'POST', '/prompt', {
      prompt:buildWorkflow(job.input),
      client_id:clientId,
    }, 20000);
    var promptId = response && response.prompt_id;
    if (typeof promptId !== 'string' || !promptId || promptId.length > 200) {
      throw serviceError(502, 'COMFY_INVALID_RESPONSE', 'ComfyUI 未返回有效任务 ID');
    }
    job.upstreamId = promptId;
    // 提交期间被取消（cancel 与 submit 竞态）：不能把已经取消的任务又翻回
    // running——否则用户按了取消，任务却复活跑完全程占 45 分钟 GPU。
    // 这里直接把刚创建的上游任务一并取消，保持取消语义。
    if (job.status !== 'queued') {
      try {
        await requestComfyJson(
          config,
          'POST',
          '/api/jobs/' + encodeURIComponent(promptId) + '/cancel',
          null,
          10000
        );
      } catch (error) {}
      return;
    }
    job.status = 'running';
    schedulePoll(job, 0);
  }

  function create(input, owner, opts) {
    if (pendingCount() >= MAX_PENDING) {
      throw serviceError(429, 'VIDEO_QUEUE_FULL', '视频队列已满，请等待当前任务完成');
    }
    // 分镜批量任务延长 TTL：整批生成可能数十分钟，首镜结果需留到批处理完再取。
    var ttlMs = opts && opts.ttlMs || jobTtlMs;
    var id = crypto.randomBytes(18).toString('hex');
    var createdAt = Date.now();
    // 动态超时：预估时长 × 3（下限 10 分钟）替代固定 45 分钟——卡死时
    // 不用再硬等 45 分钟才失败（2026-08-17 可观测性审计）。
    var estimatedSeconds = estimateH3Seconds(input);
    var job = {
      id:id,
      owner:owner,
      input:input,
      status:'queued',
      createdAt:createdAt,
      estimatedSeconds:estimatedSeconds,
      deadline:createdAt + Math.max(10 * 60 * 1000, estimatedSeconds * 3 * 1000),
      upstreamId:'',
      result:null,
      error:null,
      errorCode:null,
      pollTimer:null,
      gcTimer:null,
      pollFailures:0,
    };
    jobs.set(id, job);
    job.gcTimer = setTimeout(function () { removeJob(job); }, ttlMs).unref();
    return job;
  }

  function get(id, owner) {
    var job = jobs.get(String(id || ''));
    return job && job.owner === owner ? job : null;
  }

  async function cancel(job) {
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') return job;
    job.status = 'cancelling';
    if (job.pollTimer) clearTimeout(job.pollTimer);
    job.pollTimer = null;
    if (job.upstreamId) {
      try {
        await requestComfyJson(
          config,
          'POST',
          '/api/jobs/' + encodeURIComponent(job.upstreamId) + '/cancel',
          null,
          10000
        );
      } catch (error) {
        job.status = 'failed';
        job.error = '无法安全取消上游视频任务';
        job.errorCode = 'VIDEO_CANCEL_FAILED';
        return job;
      }
    }
    job.status = 'cancelled';
    job.error = '任务已取消';
    job.errorCode = 'VIDEO_CANCELLED';
    return job;
  }

  async function probe() {
    var response = await requestComfy(config, 'GET', '/system_stats', null, 2500, 256 * 1024);
    return response.status >= 200 && response.status < 300;
  }

  function close() {
    closed = true;
    jobs.forEach(removeJob);
    cleanupMediaRoot(config);
  }

  return {
    create:create,
    submit:submit,
    get:get,
    cancel:cancel,
    publicJob:publicJob,
    pendingCount:pendingCount,
    probe:probe,
    close:close,
  };
}

function streamVideo(req, res, result) {
  var stat = fs.statSync(result.path);
  var range = String(req.headers.range || '');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', result.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!range) {
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(result.path).pipe(res);
    return;
  }
  var match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    res.status(416).setHeader('Content-Range', 'bytes */' + stat.size);
    res.end();
    return;
  }
  var start = match[1] ? Number(match[1]) : 0;
  var end = match[2] ? Number(match[2]) : stat.size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= stat.size) {
    res.status(416).setHeader('Content-Range', 'bytes */' + stat.size);
    res.end();
    return;
  }
  res.status(206);
  res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + stat.size);
  res.setHeader('Content-Length', String(end - start + 1));
  fs.createReadStream(result.path, { start:start, end:end }).pipe(res);
}

// ── 分镜批量（P5：POST /api/video/batches）────────────────────────────────
// 一次提交一组镜头：服务端逐镜排队生成（尊重 MAX_PENDING 与 16GB 显存，绝不
// 并行多任务抢显存），单镜失败不打断整批，可在批内单独重抽；linkLastFrame 时
// 用上一镜结果尾帧衔接下一镜（有首帧 → FL2VA 尾帧；无首帧 → 续接为 I2VA 首帧），
// 全批成功后可用 ffmpeg 拼接成片（P8）。

var BATCH_BODY_KEYS = new Set(['modelId', 'aspectRatio', 'quality', 'linkLastFrame', 'steps', 'shots']);
var BATCH_SHOT_KEYS = new Set(['prompt', 'dialogue', 'dialogueLang', 'shotSize', 'camera', 'motion', 'duration', 'seed', 'image', 'references']);
var BATCH_SHOT_DEFAULTS = Object.freeze({ camera:'still', motion:'subtle', duration:5 });

function validateBatchInput(body, config) {
  if (!isPlainObject(body)) throw serviceError(400, 'INVALID_BODY', '请求体必须是 JSON 对象');
  Object.keys(body).forEach(function (key) {
    if (!BATCH_BODY_KEYS.has(key)) {
      throw serviceError(400, 'UNKNOWN_PARAMETER', '不支持的参数：' + key);
    }
  });
  if (typeof body.modelId !== 'string' || !MODEL_BY_ID[body.modelId]) {
    throw serviceError(400, 'UNKNOWN_MODEL', '未知视频模型');
  }
  var model = MODEL_BY_ID[body.modelId];
  if (!model.executable) throw serviceError(409, 'MODEL_ADAPTER_UNAVAILABLE', '该模型仍在适配与实测阶段');
  // 整批统一画幅与画质：拼接成片时分辨率必须一致，逐镜自由会破坏 P8 concat。
  var aspectRatio = body.aspectRatio;
  if (aspectRatio !== 'landscape' && aspectRatio !== 'portrait' && aspectRatio !== 'square') {
    throw serviceError(400, 'INVALID_PARAMETER', '分镜整批需要统一的画幅（landscape/portrait/square）');
  }
  var quality = body.quality === undefined || body.quality === null || body.quality === ''
    ? 'standard'
    : body.quality;
  if (typeof quality !== 'string' || !QUALITIES[quality]) {
    throw serviceError(400, 'INVALID_PARAMETER', '不支持的画质档位');
  }
  var linkLastFrame = body.linkLastFrame === undefined || body.linkLastFrame === null
    ? true
    : body.linkLastFrame;
  if (typeof linkLastFrame !== 'boolean') {
    throw serviceError(400, 'INVALID_PARAMETER', 'linkLastFrame 需为布尔值');
  }
  var steps = body.steps === undefined || body.steps === null || body.steps === ''
    ? 8
    : body.steps;
  if (steps !== 4 && steps !== 8) {
    throw serviceError(400, 'INVALID_PARAMETER', '步数只支持 4（极速）或 8（标准）');
  }
  if (steps === 4 && model.family !== 'minimax-h3') {
    throw serviceError(400, 'MODEL_INPUT_MODE', '极速步数仅支持 MiniMax H3');
  }
  if (!Array.isArray(body.shots) || body.shots.length < 1 || body.shots.length > MAX_BATCH_SHOTS) {
    throw serviceError(400, 'INVALID_PARAMETER', '分镜数量需为 1—' + MAX_BATCH_SHOTS);
  }
  var shots = body.shots.map(function (shot, index) {
    if (!isPlainObject(shot)) {
      throw serviceError(400, 'INVALID_PARAMETER', '第 ' + (index + 1) + ' 个分镜必须是对象');
    }
    Object.keys(shot).forEach(function (key) {
      if (!BATCH_SHOT_KEYS.has(key)) {
        throw serviceError(400, 'UNKNOWN_PARAMETER', '分镜不支持参数：' + key);
      }
    });
    // 单镜契约与单任务完全同源（validateInput 白名单/时长/景别/对白/图片校验）。
    // lastFrame 由服务端衔接写入，客户端不接受；validateInput 返回冻结对象，
    // 这里复制成可变副本，供 linkLastFrame 衔接时改写 image/lastFrame。
    var shotBody = Object.assign({}, BATCH_SHOT_DEFAULTS, shot, {
      modelId:model.id,
      aspectRatio:aspectRatio,
      quality:quality,
    });
    if (model.family === 'minimax-h3') shotBody.steps = steps;
    var input = Object.assign({}, validateInput(shotBody, config));
    return { input:input };
  });
  return Object.freeze({
    modelId:model.id,
    aspectRatio:aspectRatio,
    quality:quality,
    linkLastFrame:linkLastFrame,
    steps:steps,
    shots:shots,
  });
}

function createBatchService(config, videoService, dependencies) {
  dependencies = dependencies || {};
  var batches = new Map();
  var closed = false;
  var pollIntervalMs = dependencies.batchPollIntervalMs || 2000;
  // ffmpeg 命令可注入（测试替身）；缺省走 child_process.execFile。
  var runFfmpeg = dependencies.runFfmpeg || function (args) {
    return new Promise(function (resolve, reject) {
      childProcess.execFile('ffmpeg', args, { maxBuffer:8 * 1024 * 1024 }, function (error, stdout, stderr) {
        if (error) reject(new Error('ffmpeg 执行失败: ' + String(stderr || error.message).slice(0, 300)));
        else resolve(stdout);
      });
    });
  };

  function publicShot(shot) {
    return {
      index:shot.index,
      status:shot.status,
      prompt:shot.input.originalPrompt,
      dialogue:shot.input.dialogue || null,
      shotSize:shot.input.shotSize || null,
      camera:shot.input.camera,
      motion:shot.input.motion,
      duration:shot.input.duration,
      seed:shot.input.seed,
      attempts:shot.attempts,
      error:shot.error || null,
      code:shot.errorCode || null,
      resultAvailable:Boolean(shot.job && shot.job.result),
      resultUrl:shot.job && shot.job.result
        ? '/api/video/jobs/' + encodeURIComponent(shot.job.id) + '/result'
        : null,
    };
  }

  function publicBatch(batch) {
    var total = batch.shots.length;
    var succeeded = batch.shots.filter(function (s) { return s.status === 'succeeded'; }).length;
    var failed = batch.shots.filter(function (s) { return s.status === 'failed'; }).length;
    return {
      id:batch.id,
      status:batch.status,
      modelId:batch.modelId,
      aspectRatio:batch.aspectRatio,
      quality:batch.quality,
      steps:batch.steps,
      linkLastFrame:batch.linkLastFrame,
      progress:{ total:total, succeeded:succeeded, failed:failed },
      createdAt:batch.createdAt,
      shots:batch.shots.map(publicShot),
      concatAvailable:Boolean(batch.concat),
      concatUrl:batch.concat ? '/api/video/batches/' + encodeURIComponent(batch.id) + '/result' : null,
    };
  }

  function get(id, owner) {
    var batch = batches.get(String(id || ''));
    return batch && batch.owner === owner ? batch : null;
  }

  // 从上一镜结果 MP4 抽取尾帧 → 受控输入文件（供下一镜 FL2VA 尾帧 / I2VA 首帧）。
  async function extractLastFrame(shot) {
    if (!shot.job || !shot.job.result || !shot.job.result.path) return null;
    var name = IMAGE_INPUT_PREFIX + crypto.randomBytes(8).toString('hex') + '.png';
    var root = imageInputRoot(config);
    var target = path.resolve(root, name);
    if (target.indexOf(path.resolve(root) + path.sep) !== 0) return null;
    try {
      await runFfmpeg(['-y', '-sseof', '-0.1', '-i', shot.job.result.path, '-frames:v', '1', '-update', '1', target]);
    } catch (error) {
      console.warn('[video] 尾帧抽取失败（镜头 ' + shot.index + '）：' + error.message);
      return null;
    }
    if (!fs.existsSync(target) || !fs.statSync(target).size) return null;
    return name;
  }

  // 批状态收敛：无待处理/运行中镜头时定终态；否则继续推进下一镜。
  function finalizeStatus(batch) {
    var pending = batch.shots.some(function (s) { return s.status === 'pending'; });
    var active = batch.shots.some(function (s) { return s.status === 'queued' || s.status === 'running'; });
    if (!pending && !active) {
      var allSucceeded = batch.shots.every(function (s) { return s.status === 'succeeded'; });
      var allTerminal = batch.shots.every(function (s) {
        return s.status === 'succeeded' || s.status === 'cancelled';
      });
      batch.status = allSucceeded ? 'done' : (allTerminal ? 'cancelled' : 'paused');
      return;
    }
    void kick(batch);
  }

  // linkLastFrame 衔接可能在提交前改写了 image/lastFrame（上一镜尾帧）：
  // 提示词必须按当前输入模式重新组装（官方参考图指令随 I2VA/FL2VA/L2VA 变化），
  // seed 显式传回保证确定性（重抽/重试不换随机种子）。
  function recomposeInput(input, batch, config) {
    var body = {
      prompt:input.originalPrompt,
      modelId:batch.modelId,
      aspectRatio:batch.aspectRatio,
      duration:input.duration,
      camera:input.camera,
      motion:input.motion,
      seed:input.seed,
      quality:input.quality,
      image:input.image || undefined,
      lastFrame:input.lastFrame || undefined,
      references:input.references || undefined,
      dialogue:input.dialogue || undefined,
      dialogueLang:input.dialogueLang || undefined,
      shotSize:input.shotSize || undefined,
    };
    if (input.negative) body.negative = input.negative;
    if (batch.modelId === 'minimax-h3' && input.steps) body.steps = input.steps;
    return Object.assign({}, validateInput(body, config));
  }

  function scheduleWatch(batch) {
    if (closed || batch.status === 'cancelled' || batch.watchTimer) return;
    var tick = async function () {
      batch.watchTimer = null;
      if (closed || batch.status === 'cancelled') return;
      var shot = batch.shots.find(function (s) {
        return s.job && (s.status === 'queued' || s.status === 'running');
      });
      if (!shot) return;
      var job = videoService.get(shot.job.id, batch.owner);
      if (!job) {
        shot.status = 'failed';
        shot.error = '任务记录已过期';
        shot.errorCode = 'JOB_EXPIRED';
        finalizeStatus(batch);
        return;
      }
      if (job.status === 'succeeded') {
        shot.status = 'succeeded';
        var next = batch.shots[shot.index]; // index 从 1 开始 → 数组下一项
        if (batch.linkLastFrame && next && next.status === 'pending') {
          // 带参考图（Ref2VA 角色卡）的镜头不做尾帧衔接：上一镜末帧作为 Hybrid
          // 首帧会以像素锚定覆盖 <Picture N> 参考，导致角色切换镜头被前一角色
          // 污染（2026-08-17 实锤：宁宁末帧喂给夏目读信镜头，夏目被画成白发）。
          // 参考卡镜头保持纯 Ref2VA，身份由 <Picture N> 专属锚定。
          if (next.input && next.input.references && next.input.references.length) {
            finalizeStatus(batch);
            return;
          }
          var name = await extractLastFrame(shot);
          if (name) {
            if (next.input.image) next.input.lastFrame = name;
            else next.input.image = name;
          }
        }
        finalizeStatus(batch);
        return;
      }
      if (job.status === 'failed' || job.status === 'cancelled') {
        shot.status = job.status;
        shot.error = job.error;
        shot.errorCode = job.errorCode;
        finalizeStatus(batch);
        return;
      }
      batch.watchTimer = setTimeout(tick, pollIntervalMs);
      if (batch.watchTimer.unref) batch.watchTimer.unref();
    };
    batch.watchTimer = setTimeout(tick, pollIntervalMs);
    if (batch.watchTimer.unref) batch.watchTimer.unref();
  }

  async function kick(batch) {
    if (closed || batch.status === 'cancelled' || batch.kicking) return;
    var shot = batch.shots.find(function (s) { return s.status === 'pending'; });
    if (!shot) {
      finalizeStatus(batch);
      return;
    }
    batch.kicking = true;
    try {
      shot.input = recomposeInput(shot.input, batch, config);
      var job = videoService.create(shot.input, batch.owner, { ttlMs:BATCH_JOB_TTL_MS });
      shot.job = job;
      shot.attempts += 1;
      shot.status = 'queued';
      await videoService.submit(job);
      scheduleWatch(batch);
    } catch (error) {
      shot.status = 'failed';
      shot.error = error && error.message || '分镜提交失败';
      shot.errorCode = error && error.code || 'BATCH_SUBMIT_FAILED';
      if (shot.job) {
        try { await videoService.cancel(shot.job); } catch (cancelError) {}
        shot.job = null;
      }
      finalizeStatus(batch);
    } finally {
      batch.kicking = false;
    }
  }

  function removeBatch(batch) {
    if (batch.watchTimer) clearTimeout(batch.watchTimer);
    if (batch.gcTimer) clearTimeout(batch.gcTimer);
    if (batch.concat && batch.concat.path) {
      try { fs.unlinkSync(batch.concat.path); } catch (error) {}
    }
    batches.delete(batch.id);
  }

  async function create(owner, batchInput) {
    var availability = modelAvailability(config, MODEL_BY_ID[batchInput.modelId]);
    if (!availability.available) {
      throw serviceError(503, 'VIDEO_MODEL_UNAVAILABLE', '视频模型文件尚未安装', {
        missing:availability.missing,
      });
    }
    var id = crypto.randomBytes(18).toString('hex');
    var batch = {
      id:id,
      owner:owner,
      status:'running',
      modelId:batchInput.modelId,
      aspectRatio:batchInput.aspectRatio,
      quality:batchInput.quality,
      steps:batchInput.steps,
      linkLastFrame:batchInput.linkLastFrame,
      shots:batchInput.shots.map(function (entry, index) {
        return {
          index:index + 1,
          input:entry.input,
          status:'pending',
          attempts:0,
          error:null,
          errorCode:null,
          job:null,
        };
      }),
      createdAt:Date.now(),
      concat:null,
      watchTimer:null,
      gcTimer:null,
      kicking:false,
    };
    batches.set(id, batch);
    batch.gcTimer = setTimeout(function () { removeBatch(batch); }, BATCH_TTL_MS);
    if (batch.gcTimer.unref) batch.gcTimer.unref();
    void kick(batch);
    return batch;
  }

  async function cancel(batch) {
    if (batch.status === 'done') return batch;
    batch.status = 'cancelled';
    if (batch.watchTimer) { clearTimeout(batch.watchTimer); batch.watchTimer = null; }
    for (var i = 0; i < batch.shots.length; i += 1) {
      var shot = batch.shots[i];
      if (shot.status === 'pending') shot.status = 'cancelled';
      else if (shot.status === 'queued' || shot.status === 'running') {
        if (shot.job) {
          try { await videoService.cancel(shot.job); } catch (error) {}
        }
        if (shot.status !== 'cancelled') {
          shot.status = 'cancelled';
          shot.error = '任务已取消';
          shot.errorCode = 'VIDEO_CANCELLED';
        }
      }
    }
    return batch;
  }

  async function retryShot(batch, index) {
    var shot = batch.shots[index];
    if (!shot) throw serviceError(404, 'SHOT_NOT_FOUND', '分镜不存在');
    if (shot.status !== 'failed' && shot.status !== 'cancelled') {
      throw serviceError(409, 'BATCH_SHOT_NOT_RETRYABLE', '只有失败或取消的分镜可以重抽');
    }
    shot.status = 'pending';
    shot.error = null;
    shot.errorCode = null;
    shot.job = null;
    batch.status = 'running';
    void kick(batch);
    return batch;
  }

  async function concat(batch) {
    if (batch.concat) return batch.concat;
    var succeeded = batch.shots.filter(function (s) { return s.status === 'succeeded'; });
    if (succeeded.length < 2) {
      throw serviceError(409, 'BATCH_CONCAT_NEEDS_SHOTS', '至少需要两个成功分镜才能拼接');
    }
    var root = ensureMediaRoot(config);
    var listPath = path.join(root, 'batch_' + batch.id + '.txt');
    var lines = succeeded.map(function (shot) {
      return "file '" + String(shot.job.result.path).replace(/'/g, "'\\''") + "'";
    });
    fs.writeFileSync(listPath, lines.join('\n') + '\n');
    var target = path.join(root, 'batch_' + batch.id + '.mp4');
    // 2026-08-16 真机实测：H3 输出画布可能与请求画布有 ±几像素漂移（如 832×480 →
    // 832×509），逐镜拼接必须 scale+pad 归一化到批量画布，否则成片分辨率逐段漂移。
    var canvas = batch.shots[0].input;
    var args = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath,
      '-vf', 'scale=' + canvas.width + ':' + canvas.height + ':force_original_aspect_ratio=decrease,pad=' + canvas.width + ':' + canvas.height + ':(ow-iw)/2:(oh-ih)/2,setsar=1',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', target];
    try {
      await runFfmpeg(args);
    } catch (error) {
      // 部分镜头可能无音轨导致音频编码失败：去掉音频轨重试（纯视频拼接）。
      console.warn('[video] 带音轨拼接失败，回退纯视频拼接：' + error.message);
      await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath,
        '-vf', 'scale=' + canvas.width + ':' + canvas.height + ':force_original_aspect_ratio=decrease,pad=' + canvas.width + ':' + canvas.height + ':(ow-iw)/2:(oh-ih)/2,setsar=1',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-an', target]);
    } finally {
      try { fs.unlinkSync(listPath); } catch (error) {}
    }
    if (!fs.existsSync(target) || !fs.statSync(target).size) {
      throw serviceError(500, 'BATCH_CONCAT_FAILED', '视频拼接失败');
    }
    batch.concat = { path:target, mime:'video/mp4' };
    return batch.concat;
  }

  function close() {
    closed = true;
    batches.forEach(removeBatch);
  }

  return {
    create:create,
    get:get,
    cancel:cancel,
    retryShot:retryShot,
    concat:concat,
    publicBatch:publicBatch,
    close:close,
  };
}

function createVideoRouter(config, dependencies) {
  var router = express.Router();
  var service = dependencies && dependencies.videoService
    ? dependencies.videoService
    : createVideoService(config, dependencies);
  var batchService = dependencies && dependencies.batchService
    ? dependencies.batchService
    : createBatchService(config, service, dependencies);
  var jobLimit = security.rateLimit({ capacity:3, refillMs:60000, label:'视频生成' });
  // T8 双时钟采样路径（2026-08-16）：测试可注入 t8Available 固定路径；
  // 生产启动时探测真实 ComfyUI（默认 false → 探测成功前走原生路径，幂等无害）。
  if (dependencies && typeof dependencies.t8Available === 'boolean') {
    setT8Available(dependencies.t8Available);
  } else {
    void probeT8Nodes(config);
  }

  router.get('/api/video/status', async function (req, res) {
    var online = false;
    try { online = await service.probe(); } catch (error) {}
    var models = MODEL_CATALOG.map(function (model) {
      return Object.assign({}, model, modelAvailability(config, model), {
        requirements:model.requirements.map(function (requirement) {
          return requirement[0] + '/' + requirement[1];
        }),
      });
    });
    var t8 = {
      available:t8Available,
      reason:t8Available
        ? 'T8 双时钟采样 + 4 步加速 LoRA（最快路径）'
        : '已降级：原生采样器（速度约慢 1 倍）；提交任务时会自动重新探测',
    };
    var qualities = Object.keys(QUALITIES).map(function (id) {
      var quality = QUALITIES[id];
      return {
        id:id,
        label:quality.label,
        summary:quality.summary,
        sizes:Object.keys(quality.sizes).reduce(function (sizes, aspectId) {
          sizes[aspectId] = quality.sizes[aspectId].width + ' × ' + quality.sizes[aspectId].height;
          return sizes;
        }, {}),
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    envelope.ok(res, {
      online:online,
      pending:service.pendingCount(),
      maxPending:MAX_PENDING,
      models:models,
      qualities:qualities,
      defaults:{
        modelId:'wan2.2-ti2v-5b',
        aspectRatio:'landscape',
        duration:3,
        camera:'still',
        motion:'subtle',
        quality:'standard',
      },
      t8:t8,
    });
  });

  // 首帧图/参考图上传：base64 JSON → 魔数校验 → 写入 ComfyUI/input（受控文件名）。
  // kind:'reference' 用 aics_video_ref_ 前缀（跨任务资产，启动清理保留）；
  // 缺省 aics_video_input_（首帧，任务结束/网关重启时清理）。
  router.post('/api/video/images', jobLimit, express.json({ limit:'28mb' }), function (req, res) {
    var body = req.body;
    var data = body && body.data;
    if (typeof data !== 'string' || !data) {
      return envelope.fail(res, 400, '缺少图片数据', { code:'INVALID_IMAGE' });
    }
    var buffer;
    try { buffer = Buffer.from(data, 'base64'); } catch (error) {
      return envelope.fail(res, 400, '图片数据编码无效', { code:'INVALID_IMAGE' });
    }
    if (buffer.length < 16 || buffer.length > MAX_IMAGE_BYTES) {
      return envelope.fail(res, 400, '图片大小需在 16B—20MB 之间', { code:'INVALID_IMAGE' });
    }
    var ext = sniffImageExtension(buffer);
    if (!ext) {
      return envelope.fail(res, 400, '仅支持 PNG / JPEG / WebP 图片', { code:'INVALID_IMAGE' });
    }
    var isReference = body.kind === 'reference';
    var prefix = isReference ? IMAGE_REF_PREFIX : IMAGE_INPUT_PREFIX;
    var name = prefix + crypto.randomBytes(8).toString('hex') + '.' + ext;
    var root = imageInputRoot(config);
    var resolvedRoot = path.resolve(root);
    var target = path.resolve(root, name);
    if (target.indexOf(resolvedRoot + path.sep) !== 0) {
      return envelope.fail(res, 500, '图片存储路径无效', { code:'IMAGE_STORAGE_INVALID' });
    }
    try {
      fs.mkdirSync(resolvedRoot, { recursive:true });
      fs.writeFileSync(target, buffer, { flag:'wx' });
    } catch (error) {
      return envelope.fail(res, 500, '图片写入失败', { code:'IMAGE_WRITE_FAILED' });
    }
    envelope.ok(res, { name:name, bytes:buffer.length });
  });

  router.post('/api/video/jobs', jobLimit, express.json({ limit:MAX_BODY }), async function (req, res) {
    try { await ensureT8Probe(config); } catch (error) { /* 探测失败沿用旧值，提交照常 */ }
    var input;
    try { input = validateInput(req.body, config); } catch (error) {
      return envelope.fail(res, error.status || 400, error.message, {
        code:error.code,
        detail:error.detail,
      });
    }
    var job;
    try {
      job = service.create(input, requestOwner(req));
      await service.submit(job);
    } catch (error) {
      if (job) await service.cancel(job);
      return envelope.fail(res, error.status || 502,
        error.status >= 500 ? '视频生成环境尚未就绪' : error.message,
        { code:error.code || 'VIDEO_SUBMIT_FAILED', detail:error.detail });
    }
    res.status(202);
    envelope.ok(res, { job:service.publicJob(job) });
  });

  router.get('/api/video/jobs/:id', function (req, res) {
    var job = service.get(req.params.id, requestOwner(req));
    if (!job) return envelope.fail(res, 404, '视频任务不存在', { code:'JOB_NOT_FOUND' });
    res.setHeader('Cache-Control', 'no-store');
    envelope.ok(res, { job:service.publicJob(job) });
  });

  router.delete('/api/video/jobs/:id', async function (req, res) {
    var job = service.get(req.params.id, requestOwner(req));
    if (!job) return envelope.fail(res, 404, '视频任务不存在', { code:'JOB_NOT_FOUND' });
    var cancelled = await service.cancel(job);
    envelope.ok(res, { job:service.publicJob(cancelled) });
  });

  router.get('/api/video/jobs/:id/result', function (req, res) {
    var job = service.get(req.params.id, requestOwner(req));
    if (!job || job.status !== 'succeeded' || !job.result) {
      return envelope.fail(res, 404, '视频结果不存在', { code:'RESULT_NOT_FOUND' });
    }
    try {
      streamVideo(req, res, job.result);
    } catch (error) {
      if (!res.headersSent) envelope.fail(res, 404, '视频结果不存在', { code:'RESULT_NOT_FOUND' });
      else res.destroy();
    }
  });

  // ── 分镜批量（P5：批量生成 / P6：尾帧衔接 / P8：拼接成片）──────────────
  router.post('/api/video/batches', jobLimit, express.json({ limit:MAX_BATCH_BODY }), async function (req, res) {
    try { await ensureT8Probe(config); } catch (error) { /* 探测失败沿用旧值，提交照常 */ }
    var batchInput;
    try {
      batchInput = validateBatchInput(req.body, config);
    } catch (error) {
      return envelope.fail(res, error.status || 400, error.message, {
        code:error.code,
        detail:error.detail,
      });
    }
    var batch;
    try {
      batch = await batchService.create(requestOwner(req), batchInput);
    } catch (error) {
      return envelope.fail(res, error.status || 502,
        error.status >= 500 ? '视频生成环境尚未就绪' : error.message,
        { code:error.code || 'BATCH_SUBMIT_FAILED', detail:error.detail });
    }
    res.status(202);
    envelope.ok(res, { batch:batchService.publicBatch(batch) });
  });

  router.get('/api/video/batches/:id', function (req, res) {
    var batch = batchService.get(req.params.id, requestOwner(req));
    if (!batch) return envelope.fail(res, 404, '分镜任务不存在', { code:'BATCH_NOT_FOUND' });
    res.setHeader('Cache-Control', 'no-store');
    envelope.ok(res, { batch:batchService.publicBatch(batch) });
  });

  router.delete('/api/video/batches/:id', async function (req, res) {
    var batch = batchService.get(req.params.id, requestOwner(req));
    if (!batch) return envelope.fail(res, 404, '分镜任务不存在', { code:'BATCH_NOT_FOUND' });
    var cancelled = await batchService.cancel(batch);
    envelope.ok(res, { batch:batchService.publicBatch(cancelled) });
  });

  // 重抽单个失败/取消分镜（同 seed 确定性复现，不重跑整批）。
  router.post('/api/video/batches/:id/shots/:index/retry', async function (req, res) {
    var batch = batchService.get(req.params.id, requestOwner(req));
    if (!batch) return envelope.fail(res, 404, '分镜任务不存在', { code:'BATCH_NOT_FOUND' });
    var index = Number(req.params.index);
    if (!Number.isSafeInteger(index) || index < 1) {
      return envelope.fail(res, 400, '分镜序号无效', { code:'SHOT_INDEX_INVALID' });
    }
    try {
      await batchService.retryShot(batch, index - 1);
    } catch (error) {
      return envelope.fail(res, error.status || 400, error.message, { code:error.code || 'SHOT_RETRY_FAILED' });
    }
    res.status(202);
    envelope.ok(res, { batch:batchService.publicBatch(batch) });
  });

  router.post('/api/video/batches/:id/concat', async function (req, res) {
    var batch = batchService.get(req.params.id, requestOwner(req));
    if (!batch) return envelope.fail(res, 404, '分镜任务不存在', { code:'BATCH_NOT_FOUND' });
    try {
      await batchService.concat(batch);
    } catch (error) {
      return envelope.fail(res, error.status || 500, error.message, { code:error.code || 'BATCH_CONCAT_FAILED' });
    }
    res.setHeader('Cache-Control', 'no-store');
    envelope.ok(res, { batch:batchService.publicBatch(batch) });
  });

  router.get('/api/video/batches/:id/result', function (req, res) {
    var batch = batchService.get(req.params.id, requestOwner(req));
    if (!batch || !batch.concat) {
      return envelope.fail(res, 404, '拼接结果不存在', { code:'RESULT_NOT_FOUND' });
    }
    try {
      streamVideo(req, res, batch.concat);
    } catch (error) {
      if (!res.headersSent) envelope.fail(res, 404, '拼接结果不存在', { code:'RESULT_NOT_FOUND' });
      else res.destroy();
    }
  });

  var close = function () {
    service.close();
    batchService.close();
  };
  return { router:router, service:service, batchService:batchService, close:close };
}

module.exports = {
  createVideoRouter:createVideoRouter,
  createVideoService:createVideoService,
  createBatchService:createBatchService,
  validateInput:validateInput,
  validateBatchInput:validateBatchInput,
  buildWorkflow:buildWorkflow,
  validateVideoReference:validateVideoReference,
  // 测试钩子：固定 T8 双时钟路径（生产由 createVideoRouter 探测 ComfyUI 决定）。
  setT8Available:setT8Available,
  constants:{
    MODEL_CATALOG:MODEL_CATALOG,
    ASPECTS:ASPECTS,
    QUALITIES:QUALITIES,
    DURATIONS:DURATIONS,
    OUTPUT_NODE_ID:OUTPUT_NODE_ID,
    OUTPUT_FILENAME_PREFIX:OUTPUT_FILENAME_PREFIX,
    MAX_BATCH_SHOTS:MAX_BATCH_SHOTS,
    BATCH_TTL_MS:BATCH_TTL_MS,
  },
};
