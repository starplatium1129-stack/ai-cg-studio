'use strict';

var express = require('express');
var path = require('path');
var security = require('../server/security');
var envelope = require('../server/http-envelope');
var trainingModule = require('../services/training-service');

var JOB_IDS = trainingModule.JOB_IDS;

function idFromRequest(req) {
  var value = req.params && req.params.id;
  if (!value && req.body && typeof req.body.id === 'string') value = req.body.id;
  if (!value && req.body && typeof req.body.kind === 'string') {
    var kind = req.body.kind;
    if (kind === 'lora-nene' || kind === 'nene' || kind === 'lora-nene-v16' || kind === 'lora-nene-v18') value = 'lora-nene-v18';
    if (kind === 'lora-natsume' || kind === 'natsume' || kind === 'lora-natsume-v16' || kind === 'lora-natsume-v18') value = 'lora-natsume-v18';
    if (kind === 'voice-nene' || kind === 'voice-nene-v16') value = 'voice-nene';
    if (kind === 'voice-natsume' || kind === 'voice-natsume-v16') value = 'voice-natsume';
  }
  return value;
}

function serviceError(res, error) {
  if (error instanceof trainingModule.TrainingServiceError) {
    return envelope.fail(res, error.status, error.message, {
      code: error.code,
      detail: error.detail || undefined
    });
  }
  console.error('Training route error:', error && error.stack || error);
  return envelope.fail(res, 500, '训练服务暂时不可用', { code: 'TRAINING_INTERNAL' });
}

function createTrainingRouter(config, dependencies) {
  dependencies = dependencies || {};
  var aiRoot = config.AI_WORKSPACE_ROOT || path.resolve(config.ROOT_DIR, '..', 'AI');
  var service = dependencies.training || trainingModule.createTrainingService({
    aiRoot: aiRoot,
    runtimeRoot: config.RUNTIME_ROOT || path.join(config.ROOT_DIR, 'runtime')
  });
  var router = express.Router();

  router.use('/api/training', security.localOnly);
  router.use('/api/training/jobs', express.json({ limit: '16kb' }));

  router.get('/api/training/overview', function (req, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return envelope.ok(res, service.overview());
    } catch (error) {
      return serviceError(res, error);
    }
  });

  router.get('/api/training/datasets', function (req, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return envelope.ok(res, service.listDatasets());
    } catch (error) {
      return serviceError(res, error);
    }
  });

  router.get('/api/training/datasets/:id/preview', function (req, res) {
    try {
      var preview = service.getDatasetPreview(req.params.id, 'signature');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Type', preview.contentType);
      res.setHeader('Content-Disposition', 'inline');
      return res.sendFile(preview.filePath);
    } catch (error) {
      return serviceError(res, error);
    }
  });

  router.get('/api/training/datasets/:id/adult-preview', function (req, res) {
    try {
      var preview = service.getDatasetPreview(req.params.id, 'adult');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Type', preview.contentType);
      res.setHeader('Content-Disposition', 'inline');
      return res.sendFile(preview.filePath);
    } catch (error) {
      return serviceError(res, error);
    }
  });

  router.get('/api/training/jobs', function (req, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return envelope.ok(res, service.listJobs());
    } catch (error) {
      return serviceError(res, error);
    }
  });

  router.get('/api/training/jobs/:id', function (req, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return envelope.ok(res, { job: service.getJob(idFromRequest(req)) });
    } catch (error) {
      return serviceError(res, error);
    }
  });

  router.get('/api/training/jobs/:id/config', function (req, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return envelope.ok(res, { config: service.getJobConfig(idFromRequest(req)) });
    } catch (error) {
      return serviceError(res, error);
    }
  });

  function logsHandler(req, res) {
    // 2026-08-16 审计：getLogs 已异步化（读前先 flush 待写日志缓冲）。
    res.setHeader('Cache-Control', 'no-store');
    service.getLogs(
      idFromRequest(req),
      req.query && req.query.cursor,
      req.query && req.query.version
    ).then(function (logs) {
      return envelope.ok(res, logs);
    }).catch(function (error) {
      return serviceError(res, error);
    });
  }

  router.get('/api/training/jobs/:id/logs', logsHandler);
  router.get('/api/training/logs/:id', logsHandler);

  function startHandler(req, res) {
    try {
      var id = idFromRequest(req);
      if (!id || JOB_IDS.indexOf(id) === -1) {
        return envelope.fail(res, 400, '请选择一个受支持的训练任务', { code: 'UNKNOWN_JOB' });
      }
      var overrides = req.body && typeof req.body === 'object' ? req.body.overrides : undefined;
      var dataset = req.body && typeof req.body === 'object' ? req.body.dataset : undefined;
      return envelope.ok(res, { job: service.startJob(id, overrides, dataset) });
    } catch (error) {
      return serviceError(res, error);
    }
  }

  router.post('/api/training/jobs', startHandler);
  router.post('/api/training/jobs/:id/start', startHandler);

  router.post('/api/training/jobs/:id/stop', function (req, res) {
    try {
      return envelope.ok(res, { job: service.stopJob(idFromRequest(req)) });
    } catch (error) {
      return serviceError(res, error);
    }
  });

  return {
    router: router,
    service: service,
    close: function () { service.close(); }
  };
}

module.exports = { createTrainingRouter: createTrainingRouter };
