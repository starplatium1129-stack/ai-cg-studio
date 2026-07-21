(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AICDataBackup = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  var TYPE = 'aics-personal-backup';
  var SCHEMA_VERSION = 1;

  function plainObject(value){ return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function array(value){ return Array.isArray(value) ? value.filter(function(item){ return item && typeof item === 'object'; }) : []; }
  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function finite(value, fallback){ var number = Number(value); return Number.isFinite(number) ? number : fallback; }

  function normalizeImage(record){
    record = plainObject(record);
    var dataUrl = typeof record.dataUrl === 'string' ? record.dataUrl : '';
    var id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id || !/^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl)) return null;
    return {
      id:id,
      name:typeof record.name === 'string' ? record.name : '',
      type:typeof record.type === 'string' ? record.type : '',
      size:Math.max(0, finite(record.size, 0)),
      created_at:Math.max(0, finite(record.created_at, 0)),
      dataUrl:dataUrl
    };
  }

  function normalize(raw){
    if (!raw || typeof raw !== 'object') throw new Error('备份文件不是有效对象');
    var version = Math.max(0, Math.floor(finite(raw.schemaVersion, 0)));
    if (version > SCHEMA_VERSION) throw new Error('该备份来自更新版本，请先升级网站');
    if (version > 0 && raw.type !== TYPE) throw new Error('该文件不是绫季绘境备份');
    if (version === 0 && !['history','projects','settings','images'].some(function(key){ return Object.prototype.hasOwnProperty.call(raw, key); })) {
      throw new Error('该文件不包含可恢复的绫季绘境数据');
    }

    var source = version === 0 ? raw : plainObject(raw.data);
    var normalized = {
      type:TYPE,
      schemaVersion:SCHEMA_VERSION,
      appVersion:String(raw.appVersion || ''),
      exportedAt:String(raw.exportedAt || new Date(0).toISOString()),
      data:{
        history:clone(array(source.history || raw.history)),
        projects:clone(array(source.projects || raw.projects)),
        settings:clone(plainObject(source.settings || raw.settings))
      },
      images:array(raw.images).map(normalizeImage).filter(Boolean)
    };
    return normalized;
  }

  function create(payload){
    payload = plainObject(payload);
    return normalize({
      type:TYPE,
      schemaVersion:SCHEMA_VERSION,
      appVersion:String(payload.appVersion || ''),
      exportedAt:new Date().toISOString(),
      data:{ history:payload.history, projects:payload.projects, settings:payload.settings },
      images:payload.images
    });
  }

  function mergeById(local, imported){
    var result = new Map();
    function keyFor(item, index, source){
      if (item.id != null) return 'id:' + String(item.id);
      var stamp = finite(item.timestamp || item.updatedAt || item.createdAt, 0);
      return stamp ? 'legacy:' + stamp : source + ':' + index;
    }
    array(local).forEach(function(item, index){ result.set(keyFor(item, index, 'local'), clone(item)); });
    array(imported).forEach(function(item, index){
      var key = keyFor(item, index, 'imported');
      result.set(key, Object.assign({}, result.get(key) || {}, clone(item)));
    });
    return Array.from(result.values()).sort(function(a, b){
      return finite(b.timestamp || b.updatedAt || b.createdAt, 0) - finite(a.timestamp || a.updatedAt || a.createdAt, 0);
    });
  }

  function summary(backup){
    var normalized = normalize(backup);
    return {
      history:normalized.data.history.length,
      projects:normalized.data.projects.length,
      settings:Object.keys(normalized.data.settings).length,
      images:normalized.images.length
    };
  }

  return {
    TYPE:TYPE,
    SCHEMA_VERSION:SCHEMA_VERSION,
    create:create,
    mergeById:mergeById,
    normalize:normalize,
    summary:summary
  };
});
