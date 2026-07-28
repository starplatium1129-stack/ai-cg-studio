'use strict';

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var loadGatewayConfig = require('../../server/config').loadGatewayConfig;

var root = fs.mkdtempSync(path.join(os.tmpdir(), 'aics-gateway-token-'));

try {
  var initial = loadGatewayConfig(root, { DISABLE_TUNNEL:'1' });
  var restarted = loadGatewayConfig(root, { DISABLE_TUNNEL:'1' });
  assert.match(initial.TOKEN, /^[a-f0-9]{64}$/i, 'generated token must be 32 random bytes encoded as hex');
  assert.strictEqual(initial.TOKEN_SOURCE, 'runtime/state');
  assert.strictEqual(restarted.TOKEN, initial.TOKEN, 'gateway token must survive a restart');
  assert.strictEqual(
    fs.readFileSync(initial.RUNTIME.gatewayToken, 'utf8').trim(), initial.TOKEN,
    'generated gateway token must be persisted in runtime/state',
  );

  var override = loadGatewayConfig(root, { TOKEN:'operator-defined-token', DISABLE_TUNNEL:'1' });
  assert.strictEqual(override.TOKEN, 'operator-defined-token', 'TOKEN environment variable must override persisted token');
  assert.strictEqual(override.TOKEN_SOURCE, 'environment');
  assert.strictEqual(
    loadGatewayConfig(root, { DISABLE_TUNNEL:'1' }).TOKEN, initial.TOKEN,
    'an environment override must not replace the persisted share token',
  );

  fs.writeFileSync(initial.RUNTIME.gatewayToken, 'invalid token\n', 'utf8');
  var repaired = loadGatewayConfig(root, { DISABLE_TUNNEL:'1' });
  assert.match(repaired.TOKEN, /^[a-f0-9]{64}$/i, 'invalid persisted token must be replaced safely');
  assert.notStrictEqual(repaired.TOKEN, initial.TOKEN, 'invalid token must not be reused');
  assert.strictEqual(fs.readFileSync(initial.RUNTIME.gatewayToken, 'utf8').trim(), repaired.TOKEN);
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}

console.log('Gateway token persistence tests passed.');
