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

  function normalizeQuery(value){
    return String(value || '').toLowerCase()
      .replace(/[，。！？、,.;；:：/\\|()[\]{}"'“”‘’]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function uniqueTerms(items){
    var seen = {};
    return items.map(normalizeQuery).filter(function(item){
      if (!item || seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }

  function detectableInside(query, term){
    if (!term) return false;
    if (/^[\u3400-\u9fff]$/.test(term)) return query === term || query.split(' ').indexOf(term) >= 0;
    return query.indexOf(term) >= 0;
  }

  function analyzeQuery(query, config){
    var normalized = normalizeQuery(query);
    if (!normalized) return { normalized:'', groups:[], intents:[], residualTerms:[] };
    var aliases = config && config.searchAliases || {};
    var groups = [];
    var intents = [];
    var residual = normalized;

    if (aliases[normalized]) {
      groups.push(uniqueTerms([normalized].concat(aliases[normalized])));
      intents.push(normalized);
      residual = '';
    } else {
      Object.keys(aliases).forEach(function(intent){
        var terms = uniqueTerms([intent].concat(aliases[intent] || []));
        var hits = terms.filter(function(term){ return detectableInside(normalized, term); });
        if (!hits.length) return;
        groups.push(terms);
        intents.push(intent);
        hits.sort(function(left, right){ return right.length - left.length; }).forEach(function(hit){
          residual = residual.split(hit).join(' ');
        });
      });
    }

    ['请帮我找','帮我找','我想画','想画一个','想画','想要一个','想要','给我一个','给我','来一个','来点','比较','有一点','有点','一幅','一张','一些','一个','这种','那种','感觉','风格','画面','场景']
      .sort(function(left, right){ return right.length - left.length; })
      .forEach(function(phrase){ residual = residual.split(phrase).join(' '); });
    var stopSingles = { '我':1, '的':1, '地':1, '得':1, '在':1, '把':1, '请':1, '找':1, '画':1, '想':1, '要':1, '个':1, '张':1, '些':1, '点':1 };
    var residualTerms = normalizeQuery(residual).split(' ').filter(function(term){ return term && !stopSingles[term]; });
    residualTerms.forEach(function(term){ groups.push([term]); });
    return { normalized:normalized, groups:groups, intents:intents, residualTerms:residualTerms };
  }

  function queryGroups(query, config){
    return analyzeQuery(query, config).groups;
  }

  function matchesSearch(scene, query, config, extras){
    var groups = queryGroups(query, config);
    if (!groups.length) return true;
    var hay = searchText(scene, extras);
    return groups.every(function(group){
      return group.some(function(term){ return hay.includes(String(term).toLowerCase()); });
    });
  }

  function searchScore(scene, query, config, extras){
    var analysis = analyzeQuery(query, config);
    if (!analysis.groups.length) return 0;
    var fields = [
      { value:scene.title, weight:36 },
      { value:characterLabel(scene.char), weight:30 },
      { value:scene.emotion, weight:28 },
      { value:scene.location, weight:24 },
      { value:scene.weather, weight:22 },
      { value:scene.category, weight:20 },
      { value:scene.story, weight:16 },
      { value:(scene.tags || []).join(' '), weight:14 },
      { value:[scene.camera, scene.lighting, scene.season, scene.timeOfDay].join(' '), weight:10 },
      { value:(extras || []).join(' '), weight:8 }
    ];
    var score = 0;
    analysis.groups.forEach(function(group){
      var best = 0;
      group.forEach(function(term){
        term = normalizeQuery(term);
        fields.forEach(function(field){
          if (normalizeQuery(field.value).indexOf(term) >= 0) best = Math.max(best, field.weight + Math.min(term.length, 8));
        });
      });
      score += best;
    });
    var title = normalizeQuery(scene.title);
    var story = normalizeQuery(scene.story);
    if (analysis.normalized && title.indexOf(analysis.normalized) >= 0) score += 50;
    else if (analysis.normalized && story.indexOf(analysis.normalized) >= 0) score += 24;
    return score;
  }

  function ratingAverage(rating){
    var axes = ['face','expression','composition','hands','atmosphere'];
    var values = axes.map(function(axis){ return Number(rating && rating[axis]); }).filter(function(value){ return value > 0 && value <= 5; });
    if (!values.length) return 0;
    return values.reduce(function(total, value){ return total + value; }, 0) / values.length;
  }

  function normalizeCharacter(value){
    if (value === 'ayachi_nene') return 'nene';
    if (value === 'shiki_natsume') return 'natsume';
    if (value === 'both') return 'triad';
    return value || '';
  }

  function ensureStats(container, key){
    if (!key) return null;
    if (!container[key]) container[key] = { uses:0, favorites:0, ratingTotal:0, rated:0, lastUsed:0, averageRating:0 };
    return container[key];
  }

  function addHistoryStats(stats, entry){
    if (!stats) return;
    stats.uses += 1;
    if (entry.favorite) stats.favorites += 1;
    var average = ratingAverage(entry.rating);
    if (average) { stats.ratingTotal += average; stats.rated += 1; }
    stats.lastUsed = Math.max(stats.lastUsed, Number(entry.timestamp || entry.id) || 0);
  }

  function finishStats(container){
    Object.keys(container).forEach(function(key){
      var stats = container[key];
      stats.averageRating = stats.rated ? stats.ratingTotal / stats.rated : 0;
    });
  }

  function buildPreferenceProfile(history, now){
    var profile = { entries:0, ratedEntries:0, favorites:0, scenes:{}, characters:{}, generatedAt:Number(now) || Date.now() };
    (Array.isArray(history) ? history : []).forEach(function(entry){
      if (!entry || typeof entry !== 'object') return;
      profile.entries += 1;
      if (ratingAverage(entry.rating)) profile.ratedEntries += 1;
      if (entry.favorite) profile.favorites += 1;
      addHistoryStats(ensureStats(profile.scenes, entry.scene), entry);
      addHistoryStats(ensureStats(profile.characters, normalizeCharacter(entry.character)), entry);
    });
    finishStats(profile.scenes);
    finishStats(profile.characters);
    return profile;
  }

  function statsScore(stats, now){
    if (!stats) return 0;
    var score = Math.min(stats.uses, 6) * 2 + Math.min(stats.favorites, 3) * 12;
    if (stats.rated) score += (stats.averageRating - 3) * 8;
    if (stats.lastUsed) {
      var days = Math.max(0, (now - stats.lastUsed) / 86400000);
      if (days <= 7) score += 4;
      else if (days <= 30) score += 2;
      else if (days <= 90) score += 1;
    }
    return score;
  }

  function personalScore(scene, profile){
    if (!scene || !profile) return 0;
    var sceneStats = profile.scenes && profile.scenes[scene.id];
    var characterStats = profile.characters && profile.characters[normalizeCharacter(scene.char)];
    return statsScore(sceneStats, profile.generatedAt || Date.now()) + statsScore(characterStats, profile.generatedAt || Date.now()) * 0.3;
  }

  function personalReason(scene, profile){
    if (!scene || !profile) return '';
    var sceneStats = profile.scenes && profile.scenes[scene.id];
    if (sceneStats) {
      if (sceneStats.favorites) return '你收藏过这个场景';
      if (sceneStats.averageRating >= 4) return '你曾给出 ' + sceneStats.averageRating.toFixed(1) + ' 分';
      if (sceneStats.uses >= 2) return '你已经创作过 ' + sceneStats.uses + ' 次';
    }
    var characterStats = profile.characters && profile.characters[normalizeCharacter(scene.char)];
    if (characterStats && characterStats.uses >= 3 && (characterStats.averageRating >= 3.8 || characterStats.favorites)) {
      return '符合你常画的' + characterLabel(scene.char) + '偏好';
    }
    return '';
  }

  function isPersonalFavorite(scene, profile){
    var stats = scene && profile && profile.scenes && profile.scenes[scene.id];
    return !!(stats && stats.favorites);
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
    analyzeQuery: analyzeQuery,
    buildPreferenceProfile: buildPreferenceProfile,
    characterLabel: characterLabel,
    isPersonalFavorite: isPersonalFavorite,
    matchesSearch: matchesSearch,
    personalReason: personalReason,
    personalScore: personalScore,
    priority: priority,
    queryGroups: queryGroups,
    ratingAverage: ratingAverage,
    readRecent: readRecent,
    rememberRecent: rememberRecent,
    searchScore: searchScore,
    searchText: searchText,
    tier: tier
  };
});
