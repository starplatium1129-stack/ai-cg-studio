'use strict';

var express = require('express');
var createLive2dService = require('../services/live2d-service').createLive2dService;

function createLive2dRouter(config, dependencies) {
  dependencies = dependencies || {};
  var router = express.Router();
  var service = dependencies.live2d || createLive2dService({
    rootDir:config.LIVE2D_ROOT,
    characters:['nene', 'natsume']
  });

  router.get('/api/live2d-status', function (req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.json(service.status());
  });

  return { router:router, service:service };
}

module.exports = { createLive2dRouter:createLive2dRouter };
