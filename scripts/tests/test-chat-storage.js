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

// 旧版本 normalize 曾把开箱即用兜底默认（本机 CLIProxy + Gemini）持久化进
// localStorage。这些用户从未主动配置 API，站主托管配置必须优先于兜底：
// 存着兜底默认值的存储必须判定为 neverConfigured。
const persistedFallback = core.normalizeChatStorage({
  version:3,
  active:'nene',
  histories:{},
  settings:{
    provider:'api',
    apiBaseUrl:'http://127.0.0.1:8317/v1',
    apiModel:'gemini-3.6-flash-high',
    apiKey:'sk-local-proxy-key-2024',
    webSearchEnabled:false,
    live2dEnabled:false,
    live2dOutfit:'school',
    autoVoice:true,
    volume:80,
    drafts:{ nene:'', natsume:'' },
  },
}, '', options);
assert.strictEqual(persistedFallback.neverConfigured, true,
  'storage holding only the built-in fallback values must count as never configured');
assert.strictEqual(persistedFallback.state.settings.apiModel, 'gemini-3.6-flash-high',
  'fallback values stay visible for out-of-box chat, but must not block hosted config');

// 用户真实保存过的配置（哪怕值恰好相同）来自主动保存，不属于兜底
const userSavedSameValues = core.normalizeChatStorage({
  version:3,
  active:'nene',
  histories:{},
  settings:{
    provider:'api',
    apiBaseUrl:'https://api.deepseek.com',
    apiModel:'deepseek-v4-flash',
    apiKey:'sk-user-real-key',
    webSearchEnabled:false,
    live2dEnabled:false,
    live2dOutfit:'school',
    autoVoice:true,
    volume:80,
    drafts:{ nene:'', natsume:'' },
  },
}, '', options);
assert.strictEqual(userSavedSameValues.neverConfigured, false,
  'a real user-saved API config must stay user-configured');

});

test('Chat archive round-trip: trim overflow, export/import, markdown and restore', () => {
  const archive = require('../../src/utils/chatArchive.ts');
  const ids = ['nene', 'natsume'];
  const fresh = archive.emptyChatArchive(ids);
  assert.deepStrictEqual(fresh.archived, { nene: [], natsume: [] });

  const messages = [
    { role: 'user', content: '第一句', mid: 'm1', stopped: false },
    { role: 'assistant', content: '第二句', mid: 'm2', stopped: false },
    { role: 'assistant', content: '重复句', mid: 'm2', stopped: false },
    { role: 'user', content: '第三句', mid: '', stopped: false },
  ];
  const archived = archive.archiveMessages(fresh, 'nene', messages);
  assert.strictEqual(archived.archived.nene.length, 3, 'archive must dedupe by mid');

  // 超限消息来自 trim：前 20 条进归档，剩下 20 条留在会话
  const overflow = Array.from({ length: 25 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: `old-${index}`,
    mid: `m-old-${index}`,
    stopped: false,
  }));
  const trimmed = archive.archiveMessages(archive.emptyChatArchive(ids), 'nene', overflow);
  assert.strictEqual(trimmed.archived.nene.length, 25);

  const serialized = archive.serializeChatArchive(trimmed);
  const parsed = archive.normalizeChatArchive(JSON.parse(serialized), ids);
  assert.deepStrictEqual(parsed, trimmed, 'archive must round-trip through JSON');

  const merged = archive.mergeChatArchives(parsed, archive.emptyChatArchive(ids));
  assert.strictEqual(merged.archived.nene.length, 25);
  const mergedDup = archive.mergeChatArchives(parsed, parsed);
  assert.strictEqual(mergedDup.archived.nene.length, 25, 'merging identical archives must not duplicate');

  // 并回当前对话：按 mid 去重、保持归档顺序
  const history = [
    { role: 'user', content: 'current', mid: 'm-current', stopped: false },
    { role: 'assistant', content: 'old-0', mid: 'm-old-0', stopped: false },
  ];
  const restored = archive.mergeArchiveIntoHistory(history, parsed.archived.nene);
  assert.strictEqual(restored.length, 26, 'restore must append archive messages without duplicating');
  assert.strictEqual(restored[0].content, 'current');
  assert.strictEqual(restored[1].content, 'old-0');
  assert.strictEqual(restored[restored.length - 1].content, 'old-24');

  const markdown = archive.chatArchiveToMarkdown(parsed, { nene: '宁宁', natsume: '夏目' });
  assert(/\# 角色聊天归档/.test(markdown), 'markdown export must have a title');
  assert(/## 宁宁（25 条）/.test(markdown), 'markdown export must list per-character counts');
  assert(/\*\*宁宁\*\*：old-1/.test(markdown), 'markdown export must render assistant lines');
  assert(/\*\*你\*\*：old-0/.test(markdown), 'markdown export must render user lines');

  const damaged = archive.normalizeChatArchive({
    version: 'broken',
    archived: { nene: [{ role: 'system', content: 'x' }, { role: 'user', content: 'ok', mid: 123 }] },
  }, ids);
  assert.deepStrictEqual(damaged.archived.nene.map(m => m.content), ['ok']);
});
