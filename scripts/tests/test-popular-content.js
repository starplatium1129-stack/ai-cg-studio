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

test('popular data: 18 characters, unique ids, exactly one default outfit per character', function () {
  assert.strictEqual(characters.length, 18, 'must ship exactly 18 characters');
  var ids = new Set(characters.map(function (character) { return character.id; }));
  assert.strictEqual(ids.size, 18, 'character ids must be unique');
  characters.forEach(function (character) {
    assert.ok(character.outfits.length >= 2 && character.outfits.length <= 3, character.id + ' must have 2-3 outfits');
    var defaults = character.outfits.filter(function (outfit) { return outfit.default; });
    assert.strictEqual(defaults.length, 1, character.id + ' must have exactly one default outfit');
    var outfitIds = new Set(character.outfits.map(function (outfit) { return outfit.id; }));
    assert.strictEqual(outfitIds.size, character.outfits.length, character.id + ' outfit ids must be unique');
    assert.ok(character.identityTokens.length > 0, character.id + ' needs identityTokens');
    assert.ok(character.exactTokens.length > 0, character.id + ' needs exactTokens');
    assert.ok(character.supportedEngines.includes('anima-aesthetic-v1.1'), character.id + ' must support Anima Aesthetic');
    assert.ok(character.supportedEngines.includes('krea2-turbo-fp8'), character.id + ' must support Krea 2');
  });
  var adults = characters.filter(function (character) { return character.adultEligibility === 'adult'; });
  var nonAdults = characters.filter(function (character) { return character.adultEligibility !== 'adult'; });
  assert.ok(adults.length >= 1, 'at least one clearly-adult character must be available for adult blueprints');
  assert.ok(nonAdults.length > adults.length, 'conservative fail-closed majority is expected');
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

test('blueprints: ~24 character-independent entries, adult blueprints fail closed for non-adults', function () {
  assert.ok(blueprints.length >= 20 && blueprints.length <= 28, 'expected roughly 24 blueprints, got ' + blueprints.length);
  var ids = new Set(blueprints.map(function (blueprint) { return blueprint.id; }));
  assert.strictEqual(ids.size, blueprints.length, 'blueprint ids must be unique');
  blueprints.forEach(function (blueprint) {
    var text = JSON.stringify(blueprint);
    assert.ok(!/(?:ayachi_nene|shiki_natsume|nene_|natsume_)/i.test(text), blueprint.id + ' must not reference studio LoRA tokens');
    assert.ok(!/(?:official_cg|visual_audited)/i.test(text), blueprint.id + ' must not leak retrieval metadata');
    assert.ok(blueprint.promptProse.length > 20, blueprint.id + ' needs a prose prompt');
    assert.ok(blueprint.promptTokens.length > 0, blueprint.id + ' needs prompt tokens');
  });

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
  var blueprint = blueprints.find(function (item) { return item.id === 'flower_field_backlight'; });

  var anima = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'anima', profile: null, adultEnabled: true,
  });
  assert.ok(anima, 'anima plan must build for a safe blueprint');
  assert.ok(anima.prompt.includes('raiden_shogun'), 'canonical identity anchor must be preserved exactly');
  assert.ok(anima.prompt.includes('flower field'), 'blueprint tokens must be synthesized');
  assert.ok(anima.prompt.includes('japanese_clothes') || anima.prompt.includes('kimono'), 'outfit tokens must be synthesized');
  assert.ok(anima.negative.length > 0, 'Anima no-LoRA workflow keeps negative tokens');
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
  var underage = characters.find(function (character) { return character.adultEligibility === 'underage'; });
  var unknown = characters.find(function (character) { return character.adultEligibility === 'unknown'; });
  assert.strictEqual(recipes.recipeEligible(adult, adultChar, { adultEnabled: true }), true);
  assert.strictEqual(recipes.recipeEligible(adult, adultChar, { adultEnabled: false }), false,
    'adult recipe must require the mature-content switch');
  [underage, unknown].forEach(function (character) {
    assert.strictEqual(recipes.recipeEligible(adult, character, { adultEnabled: true }), false,
      character.id + ' must never be eligible for an adult recipe');
    assert.ok(recipes.eligibleStyleRecipes(recipes.KREA_STYLE_RECIPES, character, { adultEnabled: true })
      .every(function (recipe) { return !recipe.adult; }), character.id + ' must see no adult recipes');
  });
});

test('krea style recipes: resolution is engine-default -> blueprint hint -> selection, gated fail-closed', function () {
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var flower = blueprints.find(function (blueprint) { return blueprint.id === 'flower_field_backlight'; });
  var adultBp = blueprints.find(function (blueprint) { return blueprint.adult; });

  // 无 hint / 无手选：引擎缺省。
  var auto = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', null, null, raiden, { adultEnabled: true });
  assert.strictEqual(auto.lead, 'A polished visual novel event CG with refined cel shading and crisp character work');
  var animaAuto = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'anima', null, null, raiden, { adultEnabled: true });
  assert.ok(animaAuto.lead.indexOf('anime key visual') !== -1, 'anima default must be the key visual recipe');
  // 解析层照常返回 medium，但 Anima 组装只取 lead（medium 不进 token 流）。
  var animaBuilt = popular.buildPopularPromptPlan({
    character: raiden, outfit: raiden.outfits[0], blueprint: null, engine: 'anima', profile: null, adultEnabled: true, style: animaAuto,
  });
  assert.ok(animaBuilt.prompt.indexOf('anime key visual') !== -1, 'anima must prepend the style lead');
  assert.ok(!/anime key visual\.$/i.test(animaBuilt.prompt), 'anima must not append the style medium');

  // 蓝图 hint（配方 id）优先于缺省。
  var hinted = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', flower, null, raiden, { adultEnabled: true });
  assert.strictEqual(hinted.medium, 'film still', 'flower_field kreaStyleHint must resolve to cinematic_film_still');
  var hintedAnima = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'anima', flower, null, raiden, { adultEnabled: true });
  assert.ok(hintedAnima.lead.indexOf('anime key visual') !== -1, 'flower_field animaStyleHint must resolve to anime_key_visual');

  // 手选覆盖 hint。
  var selected = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', flower, 'dreamy_pastel', raiden, { adultEnabled: true });
  assert.strictEqual(selected.medium, 'dreamy pastel art', 'selection must override the blueprint hint');

  // 成人蓝图 hint → 成人配方，仅对 adult 角色可达。
  var adultStyle = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', adultBp, null, raiden, { adultEnabled: true });
  assert.strictEqual(adultStyle.adult, true, 'adult blueprint hint must resolve to an adult recipe');
  var underage = popular.findCharacter(characters, 'sakurajima_mai');
  assert.strictEqual(recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', adultBp, null, underage, { adultEnabled: true }), null,
    'underage character must fail closed on an adult recipe hint');
  assert.strictEqual(recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', adultBp, null, raiden, { adultEnabled: false }), null,
    'adult recipe must fail closed when the mature switch is off');

  // hint 可以是自由风格短语（未命中配方 id 时原样作为前置短语）。
  var freeHint = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', { kreaStyleHint: 'soft watercolor anime style' }, null, raiden, { adultEnabled: true });
  assert.strictEqual(freeHint.lead, 'soft watercolor anime style');
  assert.strictEqual(freeHint.adult, false, 'free phrase hints are never adult');
});

test('krea prose: official paragraph flow, style first, medium last, no meta phrases, no tag stuffing', function () {
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var outfit = raiden.outfits.find(function (item) { return item.default; }) || raiden.outfits[0];
  var blueprint = blueprints.find(function (item) { return item.id === 'flower_field_backlight'; });
  var style = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', blueprint, null, raiden, { adultEnabled: true });

  var krea = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'krea2', profile: null, adultEnabled: true, style: style,
  });
  assert.ok(krea);
  assert.strictEqual(krea.negative, '');
  var text = krea.prompt;

  // 风格配方开头。
  assert.ok(text.startsWith('A cinematic film still'), 'style lead must open the Krea prompt');
  // 后置媒介词收尾。
  assert.ok(/film still\.$/i.test(text), 'style medium must close the Krea prompt');
  // 无 meta 短语 / 无检索元数据 / 无工作室污染。
  assert.ok(!/(?:In this image|The image shows|Scene details:|Composition and lighting|A visual novel event CG featuring)/i.test(text));
  assert.ok(!/official_cg|visual_audited/i.test(text));
  assert.ok(!/(?:ayachi_nene|shiki_natsume|nene_|natsume_|<lora:)/i.test(text));
  // 无逗号标签堆砌：不出现下划线 token，也不出现连续逗号标签。
  assert.ok(!/[a-z]+_[a-z]+/i.test(text), 'krea prose must not carry raw danbooru tokens');
  assert.ok(!/,\s*\w+,\s*\w+,\s*\w+,\s*$/.test(text), 'krea prose must not end with a comma-stuffed list');
  // identityProse / outfitProse / promptProse 原样织入，未被逗号切碎。
  assert.ok(text.includes('Raiden Shogun from Genshin Impact, also known as Raiden Ei, the Electro Archon'),
    'identityProse must be woven verbatim');
  assert.ok(/the Raiden Shogun's flowing purple Japanese robes, bare shoulders, thigh-highs and a long braid/i.test(text),
    'outfitProse must be woven verbatim');
  assert.ok(text.includes('Standing in a vast blooming flower field on a hill at golden hour'),
    'blueprint promptProse must be woven verbatim');
  // 散文句子必须以句号收束。
  var sentences = text.split(/(?<=\.)\s/);
  sentences.forEach(function (sentenceText) {
    assert.ok(/\.$/.test(sentenceText.trim()), 'each prose sentence must end with a period');
  });
});

test('krea prose: adult recipe fails closed inside buildPopularPromptPlan for ineligible characters', function () {
  var mai = popular.findCharacter(characters, 'sakurajima_mai');
  var adultBp = blueprints.find(function (blueprint) { return blueprint.adult; });
  var adultStyle = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', adultBp, null, mai, { adultEnabled: true });
  assert.strictEqual(adultStyle, null, 'underage must never resolve an adult style');
  // 即便调用方绕过解析直接传 adult 配方，build 层也要再 fail-closed 一次。
  var sneaked = popular.buildPopularPromptPlan({
    character: mai, outfit: mai.outfits[0], blueprint: adultBp, engine: 'krea2',
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
  assert.ok(/mature art\.$/i.test(legit.prompt), 'adult style medium must close the prompt');
});

test('blueprint hints: kreaStyleHint/animaStyleHint parse into the model and stay on valid blueprints', function () {
  var flower = blueprints.find(function (blueprint) { return blueprint.id === 'flower_field_backlight'; });
  assert.strictEqual(flower.kreaStyleHint, 'cinematic_film_still');
  assert.strictEqual(flower.animaStyleHint, 'anime_key_visual');
  var adultBp = blueprints.find(function (blueprint) { return blueprint.adult; });
  assert.ok(adultBp.kreaStyleHint && /^r18_/.test(adultBp.kreaStyleHint), 'adult blueprint must carry an adult recipe hint');
  var unknown = blueprints.find(function (blueprint) { return blueprint.kreaStyleHint === undefined; });
  assert.ok(unknown, 'hints must be optional for blueprints without a strong style identity');
});

test('prompt compiler: Anima negative merges profile negative_prefix per negative_mode, Krea stays empty', function () {
  var raiden = popular.findCharacter(characters, 'raiden_shogun');
  var outfit = raiden.outfits[0];
  var blueprint = blueprints.find(function (item) { return item.id === 'snowy_night_street'; });
  // anima_aesthetic_v11：negative_mode=replace, replace_scope=boilerplate。
  var profile = { engine: 'anima', negative_prefix: 'worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration', negative_mode: 'replace', negative_replace_scope: 'boilerplate', exact_tokens: ['best_quality'] };

  var anima = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'anima', profile: profile, adultEnabled: true,
  });
  assert.ok(anima, 'anima plan must build');
  assert.ok(anima.negative.includes('artist name'), 'profile negative_prefix must be merged in');
  assert.ok(anima.negative.includes('chromatic aberration'), 'profile negative_prefix tail must be merged in');
  assert.ok(anima.negative.includes('rain'), 'blueprint non-boilerplate negative must be kept');
  assert.ok(!anima.negative.includes('<lora:'), 'no lora syntax in negative');

  var krea = popular.buildPopularPromptPlan({
    character: raiden, outfit: outfit, blueprint: blueprint, engine: 'krea2', profile: profile, adultEnabled: true,
  });
  assert.ok(krea);
  assert.strictEqual(krea.negative, '', 'Krea negative must always be empty regardless of profile prefix');
});

test('prompt compiler: restored adult blueprint fails closed for ineligible characters', function () {
  var mai = popular.findCharacter(characters, 'sakurajima_mai');
  var adultBlueprint = blueprints.find(function (item) { return item.adult; });
  assert.ok(adultBlueprint);
  // 无论 manualTags / profile 是否携带显式词，组装必须整体拒绝。
  var rejected = popular.buildPopularPromptPlan({
    character: mai, outfit: mai.outfits[0], blueprint: adultBlueprint, engine: 'anima', profile: null, adultEnabled: true,
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

  // Finding 6：metadata preview 只认夏目 preview LoRA，不能因 character===null 全标 preview。
  assert.ok(!/preview:\s*request\.character\s*===\s*'natsume'\s*\|\|\s*request\.character\s*===\s*null/.test(view),
    'preview must not be implied by character===null');
  assert.ok(/preview:\s*request\.character\s*===\s*'natsume'\s*&&\s*request\.loraId\s*===\s*'L_NAT_V19_ANIMA_PREVIEW'/.test(view),
    'preview must require the natsume preview LoRA');
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
  assert.ok(/activeModel\.sizes\.includes\(size\)/.test(view), 'selectBlueprint must clamp to active model sizes');

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
    blueprintId: 'flower_field_backlight',
    noLora: true,
    kreaStyleId: 'cinematic_film_still',
  };
  var parsed = persistence.parsePromptBuilderDraft(draft);
  assert.ok(parsed, 'draft must parse');
  assert.strictEqual(parsed.subject, 'popular');
  assert.strictEqual(parsed.characterId, 'raiden_shogun');
  assert.strictEqual(parsed.outfitId, 'shogun_robes');
  assert.strictEqual(parsed.blueprintId, 'flower_field_backlight');
  assert.strictEqual(parsed.noLora, true);
  assert.strictEqual(parsed.kreaStyleId, 'cinematic_film_still');

  var serialized = JSON.parse(JSON.stringify(parsed));
  assert.strictEqual(serialized.subject, 'popular');
  assert.strictEqual(serialized.characterId, 'raiden_shogun');
  assert.strictEqual(serialized.kreaStyleId, 'cinematic_film_still');

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
  assert.strictEqual(parsedStoryless.kreaStyleId, undefined, 'missing kreaStyleId stays undefined (auto)');

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
  assert.strictEqual(workflow['7'].inputs.sampler_name, 'er_sde');
  assert.strictEqual(workflow['7'].inputs.scheduler, 'sgm_uniform');
  assert.strictEqual(workflow['7'].inputs.steps, 30);
  assert.strictEqual(workflow['7'].inputs.cfg, 4.5);
  assert.deepStrictEqual(workflow['7'].inputs.negative, ['5', 0]);
  assert.strictEqual(workflow['10'].class_type, 'SaveImage');

  // 无 LoRA 模式仍保持原有 lora 校验：提供 lora 时走原路径。
  var withLora = animaRoute.validateInput({
    prompt: 'x', negative: 'n', modelId: 'anima-aesthetic-v1.1',
    loraId: 'L_NENE_V20B_ANIMA', loraStrength: 0.85, width: 832, height: 1216, character: 'nene',
  });
  assert.strictEqual(withLora.loraId, 'L_NENE_V20B_ANIMA');
  assert.throws(function () {
    animaRoute.validateInput({ prompt: 'x', modelId: 'anima-aesthetic-v1.1', loraId: 'unknown', width: 832, height: 1216 });
  }, function (error) { return error && error.code === 'UNKNOWN_LORA'; });
  assert.throws(function () {
    animaRoute.validateInput({
      prompt: 'x', modelId: 'anima-aesthetic-v1.1', loraId: 'L_NAT_V19_ANIMA_PREVIEW', width: 832, height: 1216, character: 'nene',
    });
  }, function (error) { return error && error.code === 'INCOMPATIBLE_CHARACTER'; });
  assert.throws(function () {
    animaRoute.validateInput({ prompt: 'x', modelId: 'anima-base-v1.0', width: 832, height: 1216 });
  }, function (error) { return error && error.code === 'UNKNOWN_LORA'; }, 'non-noLora anima model must still require a LoRA');
});
