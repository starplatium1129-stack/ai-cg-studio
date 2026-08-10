#!/usr/bin/env node
'use strict';

/* Promotion is intentionally impossible without an explicit passing audit. */
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var MATRIX = process.env.AICS_NATSUME_V19_MATRIX_DIR || path.join(AI_ROOT, 'Reviews', 'AnimaNatsumeV19ProductMatrix', '2026-08-09');
var AUDIT = path.join(MATRIX, 'manual-audit.json');
var TRAIN_SAVE = path.join(AI_ROOT, 'OneTrainer', 'workspace', 'shiki_natsume_v19_anima_scientific_a', 'save');
var LORA_ROOT = path.join(AI_ROOT, 'ComfyUI', 'models', 'loras');
var DESTINATION = path.join(LORA_ROOT, 'shiki_natsume_v19_anima.safetensors');
var PREVIOUS = path.join(AI_ROOT, 'Data', 'Models', 'Lora', 'shiki_natsume_v18_wd14.safetensors');

function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

function main() {
  assert(fs.existsSync(AUDIT), 'manual-audit.json is required');
  var audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
  assert(audit.decision === 'promote', 'manual audit decision is not promote');
  assert(audit.hardGates && audit.hardGates.criticalIdentityAnatomyExtraPerson === 0, 'critical failure gate is not zero');
  assert(audit.hardGates.safeLeakage === 0 && audit.hardGates.r18OnlyOnRequest === true, 'safety gate failed');
  assert(audit.hardGates.ordinaryFullBody === '3/3' && audit.hardGates.qipaoAtLeast === '2/3' && audit.hardGates.r18FullBodyBetterThanV18 === '>=1/3', 'coverage gate failed');
  assert(audit.hardGates.rowsWon >= 12 && audit.hardGates.rowsLost <= 3, '18-row comparison gate failed');
  var selected = String(audit.selectedCheckpoint || '');
  assert(/^e(06|08|10|12|14)$/.test(selected), 'selected checkpoint must be one saved scientific candidate');
  var source = fs.readdirSync(TRAIN_SAVE).find(function (name) { return name.includes('-' + ({ e06:234, e08:312, e10:390, e12:468, e14:546 }[selected]) + '-' + selected.slice(1) + '-0') && name.endsWith('.safetensors'); });
  assert(source, 'selected checkpoint is missing');
  assert(fs.existsSync(PREVIOUS), 'v18 rollback artifact is missing');
  fs.mkdirSync(path.dirname(DESTINATION), { recursive:true });
  fs.copyFileSync(path.join(TRAIN_SAVE, source), DESTINATION);
  var output = { status:'promoted', selectedCheckpoint:selected, productionId:'L_NAT_V19_ANIMA', productionFile:DESTINATION, productionSha256:sha256(DESTINATION), previousProductionFile:PREVIOUS, previousProductionSha256:sha256(PREVIOUS) };
  fs.writeFileSync(path.join(MATRIX, 'promotion.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(output, null, 2));
}
try { main(); } catch (error) { console.error(error && error.stack || error); process.exitCode = 1; }
