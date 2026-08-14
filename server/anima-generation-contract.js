'use strict';

const ANIMA_DEFAULTS = Object.freeze({
  steps: 24,
  cfg: 3.0,
  sampler: 'res_multistep',
  scheduler: 'simple',
});

const KREA_DEFAULTS = Object.freeze({
  steps: 8,
  cfg: 1,
  sampler: 'euler',
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
});

const ALLOWED_INPUT_KEYS = Object.freeze([
  'prompt', 'negative', 'modelId', 'loraId', 'loraStrength',
  'width', 'height', 'steps', 'cfg', 'seed', 'character', 'styleLoraId',
  'hiresFix', 'hiresScale', 'hiresDenoise', 'hiresSteps',
]);

const CHARACTER_LORA_BINDINGS = Object.freeze({
  nene: 'L_NENE_V21_ANIMA',
  nene_b: 'L_NENE_V20B_ANIMA',
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
  KREA_DEFAULTS,
  MANUAL_REPAIR_PRESET,
  PARAMETER_LIMITS,
  ALLOWED_INPUT_KEYS,
  CHARACTER_LORA_BINDINGS,
  requiredCharacterForLora,
  validateTunableNumber,
};
