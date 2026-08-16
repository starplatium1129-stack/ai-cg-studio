'use strict';
const { test } = require('node:test');

/**
 * Training service process-contract tests.
 *
 * A fake child process verifies the fixed OneTrainer command surface without
 * launching Python or touching the real GPU workspace.
 */

test('training-service', async () => {
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

async function main() {
  var temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-cg-training-service-'));
  var aiRoot = path.join(temporaryRoot, 'AI');
  var runtimeRoot = path.join(temporaryRoot, 'runtime');
  var python = path.join(aiRoot, 'OneTrainer', 'venv', 'Scripts', 'python.exe');
  var script = path.join(aiRoot, 'OneTrainer', 'scripts', 'train.py');
  var config = path.join(
    aiRoot,
    'OneTrainer',
    'training_configs',
    'ayachi_nene_v18_wd14_curated.json'
  );
  var image = path.join(aiRoot, 'Datasets', 'Characters', 'Ayachi_Nene', 'V18_WD14_Curated', 'identity_anchors', 'anchor.png');
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
    var recoveredService = null;

  try {
    writeFile(python);
    writeFile(script, 'print("train")\n');
    writeFile(config, JSON.stringify({
      __version: 11,
      training_method: 'LORA',
      epochs: 143,
      batch_size: 4,
      gradient_accumulation_steps: 1,
      lora_rank: 32,
      lora_alpha: 32,
      learning_rate: 3e-6,
      unet: { __version: 0, learning_rate: 0.0001 },
      text_encoder: { __version: 0, learning_rate: 3e-5, stop_training_after: 30 }
    }, null, 2));
    writeFile(image, 'not-a-real-png');
    writeFile(image.replace(/\.png$/, '.txt'), 'ayachi_nene, face_anchor\n');
    writeFile(path.join(aiRoot, 'Datasets', 'Characters', 'Ayachi_Nene', 'V18_Unified', 'identity', 'alt.png'), 'x');
    writeFile(path.join(aiRoot, 'Datasets', 'Characters', 'Ayachi_Nene', 'V18_Unified', 'identity', 'alt.txt'), 'ayachi_nene\n');
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
        return command.indexOf('GPT-SoVITS') >= 0 ? voiceChild : child;
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
    assert.ok(overview.readyJobs.indexOf('lora-nene-v18') >= 0);
    assert.strictEqual(
      overview.datasets.find(function (item) { return item.id === 'lora-nene-v18'; }).images,
      1
    );
    var voiceSummary = overview.datasets.find(function (item) { return item.id === 'voice-nene'; });
    assert.ok(overview.readyJobs.indexOf('voice-nene') >= 0);
    assert.strictEqual(voiceSummary.trainSamples, 1);
    assert.strictEqual(voiceSummary.evalSamples, 1);
    assert.strictEqual(voiceSummary.testSamples, 1);

    var loraJob = overview.jobs.find(function (item) { return item.id === 'lora-nene-v18'; });
    assert.strictEqual(loraJob.selectedDataset, 'V18_WD14_Curated');
    assert.strictEqual(loraJob.datasetOptions.length, 2);
    var unified = loraJob.datasetOptions.find(function (item) { return item.id === 'V18_Unified'; });
    assert.strictEqual(unified.images, 1);
    assert.strictEqual(unified.captions, 1);
    assert.strictEqual(unified.ready, true);
    assert.strictEqual(
      service.getJob('voice-nene').datasetOptions.length,
      0,
      'voice jobs must not expose image dataset options'
    );

    var started = service.startJob('lora-nene-v18');
    assert.strictEqual(started.status, 'running');
    assert.strictEqual(started.pid, 4242);
    assert.strictEqual(spawnCalls.length, 1);
    assert.strictEqual(spawnCalls[0].command, python);
    assert.deepStrictEqual(spawnCalls[0].args, [script, '--config-path', config]);
    assert.strictEqual(spawnCalls[0].options.cwd, path.join(aiRoot, 'OneTrainer'));
    assert.strictEqual(spawnCalls[0].options.shell, false);
    assert.strictEqual(spawnCalls[0].options.windowsHide, true);
    assert.deepStrictEqual(spawnCalls[0].options.stdio, ['ignore', 'pipe', 'pipe']);

    var jobConfig = service.getJobConfig('lora-nene-v18');
    assert.strictEqual(jobConfig.available, true);
    assert.strictEqual(jobConfig.fields.epochs, 143);
    assert.strictEqual(jobConfig.fields.batch_size, 4);
    assert.strictEqual(jobConfig.fields.lora_rank, 32);
    assert.strictEqual(jobConfig.fields.unet_learning_rate, 0.0001);
    assert.strictEqual(jobConfig.fields.text_encoder_stop_epoch, 30);
    assert.deepStrictEqual(jobConfig.recommended, jobConfig.fields);
    var voiceConfig = service.getJobConfig('voice-nene');
    assert.strictEqual(voiceConfig.available, false);

    child.stdout.emit(
      'data',
      Buffer.from(
        'epoch: 50%| 1/2\nstep: 25%| 1/4 [00:01<00:03, loss=0.1234]\n',
        'utf8'
      )
    );
    var running = service.getJob('lora-nene-v18');
    assert.strictEqual(running.progress.epoch, 1);
    assert.strictEqual(running.progress.epochs, 2);
    assert.strictEqual(running.progress.step, 1);
    assert.strictEqual(running.progress.steps, 4);
    assert.strictEqual(running.progress.stage, 'LoRA 训练');

    // 2026-08-16 审计：getLogs 已异步化（读前先 flush 待写缓冲）。
    var logs = await service.getLogs('lora-nene-v18', 0, 0);
    assert.ok(logs.text.indexOf('loss=0.1234') >= 0);
    assert.ok(logs.nextCursor > 0);
    assert.strictEqual(logs.reset, true);

    assert.throws(
      function () { service.startJob('lora-natsume-v18'); },
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

    var stopping = service.stopJob('lora-nene-v18');
    assert.strictEqual(stopping.status, 'stopping');
    assert.deepStrictEqual(killed, [{ pid:4242, child:child }]);
    child.emit('close', null);
    var stopped = service.getJob('lora-nene-v18');
    assert.strictEqual(stopped.status, 'stopped');
    assert.ok(stopped.finishedAt > stopped.startedAt);

    var restarted = service.startJob('lora-nene-v18', { epochs: 100, batch_size: 2, unet_learning_rate: 5e-4 });
    assert.strictEqual(restarted.status, 'running');
    assert.strictEqual(spawnCalls.length, 2);
    var planArg = spawnCalls[1].args[2];
    assert.ok(path.dirname(planArg).indexOf(path.join('training_configs', '.ui_plans')) >= 0);
    var planConfig = JSON.parse(fs.readFileSync(planArg, 'utf8'));
    assert.strictEqual(planConfig.epochs, 100);
    assert.strictEqual(planConfig.batch_size, 2);
    assert.strictEqual(planConfig.unet.learning_rate, 5e-4);
    assert.strictEqual(planConfig.text_encoder.learning_rate, 3e-5);
    assert.strictEqual(planConfig.lora_rank, 32);
    var originalConfig = JSON.parse(fs.readFileSync(config, 'utf8'));
    assert.strictEqual(originalConfig.epochs, 143);
    service.stopJob('lora-nene-v18');
    child.emit('close', null);
    assert.throws(
      function () { service.startJob('lora-nene-v18', { epochs: 99999 }); },
      function (error) {
        return error instanceof trainingModule.TrainingServiceError
          && error.code === 'OVERRIDE_OUT_OF_RANGE'
          && error.status === 400;
      }
    );
    assert.throws(
      function () { service.startJob('lora-nene-v18', { learning_rate: 1e-4 }); },
      function (error) {
        return error instanceof trainingModule.TrainingServiceError
          && error.code === 'UNKNOWN_OVERRIDE'
          && error.status === 400;
      }
    );
    assert.throws(
      function () { service.startJob('lora-nene-v18', { epochs: 'many' }); },
      function (error) {
        return error instanceof trainingModule.TrainingServiceError
          && error.code === 'INVALID_OVERRIDE'
          && error.status === 400;
      }
    );
    assert.throws(
      function () { service.startJob('lora-nene-v18', {}, 'not-a-real-dataset'); },
      function (error) {
        return error instanceof trainingModule.TrainingServiceError
          && error.code === 'UNKNOWN_DATASET'
          && error.status === 400;
      }
    );
    var startedWithDataset = service.startJob('lora-nene-v18', {}, 'V18_Unified');
    assert.strictEqual(startedWithDataset.status, 'running');
    service.stopJob('lora-nene-v18');
    child.emit('close', null);

    fs.unlinkSync(voiceTestList);
    var missingTestSplit = service.getJob('voice-nene');
    assert.strictEqual(missingTestSplit.ready, false);
    assert.ok(missingTestSplit.missing.some(function (item) { return item.indexOf('封闭测试') >= 0; }));
    writeFile(voiceTestList, 'test.wav|nene|ja|test\n');

    var startedVoice = service.startJob('voice-nene');
    assert.strictEqual(startedVoice.status, 'running');
    assert.strictEqual(startedVoice.pid, 4343);
    assert.strictEqual(spawnCalls.length, 4);
    assert.strictEqual(spawnCalls[3].command, voicePython);
    assert.deepStrictEqual(spawnCalls[3].args, [
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
    assert.strictEqual(spawnCalls[3].options.cwd, path.join(aiRoot, 'Voice'));
    assert.strictEqual(spawnCalls[3].options.shell, false);
    voiceChild.emit('close', 0);
    assert.strictEqual(service.getJob('voice-nene').status, 'completed');

    // 2026-08-16 用户决策：优雅关闭网关 = 终止训练——close() 必须 kill 在跑子进程，
    // 并同步落盘剩余日志缓冲（异步批量写不丢尾巴）。
    var closeKillRun = service.startJob('lora-nene-v18');
    assert.strictEqual(closeKillRun.status, 'running');
    child.stdout.emit('data', Buffer.from('close tail marker line\n', 'utf8'));
    service.close();
    assert.ok(
      killed.some(function (entry) { return entry.pid === 4242; }),
      'close() must kill running training children (graceful shutdown = stop training)'
    );
    var closeLog = fs.readFileSync(
      path.join(runtimeRoot, 'training', 'logs', 'lora-nene-v18.log'),
      'utf8'
    );
    assert.ok(
      closeLog.indexOf('close tail marker line') >= 0,
      'close() must drain pending log buffer synchronously'
    );
    service = null;

    // 网关重启时旧进程可能仍然存在；旧服务没有 child 句柄，后续必须在查询时
    // 重新校准，而不能让 jobs.json 永久停在 running。
    var stateFile = path.join(runtimeRoot, 'training', 'jobs.json');
    var persisted = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    persisted.jobs['lora-nene-v18'] = {
      id:'lora-nene-v18', status:'running', pid:9999, startedAt:1800000000000,
      finishedAt:0, exitCode:null, error:'', stopRequested:false, runCount:8,
      logVersion:1, progress:{ stage:'LoRA 训练', message:'旧网关已重启', percent:42 },
    };
    fs.writeFileSync(stateFile, JSON.stringify(persisted), 'utf8');
    var processPresent = true;
    recoveredService = trainingModule.createTrainingService({
      aiRoot:aiRoot,
      runtimeRoot:runtimeRoot,
      isProcessAlive:function () { return processPresent; },
      now:function () { return 1800000005000; },
    });
    assert.strictEqual(recoveredService.getJob('lora-nene-v18').status, 'running');
    processPresent = false;
    var reconciled = recoveredService.getJob('lora-nene-v18');
    assert.strictEqual(reconciled.status, 'failed');
    assert.strictEqual(reconciled.progress.stage, '进程已丢失');
    assert.ok(reconciled.error.indexOf('未发现训练进程') >= 0);
    recoveredService.close();
    recoveredService = null;

    console.log(
      'Training service tests passed: LoRA/voice readiness, fixed argv, shell:false, ' +
      'progress/logs, busy guard, unknown-id rejection, stop lifecycle, ' +
      'whitelisted overrides (config copies, ranges, unknown keys), restart reconciliation'
    );
  } finally {
    if (service) service.close();
    if (recoveredService) recoveredService.close();
    safeRemove(temporaryRoot);
  }
}

await main();
});
