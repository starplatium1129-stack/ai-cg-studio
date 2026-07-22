(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AICPromptPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BREAK_MARK = '\u0000AIC_BREAK\u0000';
  var FRAME_GROUPS = {
    close: ['close_up', 'extreme_close_up', 'close_up_detail', 'face_focus', 'upper_face', 'portrait'],
    medium: ['medium_shot', 'upper_body', 'cowboy_shot', 'waist_up'],
    wide: ['wide_shot', 'long_shot', 'full_body', 'establishing_shot']
  };
  // These are model-agnostic failure/artifact guards repeated by nearly every
  // scene. A model profile may replace them with its own recommended baseline,
  // while semantic exclusions (crowd, daylight, school_uniform, etc.) survive.
  var NEGATIVE_BOILERPLATE = new Set([
    'bad_quality', 'worst_quality', 'low_quality', 'normal_quality', 'worst_detail',
    'lowres', 'blurry', 'jpeg_artifacts', 'text', 'watermark', 'logo', 'signature',
    'username', 'sketch', 'censor', 'old', 'early',
    'bad_anatomy', 'bad_hands', 'mutated_hands', 'extra_fingers', 'missing_fingers',
    'fused_fingers', 'extra_arms', 'extra_legs', 'extra_limbs', 'deformed',
    'bad_proportions', 'duplicate', 'cropped', 'poorly_drawn_face'
  ]);

  var STORY_RULES = [
    { words:['海边','沙滩','海浪','大海','beach'], tags:['beach','ocean'] },
    { words:['神社','鸟居','shrine'], tags:['shrine','torii'] },
    { words:['祭典','夏日祭','烟花','花火'], tags:['summer_festival','fireworks'] },
    { words:['咖啡馆','咖啡店','咖啡','cafe'], tags:['cafe','holding_cup'] },
    { words:['公园','树下','park'], tags:['park'] },
    { words:['樱花','cherry blossom'], tags:['cherry_blossoms','falling_petals'] },
    { words:['教室','学校','classroom'], tags:['classroom'] },
    { words:['图书馆','读书','看书','library'], tags:['library','reading'] },
    { words:['天台','屋顶','楼顶','rooftop'], tags:['rooftop'] },
    { words:['车站','火车站','月台','station'], tags:['train_station'] },
    { words:['卧室','房间','床边','bedroom'], tags:['bedroom'] },
    { words:['厨房','做饭','料理','kitchen'], tags:['kitchen'] },
    { words:['清晨','日出','晨光','sunrise','dawn'], tags:['dawn','morning_light'] },
    { words:['黄昏','日落','夕阳','晚霞','sunset'], tags:['sunset','golden_hour'] },
    { words:['夜晚','深夜','夜色','night'], tags:['night'] },
    { words:['月亮','月光','月色','moonlight'], tags:['moonlight'] },
    { words:['烛光','蜡烛','candle'], tags:['candlelight'] },
    { words:['下雨','雨天','雨伞','撑伞','rain'], tags:['rain'] },
    { words:['下雪','雪天','雪花','snow'], tags:['snow'] },
    { words:['等待','等人','wait'], tags:['waiting'] },
    { words:['牵手','拉着手','holding hands'], tags:['holding_hands'] },
    { words:['拥抱','抱住','hug'], tags:['hug'] },
    { words:['回头','回眸','转身','looking back'], tags:['looking_back'] },
    { words:['坐着','坐在','坐下','sitting'], tags:['sitting'] },
    { words:['站着','站在','standing'], tags:['standing'] },
    { words:['躺着','躺在','lying'], tags:['lying'] },
    { words:['跑来','奔跑','running'], tags:['running'] },
    { words:['微笑','笑着','smile'], tags:['smile'] },
    { words:['大笑','laugh'], tags:['laughing'] },
    { words:['害羞','脸红','羞涩','shy'], tags:['shy','blush'] },
    { words:['哭泣','眼泪','流泪','cry'], tags:['tears'] },
    { words:['生气','愤怒','angry'], tags:['angry'] },
    { words:['惊讶','吃惊','surprised'], tags:['surprised'] },
    { words:['闭眼','闭着眼','closed eyes'], tags:['closed_eyes'] },
    { words:['特写','近景','close-up','close up'], tags:['close_up'] },
    { words:['全身','远景','wide shot'], tags:['full_body','wide_shot'] }
  ];

  function normalizeKey(token) {
    return String(token || '')
      .replace(/^\s*\[NEG\]\s*/i, '')
      .replace(/^\s*<lora:|>\s*$/gi, '')
      .replace(/^\s*\(+|\)+\s*$/g, '')
      .replace(/:\s*-?\d+(?:\.\d+)?\s*$/g, '')
      .trim().toLowerCase().replace(/[\s\-/]+/g, '_');
  }

  function splitBreaks(text) {
    return String(text || '')
      .replace(/\s*,?\s*\bBREAK\b\s*,?\s*/gi, BREAK_MARK)
      .split(BREAK_MARK);
  }

  function tokenize(text) {
    return String(text || '').split(',').map(function (token) { return token.trim(); }).filter(Boolean);
  }

  function dedupeSegment(text, seen) {
    return tokenize(text).filter(function (token) {
      var key = normalizeKey(token);
      if (!key || key === 'break') return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).join(', ');
  }

  function dedupeText(text, externalSeen) {
    var sections = splitBreaks(text);
    if (sections.length === 1) return dedupeSegment(sections[0], externalSeen || new Set());
    return sections.map(function (section) {
      // BREAK marks a new subject scope. Never remove an attribute because it
      // appeared on the other character or in the global character prefix.
      return dedupeSegment(section, new Set());
    }).filter(Boolean).join(' BREAK ');
  }

  function dedupeParts(parts) {
    var positiveSeen = new Set();
    var negativeSeen = new Set();
    return (parts || []).map(function (part) {
      var hasBreak = /\bBREAK\b/i.test(part.text || '');
      var seen = part.cls === 'n' ? negativeSeen : positiveSeen;
      var text = dedupeText(part.text, hasBreak ? null : seen);
      return { cls:part.cls, text:text };
    }).filter(function (part) { return part.text; });
  }

  function framingFamily(token) {
    var key = normalizeKey(token);
    return Object.keys(FRAME_GROUPS).find(function (family) {
      return FRAME_GROUPS[family].indexOf(key) !== -1;
    }) || '';
  }

  function selectedFramingFamily(shot) {
    if (shot === 'close' || shot === 'detail') return 'close';
    if (shot === 'medium') return 'medium';
    if (shot === 'wide') return 'wide';
    return '';
  }

  function resolveFramingMode(shot, tags) {
    // Any explicit director shot is authoritative, including POV/angle shots
    // that intentionally have no close/medium/wide family. Only fall back to
    // scene/manual tags when the director has not selected a shot at all.
    if (shot) return selectedFramingFamily(shot);
    var values = Array.isArray(tags) ? tags : tokenize(tags);
    var families = values.map(framingFamily).filter(Boolean);
    if (families.indexOf('wide') !== -1) return 'wide';
    if (families.indexOf('close') !== -1) return 'close';
    if (families.indexOf('medium') !== -1) return 'medium';
    return '';
  }

  function filterFraming(text, shot) {
    var selected = selectedFramingFamily(shot);
    if (!selected) return String(text || '');
    return splitBreaks(text).map(function (section) {
      return tokenize(section).filter(function (token) {
        var family = framingFamily(token);
        return !family || family === selected;
      }).join(', ');
    }).filter(Boolean).join(' BREAK ');
  }

  function applyFraming(parts, shot) {
    if (!selectedFramingFamily(shot)) return (parts || []).slice();
    return (parts || []).map(function (part) {
      if (!part || part.cls === 'n') return part;
      var copy = {};
      Object.keys(part).forEach(function (key) { copy[key] = part[key]; });
      copy.text = filterFraming(part.text, shot);
      return copy;
    }).filter(function (part) { return part && part.text; });
  }

  function isNegativeBoilerplate(token) {
    return NEGATIVE_BOILERPLATE.has(normalizeKey(token));
  }

  function mergeNegativePrompt(prefix, base, mode, replaceScope) {
    var normalizedMode = String(mode || '').toLowerCase();
    if (normalizedMode !== 'replace') {
      return dedupeSegment([prefix, base].filter(Boolean).join(', '), new Set());
    }
    if (String(replaceScope || 'boilerplate').toLowerCase() === 'all') {
      return dedupeSegment(prefix, new Set());
    }
    var semantic = tokenize(base).filter(function (token) {
      return !isNegativeBoilerplate(token);
    });
    return dedupeSegment([prefix].concat(semantic).filter(Boolean).join(', '), new Set());
  }

  function inferStory(story) {
    var source = String(story || '').trim().toLowerCase();
    var tags = [];
    var matched = [];
    if (!source) return { tags:tags, matched:matched };
    STORY_RULES.forEach(function (rule) {
      var word = rule.words.find(function (candidate) { return source.indexOf(candidate.toLowerCase()) !== -1; });
      if (!word) return;
      matched.push(word);
      rule.tags.forEach(function (tag) { if (tags.indexOf(tag) === -1) tags.push(tag); });
    });
    return { tags:tags, matched:matched };
  }

  function sceneCharacter(scene) {
    if (scene && Array.isArray(scene.character) && scene.character.length > 1) return 'triad';
    var value = String(scene && (scene.char || scene.character) || '').toLowerCase();
    if (value.indexOf('triad') !== -1 || value.indexOf('dual') !== -1 || value.indexOf('both') !== -1) return 'triad';
    if (value.indexOf('natsume') !== -1 || value.indexOf('shiki') !== -1) return 'natsume';
    if (value.indexOf('nene') !== -1 || value.indexOf('ayachi') !== -1) return 'nene';
    return '';
  }

  function sceneSupportsCharacter(scene, character) {
    if (!scene) return true;
    return sceneCharacter(scene) === character;
  }

  function mergeSubjectBlock(block, identityTags) {
    var raw = String(block || '').trim();
    var open = raw.charAt(0) === '(';
    var close = raw.charAt(raw.length - 1) === ')';
    if (open) raw = raw.slice(1);
    if (close) raw = raw.slice(0, -1);
    var merged = dedupeSegment(identityTags.concat(tokenize(raw)).join(', '), new Set());
    return '(' + merged + ')';
  }

  function enrichDualPrompt(text, neneTags, natsumeTags) {
    var sections = splitBreaks(text);
    var left = sections[0] || '';
    var right = sections[1] || '';
    var leftStart = left.lastIndexOf('(');
    var global = leftStart >= 0 ? left.slice(0, leftStart).replace(/,\s*$/, '') : left.replace(/,\s*$/, '');
    var leftBlock = leftStart >= 0 ? left.slice(leftStart) : '';
    var leftIsNatsume = /shiki_natsume/i.test(leftBlock);
    var rightIsNene = /ayachi_nene/i.test(right);
    var firstTags = leftIsNatsume ? natsumeTags : neneTags;
    var secondTags = rightIsNene ? neneTags : natsumeTags;
    var enrichedLeft = mergeSubjectBlock(leftBlock, firstTags);
    var enrichedRight = mergeSubjectBlock(right, secondTags);
    return [global, enrichedLeft].filter(Boolean).join(', ') + ' BREAK ' + enrichedRight;
  }

  function ratingOf(scene) {
    var rating = String(scene && scene.rating || '').toUpperCase();
    if (rating === 'R18' || (scene && scene.mature)) return 'R18';
    if (rating === 'R15') return 'R15';
    return 'ALL';
  }

  function adaptNegative(text, scene, context) {
    context = context || {};
    var rating = ratingOf(scene);
    var remove = new Set();
    if (rating === 'R18') ['nsfw','nude','naked','explicit'].forEach(function (tag) { remove.add(tag); });
    if (rating === 'R15') remove.add('nsfw');
    if (context.shot === 'close' || context.shot === 'detail') remove.add('cropped');
    if (context.character === 'triad') remove.add('duplicate');
    var tokens = tokenize(text).filter(function (token) { return !remove.has(normalizeKey(token)); });
    var required = rating === 'R18' ? ['child','loli','underage'] : (rating === 'R15' ? ['nude','explicit'] : ['nsfw','nude','explicit']);
    required.forEach(function (tag) { tokens.push(tag); });
    return dedupeSegment(tokens.join(', '), new Set());
  }

  function analyzeParts(parts) {
    var positive = [];
    var negative = [];
    var hasBreak = false;
    (parts || []).forEach(function (part) {
      if (/\bBREAK\b/i.test(part.text || '')) hasBreak = true;
      var target = part.cls === 'n' ? negative : positive;
      splitBreaks(part.text).forEach(function (section) {
        tokenize(section).forEach(function (token) {
          if (/^\s*<lora:/i.test(token)) return;
          var key = normalizeKey(token);
          if (key && key !== 'break') target.push(key);
        });
      });
    });
    var warnings = [];
    var frameFamilies = new Set(positive.map(framingFamily).filter(Boolean));
    if (frameFamilies.size > 1) warnings.push('镜头景别相互竞争');
    if (!hasBreak && positive.indexOf('closed_eyes') !== -1 && positive.indexOf('looking_at_viewer') !== -1) warnings.push('闭眼与直视镜头冲突');
    if (!hasBreak) {
      var poseCount = ['standing','sitting','lying','kneeling'].filter(function (pose) { return positive.indexOf(pose) !== -1; }).length;
      if (poseCount > 1) warnings.push('主体姿势相互冲突');
    }
    var negativeSet = new Set(negative);
    var overlap = Array.from(new Set(positive.filter(function (tag) { return negativeSet.has(tag); })));
    if (overlap.length) warnings.push('正负词冲突：' + overlap.slice(0, 3).join('、'));
    var level = warnings.length || positive.length > 64 ? 'warn' : 'ok';
    if (positive.length > 78 || warnings.length > 2) level = 'over';
    var label = warnings.length ? warnings[0] : (positive.length > 64 ? '建议精简' : '结构均衡');
    return { positiveCount:positive.length, negativeCount:negative.length, warnings:warnings, level:level, label:label };
  }

  function recommendAspect(tags, character) {
    var values = Array.isArray(tags) ? tags : tokenize(tags);
    var keys = values.map(normalizeKey);
    if (character === 'triad' || keys.some(function (key) { return FRAME_GROUPS.wide.indexOf(key) !== -1; })) return 'landscape';
    if (keys.some(function (key) { return FRAME_GROUPS.close.indexOf(key) !== -1; })) return 'square';
    return 'portrait';
  }

  return {
    normalizeKey:normalizeKey,
    tokenize:tokenize,
    splitBreaks:splitBreaks,
    dedupeText:dedupeText,
    dedupeParts:dedupeParts,
    filterFraming:filterFraming,
    applyFraming:applyFraming,
    resolveFramingMode:resolveFramingMode,
    isNegativeBoilerplate:isNegativeBoilerplate,
    mergeNegativePrompt:mergeNegativePrompt,
    inferStory:inferStory,
    sceneCharacter:sceneCharacter,
    sceneSupportsCharacter:sceneSupportsCharacter,
    enrichDualPrompt:enrichDualPrompt,
    ratingOf:ratingOf,
    adaptNegative:adaptNegative,
    analyzeParts:analyzeParts,
    recommendAspect:recommendAspect
  };
});
