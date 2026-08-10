#!/usr/bin/env node
'use strict';

/* Stage an explicitly authorized preview copy without touching promotion. */
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = process.env.AI_WORKSPACE_ROOT || path.resolve(ROOT, '..', 'AI');
var LORA_ROOT = path.join(AI_ROOT, 'ComfyUI', 'models', 'loras');
var SOURCE = process.env.AICS_ANIMA_NATSUME_PREVIEW_SOURCE || path.join(LORA_ROOT, 'shiki_natsume_v19_anima_e08.safetensors');
var DESTINATION = process.env.AICS_ANIMA_NATSUME_PREVIEW_DESTINATION || path.join(LORA_ROOT, 'shiki_natsume_v19_anima_preview.safetensors');
var EXPECTED_SHA256 = '389d3153ac05fbe0ea9bd74a9823e5cb8ee6fdc5ed0ecfd9e0b08ff9215036d2';

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  assert(fs.existsSync(SOURCE), 'preview source is missing: ' + SOURCE);
  assert(sha256(SOURCE) === EXPECTED_SHA256, 'preview source SHA-256 mismatch');
  fs.mkdirSync(path.dirname(DESTINATION), { recursive:true });
  if (fs.existsSync(DESTINATION)) {
    assert(sha256(DESTINATION) === EXPECTED_SHA256, 'existing preview destination SHA-256 mismatch');
  } else {
    var temporary = DESTINATION + '.' + process.pid + '.tmp';
    try {
      fs.copyFileSync(SOURCE, temporary, fs.constants.COPYFILE_EXCL);
      assert(sha256(temporary) === EXPECTED_SHA256, 'copied preview SHA-256 mismatch');
      fs.renameSync(temporary, DESTINATION);
    } finally {
      try { fs.unlinkSync(temporary); } catch (error) {}
    }
  }
  assert(sha256(DESTINATION) === EXPECTED_SHA256, 'preview destination SHA-256 mismatch after staging');
  console.log(JSON.stringify({ status:'staged', source:SOURCE, destination:DESTINATION, sha256:EXPECTED_SHA256 }, null, 2));
}

try { main(); } catch (error) { console.error(error && error.stack || error); process.exitCode = 1; }
