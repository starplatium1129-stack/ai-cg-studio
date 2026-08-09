#!/usr/bin/env node
'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var selected = path.join(
  AI_ROOT,
  'OneTrainer',
  'workspace',
  'ayachi_nene_v20_anima_scientific_a',
  'save',
  'ayachi_nene_v20_anima_scientific_a2026-08-09_18-58-45-save-336-8-0.safetensors'
);
var loraDir = path.join(AI_ROOT, 'ComfyUI', 'models', 'loras');
var production = path.join(loraDir, 'ayachi_nene_v20_anima.safetensors');
var previousProduction = path.join(loraDir, 'ayachi_nene_v19_anima.safetensors');
var EXPECTED_SELECTED_SHA256 = 'e5c850dafe8fe8c9466e5378aa1192d3e4290b1d45cc46bb64a16fbb177c15ed';

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function assertFile(file, label) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(label + ' is missing: ' + file);
  }
}

function main() {
  assertFile(selected, 'Selected epoch 8 checkpoint');
  assertFile(previousProduction, 'Previous v19 production LoRA');
  var selectedHash = sha256(selected);
  if (selectedHash !== EXPECTED_SELECTED_SHA256) {
    throw new Error('Selected epoch 8 checkpoint hash mismatch: ' + selectedHash);
  }

  if (fs.existsSync(production)) {
    assertFile(production, 'V20 production LoRA');
    if (sha256(production) !== selectedHash) throw new Error('Existing V20 production LoRA hash mismatch');
    console.log(JSON.stringify({
      status:'already-promoted',
      selectedEpoch:8,
      selectedStep:336,
      production:production,
      productionSha256:selectedHash,
      previousProduction:previousProduction,
      previousProductionSha256:sha256(previousProduction),
    }, null, 2));
    return;
  }

  fs.linkSync(selected, production);
  if (sha256(production) !== selectedHash) {
    fs.unlinkSync(production);
    throw new Error('Promoted V20 checkpoint hash mismatch');
  }
  console.log(JSON.stringify({
    status:'promoted',
    selectedEpoch:8,
    selectedStep:336,
    production:production,
    productionSha256:selectedHash,
    previousProduction:previousProduction,
    previousProductionSha256:sha256(previousProduction),
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
}
