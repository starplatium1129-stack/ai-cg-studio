'use strict';

var assert = require('assert');
var test = require('node:test');
var popular = require('../../src/utils/popularContent.ts');
var recipes = require('../../src/config/kreaStyleRecipes.ts');
var persistence = require('../../src/utils/promptBuilderPersistence.ts');
var animaRoute = require('../../routes/anima.js');

var characterData = require('../../data/popular-characters.json');
var blueprintData = require('../../data/scene-blueprints.json');

var characters = popular.parsePopularCharacters(characterData);
var blueprints = popular.parseSceneBlueprints(blueprintData);

test('popular data: 33 characters, unique ids, exactly one default outfit per character', function () {
  assert.strictEqual(characters.length, 33, 'must ship exactly 33 characters');
  var ids = new Set(characters.map(function (character) { return character.id; }));
  assert.strictEqual(ids.size, 33, 'character ids must be unique');
  characters.forEach(function (character) {
    assert.ok(character.outfits.length >= 2 && character.outfits.length <= 8, character.id + ' must have 2-8 outfits (researched official skins + derived casual wear)');
    var defaults = character.outfits.filter(function (outfit) { return outfit.default; });
    assert.strictEqual(defaults.length, 1, character.id + ' must have exactly one default outfit');
    var outfitIds = new Set(character.outfits.map(function (outfit) { return outfit.id; }));
    assert.strictEqual(outfitIds.size, character.outfits.length, character.id + ' outfit ids must be unique');
    assert.ok(character.identityTokens.length > 0, character.id + ' needs identityTokens');
    assert.ok(character.exactTokens.length > 0, character.id + ' needs exactTokens');
    assert.ok(character.supportedEngines.includes('anima-aesthetic-v1.1'), character.id + ' must support Anima Aesthetic');
    assert.ok(character.supportedEngines.includes('krea2-turbo-fp8'), character.id + ' must support Krea 2');
  });
    assert.strictEqual(popular.findCharacter(characters, 'rem_rezero').exactTokens[0], 'rem_(re_zero)', 'rem must use the disambiguated Danbooru tag');
  assert.strictEqual(popular.findCharacter(characters, 'emilia_rezero').exactTokens[0], 'emilia_(re_zero)', 'emilia must use the disambiguated Danbooru tag');
  assert.strictEqual(popular.findCharacter(characters, 'kisara_engage_kiss').exactTokens[0], 'kisara_(engage_kiss)', 'kisara must use the disambiguated Danbooru tag');
var adults = characters.filter(function (character) { return character.adultEligibility === 'adult'; });
  var nonAdults = characters.filter(function (character) { return character.adultEligibility !== 'adult'; });
  assert.ok(adults.length >= 1, 'at least one clearly-adult character must be available for adult blueprints');
  // 2026-08-14 用户决策「全部开放」：18 角色全部 adultEligibility=adult；
  // fail-closed 语义（adultEnabled=false、unknown/underage 分类）由下方合成对象用例继续保证。
  assert.strictEqual(nonAdults.length, 0, 'all popular characters are adult-eligible after the full-open decision');
});

test('popular data: all character fields never leak nene/natsume anchors', function () {
  characters.forEach(function (character) {
    // 全字段扫描：identityTokens/exactTokens/identityProse/aliases/exactPrefixes/outfit prose+tokens。
    var leaks = popular.scanCharacterPollution(character);
    assert.deepStrictEqual(leaks, [], character.id + ' leaked studio LoRA anchors: ' + leaks.join(' | '));
    character.identityTokens.concat(character.exactTokens).forEach(function (token) {
      assert.ok(!/(?:ayachi_nene|shiki_natsume|^nene_|^natsume_)/i.test(token),
        character.id + ' leaked studio LoRA token ' + token);
    });
  });
  var synthetic = JSON.parse(JSON.stringify(characters[0]));
  synthetic.identityProse = 'a girl who looks like ayachi_nene in the rain';
  assert.deepStrictEqual(popular.scanCharacterPollution(synthetic), ['raiden_shogun.identityProse: studio character name']);
  synthetic.identityProse = 'plain prose';
  synthetic.outfits[0].tokens = ['nene_school_uniform', 'school_uniform'];
  assert.deepStrictEqual(popular.scanCharacterPollution(synthetic), ['raiden_shogun.outfit.shogun_robes: studio control prefix']);
});

test('blueprints: 33 characters x (6 prototype + 4 adult), all owned by a character, adult blueprints fail closed for non-adults', function () {
  // 2026-08-15 扩容：新增 15 位方舟/终末地热门角色（洛茜因底模无训练数据、实测还原不足已移除），
  // 各配 6 原型 + 4 成人场景（33 角色 = 27x10 + 6x11）。
  assert.strictEqual(blueprints.length, 336, 'expected 336 character scenes, got ' + blueprints.length);
  var ids = new Set(blueprints.map(function (blueprint) { return blueprint.id; }));
  assert.strictEqual(ids.size, blueprints.length, 'blueprint ids must be unique');
  var byCharacter = {};
  blueprints.forEach(function (blueprint) {
    var text = JSON.stringify(blueprint);
    assert.ok(!/(?:ayachi_nene|shiki_natsume|nene_|natsume_)/i.test(text), blueprint.id + ' must not reference studio LoRA tokens');
    assert.ok(!/(?:official_cg|visual_audited)/i.test(text), blueprint.id + ' must not leak retrieval metadata');
    assert.ok(blueprint.promptProse.length > 20, blueprint.id + ' needs a prose prompt');
    assert.ok(blueprint.promptTokens.length > 0, blueprint.id + ' needs prompt tokens');
    if (blueprint.characterId) byCharacter[blueprint.characterId] = (byCharacter[blueprint.characterId] || 0) + 1;
  });
  // 每个角色 10 或 11 个场景：10=6 原型+4 成人（12 角色）、11=6 原型+5 成人（6 角色）；
  // 全部蓝图必须归属某个角色（通用蓝图已删除）。
  var sceneDist = {};
  Object.entries(byCharacter).forEach(function (entry) {
    assert.ok(entry[1] === 10 || entry[1] === 11, entry[0] + ' must own 10 or 11 scenes, got ' + entry[1]);
    sceneDist[entry[1]] = (sceneDist[entry[1]] || 0) + 1;
  });
  assert.deepStrictEqual(sceneDist, { 10: 27, 11: 6 }, 'scene distribution must be 27x10 + 6x11');
  assert.strictEqual(blueprints.filter(function (blueprint) { return !blueprint.characterId; }).length, 0,
    'every blueprint must belong to a character (generic blueprints were removed)');
  // 每角色 4 或 5 个带 characterId 的成人场景。
  var adultDist = {};
  Object.entries(byCharacter).forEach(function (entry) {
    var adultOwned = blueprints.filter(function (blueprint) { return blueprint.characterId === entry[0] && blueprint.adult; });
    assert.ok(adultOwned.length === 4 || adultOwned.length === 5,
      entry[0] + ' must own 4 or 5 character-specific adult scenes, got ' + adultOwned.length);
    adultDist[adultOwned.length] = (adultDist[adultOwned.length] || 0) + 1;
  });
  assert.deepStrictEqual(adultDist, { 4: 27, 5: 6 }, 'adult distribution must be 27x4 + 6x5');

  var adultBlueprints = blueprints.filter(function (blueprint) { return blueprint.adult; });
  assert.ok(adultBlueprints.length >= 1, 'adult-only blueprints must exist');
  var nonAdultCharacters = characters.filter(function (character) { return character.adultEligibility !== 'adult'; });
  nonAdultCharacters.forEach(function (character) {
    adultBlueprints.forEach(function (blueprint) {
      assert.strictEqual(popular.blueprintEligible(blueprint, character, { adultEnabled: true }), false,
        character.id + ' must never see adult blueprint ' + blueprint.id);
      assert.strictEqual(popular.buildPopularPromptPlan({
        character: character, outfit: character.outfits[0], blueprint: blueprint,
        engine: 'anima', adultEnabled: true,
      }), null, character.id + ' must fail closed when building an adult blueprint');
    });
  });
  var adult = characters.find(function (character) { return character.adultEligibility === 'adult'; });
  assert.strictEqual(popular.blueprintEligible(adultBlueprints[0], adult, { adultEnabled: true }), true);
  assert.strictEqual(popular.blueprintEligible(adultBlueprints[0], adult, { adultEnabled: false }), false,
    'adult gate must require the mature-content switch as well');
});

test('blueprint rotation: deterministic, changes per cursor, avoids immediate repeat', function () {
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var pool = popular.eligibleBlueprints(blueprints, raiden, { adultEnabled: true });
  var first = popular.recommendBlueprints(pool, 'raiden_shogun#shogun_robes', 0, null, 3);
  assert.strictEqual(first.length, 3);
  var repeat = popular.recommendBlueprints(pool, 'raiden_shogun#shogun_robes', 0, null, 3);
  assert.deepStrictEqual(first.map(function (blueprint) { return blueprint.id; }), repeat.map(function (blueprint) { return blueprint.id; }),
    'same cursor must be deterministic');
  var second = popular.recommendBlueprints(pool, 'raiden_shogun#shogun_robes', 1, first.map(function (blueprint) { return blueprint.id; }), 3);
  assert.notDeepStrictEqual(second.map(function (blueprint) { return blueprint.id; }), first.map(function (blueprint) { return blueprint.id; }),
    'consecutive cursor must avoid the previous set');
});

test('prompt compiler: Anima keeps identity anchors exact, no studio pollution, Krea negative always empty', function () {
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var outfit = raiden.outfits.find(function (item) { return item.default; }) || raiden.outfits[0];
  var blueprint = blueprints.find(function (item) { return item.id === 'raiden_shogun_tenshukaku'; });

  var anima = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'anima', profile: null, adultEnabled: true,
  });
  assert.ok(anima, 'anima plan must build for a safe blueprint');
  assert.ok(anima.prompt.includes('raiden_shogun'), 'canonical identity anchor must be preserved exactly');
  assert.ok(anima.prompt.includes('tenshukaku'), 'blueprint tokens must be synthesized');
  assert.ok(anima.prompt.includes('japanese_clothes') || anima.prompt.includes('kimono'), 'outfit tokens must be synthesized');
  assert.ok(anima.negative.length > 0, 'Anima no-LoRA workflow keeps negative tokens');

  var visualAnima = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'anima', profile: null, adultEnabled: true,
    visualDescription: 'The girl gently holds a bouquet of flowers, petals drifting onto her shoulder.',
  });
  assert.ok(visualAnima.prompt.includes('bouquet'), 'user visual description must enter the no-LoRA prompt');
  assert.ok(visualAnima.prompt.includes('japanese_clothes') || visualAnima.prompt.includes('kimono'),
    'user visual description must not replace the selected outfit');
  var fallbackAnima = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'anima', profile: null, adultEnabled: true,
  });
  assert.ok(fallbackAnima.prompt.includes('japanese_clothes') || fallbackAnima.prompt.includes('kimono'),
    'empty visual description still keeps the selected outfit tokens');

  var animaText = [anima.prompt, anima.negative].join(' ');
  assert.ok(!/(?:ayachi_nene|shiki_natsume)/i.test(animaText), 'no studio character name');
  assert.ok(!/(?:nene_|natsume_)[a-z0-9_]+/i.test(animaText), 'no studio control tokens');
  assert.ok(!/<lora:/i.test(animaText), 'no lora syntax');
  assert.ok(!/official_cg|visual_audited/i.test(animaText), 'no retrieval metadata');
  assert.ok(!/这是故事|台词|心理活动/i.test(animaText), 'no story/dialogue/psychology leakage');

  var krea = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'krea2', profile: null, adultEnabled: true,
  });
  assert.ok(krea, 'krea plan must build');
  assert.strictEqual(krea.negative, '', 'Krea must never carry a negative');
  var kreaText = krea.prompt;
  assert.ok(!/(?:ayachi_nene|shiki_natsume|nene_|natsume_)/i.test(kreaText), 'krea no studio pollution');
  assert.ok(!/<lora:/i.test(kreaText), 'krea no lora syntax');
  assert.ok(!/official_cg|visual_audited/i.test(kreaText), 'krea no retrieval metadata');
  assert.strictEqual((kreaText.match(/flowing purple Japanese robes/gi) || []).length, 1, 'selected outfit must appear exactly once');
  assert.ok(!/completely deserted|not a single other person|no commuters/i.test(kreaText), 'Krea must not force every public scene to be deserted');
});

test('prompt compiler: manual expert tags are sanitized against studio control tokens', function () {
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var outfit = raiden.outfits[0];
  var manual = ['nene_school_uniform', 'shiki_natsume', 'raiden_shogun', 'thighhighs', 'natsume_cafe_uniform'];
  var sanitized = popular.sanitizePopularManual(manual);
  assert.deepStrictEqual(sanitized, ['raiden_shogun', 'thighhighs']);
  var anima = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: null, engine: 'anima', profile: null, manual: manual, adultEnabled: true,
  });
  var text = anima.prompt;
  assert.ok(!/(?:nene_|natsume_)/i.test(text), 'manual studio tokens must be stripped');
  assert.ok(text.includes('thighhighs'), 'valid manual tag survives');
});

test('krea style recipes: >=8 common recipes, explicit adult recipes, unique ids, no studio pollution', function () {
  var all = recipes.KREA_STYLE_RECIPES;
  var common = all.filter(function (recipe) { return !recipe.adult; });
  var adult = all.filter(function (recipe) { return recipe.adult; });
  assert.ok(all.length >= 9, 'must ship at least 8 common + explicit adult recipes, got ' + all.length);
  assert.ok(common.length >= 8, 'must ship at least 8 common recipes, got ' + common.length);
  assert.ok(adult.length >= 1, 'must ship explicit adult-only recipes');
  var ids = new Set(all.map(function (recipe) { return recipe.id; }));
  assert.strictEqual(ids.size, all.length, 'recipe ids must be unique');
  all.forEach(function (recipe) {
    assert.ok(recipe.lead && recipe.lead.trim().length > 10, recipe.id + ' needs a real lead phrase');
    assert.ok(!/(?:ayachi_nene|shiki_natsume|nene_|natsume_)/i.test(recipe.lead + ' ' + (recipe.medium || '')),
      recipe.id + ' leaked studio anchors');
  });
  assert.ok(adult.every(function (recipe) { return /^r18_/.test(recipe.id); }), 'adult recipes must be independently and explicitly id-prefixed');
});

test('krea style recipes: adult recipes fail closed for unknown/underage and without the mature switch', function () {
  var adult = recipes.KREA_STYLE_RECIPES.filter(function (recipe) { return recipe.adult; })[0];
  assert.ok(adult);
  var adultChar = characters.find(function (character) { return character.adultEligibility === 'adult'; });
  assert.ok(adultChar, 'at least one adult-eligible character must exist');
  // 数据已按「全部开放」升为 adult；用合成 underage/unknown 对象保持 fail-closed 契约。
  var ineligible = [
    { id: 'synthetic-underage', adultEligibility: 'underage' },
    { id: 'synthetic-unknown', adultEligibility: 'unknown' },
  ];
  assert.strictEqual(recipes.recipeEligible(adult, adultChar, { adultEnabled: true }), true);
  assert.strictEqual(recipes.recipeEligible(adult, adultChar, { adultEnabled: false }), false,
    'adult recipe must require the mature-content switch');
  ineligible.forEach(function (character) {
    assert.strictEqual(recipes.recipeEligible(adult, character, { adultEnabled: true }), false,
      character.id + ' must never be eligible for an adult recipe');
    assert.ok(recipes.eligibleStyleRecipes(recipes.KREA_STYLE_RECIPES, character, { adultEnabled: true })
      .every(function (recipe) { return !recipe.adult; }), character.id + ' must see no adult recipes');
  });
});

test('krea style recipes: resolution is engine-default -> blueprint hint -> selection, gated fail-closed', function () {
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var flower = blueprints.find(function (blueprint) { return blueprint.id === 'raiden_shogun_tenshukaku'; });
  var adultBp = blueprints.find(function (blueprint) { return blueprint.adult; });

  // 无 hint / 无手选：引擎缺省。
  var auto = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', null, null, raiden, { adultEnabled: true });
  assert.strictEqual(auto.lead, 'A polished visual novel event CG with refined cel shading and crisp character work');
  var animaAuto = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'anima', null, null, raiden, { adultEnabled: true });
  assert.ok(animaAuto.lead.indexOf('anime key visual') !== -1, 'anima default must be the key visual recipe');
  // 解析层照常返回自然语言 lead；Anima 组装改取同配方的模型原生短标签。
  var animaBuilt = popular.buildPopularPromptPlan({
    character: raiden, outfit: raiden.outfits[0], blueprint: null, engine: 'anima', profile: null, adultEnabled: true, style: animaAuto,
  });
  assert.ok(animaBuilt.prompt.indexOf('anime key visual') !== -1, 'anima must include the model-native style tags');
  assert.ok(!/anime key visual\.$/i.test(animaBuilt.prompt), 'anima must not append the style medium');
  assert.ok(animaBuilt.prompt.includes('Raiden Shogun from Genshin Impact'), 'Anima must receive the popular character identity prose');

  // 角色原型场景无 hint：引擎缺省即兜底（hint 仅成人蓝图与手选携带）。
  var hinted = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', flower, null, raiden, { adultEnabled: true });
  assert.strictEqual(hinted.lead, auto.lead, 'character scene without kreaStyleHint must fall back to the engine default');
  var hintedAnima = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'anima', flower, null, raiden, { adultEnabled: true });
  assert.strictEqual(hintedAnima.lead, animaAuto.lead, 'character scene without animaStyleHint must fall back to the engine default');

  // 手选覆盖 hint。
  var selected = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', flower, 'dreamy_pastel', raiden, { adultEnabled: true });
  assert.strictEqual(selected.medium, 'dreamy pastel art', 'selection must override the blueprint hint');

  // 成人蓝图 hint → 成人配方，仅对 adult 角色可达。
  var adultStyle = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', adultBp, null, raiden, { adultEnabled: true });
  assert.strictEqual(adultStyle.adult, true, 'adult blueprint hint must resolve to an adult recipe');
  var ineligible = { id: 'synthetic-underage', adultEligibility: 'underage' };
  assert.strictEqual(recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', adultBp, null, ineligible, { adultEnabled: true }), null,
    'underage character must fail closed on an adult recipe hint');
  assert.strictEqual(recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', adultBp, null, raiden, { adultEnabled: false }), null,
    'adult recipe must fail closed when the mature switch is off');

  // hint 可以是自由风格短语（未命中配方 id 时原样作为前置短语）。
  var freeHint = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', { kreaStyleHint: 'soft watercolor anime style' }, null, raiden, { adultEnabled: true });
  assert.strictEqual(freeHint.lead, 'soft watercolor anime style');
  assert.strictEqual(freeHint.adult, false, 'free phrase hints are never adult');
});

test('krea prose: automatic style first, 3-5 visual sentences, no meta phrases or tag stuffing', function () {
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var outfit = raiden.outfits.find(function (item) { return item.default; }) || raiden.outfits[0];
  var blueprint = blueprints.find(function (item) { return item.id === 'raiden_shogun_tenshukaku'; });
  var style = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', blueprint, null, raiden, { adultEnabled: true });

  var krea = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'krea2', profile: null, adultEnabled: true, style: style,
  });
  assert.ok(krea);
  assert.strictEqual(krea.negative, '');
  var text = krea.prompt;

  // 风格配方开头（角色场景无 hint → 引擎默认）。
  assert.ok(text.startsWith('A polished visual novel event CG'), 'engine default style lead must open the Krea prompt');
  // 无 meta 短语 / 无检索元数据 / 无工作室污染。
  assert.ok(!/(?:In this image|The image shows|Scene details:|Composition and lighting|A visual novel event CG featuring)/i.test(text));
  assert.ok(!/official_cg|visual_audited/i.test(text));
  assert.ok(!/(?:ayachi_nene|shiki_natsume|nene_|natsume_|<lora:)/i.test(text));
  // 无逗号标签堆砌：不出现下划线 token，也不出现连续逗号标签。
  assert.ok(!/[a-z]+_[a-z]+/i.test(text), 'krea prose must not carry raw danbooru tokens');
  assert.ok(!/,\s*\w+,\s*\w+,\s*\w+,\s*$/.test(text), 'krea prose must not end with a comma-stuffed list');
  // identityProse / outfitProse / promptProse 作为自然语言织入，未退化成标签流。
  assert.ok(text.includes('Raiden Shogun from Genshin Impact, also known as Raiden Ei, the Electro Archon'),
    'identityProse must be woven verbatim');
  assert.ok(/the Raiden Shogun's flowing purple Japanese robes, bare shoulders, thigh-highs and a long braid/i.test(text),
    'outfitProse must be woven verbatim');
  assert.ok(text.includes("Inside the Raiden Shogun's Tenshukaku throne hall in Inazuma"),
    'blueprint promptProse must be woven verbatim');
  // 散文句子必须以句号收束。
  var sentences = text.split(/(?<=\.)\s/);
  assert.ok(sentences.length >= 3 && sentences.length <= 5, 'Krea prompt must contain 3-5 concise visual sentences');
  sentences.forEach(function (sentenceText) {
    assert.ok(/\.$/.test(sentenceText.trim()), 'each prose sentence must end with a period');
  });
});

test('krea prose: adult recipe fails closed inside buildPopularPromptPlan for ineligible characters', function () {
  var ineligible = JSON.parse(JSON.stringify(characters[0]));
  ineligible.adultEligibility = 'underage';
  var adultBp = blueprints.find(function (blueprint) { return blueprint.adult; });
  var adultStyle = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', adultBp, null, ineligible, { adultEnabled: true });
  assert.strictEqual(adultStyle, null, 'underage must never resolve an adult style');
  // 即便调用方绕过解析直接传 adult 配方，build 层也要再 fail-closed 一次。
  var sneaked = popular.buildPopularPromptPlan({
    character: ineligible, outfit: ineligible.outfits[0], blueprint: adultBp, engine: 'krea2',
    profile: null, adultEnabled: true, style: { lead: 'mature sensual content', adult: true },
  });
  assert.strictEqual(sneaked, null, 'build layer must reject an adult style for an ineligible character');
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var legit = popular.buildPopularPromptPlan({
    character: raiden, outfit: raiden.outfits[0], blueprint: adultBp, engine: 'krea2',
    profile: null, adultEnabled: true, style: { lead: 'mature sensual content', medium: 'mature art', adult: true },
  });
  assert.ok(legit, 'adult character + mature switch must build with an adult style');
  assert.ok(/mature sensual content/i.test(legit.prompt), 'adult style lead must reach the prompt');
  assert.ok(legit.prompt.split(/(?<=\.)\s/).length <= 5, 'adult Krea prompt must remain concise');
});

test('blueprint hints: kreaStyleHint/animaStyleHint stay optional; adult blueprints must carry an adult hint', function () {
  var tenshukaku = blueprints.find(function (blueprint) { return blueprint.id === 'raiden_shogun_tenshukaku'; });
  assert.ok(tenshukaku && tenshukaku.kreaStyleHint === undefined, 'character prototype scenes may omit style hints');
  var adultBp = blueprints.find(function (blueprint) { return blueprint.adult; });
  assert.ok(adultBp.kreaStyleHint && /^r18_/.test(adultBp.kreaStyleHint), 'adult blueprint must carry an adult recipe hint');
  var unknown = blueprints.find(function (blueprint) { return blueprint.kreaStyleHint === undefined; });
  assert.ok(unknown, 'hints must be optional for blueprints without a strong style identity');
});

test('prompt compiler: Anima negative merges profile negative_prefix per negative_mode, Krea stays empty', function () {
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var outfit = raiden.outfits[0];
  var blueprint = blueprints.find(function (item) { return item.id === 'raiden_shogun_thunder_night'; });
  // anima_aesthetic_v11：negative_mode=replace, replace_scope=boilerplate。
  var profile = { engine: 'anima', negative_prefix: 'worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration', negative_mode: 'replace', negative_replace_scope: 'boilerplate', exact_tokens: ['best_quality'] };

  var anima = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'anima', profile: profile, adultEnabled: true,
  });
  assert.ok(anima, 'anima plan must build');
  assert.ok(anima.negative.includes('artist name'), 'profile negative_prefix must be merged in');
  assert.ok(anima.negative.includes('chromatic aberration'), 'profile negative_prefix tail must be merged in');
  assert.ok(anima.negative.includes('neon'), 'blueprint non-boilerplate negative must be kept');
  assert.ok(!anima.negative.includes('<lora:'), 'no lora syntax in negative');

  var krea = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'krea2', profile: profile, adultEnabled: true,
  });
  assert.ok(krea);
  assert.strictEqual(krea.negative, '', 'Krea negative must always be empty regardless of profile prefix');
});

test('curated artist styles use native Anima tags and Krea prose', function () {
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var outfit = raiden.outfits[0];
  var blueprint = blueprints.find(function (item) { return item.id === 'raiden_shogun_tenshukaku'; });
  var anima = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'anima', profile: { engine:'anima' },
    artistTags: ['@kantoku', '@mika pikazo'], artistProse: 'with visual styling inspired by Kantoku and Mika Pikazo',
  });
  assert.ok(anima.prompt.includes('@kantoku') && anima.prompt.includes('@mika pikazo'));
  var krea = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'krea2', profile: { engine:'krea2' },
    style: { lead:'A polished visual novel event CG', medium:'visual novel event CG' },
    artistTags: [], artistProse: 'with visual styling inspired by Kantoku and Mika Pikazo',
  });
  assert.ok(krea.prompt.startsWith('A polished visual novel event CG, with visual styling inspired by Kantoku and Mika Pikazo.'));
  assert.ok(!krea.prompt.includes('@kantoku'));
});

test('prompt compiler: restored adult blueprint fails closed for ineligible characters', function () {
  var ineligible = JSON.parse(JSON.stringify(characters[0]));
  ineligible.adultEligibility = 'underage';
  var adultBlueprint = blueprints.find(function (item) { return item.adult; });
  assert.ok(adultBlueprint);
  // 无论 manualTags / profile 是否携带显式词，组装必须整体拒绝。
  var rejected = popular.buildPopularPromptPlan({
    character: ineligible, outfit: ineligible.outfits[0], blueprint: adultBlueprint, engine: 'anima', profile: null, adultEnabled: true,
  });
  assert.strictEqual(rejected, null, 'underage character must never assemble an adult blueprint');
  assert.ok(!adultBlueprint.promptTokens.join(' ').match(/nsfw|nude|explicit/i), 'adult blueprint should not smuggle explicit tokens via assembly');
});

test('view source sentinels: popular copy/preview, studio refresh, preview badge, recommended engine branch', function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '..', '..');
  var view = fs.readFileSync(path.join(root, 'src', 'views', 'PromptBuilderView.vue'), 'utf8');
  var panel = fs.readFileSync(path.join(root, 'src', 'components', 'AnimaQuickPanel.vue'), 'utf8');

  // Finding 1：popular 模式复制 Prompt 必须用 previewPromptView，不是 studio previewPrompt。
  assert.ok(/copyPrompt[\s\S]*?previewPromptView\.value/.test(view), 'copyPrompt must copy the popular-aware preview');
  assert.ok(view.includes('navigator.clipboard.writeText(previewPromptView.value)'), 'copyPrompt must write previewPromptView');

  // Finding 3：popular→studio 立即 refreshAnimaBackend 恢复 nene/natsume。
  assert.ok(/setStudioSubject\(\)[\s\S]{0,200}refreshAnimaBackend\(\)/.test(view), 'studio switch must refresh backend immediately');

  // Finding 6：metadata preview 已随夏目 v20 晋级停用（不再有任何 preview LoRA）。
  // 请求元数据构建归 useAnimaSession（第十二轮），哨兵随之迁移。
  var sessionSource = fs.readFileSync(path.join(root, 'src', 'composables', 'useAnimaSession.ts'), 'utf8');
  assert.ok(!/preview:\s*request\.character\s*===\s*'natsume'\s*\|\|\s*request\.character\s*===\s*null/.test(view),
    'preview must not be implied by character===null');
  assert.ok(/preview:\s*false/.test(sessionSource), 'preview must be retired after Natsume v20 promotion');
  assert.ok(/historyGenerationFields[\s\S]*?preview:\s*meta\.preview\s*===\s*true/.test(view),
    'history preview must be driven by the real preview flag, not character fallback');
  assert.ok(!/preview:\s*meta\.preview\s*===\s*true\s*\|\|\s*meta\.character\s*===\s*'natsume'/.test(view),
    'history preview must not fall back to a hardcoded character');

  // Finding 10：推荐引擎为 Krea 时必须切 drawEngine='krea2'（防死字段）。
  assert.ok(/applyRecommendedEngine[\s\S]*?recommendedEngine\s*===\s*'krea2-turbo-fp8'\s*\?\s*'krea2'\s*:\s*'anima'/.test(view),
    'recommended engine must map krea2-turbo-fp8 to the krea2 engine');
  assert.ok(/applyRecommendedEngine\(character\)/.test(view) && /applyRecommendedEngine\(first\)/.test(view),
    'recommended engine must be applied on character/source selection');

  // Finding 2：蓝图尺寸必须收敛到当前底模 sizes。
  assert.ok(view.includes('closestSupportedSize(activeModel, normalized)') && view.includes('applyRecommendedSize(decision.size)'),
    'selectBlueprint must clamp to the nearest active-model size');

  assert.ok(view.includes('<GenerationOutputControls') && view.includes(':engine="drawEngine"'),
    'all engines must share the persistent generation control');
  assert.ok(!view.includes('GenerationStylePanel') && !view.includes('artistInfluences')
      && view.includes('ArtistStylePicker') && view.includes("pb.directorMode === 'pro'"),
    'one-click mode must hide artist setup while expert mode exposes curated tags');

  // Finding 4：AnimaQuickPanel 用显式 noLora prop，不靠 model id 猜。
  assert.ok(panel.includes('noLora?: boolean'), 'panel must accept an explicit noLora prop');
  assert.ok(panel.includes('props.noLora === true && selectedModel.value?.capabilities?.noLora === true'),
    'panel noLora must combine subject prop with capability');
  assert.ok(!/model\.id\s*===\s*'anima-aesthetic-v1\.1'/.test(panel), 'panel must not guess by model id');
});

test('persistence round-trip: popular subject/outfit/blueprint/noLora survive parse and old drafts stay studio', function () {
  var draft = {
    updatedAt: 1700000000000,
    story: 'test',
    sceneId: null,
    subject: 'popular',
    characterId: 'raiden_shogun',
    outfitId: 'shogun_robes',
    blueprintId: 'raiden_shogun_tenshukaku',
     noLora: true,
     kreaStyleId: 'legacy-style-ignored',
     artistInfluences: ['legacy artist ignored'],
     artistStyleIds: ['kantoku', 'rella', 'unknown-third'],
  };
  var parsed = persistence.parsePromptBuilderDraft(draft);
  assert.ok(parsed, 'draft must parse');
  assert.strictEqual(parsed.subject, 'popular');
  assert.strictEqual(parsed.characterId, 'raiden_shogun');
  assert.strictEqual(parsed.outfitId, 'shogun_robes');
  assert.strictEqual(parsed.blueprintId, 'raiden_shogun_tenshukaku');
  assert.strictEqual(parsed.noLora, true);
   assert.strictEqual(parsed.kreaStyleId, undefined, 'manual style state is not restored');
    assert.strictEqual(parsed.artistInfluences, undefined, 'manual artist state is not restored');
    assert.deepStrictEqual(parsed.artistStyleIds, ['kantoku', 'rella'], 'curated artist ids restore with whitelist and two-item limit');

  var serialized = JSON.parse(JSON.stringify(parsed));
  assert.strictEqual(serialized.subject, 'popular');
  assert.strictEqual(serialized.characterId, 'raiden_shogun');
    assert.strictEqual(serialized.kreaStyleId, undefined);
    assert.strictEqual(serialized.artistInfluences, undefined);
    assert.deepStrictEqual(serialized.artistStyleIds, ['kantoku', 'rella']);

  // 热门角色草稿没有 story/sceneId 也能恢复（蓝图驱动场景）。
  var storyless = {
    updatedAt: 1700000000001,
    subject: 'popular',
    characterId: 'raiden_shogun',
    outfitId: 'shogun_robes',
    blueprintId: null,
    noLora: true,
  };
  var parsedStoryless = persistence.parsePromptBuilderDraft(storyless);
  assert.ok(parsedStoryless, 'storyless popular draft must restore');
  assert.strictEqual(parsedStoryless.subject, 'popular');
  assert.strictEqual(parsedStoryless.kreaStyleId, undefined);

  var legacy = persistence.parsePromptBuilderDraft({ updatedAt: 1, sceneId: 'sc001', story: 'old' });
  assert.ok(legacy, 'legacy draft must parse');
  assert.strictEqual(legacy.subject, 'studio', 'legacy draft must default to studio');
  assert.strictEqual(legacy.characterId, undefined);
  assert.strictEqual(legacy.noLora, undefined);
  assert.strictEqual(legacy.kreaStyleId, undefined);
});

test('anima no-LoRA route contract: validate + workflow have no LoraLoader and keep a negative encode', function () {
  var input = animaRoute.validateInput({
    prompt: 'raiden_shogun, 1girl, flower field',
    negative: 'worst quality, low quality',
    modelId: 'anima-aesthetic-v1.1',
    width: 832,
    height: 1216,
    seed: 7,
  });
  assert.strictEqual(input.family, 'anima');
  assert.strictEqual(input.loraId, undefined, 'no-LoRA input must not carry a loraId');
  assert.strictEqual(input.loraStrength, null);
  assert.strictEqual(input.character, undefined);

  var workflow = animaRoute.buildWorkflow(input);
  var classes = Object.values(workflow).map(function (node) { return node.class_type; });
  assert.ok(!classes.includes('LoraLoader'), 'no-LoRA workflow must not contain LoraLoader');
  assert.ok(classes.includes('CLIPTextEncode'), 'no-LoRA workflow must keep prompt encoding');
  assert.strictEqual(workflow['2'].inputs.type, 'qwen_image');
  assert.strictEqual(workflow['2'].inputs.clip_name, 'qwen_3_06b_base.safetensors');
  assert.strictEqual(workflow['5'].inputs.text, 'worst quality, low quality', 'negative encode must receive the negative');
  assert.strictEqual(workflow['7'].inputs.sampler_name, 'res_multistep');
  assert.strictEqual(workflow['7'].inputs.scheduler, 'simple');
  assert.strictEqual(workflow['7'].inputs.steps, 30);
  assert.strictEqual(workflow['7'].inputs.cfg, 4.5);
  assert.deepStrictEqual(workflow['7'].inputs.negative, ['5', 0]);
  assert.strictEqual(workflow['10'].class_type, 'SaveImage');

  // 无 LoRA 模式仍保持原有 lora 校验：提供 lora 时走原路径。
  var withLora = animaRoute.validateInput({
    prompt: 'x', negative: 'n', modelId: 'anima-aesthetic-v1.1',
    loraId: 'L_NENE_V21_ANIMA', loraStrength: 0.85, width: 832, height: 1216, character: 'nene',
  });
  assert.strictEqual(withLora.loraId, 'L_NENE_V21_ANIMA');
  assert.throws(function () {
    animaRoute.validateInput({ prompt: 'x', modelId: 'anima-aesthetic-v1.1', loraId: 'unknown', width: 832, height: 1216 });
  }, function (error) { return error && error.code === 'UNKNOWN_LORA'; });
  assert.throws(function () {
    animaRoute.validateInput({
      prompt: 'x', modelId: 'anima-aesthetic-v1.1', loraId: 'L_NAT_V21_ANIMA', width: 832, height: 1216, character: 'nene',
    });
  }, function (error) { return error && error.code === 'INCOMPATIBLE_CHARACTER'; });
  assert.throws(function () {
    animaRoute.validateInput({ prompt: 'x', modelId: 'anima-base-v1.0', width: 832, height: 1216 });
  }, function (error) { return error && error.code === 'UNKNOWN_LORA'; }, 'non-noLora anima model must still require a LoRA');

  // Hires.fix workflow validation
  var hiresInput = animaRoute.validateInput({
    prompt: 'raiden_shogun, 1girl',
    negative: 'worst quality',
    modelId: 'anima-aesthetic-v1.1',
    width: 832,
    height: 1216,
    seed: 42,
    hiresFix: true,
    hiresScale: 2.0,
    hiresDenoise: 0.35,
  });
  assert.strictEqual(hiresInput.hiresFix, true);
  assert.strictEqual(hiresInput.hiresScale, 2.0);
  assert.strictEqual(hiresInput.hiresDenoise, 0.35);
  var hiresWf = animaRoute.buildWorkflow(hiresInput);
  assert.ok(hiresWf['11'], 'hires workflow must contain LatentUpscaleBy');
  assert.strictEqual(hiresWf['11'].class_type, 'LatentUpscaleBy');
  assert.strictEqual(hiresWf['11'].inputs.scale_by, 2.0);
  assert.ok(hiresWf['12'], 'hires workflow must contain 2nd KSampler');
  assert.strictEqual(hiresWf['12'].class_type, 'KSampler');
  assert.strictEqual(hiresWf['12'].inputs.denoise, 0.35);
  assert.deepStrictEqual(hiresWf['8'].inputs.samples, ['12', 0]);
});
