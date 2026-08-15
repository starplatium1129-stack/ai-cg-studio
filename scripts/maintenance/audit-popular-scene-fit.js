#!/usr/bin/env node
'use strict';

/* audit-popular-scene-fit.js — 角色 × 预设场景适配审核矩阵。
 *
 * 背景：recommendBlueprints 目前按 cursor 纯轮转推荐，不感知角色原型，
 * 导致预设场景"强制加进"不符合角色世界观的组合（如 Saber 在现代公寓）。
 * 本脚本基于角色原型（原作世界观/时代/身份）与场景设定（location/mood/adult）
 * 输出全矩阵：✓ 契合 / △ 勉强 / ✗ 违和（附原因），并给出每角色场景白名单建议。
 * 判断依据为角色原作设定，产出供用户亲审确认后落地为角色级场景白名单。
 *
 * 用法：node scripts/maintenance/audit-popular-scene-fit.js [--out <md>]
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

// 角色原型画像：世界观类型 + 原型契合/违和场景（蓝图 id），判断依据为原作设定
var CHARACTER_PROFILES = {
  raiden_shogun: {
    world: '奇幻和风（提瓦特·雷电神）',
    fit: ['moonlit_shrine', 'flower_field_backlight', 'candlelit_palace'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'old_train_window', 'library_quiet_afternoon', 'aquarium_tunnel', 'beach_sunset', 'rooftop_dusk', 'neon_city_dusk', 'rainy_station_night'],
    note: '雷电神/稻妻和风世界，现代校园与都市日常违和；神社/花海/宫殿契合和风神性',
  },
  sakurajima_mai: {
    world: '现代校园（青春猪头少年）',
    fit: ['empty_classroom_after_school', 'rooftop_dusk', 'cafe_corner', 'aquarium_tunnel', 'beach_sunset', 'rainy_station_night'],
    clash: ['candlelit_palace', 'ancient_ruins', 'magic_library', 'snowy_forest', 'sea_cave_dawn', 'starlit_lakeside'],
    note: '现代校园少女，奇幻宫廷/遗迹/魔法类违和；天台/教室/咖啡店高度契合',
  },
  tokisaki_kurumi: {
    world: '现代超能力（约会大作战·哥特风）',
    fit: ['neon_city_dusk', 'rainy_station_night', 'candlelit_palace', 'moonlit_shrine', 'snowy_night_street'],
    clash: ['empty_classroom_after_school', 'spring_bridge', 'beach_sunset', 'old_train_window', 'library_quiet_afternoon', 'flower_field_backlight'],
    note: '哥特黑红气质契合宫殿/夜都市；校园/春景过于日常',
  },
  frieren: {
    world: '奇幻（葬送的芙莉莲·精灵魔法使）',
    fit: ['magic_library', 'snowy_forest', 'ancient_ruins', 'moonlit_shrine', 'starlit_lakeside', 'sea_cave_dawn'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'neon_city_dusk', 'rooftop_dusk', 'aquarium_tunnel', 'old_train_window', 'library_quiet_afternoon', 'spring_bridge'],
    note: '精灵魔法使，现代都市/校园全部违和；遗迹/森林/图书馆契合',
  },
  artoria_pendragon: {
    world: '中世纪英灵骑士（Fate）',
    fit: ['candlelit_palace', 'ancient_ruins', 'moonlit_shrine', 'snowy_forest'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'neon_city_dusk', 'rainy_station_night', 'aquarium_tunnel', 'rooftop_dusk', 'old_train_window', 'beach_sunset', 'spring_bridge', 'library_quiet_afternoon'],
    note: '骑士王与中世纪/奇幻场景契合；现代都市与校园违和',
  },
  hatsune_miku: {
    world: '虚拟歌姬（VOCALOID·全场景灵活）',
    fit: [],
    clash: [],
    note: '虚拟歌姬无固定世界观，全部 26 场景均可（演出/舞台类最契合）；无违和项',
  },
  yuzuriha_inori: {
    world: '近未来（罪恶王冠·葬仪社）',
    fit: ['neon_city_dusk', 'rainy_station_night', 'rooftop_dusk', 'modern_apartment_night', 'old_train_window'],
    clash: ['magic_library', 'ancient_ruins', 'moonlit_shrine', 'candlelit_palace', 'snowy_forest'],
    note: '近未来都市系契合夜都市/列车/天台；奇幻宫廷/遗迹违和',
  },
  yukinoshita_yukino: {
    world: '现代校园（春物）',
    fit: ['empty_classroom_after_school', 'library_quiet_afternoon', 'cafe_corner', 'spring_bridge', 'rooftop_dusk', 'snowy_night_street'],
    clash: ['candlelit_palace', 'ancient_ruins', 'magic_library', 'snowy_forest', 'sea_cave_dawn', 'moonlit_shrine'],
    note: '现代校园少女，奇幻类违和；教室/图书馆/咖啡店契合',
  },
  elaina: {
    world: '旅行魔女（魔女之旅·奇幻）',
    fit: ['magic_library', 'ancient_ruins', 'moonlit_shrine', 'starlit_lakeside', 'sea_cave_dawn', 'snowy_forest', 'flower_field_backlight'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'neon_city_dusk', 'rooftop_dusk', 'old_train_window', 'library_quiet_afternoon'],
    note: '旅行魔女适合异国奇幻场景；现代都市/校园违和',
  },
  misaka_mikoto: {
    world: '学园都市超能力（超电磁炮·现代）',
    fit: ['empty_classroom_after_school', 'aquarium_tunnel', 'neon_city_dusk', 'rooftop_dusk', 'beach_sunset', 'rainy_station_night'],
    clash: ['candlelit_palace', 'ancient_ruins', 'magic_library', 'snowy_forest', 'moonlit_shrine', 'sea_cave_dawn'],
    note: '学园都市现代系契合；奇幻类违和',
  },
  makima: {
    world: '现代恶魔（电锯人·都市）',
    fit: ['neon_city_dusk', 'rainy_station_night', 'snowy_night_street', 'modern_apartment_night', 'rooftop_dusk'],
    clash: ['candlelit_palace', 'magic_library', 'ancient_ruins', 'snowy_forest', 'moonlit_shrine', 'beach_sunset', 'spring_bridge', 'flower_field_backlight'],
    note: '都市系契合；阳光明媚的田园/春景与角色氛围违和',
  },
  tohsaka_rin: {
    world: '现代魔术师（Fate·校园）',
    fit: ['empty_classroom_after_school', 'library_quiet_afternoon', 'moonlit_shrine', 'rooftop_dusk', 'candlelit_palace'],
    clash: ['ancient_ruins', 'snowy_forest', 'sea_cave_dawn', 'magic_library', 'beach_sunset', 'spring_bridge', 'old_train_window', 'aquarium_tunnel'],
    note: '现代魔术师：校园/神社/宫殿均可（魔术背景），但纯奇幻遗迹/森林违和',
  },
  rem_rezero: {
    world: '异世界女仆（Re:Zero·奇幻）',
    fit: ['candlelit_palace', 'magic_library', 'moonlit_shrine', 'snowy_night_street', 'ancient_ruins'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'neon_city_dusk', 'rooftop_dusk', 'old_train_window', 'aquarium_tunnel', 'beach_sunset', 'library_quiet_afternoon'],
    note: '奇幻世界女仆契合宫廷/神社；现代校园与都市违和',
  },
  emilia_rezero: {
    world: '异世界精灵（Re:Zero·银发）',
    fit: ['magic_library', 'snowy_forest', 'starlit_lakeside', 'moonlit_shrine', 'snowy_night_street'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'neon_city_dusk', 'rooftop_dusk', 'old_train_window', 'aquarium_tunnel', 'beach_sunset', 'library_quiet_afternoon', 'spring_bridge'],
    note: '异世界精灵契合奇幻场景；现代系违和',
  },
  roxy_migurdia: {
    world: '异世界教师（无职转生·魔女帽）',
    fit: ['magic_library', 'ancient_ruins', 'moonlit_shrine', 'starlit_lakeside', 'sea_cave_dawn'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'neon_city_dusk', 'rooftop_dusk', 'old_train_window', 'aquarium_tunnel', 'beach_sunset', 'library_quiet_afternoon'],
    note: '异世界魔女教师契合奇幻场景；现代系违和',
  },
  illyasviel_von_einzbern: {
    world: '现代魔术（Fate·冬之城少女）',
    fit: ['snowy_night_street', 'modern_apartment_night', 'candlelit_palace', 'magic_library', 'snowy_forest'],
    clash: ['neon_city_dusk', 'rainy_station_night', 'aquarium_tunnel', 'old_train_window', 'beach_sunset', 'spring_bridge', 'rooftop_dusk'],
    note: '冬之城少女契合雪/暖屋/宫殿；夜都市与游乐类违和',
  },
  kitagawa_marin: {
    world: '现代辣妹（更衣人偶·cosplay）',
    fit: ['neon_city_dusk', 'summer_festival', 'aquarium_tunnel', 'cafe_corner', 'rooftop_dusk', 'beach_sunset', 'rainy_station_night'],
    clash: ['candlelit_palace', 'ancient_ruins', 'magic_library', 'snowy_forest', 'moonlit_shrine', 'sea_cave_dawn'],
    note: '现代辣妹契合都市/祭典/水族馆；奇幻类违和',
  },
  kisara_engage_kiss: {
    world: '现代恶魔少女（Engage Kiss·校服）',
    fit: ['empty_classroom_after_school', 'neon_city_dusk', 'snowy_night_street', 'rooftop_dusk', 'rainy_station_night'],
    clash: ['candlelit_palace', 'ancient_ruins', 'magic_library', 'snowy_forest', 'moonlit_shrine', 'sea_cave_dawn', 'starlit_lakeside'],
    note: '现代校园+都市契合；奇幻类违和',
  },
  // 2026-08-15：方舟 / 终末地 16 角色（与现有热门角色同等待遇）
  surtr_arknights: {
    world: '泰拉（罗德岛·火山剑士）',
    fit: ['surtr_arknights_dorm_window', 'surtr_arknights_snowfield', 'surtr_arknights_volcano_ruins', 'surtr_arknights_rhodes_canteen', 'surtr_arknights_training_ground', 'surtr_arknights_archive_reading'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'aquarium_tunnel', 'beach_sunset', 'spring_bridge', 'library_quiet_afternoon'],
    note: '泰拉近未来奇幻：雪原/火山/罗德岛舰内契合；现代校园与纯都市日常违和',
  },
  kaltsit_arknights: {
    world: '泰拉（罗德岛·医师）',
    fit: ['kaltsit_arknights_medical_wing', 'kaltsit_arknights_mon3tr_shadow', 'kaltsit_arknights_desert_recon', 'kaltsit_arknights_tea_corner', 'kaltsit_arknights_training_supervise', 'kaltsit_arknights_archive_ledger'],
    clash: ['empty_classroom_after_school', 'cafe_corner', 'beach_sunset', 'spring_bridge', 'neon_city_dusk', 'old_train_window'],
    note: '罗德岛医疗系契合舰内/荒漠考察；现代校园与游乐系违和',
  },
  chen_arknights: {
    world: '泰拉（龙门近卫局）',
    fit: ['chen_arknights_lungmen_patrol', 'chen_arknights_night_market', 'chen_arknights_rooftop_dusk', 'chen_arknights_hotpot_night', 'chen_arknights_sword_honing', 'chen_arknights_rain_station'],
    clash: ['empty_classroom_after_school', 'candlelit_palace', 'ancient_ruins', 'magic_library', 'snowy_forest', 'moonlit_shrine', 'sea_cave_dawn'],
    note: '龙门都市/夜市/天台契合；异世界奇幻类违和',
  },
  eyjafjalla_arknights: {
    world: '泰拉（罗德岛·火山学者）',
    fit: ['eyjafjalla_arknights_volcano_lab', 'eyjafjalla_arknights_craters_edge', 'eyjafjalla_arknights_library_study', 'eyjafjalla_arknights_dorm_tea', 'eyjafjalla_arknights_hot_spring_research', 'eyjafjalla_arknights_astronomy_deck'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'neon_city_dusk', 'rainy_station_night'],
    note: '实验室/火山/图书馆契合；现代都市校园违和',
  },
  lemuen_arknights: {
    world: '泰拉（拉特兰·萨科塔）',
    fit: ['lemuen_arknights_laterano_church', 'lemuen_arknights_halo_street', 'lemuen_arknights_cliff_sunset', 'lemuen_arknights_sweets_shop', 'lemuen_arknights_training_range', 'lemuen_arknights_garden_bench'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'neon_city_dusk', 'rainy_station_night', 'aquarium_tunnel', 'beach_sunset'],
    note: '拉特兰欧式城镇/教堂契合；现代都市霓虹违和',
  },
  dusk_arknights: {
    world: '泰拉（岁家·水墨画师）',
    fit: ['dusk_arknights_ink_garden', 'dusk_arknights_painting_studio', 'dusk_arknights_mountain_mist', 'dusk_arknights_tea_and_ink', 'dusk_arknights_rain_courtyard', 'dusk_arknights_lantern_festival'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'neon_city_dusk', 'aquarium_tunnel', 'beach_sunset', 'old_train_window'],
    note: '古风庭院/山水/灯会契合；现代都市校园违和',
  },
  mudrock_arknights: {
    world: '泰拉（萨卡兹·重甲战士）',
    fit: ['mudrock_arknights_armor_workshop', 'mudrock_arknights_snowfield_march', 'mudrock_arknights_ruins_shelter', 'mudrock_arknights_flower_field', 'mudrock_arknights_canteen_lunch', 'mudrock_arknights_training_dummy'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'neon_city_dusk', 'aquarium_tunnel', 'beach_sunset', 'spring_bridge'],
    note: '战场/雪原/工坊契合；现代都市校园违和',
  },
  eunectes_arknights: {
    world: '泰拉（罗德岛·机械师）',
    fit: ['eunectes_arknights_mech_garage', 'eunectes_arknights_mudland_excavation', 'eunectes_arknights_river_swim', 'eunectes_arknights_canteen_big', 'eunectes_arknights_wrench_pose', 'eunectes_arknights_stars_deck'],
    clash: ['empty_classroom_after_school', 'candlelit_palace', 'magic_library', 'moonlit_shrine', 'library_quiet_afternoon'],
    note: '工坊/荒野/河湾契合；奇幻宫廷与文静场景违和',
  },
  goldenglow_arknights: {
    world: '泰拉（罗德岛·图书管理员）',
    fit: ['goldenglow_arknights_library_desk', 'goldenglow_arknights_flower_room', 'goldenglow_arknights_meadow_book', 'goldenglow_arknights_rain_window', 'goldenglow_arknights_dusk_street', 'goldenglow_arknights_starlight_terrace'],
    clash: ['candlelit_palace', 'ancient_ruins', 'moonlit_shrine', 'sea_cave_dawn', 'neon_city_dusk', 'old_train_window'],
    note: '图书馆/花房/原野契合；奇幻宫廷遗迹违和',
  },
  skadi_arknights: {
    world: '泰拉（深海猎人）',
    fit: ['skadi_arknights_harbor_dawn', 'skadi_arknights_abyss_shore', 'skadi_arknights_ship_deck_night', 'skadi_arknights_reef_rest', 'skadi_arknights_tavern_corner', 'skadi_arknights_cabin_window'],
    clash: ['empty_classroom_after_school', 'candlelit_palace', 'magic_library', 'moonlit_shrine', 'spring_bridge', 'flower_field_backlight'],
    note: '海港/海岸/甲板契合；奇幻宫廷与校园违和',
  },
  quillpen_arknights: {
    world: '泰拉（罗德岛·信使）',
    fit: ['quillpen_arknights_post_office', 'quillpen_arknights_street_delivery', 'quillpen_arknights_rooftop_pigeon', 'quillpen_arknights_rain_delivery', 'quillpen_arknights_letter_desk', 'quillpen_arknights_feather_shop'],
    clash: ['candlelit_palace', 'ancient_ruins', 'magic_library', 'moonlit_shrine', 'sea_cave_dawn'],
    note: '邮局/街道/天台契合；奇幻宫廷遗迹违和',
  },
  exusiai_arknights: {
    world: '泰拉（企鹅物流·萨科塔）',
    fit: ['exusiai_arknights_penguin_office', 'exusiai_arknights_bar_counter', 'exusiai_arknights_skyline_roof', 'exusiai_arknights_package_run', 'exusiai_arknights_wing_rest', 'exusiai_arknights_halo_street_evening'],
    clash: ['empty_classroom_after_school', 'candlelit_palace', 'magic_library', 'moonlit_shrine', 'snowy_forest'],
    note: '龙门都市/酒馆/天台契合；奇幻宫廷与校园违和',
  },
  suzuran_arknights: {
    world: '泰拉（罗德岛·白狐）',
    fit: ['suzuran_arknights_fox_garden', 'suzuran_arknights_library_fox', 'suzuran_arknights_snow_visit', 'suzuran_arknights_wildflower_field', 'suzuran_arknights_tea_pouring', 'suzuran_arknights_fox_den_night'],
    clash: ['modern_apartment_night', 'neon_city_dusk', 'aquarium_tunnel', 'old_train_window', 'rainy_station_night'],
    note: '庭院/花田/雪景契合；现代都市霓虹违和',
  },
  perlica_arknights: {
    world: '塔罗斯-II（终末地工业）',
    fit: ['perlica_arknights_endfield_lab', 'perlica_arknights_talos_wasteland', 'perlica_arknights_research_deck', 'perlica_arknights_canteen_routine', 'perlica_arknights_data_archive', 'perlica_arknights_greenhouse_facility'],
    clash: ['empty_classroom_after_school', 'candlelit_palace', 'magic_library', 'moonlit_shrine', 'beach_sunset', 'spring_bridge'],
    note: '终末地科研舰/塔罗斯荒原契合；校园与奇幻宫廷违和',
  },
  laevatain_arknights: {
    world: '塔罗斯-II（罗德岛·萨卡兹剑士）',
    fit: ['laevatain_arknights_icefield_march', 'laevatain_arknights_lava_forge', 'laevatain_arknights_icecream_break', 'laevatain_arknights_sword_rest', 'laevatain_arknights_ship_corridor', 'laevatain_arknights_canteen_hotpot'],
    clash: ['empty_classroom_after_school', 'modern_apartment_night', 'cafe_corner', 'spring_bridge', 'flower_field_backlight'],
    note: '冰原/熔炉/舰内契合；现代校园日常违和',
  },
};

function main() {
  var characters = readJson(path.join(ROOT, 'data', 'popular-characters.json')).characters;
  var rawBlueprints = readJson(path.join(ROOT, 'data', 'scene-blueprints.json'));
  var blueprints = Array.isArray(rawBlueprints) ? rawBlueprints : (rawBlueprints.blueprints || []);
  var bpById = {};
  blueprints.forEach(function (b) { bpById[b.id] = b; });

  var md = ['# 角色 × 预设场景适配审核矩阵', '',
    '> 判断依据：角色原作世界观/时代/身份 vs 场景设定。✓ 契合 / △ 勉强（可用但非原型）/ ✗ 违和（建议排除）。',
    '> 生成：' + new Date().toISOString() + '。本表供用户亲审确认，确认后落地为角色级场景白名单（替换 recommendBlueprints 纯轮转）。',
    ''];
  var rows = [];
  characters.forEach(function (c) {
    var profile = CHARACTER_PROFILES[c.id] || { world: '未分类', fit: [], clash: [], note: '' };
    var fitSet = new Set(profile.fit);
    var clashSet = new Set(profile.clash);
    var cells = blueprints.map(function (bp) {
      if (clashSet.has(bp.id)) return '✗';
      if (fitSet.has(bp.id)) return '✓';
      return '△';
    });
    rows.push({ id: c.id, name: c.displayName, world: profile.world, cells: cells, note: profile.note });
  });

  // 表头
  md.push('| 角色 | 世界观 | ' + blueprints.map(function (b) { return b.id.replace('_', ' '); }).join(' | ') + ' |');
  md.push('|---|---|' + blueprints.map(function () { return '---'; }).join('|') + '|');
  rows.forEach(function (r) {
    md.push('| ' + r.name + ' | ' + r.world + ' | ' + r.cells.join(' | ') + ' |');
  });

  // 每角色白名单建议 + 违和原因
  md.push('', '## 每角色场景白名单建议（✓ 集合）与违和依据', '');
  rows.forEach(function (r) {
    var profile = CHARACTER_PROFILES[r.id] || { fit: [], clash: [], note: '' };
    var fitNames = profile.fit.map(function (id) { return bpById[id] ? bpById[id].title : id; });
    var clashNames = profile.clash.map(function (id) { return bpById[id] ? bpById[id].title : id; });
    md.push('### ' + r.name + '（' + r.world + '）');
    md.push('- 原型契合：' + (fitNames.length ? fitNames.join('、') : '全部 26 场景均可（无固定世界观）'));
    md.push('- 明确违和：' + (clashNames.length ? clashNames.join('、') : '无'));
    md.push('- 依据：' + profile.note);
    md.push('');
  });

  var outArgIndex = process.argv.indexOf('--out');
  var out = outArgIndex >= 0
    ? process.argv[outArgIndex + 1]
    : path.join(ROOT, 'docs', 'popular-scene-fit-audit.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md.join('\n'), 'utf8');
  console.log('written: ' + out);
}

main();
