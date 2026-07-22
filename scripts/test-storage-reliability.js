const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createFakeIndexedDB(transactionDelay) {
  const databases = new Map();
  const api = { failNextWrite:false };

  function databaseFor(name) {
    if (databases.has(name)) return databases.get(name);
    const records = new Map();
    const db = {
      objectStoreNames:{ contains:() => true },
      createObjectStore:() => {},
      close:() => {},
      transaction(storeName, mode) {
        const operations = [];
        const shouldFail = mode === 'readwrite' && api.failNextWrite;
        if (shouldFail) api.failNextWrite = false;
        const tx = { error:null, oncomplete:null, onerror:null, onabort:null };
        const store = {
          put(record) { operations.push(() => records.set(record.key || record.id, record)); },
          delete(key) { operations.push(() => records.delete(key)); },
          clear() { operations.push(() => records.clear()); },
          get(key) {
            const request = { result:undefined, error:null, onsuccess:null, onerror:null };
            setTimeout(() => {
              request.result = records.get(key);
              if (request.onsuccess) request.onsuccess();
            }, 0);
            return request;
          },
          getAll() {
            const request = { result:undefined, error:null, onsuccess:null, onerror:null };
            setTimeout(() => {
              request.result = Array.from(records.values());
              if (request.onsuccess) request.onsuccess();
            }, 0);
            return request;
          }
        };
        tx.objectStore = () => store;
        setTimeout(() => {
          if (shouldFail) {
            tx.error = new Error('simulated transaction failure');
            if (tx.onerror) tx.onerror();
            return;
          }
          operations.forEach(operation => operation());
          if (tx.oncomplete) tx.oncomplete();
        }, transactionDelay);
        return tx;
      }
    };
    databases.set(name, db);
    return db;
  }

  api.open = function(name) {
    const request = { result:null, error:null, onupgradeneeded:null, onsuccess:null, onerror:null, onblocked:null };
    setTimeout(() => {
      request.result = databaseFor(name);
      if (request.onupgradeneeded) request.onupgradeneeded();
      if (request.onsuccess) request.onsuccess();
    }, 0);
    return request;
  };
  return api;
}

async function testKvCacheWaitsForCommit() {
  const indexedDB = createFakeIndexedDB(20);
  const context = vm.createContext({
    window:{ indexedDB, crypto:global.crypto },
    Blob,
    Uint32Array,
    Array,
    Date,
    Math,
    Promise,
    Set,
    JSON,
    Error,
    console:Object.assign({}, console, { warn:() => {} }),
    setTimeout
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'tools', 'image-store.js'), 'utf8'), context);
  const store = context.window.AICKVStore;

  await store.set('history', { version:1 });
  const pending = store.set('history', { version:2 });
  assert.deepEqual(await store.get('history'), { version:1 }, 'cache must expose the last committed value while a write is pending');
  await pending;
  assert.deepEqual(await store.get('history'), { version:2 });

  indexedDB.failNextWrite = true;
  await assert.rejects(store.set('history', { version:3 }), /simulated transaction failure/);
  assert.deepEqual(await store.get('history'), { version:2 }, 'failed set must not poison the cache');

  indexedDB.failNextWrite = true;
  await assert.rejects(store.remove('history'), /simulated transaction failure/);
  assert.deepEqual(await store.get('history'), { version:2 }, 'failed remove must keep the committed cache value');
}

function historyEntry(id, imageId) {
  return {
    id,
    timestamp:id,
    scene:null,
    sceneTitle:'记录 ' + id,
    character:'nene',
    prompt:'prompt ' + id,
    negative:'negative',
    rating:{ face:0, expression:0, composition:0, hands:0, atmosphere:0 },
    favorite:false,
    image_id:imageId || '',
    image_url:'',
    version:1,
    project:''
  };
}

async function testHistoryWaitsForPersistence() {
  const initial = Array.from({ length:35 }, (_, index) => historyEntry(index + 1));
  let setImpl = () => Promise.resolve(true);
  let setCalls = 0;
  let renderSceneCalls = 0;
  const deletedImages = [];
  const flashes = [];
  let allowDelete = true;
  const historyList = { innerHTML:'', querySelectorAll:() => [] };
  const elements = { historyList, hisCount:{ textContent:'' } };
  const state = { history:initial, selections:{ emotion:[] }, char:'nene', story:'', colorMood:'', __projectId:'', __sceneId:null };
  const context = vm.createContext({
    window:{ location:{ href:'http://localhost/tools/prompt-builder.html' }, addEventListener:() => {} },
    document:{ getElementById:id => elements[id] || null, querySelector:() => null },
    URL,
    console:Object.assign({}, console, { warn:() => {} }),
    Promise,
    Set,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    JSON,
    Error,
    NEGATIVE:'negative',
    LORA_ID:{},
    SCENES:[],
    state,
    _cachedHistory:initial,
    _cachedProjects:[],
    PERSONAL_PROFILE:{},
    HIS_KEY:'history',
    PRJ_KEY:'projects',
    AICKVStore:{ set(key, value) { setCalls += 1; return setImpl(key, value); } },
    AICGImageStore:{
      get:() => Promise.resolve(null),
      deleteMany:ids => { deletedImages.push(...ids); return Promise.resolve(); }
    },
    AICSceneUX:{ buildPreferenceProfile:list => ({ count:list.length }) },
    renderScenes:() => { renderSceneCalls += 1; },
    escapeHtml:value => String(value == null ? '' : value),
    flash:message => flashes.push(message),
    confirm:() => allowDelete,
    navigator:{ clipboard:{ writeText:() => Promise.resolve() } },
    resolveLoraSpecs:() => [],
    loraSpecText:value => value,
    getPlainPrompt:() => '',
    getPlainNegative:() => '',
    setTimeout
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'tools', 'prompt-builder', 'history.js'), 'utf8'), context);

  let releaseWrite;
  setImpl = () => new Promise(resolve => { releaseWrite = resolve; });
  const added = historyEntry(100, 'img_100');
  const savePromise = context.commitHistoryEntry(added);
  await delay(0);
  assert.equal(state.history.length, 35, 'UI state must not change before persistence succeeds');
  assert.equal(renderSceneCalls, 0);
  releaseWrite(true);
  await savePromise;
  assert.equal(state.history.length, 36, 'history must no longer evict records after 30 entries');
  assert.equal(state.history[0].id, 100);
  assert.match(historyList.innerHTML, /显示更早的 6 条/);

  const committed = state.history;
  setImpl = () => Promise.reject(new Error('quota exceeded'));
  await assert.rejects(context.commitHistoryEntry(historyEntry(101)), /quota exceeded/);
  assert.strictEqual(state.history, committed, 'failed save must leave the committed UI state intact');

  const callsBeforeCancel = setCalls;
  allowDelete = false;
  assert.equal(await context.deleteHistoryId(100), false);
  assert.equal(setCalls, callsBeforeCancel, 'cancelled deletion must not write');
  assert.equal(deletedImages.length, 0);

  allowDelete = true;
  assert.equal(await context.deleteHistoryId(100), false);
  assert.equal(state.history.some(item => item.id === 100), true, 'failed delete must keep the history record');
  assert.equal(deletedImages.length, 0, 'failed delete must not delete the image blob');
  assert.ok(flashes.some(message => /均已保留/.test(message)));

  let releaseDelete;
  setImpl = () => new Promise(resolve => { releaseDelete = resolve; });
  const deletePromise = context.deleteHistoryId(100);
  await delay(0);
  assert.equal(state.history.some(item => item.id === 100), true, 'record must stay visible while delete persistence is pending');
  assert.equal(deletedImages.length, 0);
  releaseDelete(true);
  assert.equal(await deletePromise, true);
  assert.equal(state.history.some(item => item.id === 100), false);
  assert.deepEqual(deletedImages, ['img_100']);
}

async function testConcurrentHistoryAllocatesAtomicChains() {
  const fixedNow = 1700000000000;
  class FixedDate extends Date {}
  FixedDate.now = () => fixedNow;

  const rootEntry = Object.assign(historyEntry(42), {
    scene:'sc001',
    character:'nene',
    version:4,
    parent_id:null
  });
  const importedCollision = Object.assign(historyEntry(fixedNow), {
    scene:'imported-scene',
    character:'natsume',
    version:9
  });
  const initial = [rootEntry, importedCollision];
  const historyList = { innerHTML:'', querySelectorAll:() => [] };
  const elements = { historyList, hisCount:{ textContent:'' } };
  const state = {
    history:initial,
    selections:{ emotion:['smile'], shot:'portrait', lighting:'soft', composition:'centered' },
    char:'nene',
    story:'concurrent save',
    colorMood:'warm',
    manualTags:new Set(['school_uniform', 'custom_pose']),
    __projectId:'',
    __sceneId:'sc001'
  };
  let activeWrites = 0;
  let maxActiveWrites = 0;
  const context = vm.createContext({
    window:{ location:{ href:'http://localhost/tools/prompt-builder.html' }, addEventListener:() => {} },
    document:{ getElementById:id => elements[id] || null, querySelector:() => null },
    URL,
    console:Object.assign({}, console, { warn:() => {} }),
    Promise,
    Set,
    Date:FixedDate,
    Math,
    Number,
    String,
    Object,
    Array,
    JSON,
    Error,
    NEGATIVE:'negative',
    LORA_ID:{},
    SCENES:[{ id:'sc001', title:'Concurrent scene' }],
    state,
    _cachedHistory:initial,
    _cachedProjects:[],
    _sdLastResult:null,
    PERSONAL_PROFILE:{},
    HIS_KEY:'history',
    PRJ_KEY:'projects',
    AICKVStore:{
      async set() {
        activeWrites += 1;
        maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
        await delay(5);
        activeWrites -= 1;
        return true;
      }
    },
    AICGImageStore:{ get:() => Promise.resolve(null), deleteMany:() => Promise.resolve() },
    AICSceneUX:{ buildPreferenceProfile:list => ({ count:list.length }) },
    renderScenes:() => {},
    escapeHtml:value => String(value == null ? '' : value),
    flash:() => {},
    confirm:() => true,
    navigator:{ clipboard:{ writeText:() => Promise.resolve() } },
    resolveLoraSpecs:() => [],
    loraSpecText:value => value,
    getPlainPrompt:() => 'prompt',
    getPlainNegative:() => 'negative',
    setTimeout
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'tools', 'prompt-builder', 'history.js'), 'utf8'), context);

  await Promise.all([
    context.saveHistory(),
    context.saveHistoryWithRating({ face:5, expression:4, composition:3, hands:2, atmosphere:1 }, true, 'rated', '', '', false),
    context.saveHistory()
  ]);

  const importedIds = new Set([42, fixedNow]);
  const generated = state.history.filter(entry => !importedIds.has(entry.id)).sort((a, b) => a.version - b.version);
  assert.equal(generated.length, 3);
  assert.equal(new Set(generated.map(entry => entry.id)).size, 3, 'concurrent saves must receive different ids even when Date.now is fixed');
  assert.ok(generated.every(entry => Number.isSafeInteger(entry.id)), 'new ids must remain compatible with imported numeric ids');
  assert.deepEqual(generated.map(entry => entry.version), [5, 6, 7]);
  assert.deepEqual(generated.map(entry => entry.parent_id), [42, generated[0].id, generated[1].id]);
  assert.ok(generated.every(entry => JSON.stringify(entry.manual_tags) === JSON.stringify(['school_uniform', 'custom_pose'])),
    'manual tag snapshots must be stored exactly with every history entry');
  assert.equal(maxActiveWrites, 1, 'history persistence must remain serialized');

  context._sdLastResult = {
    queueJob:{
      sceneId:'sc001', sceneTitle:'Queued scene', char:'nene', story:'queued story',
      manualTags:['queued_scene_tag', 'queued_custom_tag'],
      selections:{ emotion:['smile'], shot:'portrait', lighting:'soft', composition:'centered' },
      colorMood:'warm', projectId:'', lora:''
    },
    payload:{ prompt:'queued prompt', negative_prompt:'queued negative', seed:123 },
    info:{}, seeds:[123], infotexts:[]
  };
  state.manualTags = new Set(['changed_after_enqueue']);
  await context.saveHistoryWithRating({ face:0, expression:0, composition:0, hands:0, atmosphere:0 }, false, '', '', '', true);
  assert.deepEqual(state.history[0].manual_tags, ['queued_scene_tag', 'queued_custom_tag'],
    'queue auto-save must use the manual tags captured with the job, not the current editor state');
}

(async function run() {
  await testKvCacheWaitsForCommit();
  await testHistoryWaitsForPersistence();
  await testConcurrentHistoryAllocatesAtomicChains();
  console.log('Storage reliability tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
