(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AICSceneUX = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  var RECENT_SCENE_KEY = 'aics_recent_scenes';

  function list(config, key){ return config && Array.isArray(config[key]) ? config[key] : []; }

  function tier(scene, config){
    if (list(config, 'signatureSceneIds').indexOf(scene.id) >= 0) return 'signature';
    if (list(config, 'reviewSceneIds').indexOf(scene.id) >= 0) return 'review';
    if (list(config, 'curatedSceneIds').indexOf(scene.id) >= 0) return 'curated';
    return 'standard';
  }

  function priority(scene, config){
    var signatures = list(config, 'signatureSceneIds');
    var curated = list(config, 'curatedSceneIds');
    var signatureIndex = signatures.indexOf(scene.id);
    var curatedIndex = curated.indexOf(scene.id);
    if (signatureIndex >= 0) return 30000 - signatureIndex;
    if (curatedIndex >= 0) return 20000 - curatedIndex;
    var number = Number(String(scene.id || '').replace(/\D/g, '')) || 0;
    return 10000 - number;
  }

  function characterLabel(value){
    if (value === 'nene' || value === 'ayachi_nene') return '宁宁';
    if (value === 'natsume' || value === 'shiki_natsume') return '夏目';
    if (value === 'triad') return '双人';
    return value || '';
  }

  function searchText(scene, extras){
    return [scene.id, scene.title, scene.story, scene.emotion, scene.char, characterLabel(scene.char), scene.rating,
      scene.category, scene.season, scene.time, scene.timeOfDay, scene.location, scene.weather, scene.camera, scene.lighting]
      .concat(scene.tags || [], extras || []).join(' ').toLowerCase();
  }

  function queryGroups(query, config){
    var normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return [];
    var aliases = config && config.searchAliases || {};
    if (aliases[normalized]) return [[normalized].concat(aliases[normalized])];
    return normalized.split(/\s+/).filter(Boolean).map(function(term){ return [term].concat(aliases[term] || []); });
  }

  function matchesSearch(scene, query, config, extras){
    var groups = queryGroups(query, config);
    if (!groups.length) return true;
    var hay = searchText(scene, extras);
    return groups.every(function(group){
      return group.some(function(term){ return hay.includes(String(term).toLowerCase()); });
    });
  }

  function readRecent(storage){
    try {
      var items = JSON.parse((storage || localStorage).getItem(RECENT_SCENE_KEY) || '[]');
      return Array.isArray(items) ? items.filter(function(item){ return item && item.id; }) : [];
    } catch(e) { return []; }
  }

  function rememberRecent(scene, storage){
    if (!scene || !scene.id) return [];
    var target = storage || localStorage;
    var items = [{id:scene.id,title:scene.title,char:scene.char,usedAt:Date.now()}]
      .concat(readRecent(target).filter(function(item){ return item.id !== scene.id; })).slice(0,8);
    try { target.setItem(RECENT_SCENE_KEY, JSON.stringify(items)); } catch(e) {}
    return items;
  }

  return {
    RECENT_SCENE_KEY: RECENT_SCENE_KEY,
    characterLabel: characterLabel,
    matchesSearch: matchesSearch,
    priority: priority,
    queryGroups: queryGroups,
    readRecent: readRecent,
    rememberRecent: rememberRecent,
    searchText: searchText,
    tier: tier
  };
});
