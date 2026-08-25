'use strict';

// 首轮采样器：用户指示改 euler_ancestral（柔和多样）；放大二阶段采样器不再跟随首轮，
// 冻结为 HIRES_SAMPLER（res_multistep + HIRES_SCHEDULER sgm_uniform = 用户实测组合）。
const ANIMA_DEFAULTS = Object.freeze({
  steps: 30,
  cfg: 4.5,
  sampler: 'euler_ancestral',
  scheduler: 'simple',
});

// 用户实测转正（固定 seed A/B，TeaCache 经实测排除为变量）：放大二阶段
// scheduler 单独固定 sgm_uniform（官方参数组同款排布，低 denoise 补绘细节更优）。
// 二阶段采样器同步冻结为 HIRES_SAMPLER（res_multistep）：首轮改 euler_ancestral
// 后不再跟随首轮，保住 res_multistep + sgm_uniform 实测组合。
const HIRES_SCHEDULER = 'sgm_uniform';
const HIRES_SAMPLER = 'res_multistep';

const KREA_DEFAULTS = Object.freeze({
  steps: 8,
  cfg: 1,
  // 2026-08-23 Krea 链路替换：采样器随社区增强链路固定 er_sde（与 buildWorkflow
  // 内写死的社区验证配对一致），元数据与 models 接口 defaults 必须反映真实采样器。
  sampler: 'er_sde',
  scheduler: 'simple',
});

const MANUAL_REPAIR_PRESET = Object.freeze({
  steps: 30,
  cfg: 4.5,
  sampler: ANIMA_DEFAULTS.sampler,
  scheduler: ANIMA_DEFAULTS.scheduler,
});

const PARAMETER_LIMITS = Object.freeze({
  steps: Object.freeze({ min: 1, max: 60, integer: true }),
  cfg: Object.freeze({ min: 0.5, max: 10, integer: false }),
  seed: Object.freeze({ min: 0, max: Number.MAX_SAFE_INTEGER, integer: true }),
  teaCacheThresh: Object.freeze({ min: 0.0, max: 1.0, integer: false }),
  denoisingStrength: Object.freeze({ min: 0.1, max: 1.0, integer: false }),
  growMaskBy: Object.freeze({ min: 0, max: 32, integer: true }),
  maskThreshold: Object.freeze({ min: 0.05, max: 0.95, integer: false }),
});

const ALLOWED_INPUT_KEYS = Object.freeze([
  'prompt', 'negative', 'modelId', 'loraId', 'loraStrength',
  'width', 'height', 'steps', 'cfg', 'seed', 'character', 'styleLoraId',
  'hiresFix', 'hiresScale', 'hiresDenoise', 'hiresSteps', 'hiresUpscaler',
  'teaCache', 'teaCacheThresh',
  'initImage', 'maskImage', 'maskPrompt', 'maskThreshold', 'denoisingStrength', 'growMaskBy',
]);

const CHARACTER_LORA_BINDINGS = Object.freeze({
  nene: 'L_NENE_V21_ANIMA',
  natsume: 'L_NAT_V21_ANIMA',
});

function requiredCharacterForLora(loraId) {
  return Object.keys(CHARACTER_LORA_BINDINGS)
    .find(character => CHARACTER_LORA_BINDINGS[character] === loraId) || '';
}

function validateTunableNumber(value, name) {
  const limit = PARAMETER_LIMITS[name];
  if (!limit || typeof value !== 'number' || !Number.isFinite(value)
    || (limit.integer && !Number.isInteger(value))
    || value < limit.min || value > limit.max) {
    return false;
  }
  return true;
}

module.exports = {
  ANIMA_DEFAULTS,
  HIRES_SAMPLER,
  HIRES_SCHEDULER,
  KREA_DEFAULTS,
  MANUAL_REPAIR_PRESET,
  PARAMETER_LIMITS,
  ALLOWED_INPUT_KEYS,
  CHARACTER_LORA_BINDINGS,
  requiredCharacterForLora,
  validateTunableNumber,
};
