#!/usr/bin/env node
'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var loraDir = path.join(AI_ROOT, 'ComfyUI', 'models', 'loras');
var production = path.join(loraDir, 'ayachi_nene_v19_anima.safetensors');
var rejectedBackup = path.join(loraDir, 'ayachi_nene_v19_anima_e45_rejected.safetensors');
var rejectedSource = path.join(AI_ROOT, 'OneTrainer', 'output', 'ayachi_nene_v19_anima.safetensors');
var selectedSource = path.join(
  AI_ROOT,
  'OneTrainer',
  'workspace',
  'ayachi_nene_v18_wd14_curated',
  'save',
  'ayachi_nene_v19_anima2026-08-08_14-13-17-save-1100-20-0.safetensors'
);

function sha256(file) {
  var hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function assertFile(file, label) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(label + ' is missing: ' + file);
  }
}

function main() {
  assertFile(rejectedSource, 'Preserved epoch 45 output');
  assertFile(selectedSource, 'Selected epoch 20 checkpoint');
  assertFile(production, 'Production LoRA');

  var rejectedHash = sha256(rejectedSource);
  var selectedHash = sha256(selectedSource);
  var productionHash = sha256(production);
  if (productionHash === selectedHash) {
    console.log(JSON.stringify({ status:'already-promoted', production:production, sha256:selectedHash }, null, 2));
    return;
  }
  if (productionHash !== rejectedHash) {
    throw new Error('Production LoRA does not match the preserved epoch 45 output or selected epoch 20 checkpoint');
  }
  if (fs.existsSync(rejectedBackup)) {
    assertFile(rejectedBackup, 'Rejected checkpoint backup');
    if (sha256(rejectedBackup) !== rejectedHash) throw new Error('Rejected checkpoint backup hash mismatch');
    throw new Error('Rejected checkpoint backup already exists while production still points to epoch 45');
  }

  fs.renameSync(production, rejectedBackup);
  try {
    fs.linkSync(selectedSource, production);
    if (sha256(production) !== selectedHash) throw new Error('Promoted checkpoint hash mismatch');
  } catch (error) {
    if (fs.existsSync(production)) fs.unlinkSync(production);
    fs.renameSync(rejectedBackup, production);
    throw error;
  }

  console.log(JSON.stringify({
    status:'promoted',
    selectedEpoch:20,
    selectedStep:1100,
    production:production,
    productionSha256:selectedHash,
    rejectedBackup:rejectedBackup,
    rejectedSha256:rejectedHash,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
}
