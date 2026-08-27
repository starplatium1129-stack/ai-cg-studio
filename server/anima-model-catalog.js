'use strict';

/**
 * server/anima-model-catalog.js — Anima/Krea2 模型、LoRA 与角色白名单数据表。
 *
 * 2026-08-21 从 routes/anima.js 头部原样外移（纯数据，零逻辑）：路由文件此前
 * 「工作流构建 + 参数校验 + 任务状态机 + 路由」四合一超过 1300 行，数据表独立
 * 后路由层只剩引擎与契约逻辑。修改白名单/默认参数仍只需改这里一处。
 */

var generationContract = require('./anima-generation-contract');

var MODELS = Object.freeze({
  'anima-base-v1.0': { file:'anima-base-v1.0.safetensors', label:'Anima Base v1.0', family:'anima', profileId:'anima_base_v10', steps:generationContract.ANIMA_DEFAULTS.steps, cfg:generationContract.ANIMA_DEFAULTS.cfg, sampler:generationContract.ANIMA_DEFAULTS.sampler, scheduler:generationContract.ANIMA_DEFAULTS.scheduler, sizes:['832x1216','960x1536','1024x1024','1216x832'] },
  'anima-aesthetic-v1.1': { file:'anima-aesthetic-v1.1.safetensors', label:'Anima Aesthetic v1.1', family:'anima', profileId:'anima_aesthetic_v11', steps:generationContract.ANIMA_DEFAULTS.steps, cfg:generationContract.ANIMA_DEFAULTS.cfg, sampler:generationContract.ANIMA_DEFAULTS.sampler, scheduler:generationContract.ANIMA_DEFAULTS.scheduler, sizes:['832x1216','1024x1024','1216x832'], noLora:true },
  // 2026-08-22 接入：Anima 2.9B Preview v1（Gazingstars123 层扩展动漫大模型，40 层 DiT）。
  // 官方重点推荐高分辨率：832x1216 (标准竖版)、1152x1536 (高清大竖版)、1536x1152 (高清大横版)、1024x1024 (正方形)、1216x832 (横版)
  'anima-2.9b-preview-v1': { file:'Anima-2.9B-preview-v1.safetensors', label:'Anima 2.9B Preview v1', family:'anima', profileId:'anima_29b_preview_v1', steps:generationContract.ANIMA_DEFAULTS.steps, cfg:generationContract.ANIMA_DEFAULTS.cfg, sampler:generationContract.ANIMA_DEFAULTS.sampler, scheduler:generationContract.ANIMA_DEFAULTS.scheduler, sizes:['832x1216','960x1536','1152x1536','1536x1152','1024x1024','1216x832'], noLora:true },
  // 2026-08-15 用户决策接入：AnimaYume v1.0（circlestone 社区基座微调，Civitai 2385278）。
  // noLora:true = 无 LoRA 创作模式可用；若显式传 loraId，仍走 LORAS 兼容表校验
  // （宁宁/夏目 v21 已声明兼容，用户实测自担效果）。
  'anima-yume-v1.0': { file:'AnimaYume_v10_final_base.safetensors', label:'Anima Yume v1.0', family:'anima', profileId:'anima_yume_v10', steps:generationContract.ANIMA_DEFAULTS.steps, cfg:generationContract.ANIMA_DEFAULTS.cfg, sampler:generationContract.ANIMA_DEFAULTS.sampler, scheduler:generationContract.ANIMA_DEFAULTS.scheduler, sizes:['832x1216','960x1536','1024x1024','1216x832'], noLora:true },
  'krea2-turbo-fp8': { file:'krea2_turbo_fp8_scaled.safetensors', label:'Krea 2 Turbo', family:'krea2', profileId:'krea2_turbo_fp8', steps:generationContract.KREA_DEFAULTS.steps, cfg:generationContract.KREA_DEFAULTS.cfg, sampler:generationContract.KREA_DEFAULTS.sampler, scheduler:generationContract.KREA_DEFAULTS.scheduler, sizes:['1024x1024','1024x1536','1536x1024'], noLora:true, rebalance:{ preset:'standard', multiplier:1.1, normalizeTaps:false } }
});

var PROFILE_BY_MODEL = Object.freeze({
  'anima-base-v1.0':'anima_base_v10',
  'anima-aesthetic-v1.1':'anima_aesthetic_v11',
  'anima-yume-v1.0':'anima_yume_v10',
  'anima-2.9b-preview-v1':'anima_29b_preview_v1',
  'krea2-turbo-fp8':'krea2_turbo_fp8'
});

var LORAS = Object.freeze({
  L_NENE_V21_ANIMA: {
    file:'ayachi_nene_v21_anima.safetensors',
    name:'ayachi_nene_v21_anima',
    character:'nene',
    compatibleModels:['anima-base-v1.0', 'anima-aesthetic-v1.1', 'anima-yume-v1.0', 'anima-2.9b-preview-v1'],
    minStrength:0.65,
    maxStrength:1
  },
  L_NAT_V21_ANIMA: {
    file:'shiki_natsume_v21_anima.safetensors',
    name:'shiki_natsume_v21_anima',
    character:'natsume',
    compatibleModels:['anima-base-v1.0', 'anima-aesthetic-v1.1', 'anima-yume-v1.0', 'anima-2.9b-preview-v1'],
    minStrength:0.65,
    maxStrength:1
  }
});

var KREA_STYLE_LORAS = Object.freeze({
  darkbrush:{ file:'krea2_darkbrush.safetensors', trigger:'monochrome ink wash style' }, dotmatrix:{ file:'krea2_dotmatrix.safetensors', trigger:'monochrome stippling style' },
  kidsdrawing:{ file:'krea2_kidsdrawing.safetensors', trigger:'naive expressive sketch style' }, neondrip:{ file:'krea2_neondrip.safetensors', trigger:'textured abstract style' },
  rainywindow:{ file:'krea2_rainywindow.safetensors', trigger:'rainy window style' }, retroanime:{ file:'krea2_retroanime.safetensors', trigger:'purple retro anime style' },
  softwatercolor:{ file:'krea2_softwatercolor.safetensors', trigger:'art deco watercolor style' }, sunsetblur:{ file:'krea2_sunsetblur.safetensors', trigger:'ethereal motion blur style' },
  vintagetarot:{ file:'krea2_vintagetarot.safetensors', trigger:'vintage tarot style' }
});

var CHARACTERS = Object.freeze({
  nene: { id:'nene', label:'绫地宁宁', loraId:'L_NENE_V21_ANIMA' },
  natsume: { id:'natsume', label:'四季夏目', loraId:'L_NAT_V21_ANIMA' }
});

module.exports = {
  MODELS: MODELS,
  PROFILE_BY_MODEL: PROFILE_BY_MODEL,
  LORAS: LORAS,
  KREA_STYLE_LORAS: KREA_STYLE_LORAS,
  CHARACTERS: CHARACTERS,
};
