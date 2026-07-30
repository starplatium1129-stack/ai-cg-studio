'use strict';

/**
 * Training service process-contract tests.
 *
 * A fake child process verifies the fixed OneTrainer command surface without
 * launching Python or touching the real GPU workspace.
 */

var assert = require('assert');
var EventEmitter = require('events');
var fs = require('fs');
var os = require('os');
var path = require('path');
var trainingModule = require(path.join(__dirname, '..', '..', 'services', 'training-service'));

function writeFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, value || '', 'utf8');
}

function createFakeChild(pid) {
  var child = new EventEmitter();
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = function () { return true; };
  return child;
}

function safeRemove(temporaryRoot) {
  var resolved = path.resolve(temporaryRoot);
  var expectedParent = path.resolve(os.tmpdir()).toLowerCase();
  if (
    path.dirname(resolved).toLowerCase() !== expectedParent
    || path.basename(resolved).indexOf('ai-cg-training-service-') !== 0
  ) {
    throw new Error('Refusing to remove unexpected temporary path: ' + temporaryRoot);
  }
  fs.rmSync(resolved, { recursive:true, force:true });
}

function main() {
  var temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-cg-training-service-'));
  var aiRoot = path.join(temporaryRoot, 'AI');
  var runtimeRoot = path.join(temporaryRoot, 'runtime');
  var python = path.join(aiRoot, 'OneTrainer', 'venv', 'Scripts', 'python.exe');
  var script = path.join(aiRoot, 'OneTrainer', 'scripts', 'train.py');
  var config = path.join(
    aiRoot,
    'OneTrainer',
    'training_configs',
    'ayachi_nene_v16.json'
  );
  var image = path.join(aiRoot, 'Datasets', 'v16', 'nene', 'identity_anchors', 'anchor.png');
  var voicePython = path.join(aiRoot, 'GPT-SoVITS-env', 'python.exe');
  var voiceScript = path.join(aiRoot, 'Voice', 'tools', 'train_gpt_sovits_character.py');
  var voiceDataset = path.join(aiRoot, 'Voice', 'datasets-v16', 'nene');
  var voiceDatasetRoot = path.dirname(voiceDataset);
  var voiceTrainList = path.join(voiceDataset, 'train.list');
  var voiceEvalList = path.join(voiceDataset, 'eval.list');
  var voiceTestList = path.join(voiceDataset, 'test.list');
  var spawnCalls = [];
  var killed = [];
  var child = createFakeChild(4242);
  var voiceChild = createFakeChild(4343);
  var service = null;

  try {
    writeFile(python);
    writeFile(script, 'print("train")\n');
    writeFile(config, '{}\n');
    writeFile(image, 'not-a-real-png');
    writeFile(image.replace(/\.png$/, '.txt'), 'ayachi_nene, face_anchor\n');
    writeFile(voicePython);
    writeFile(voiceScript, 'print("train voice")\n');
    writeFile(path.join(aiRoot, 'GPT-SoVITS', '.keep'));
    writeFile(path.join(voiceDataset, 'wavs', 'sample.wav'), 'not-a-real-wav');
    writeFile(voiceTrainList, 'sample.wav|nene|ja|train\n');
    writeFile(voiceEvalList, 'eval.wav|nene|ja|eval\n');
    writeFile(voiceTestList, 'test.wav|nene|ja|test\n');

    service = trainingModule.createTrainingService({
      aiRoot:aiRoot,
      runtimeRoot:runtimeRoot,
      spawn:function (command, args, options) {
        spawnCalls.push({ command:command, args:args, options:options });
        return spawnCalls.length === 1 ? child : voiceChild;
      },
      killProcess:function (pid, handle) {
        killed.push({ pid:pid, child:handle });
      },
      now:(function () {
        var value = 1800000000000;
        return function () { value += 1000; return value; };
      }())
    });

    var overview = service.overview();
    assert.strictEqual(overview.workspace.available, true);
    assert.ok(overview.readyJobs.indexOf('lora-nene-v16') >= 0);
    assert.strictEqual(
      overview.datasets.find(function (item) { return item.id === 'lora-nene-v16'; }).images,
      1
    );
    var voiceSummary = overview.datasets.find(function (item) { return item.id === 'voice-nene'; });
    assert.ok(overview.readyJobs.indexOf('voice-nene') >= 0);
    assert.strictEqual(voiceSummary.trainSamples, 1);
    assert.strictEqual(voiceSummary.evalSamples, 1);
    assert.strictEqual(voiceSummary.testSamples, 1);

    var started = service.startJob('lora-nene-v16');
    assert.strictEqual(started.status, 'running');
    assert.strictEqual(started.pid, 4242);
    assert.strictEqual(spawnCalls.length, 1);
    assert.strictEqual(spawnCalls[0].command, python);
    assert.deepStrictEqual(spawnCalls[0].args, [script, '--config-path', config]);
    assert.strictEqual(spawnCalls[0].options.cwd, path.join(aiRoot, 'OneTrainer'));
    assert.strictEqual(spawnCalls[0].options.shell, false);
    assert.strictEqual(spawnCalls[0].options.windowsHide, true);
    assert.deepStrictEqual(spawnCalls[0].options.stdio, ['ignore', 'pipe', 'pipe']);

    child.stdout.emit(
      'data',
      Buffer.from(
        'epoch: 50%| 1/2\nstep: 25%| 1/4 [00:01<00:03, loss=0.1234]\n',
        'utf8'
      )
    );
    var running = service.getJob('lora-nene-v16');
    assert.strictEqual(running.progress.epoch, 1);
    assert.strictEqual(running.progress.epochs, 2);
    assert.strictEqual(running.progress.step, 1);
    assert.strictEqual(running.progress.steps, 4);
    assert.strictEqual(running.progress.stage, 'LoRA 训练');

    var logs = service.getLogs('lora-nene-v16', 0, 0);
    assert.ok(logs.text.indexOf('loss=0.1234') >= 0);
    assert.ok(logs.nextCursor > 0);
    assert.strictEqual(logs.reset, true);

    assert.throws(
      function () { service.startJob('lora-natsume-v16'); },
      function (error) {
        return error instanceof trainingModule.TrainingServiceError
          && error.code === 'TRAINING_BUSY'
          && error.status === 409;
      }
    );
    assert.throws(
      function () { service.startJob('../../arbitrary-command'); },
      function (error) {
        return error instanceof trainingModule.TrainingServiceError
          && error.code === 'UNKNOWN_JOB';
      }
    );

    var stopping = service.stopJob('lora-nene-v16');
    assert.strictEqual(stopping.status, 'stopping');
    assert.deepStrictEqual(killed, [{ pid:4242, child:child }]);
    child.emit('close', null);
    var stopped = service.getJob('lora-nene-v16');
    assert.strictEqual(stopped.status, 'stopped');
    assert.ok(stopped.finishedAt > stopped.startedAt);

    fs.unlinkSync(voiceTestList);
    var missingTestSplit = service.getJob('voice-nene');
    assert.strictEqual(missingTestSplit.ready, false);
    assert.ok(missingTestSplit.missing.some(function (item) { return item.indexOf('封闭测试') >= 0; }));
    writeFile(voiceTestList, 'test.wav|nene|ja|test\n');

    var startedVoice = service.startJob('voice-nene');
    assert.strictEqual(startedVoice.status, 'running');
    assert.strictEqual(startedVoice.pid, 4343);
    assert.strictEqual(spawnCalls.length, 2);
    assert.strictEqual(spawnCalls[1].command, voicePython);
    assert.deepStrictEqual(spawnCalls[1].args, [
      voiceScript,
      '--character',
      'nene',
      '--version',
      'v2ProPlus',
      '--dataset-root',
      voiceDatasetRoot,
      '--experiment-suffix',
      'voice-v16'
    ]);
    assert.strictEqual(spawnCalls[1].options.cwd, path.join(aiRoot, 'Voice'));
    assert.strictEqual(spawnCalls[1].options.shell, false);
    voiceChild.emit('close', 0);
    assert.strictEqual(service.getJob('voice-nene').status, 'completed');

    console.log(
      'Training service tests passed: LoRA/voice readiness, fixed argv, shell:false, ' +
      'progress/logs, busy guard, unknown-id rejection, and stop lifecycle'
    );
  } finally {
    if (service) service.close();
    safeRemove(temporaryRoot);
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
