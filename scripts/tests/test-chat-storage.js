'use strict';

const assert = require('assert');
const core = require('../../src/utils/chatStorageCore.ts');

const { test } = require('node:test');

test("Chat storage tests passed: migration, durable local configuration, and damaged recovery", () => {
const options = {
  characterIds:['nene', 'natsume'],
  maxMessages:2,
  version:3,
  createMessageId:() => 'generated-id',
};

const migrated = core.normalizeChatStorage({
  version:1,
  activeCharacter:'natsume',
  provider:'api',
  model:'legacy-local-model',
  api:{
    baseUrl:'https://legacy.example/v1',
    model:'legacy-api-model',
    apiKey:' legacy-secret ',
    headers:{ Authorization:'Bearer legacy-secret' },
  },
  histories:{
    natsume:[
      { role:'user', content:'first' },
      { role:'assistant', content:'second', id:'legacy-mid' },
      { role:'assistant', content:'third' },
      { role:'system', content:'must be discarded' },
    ],
  },
  settings:{
    drafts:{ natsume:' remembered draft ' },
    password:'must-not-survive',
  },
}, '', options);

assert.strictEqual(migrated.state.version, 3, 'legacy chat storage must migrate to the current version');
assert.strictEqual(migrated.state.active, 'natsume');
assert.strictEqual(migrated.state.settings.provider, 'api');
assert.strictEqual(migrated.state.settings.apiBaseUrl, 'https://legacy.example/v1');
assert.strictEqual(migrated.state.settings.apiModel, 'legacy-api-model');
assert.strictEqual(migrated.state.settings.live2dOutfit, 'school');
assert.strictEqual(migrated.state.settings.drafts.natsume, 'remembered draft');
assert.deepStrictEqual(migrated.state.histories.natsume.map(message => message.content), ['second', 'third']);
assert.strictEqual(migrated.state.histories.natsume[0].mid, 'legacy-mid');
assert.strictEqual(migrated.state.histories.natsume[1].mid, 'generated-id');
assert.strictEqual(migrated.state.settings.apiKey, 'legacy-secret');
assert.strictEqual(migrated.state.settings.webSearchEnabled, true);
assert.strictEqual(migrated.migratedApiKey, '');

const durable = core.serializeChatStorage(migrated.state);
assert(/"apiKey":"legacy-secret"/.test(durable),
  'explicitly persisted local chat configuration must retain its API key');
assert(!/password|Authorization|headers/.test(durable),
  'durable chat storage must still discard unknown secrets and custom authorization fields');

const damaged = core.normalizeChatStorage({
  version:'broken',
  active:'unknown',
  histories:{ nene:'not-an-array' },
  settings:{
    provider:'other',
    apiBaseUrl:{},
    apiModel:[],
    live2dOutfit:'not-a-real-outfit',
    volume:999,
    drafts:{ nene:{ nested:'bad' } },
  },
}, { bad:'model' }, options);

assert.strictEqual(damaged.state.version, 3);
assert.strictEqual(damaged.state.active, 'nene');
assert.deepStrictEqual(damaged.state.histories, { nene:[], natsume:[] });
assert.strictEqual(damaged.state.settings.provider, 'api');
assert.strictEqual(damaged.state.settings.apiBaseUrl, 'http://127.0.0.1:8317/v1');
assert.strictEqual(damaged.state.settings.apiModel, 'gemini-3.6-flash-high');
assert.strictEqual(damaged.state.settings.apiKey, 'sk-local-proxy-key-2024');
assert.strictEqual(damaged.state.settings.webSearchEnabled, true);
assert.strictEqual(damaged.state.settings.live2dOutfit, 'school');
assert.strictEqual(damaged.state.settings.volume, 100);
assert.deepStrictEqual(damaged.state.settings.drafts, { nene:'', natsume:'' });
assert.strictEqual(damaged.migratedApiKey, '');

const current = core.normalizeChatStorage(JSON.parse(durable), 'ignored-model', options);
assert.deepStrictEqual(current.state, migrated.state, 'current chat storage must round-trip without drift');

});
