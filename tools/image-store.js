(function(global){
  'use strict';

  var DB_NAME = 'aics_image_store';
  var DB_VERSION = 1;
  var STORE_NAME = 'images';
  var dbPromise;

  function openDb(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      if(!global.indexedDB){ reject(new Error('当前浏览器不支持 IndexedDB')); return; }
      var settled = false;
      var request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function(){
        if(!request.result.objectStoreNames.contains(STORE_NAME)){
          request.result.createObjectStore(STORE_NAME, { keyPath:'id' });
        }
      };
      request.onsuccess = function(){
        var db = request.result;
        db.onversionchange = function(){ db.close(); dbPromise = null; };
        settled = true;
        resolve(db);
      };
      request.onerror = function(){ dbPromise = null; reject(request.error || new Error('图片数据库打开失败')); };
      request.onblocked = function(){
        if(settled) return;
        dbPromise = null;
        reject(new Error('图片数据库被其他页面占用，请刷新后重试'));
      };
    });
    return dbPromise;
  }

  function createId(){
    if(global.crypto && typeof global.crypto.randomUUID === 'function') return 'img_' + global.crypto.randomUUID();
    var bytes = new Uint32Array(4);
    if(global.crypto && typeof global.crypto.getRandomValues === 'function') global.crypto.getRandomValues(bytes);
    else for(var i=0;i<bytes.length;i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
    return 'img_' + Date.now().toString(36) + '_' + Array.from(bytes).map(function(n){ return n.toString(36); }).join('');
  }

  function runTransaction(mode, action){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var settled = false;
        var transaction;
        try { transaction = db.transaction(STORE_NAME, mode); }
        catch(error){ reject(error); return; }
        var store = transaction.objectStore(STORE_NAME);
        var result;
        try { result = action(store); }
        catch(error){ transaction.abort(); reject(error); return; }
        transaction.oncomplete = function(){ if(!settled){ settled = true; resolve(result); } };
        transaction.onerror = function(){ if(!settled){ settled = true; reject(transaction.error || new Error('图片数据库事务失败')); } };
        transaction.onabort = function(){ if(!settled){ settled = true; reject(transaction.error || new Error('图片数据库事务已取消')); } };
      });
    });
  }

  function put(file){
    if(!(file instanceof Blob) || !file.size) return Promise.reject(new Error('图片文件为空'));
    var id = createId();
    var record = {
      id: id,
      blob: file,
      name: typeof file.name === 'string' ? file.name : '',
      type: file.type || '',
      size: file.size,
      created_at: Date.now()
    };
    return runTransaction('readwrite', function(store){ store.put(record); }).then(function(){ return id; });
  }

  function putRecord(record){
    if(!record || typeof record.id !== 'string' || !record.id.trim()) return Promise.reject(new Error('图片记录缺少 ID'));
    if(!(record.blob instanceof Blob) || !record.blob.size) return Promise.reject(new Error('图片记录为空'));
    var normalized = {
      id: record.id.trim(),
      blob: record.blob,
      name: typeof record.name === 'string' ? record.name : '',
      type: record.type || record.blob.type || '',
      size: record.blob.size,
      created_at: Number(record.created_at) || Date.now()
    };
    return runTransaction('readwrite', function(store){ store.put(normalized); }).then(function(){ return normalized.id; });
  }

  function get(id){
    if(typeof id !== 'string' || !id.trim()) return Promise.resolve(null);
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var transaction;
        try { transaction = db.transaction(STORE_NAME, 'readonly'); }
        catch(error){ reject(error); return; }
        var request = transaction.objectStore(STORE_NAME).get(id.trim());
        request.onsuccess = function(){
          var record = request.result;
          resolve(record && record.blob instanceof Blob ? record.blob : null);
        };
        request.onerror = function(){ reject(request.error || new Error('图片读取失败')); };
      });
    });
  }

  function deleteOne(id){
    if(typeof id !== 'string' || !id.trim()) return Promise.resolve();
    return deleteMany([id]);
  }

  function deleteMany(ids){
    var unique = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(function(id){ return typeof id === 'string' && id.trim(); }).map(function(id){ return id.trim(); })));
    if(!unique.length) return Promise.resolve();
    return runTransaction('readwrite', function(store){ unique.forEach(function(id){ store.delete(id); }); });
  }

  function listRecords(){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var transaction;
        try { transaction = db.transaction(STORE_NAME, 'readonly'); }
        catch(error){ reject(error); return; }
        var request = transaction.objectStore(STORE_NAME).getAll();
        request.onsuccess = function(){ resolve(Array.isArray(request.result) ? request.result : []); };
        request.onerror = function(){ reject(request.error || new Error('图片列表读取失败')); };
      });
    });
  }

  function replaceAll(records){
    var valid = (Array.isArray(records) ? records : []).filter(function(record){
      return record && typeof record.id === 'string' && record.id.trim() && record.blob instanceof Blob && record.blob.size;
    });
    return runTransaction('readwrite', function(store){
      store.clear();
      valid.forEach(function(record){
        store.put({
          id:record.id.trim(), blob:record.blob, name:record.name || '',
          type:record.type || record.blob.type || '', size:record.blob.size,
          created_at:Number(record.created_at) || Date.now()
        });
      });
    }).then(function(){ return valid.length; });
  }

  global.AICGImageStore = {
    put:put, putRecord:putRecord, get:get, listRecords:listRecords,
    replaceAll:replaceAll, delete:deleteOne, deleteMany:deleteMany
  };
})(window);

/**
 * AICKVStore — 通用 IndexedDB KV 存储（history / projects 等）
 * 替代 localStorage，无 5-10MB 上限。
 */
(function(global){
  'use strict';

  var DB_NAME = 'aics_kv_store';
  var DB_VERSION = 1;
  var STORE_NAME = 'kv';
  var dbPromise;
  var _memCache = {}; // 内存影子数据库，防御并发覆写

  function openDb(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      if(!global.indexedDB){ reject(new Error('当前浏览器不支持 IndexedDB')); return; }
      var request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function(){
        if(!request.result.objectStoreNames.contains(STORE_NAME)){
          request.result.createObjectStore(STORE_NAME, { keyPath:'key' });
        }
      };
      request.onsuccess = function(){
        var db = request.result;
        db.onversionchange = function(){ db.close(); dbPromise = null; };
        resolve(db);
      };
      request.onerror = function(){ dbPromise = null; reject(request.error || new Error('KV 数据库打开失败')); };
    });
    return dbPromise;
  }

  function get(key){
    if(_memCache[key] !== undefined) return Promise.resolve(JSON.parse(JSON.stringify(_memCache[key])));
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = function(){
          var val = req.result ? req.result.value : null;
          if(val !== null) _memCache[key] = JSON.parse(JSON.stringify(val));
          resolve(val);
        };
        req.onerror = function(){ reject(req.error); };
      });
    });
  }

  function set(key, value){
    _memCache[key] = JSON.parse(JSON.stringify(value));
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ key:key, value:value });
        tx.oncomplete = function(){ resolve(true); };
        tx.onerror = function(){ reject(tx.error); };
      });
    });
  }

  function remove(key){
    delete _memCache[key];
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = function(){ resolve(true); };
        tx.onerror = function(){ reject(tx.error); };
      });
    });
  }

  global.AICKVStore = { init:openDb, get:get, set:set, remove:remove };
})(window);
