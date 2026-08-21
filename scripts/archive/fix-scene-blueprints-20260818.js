'use strict';
// 2026-08-18 审视修复：scene-blueprints.json 今日 9 位角色 54 个现有场景
// 1) promptTokens 剥离身份 token（身份由角色 identityTokens 承载，场景只留场景词）
// 2) negativeTokens 按首批模板补齐（质量/畸形/未成年/场景偏差/光影/多人）
// 3) R18：promptProse 含蓄场景化 + nsfwProse 显式重写（消除 nightwear/fabric/圣女模板污染）
//    + kreaStyleHint/animaStyleHint/adultArtistHint/sampleRating 补齐
// 4) location/action/time/lighting/camera/mood 具体化（去模板占位）
// 5) SFW 移除 adultArtistHint（首批 SFW 无此字段）
const fs = require('fs');
const file = 'data/scene-blueprints.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const pc = JSON.parse(fs.readFileSync('data/popular-characters.json', 'utf8'));

// 身份 token 集合（按角色）
const identitySets = {};
for (const c of pc.characters) {
  identitySets[c.id] = new Set([...c.identityTokens, ...c.exactTokens]);
}

// 首批负面模板
const NEG_BASE = ['worst quality', 'low quality', 'lowres', 'blurry', 'jpeg artifacts', 'watermark', 'text', 'extra fingers', 'mutated hands', 'bad anatomy', 'dark shadowed face', 'flat lighting', 'extra characters'];
const NEG_UNDERAGE = ['child', 'loli', 'underage'];
// 首批 R18 负面模板（含防衣物残留）
const NEG_R18 = [...NEG_BASE, ...NEG_UNDERAGE, 'clothes', 'clothing', 'underwear', 'panties', 'bra'];

function dedupe(arr) { return [...new Set(arr)]; }

// ── 修复数据表 ──────────────────────────────────────────────
// fix: { location, action, timeOfDay, lighting, camera, mood, negExtra, prose?, nsfwProse?, hint? }
const FIX = {
  // ── sylphiette ──
  sylphiette_buena_village_tree: {
    location: '布耶纳村口巨大古树下', action: '双手捧着晶莹水球，绿发在阳光与微风中扬起', timeOfDay: 'day', lighting: 'dappled_sunlight', camera: 'medium_shot', mood: 'gentle',
    negExtra: ['indoor', 'modern', 'urban', 'city'],
  },
  sylphiette_royal_academy_library: {
    location: '夏亚魔法大学图书馆', action: '扶着墨镜翻阅古籍，白发在光柱中泛着知性光泽', timeOfDay: 'day', lighting: 'window_light', camera: 'medium_portrait', mood: 'calm',
    negExtra: ['outdoor', 'modern', 'night', 'crowd'],
  },
  sylphiette_morning_balcony_tea: {
    location: '格雷拉特家清晨露台', action: '端着热气腾腾的红茶，害羞地露出幸福微笑', timeOfDay: 'morning', lighting: 'soft_morning_light', camera: 'medium_portrait', mood: 'tender',
    negExtra: ['night', 'indoor', 'modern', 'storm'],
  },
  sylphiette_r18_bedroom_soles_foreshortening: {
    location: '主卧大床', action: '屈膝大开双腿，双足朝向镜头，尖耳发红', timeOfDay: 'night', lighting: 'warm_lamp_light', camera: 'close_up', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'shoes', 'nightwear'],
    prose: 'On the master bed at night, a small elf girl with short white hair and long pointed elf ears lies on soft white sheets, knees drawn up with her delicate bare feet facing the camera, her ears blushing bright red as she shyly turns her face away.',
    nsfwProse: 'completely naked with zero clothes, small slender body, bare breasts with pink nipples, exposed pink pussy and detailed vulva, spread legs with detailed bare soles and toes facing camera, blushing pointed elf ears, shy panting expression, warm intimate lamp light',
    hint: 'r18_sensual_cg',
  },
  sylphiette_r18_fitz_unbuttoned_desk: {
    location: '宅邸书房宽大书桌', action: '半解白色执事衬衫坐在桌沿，墨镜滑落鼻梁', timeOfDay: 'night', lighting: 'desk_lamp_light', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['pants', 'shorts', 'skirt', 'suit', 'jacket'],
    prose: 'In a private study at night, a white-haired girl in the formal white academy uniform of the Silent Fitz sits on the edge of a wide wooden desk, her uniform shirt unbuttoned and slipping off her shoulders, dark sunglasses sliding down her nose, a flustered deep blush spreading across her face.',
    nsfwProse: 'completely bottomless with zero underwear, exposed pink pussy and detailed vulva, bare breasts with pink nipples, spread thighs, unbuttoned shirt falling off delicate shoulders, flustered heavy blush, desk lamp glow',
    hint: 'r18_elegant_boudoir',
  },
  sylphiette_r18_onsen_wet_elf_ears: {
    location: '私人温泉池畔', action: '坐在池边微张双腿，湿发贴背，尖耳滴着水珠', timeOfDay: 'night', lighting: 'lantern_light', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['towel', 'swimsuit', 'bikini', 'bathrobe'],
    prose: 'At a private open-air hot spring at night, a small elf girl with short wet white hair sits on the cedar edge of the pool, water droplets rolling down her bare porcelain skin, her long pointed elf ears dripping and blushing, warm lantern light reflecting on the steaming water.',
    nsfwProse: 'completely naked with zero clothes, wet porcelain skin with water droplets, bare breasts with pink nipples, exposed pink pussy and detailed vulva, parted thighs at the water edge, blushing wet elf ears, steamy lantern glow',
    hint: 'r18_sensual_cg',
  },
  // ── yuigahama_yui ──
  yui_service_club_sunset: {
    location: '总武高中侍奉部活动室', action: '坐在窗边端着红茶，夕阳洒在脸上', timeOfDay: 'evening', lighting: 'golden_hour', camera: 'medium_portrait', mood: 'warm',
    negExtra: ['outdoor', 'night', 'crowd'],
  },
  yui_fireworks_festival_glance: {
    location: '夏夜祭典石阶', action: '浴衣回眸，烟花在夜空绽放', timeOfDay: 'night', lighting: 'fireworks_glow', camera: 'medium_shot', mood: 'lively',
    negExtra: ['indoor', 'day', 'rain'],
  },
  yui_dog_walk_park_morning: {
    location: '清晨公园林荫道', action: '牵着狗散步，晨光中笑容明媚', timeOfDay: 'morning', lighting: 'soft_morning_light', camera: 'medium_portrait', mood: 'cheerful',
    negExtra: ['night', 'indoor', 'rain', 'winter'],
  },
  yui_r18_service_club_desk_afterschool: {
    location: '放学后空无一人的教室', action: '坐在课桌边缘，制服敞开，眼眶泛红', timeOfDay: 'evening', lighting: 'golden_hour', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['blazer', 'jacket', 'crowd', 'students'],
    prose: 'In an empty classroom after school bathed in warm sunset light, a cheerful girl with a coral side bun sits on the edge of a wooden desk, her school blazer and shirt hanging open, blushing intensely with teary shy eyes as golden dust motes drift through the air.',
    nsfwProse: 'school uniform top completely open, bare heavy breasts with pink nipples, completely bottomless with zero underwear, exposed pink pussy and detailed vulva, spread thighs on the desk, intense blush with teary eyes, golden hour glow',
    hint: 'r18_elegant_boudoir',
  },
  yui_r18_bedroom_soles_black_socks: {
    location: '卧室大床', action: '仰卧屈腿翘向镜头，黑丝半褪至脚踝', timeOfDay: 'night', lighting: 'warm_lamp_light', camera: 'close_up', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'socks'],
    prose: 'On a cozy bedroom bed at night, a girl with a coral side bun lies on her back with her legs raised high toward the camera, black socks peeled down to her ankles, panting with a flustered blush under warm dim lamp light.',
    nsfwProse: 'completely naked with zero clothes, voluptuous curves, bare heavy breasts with pink nipples, exposed pink pussy and detailed vulva, spread legs with detailed bare soles and five distinct toes facing camera, black socks peeled to ankles, panting blush, warm intimate light',
    hint: 'r18_sensual_cg',
  },
  yui_r18_sofa_morning_hoodie: {
    location: '客厅沙发', action: '单穿宽松连帽衫侧卧，衣摆滑至腰际', timeOfDay: 'morning', lighting: 'morning_sunlight', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['pants', 'shorts', 'pajamas', 'blanket'],
    prose: 'On a modern living room sofa in soft morning sunlight, a girl with a coral side bun lounges wearing only an unzipped loose hoodie, her legs resting apart on the cushions, a shy seductive gaze and gentle blush in the bright morning glow.',
    nsfwProse: 'loose hoodie open down the center, completely bottomless with zero underwear, bare plump breasts with pink nipples, exposed pink pussy and detailed vulva, spread thighs on the sofa, shy seductive gaze, bright morning light',
    hint: 'r18_elegant_boudoir',
  },
  // ── jeanne_alter ──
  jalter_flaming_ruins_flag: {
    location: '烈焰燃烧的废墟战场', action: '手持龙旗立于火光中，傲慢冷笑', timeOfDay: 'dusk', lighting: 'fire_glow', camera: 'wide_shot', mood: 'intense',
    negExtra: ['indoor', 'day', 'peaceful', 'crowd'],
  },
  jalter_shinjuku_night_street: {
    location: '新宿霓虹雨夜街道', action: '皮夹克侧影站在霓虹灯下', timeOfDay: 'night', lighting: 'neon_light', camera: 'medium_shot', mood: 'cool',
    negExtra: ['indoor', 'day', 'sunny', 'crowd'],
  },
  jalter_summer_beach_katana: {
    location: '落日海滩', action: '水着装收刀回眸，海浪拍岸', timeOfDay: 'sunset', lighting: 'golden_hour', camera: 'medium_portrait', mood: 'playful',
    negExtra: ['indoor', 'night', 'winter', 'crowd'],
  },
  jalter_r18_throne_spread_legs: {
    location: '漆黑王座厅', action: '仰靠王座，皮夹克敞开，脚架在扶手上', timeOfDay: 'night', lighting: 'candlelight', camera: 'medium_shot', mood: 'dominating',
    negExtra: ['armor', 'cape', 'banner', 'clothes'],
    prose: 'In a dark gothic throne hall lit by tall candles, a silver-haired girl with golden eyes reclines on a massive black iron throne, her black leather jacket hanging open, boots propped on the armrests, a fierce arrogant smirk mixed with a flustered heavy blush.',
    nsfwProse: 'completely bottomless with zero underwear, bare perky breasts with pink nipples, exposed pink pussy and detailed vulva, feet propped wide on the throne armrests, open leather jacket, fierce tsundere blush, candlelit shadows',
    hint: 'r18_elegant_boudoir',
  },
  jalter_r18_bedroom_soles_leather_boots: {
    location: '暗色绸缎大床', action: '双腿笔直抬起分向镜头，皮靴半脱挂在脚踝', timeOfDay: 'night', lighting: 'dim_lamp', camera: 'close_up', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'boots'],
    prose: 'On dark satin bedsheets at night, a silver-haired girl lies with her long slender legs raised straight up and parted toward the camera, tall black leather boots unzipped and hanging off her heels, a tsundere scowl fighting a heavy blush in dim lamplight.',
    nsfwProse: 'completely naked with zero clothes, toned slender body, bare breasts with pink nipples, exposed pink pussy and detailed vulva, raised legs with detailed bare soles and toes, leather boots hanging off heels, tsundere heavy blush, dim intimate light',
    hint: 'r18_sensual_cg',
  },
  jalter_r18_hotel_mirror_back_curves: {
    location: '酒店套房落地镜前', action: '跪姿回眸，镜中映出裸背与曲线', timeOfDay: 'night', lighting: 'rim_light', camera: 'back_view', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'dress'],
    prose: 'In a luxurious hotel suite at night, a silver-haired girl kneels on a plush rug before a grand full-length mirror, glancing over her shoulder with piercing golden eyes, soft atmospheric rim light tracing her spine.',
    nsfwProse: 'completely naked kneeling at the mirror, bare back with dimples of venus and firm buttocks, mirror reflection showing bare breasts with pink nipples and exposed pink pussy with detailed vulva, golden eyes looking over shoulder, soft rim light',
    hint: 'r18_elegant_boudoir',
  },
  // ── matou_sakura ──
  sakura_emiya_kitchen_cooking: {
    location: '卫宫家厨房', action: '系着围裙煮汤，蒸汽升腾', timeOfDay: 'evening', lighting: 'warm_kitchen_light', camera: 'medium_portrait', mood: 'warm',
    negExtra: ['outdoor', 'night', 'modern', 'crowd'],
  },
  sakura_rainy_station_waiting: {
    location: '雨中车站', action: '伞下安静等候，雨滴溅落', timeOfDay: 'day', lighting: 'overcast', camera: 'medium_shot', mood: 'calm',
    negExtra: ['indoor', 'sunny', 'crowd'],
  },
  sakura_archery_dojo_glance: {
    location: '弓道场', action: '夕阳下引弓，目光凛然', timeOfDay: 'evening', lighting: 'window_light', camera: 'medium_shot', mood: 'focused',
    negExtra: ['outdoor', 'night', 'modern', 'crowd'],
  },
  sakura_r18_tatami_kneeling_spread: {
    location: '和室榻榻米', action: '只系白色围裙跪坐，仰头泪目', timeOfDay: 'night', lighting: 'paper_lantern_light', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['sweater', 'dress', 'clothes', 'underwear'],
    prose: 'In a traditional tatami room at night, a gentle purple-haired girl kneels on the floor wearing only a white kitchen apron, her long violet hair spilling over her shoulders as she looks up with tearful shy devotion under soft paper lantern light.',
    nsfwProse: 'wearing only a white kitchen apron with bare open sides, completely bottomless with zero underwear, heavy bare breasts with pink nipples, exposed pink pussy and detailed vulva, spread thighs on tatami, tearful shy devotion, warm lantern glow',
    hint: 'r18_elegant_boudoir',
  },
  sakura_r18_bedroom_soles_tights_peel: {
    location: '卧室软床', action: '屈腿分向镜头，黑丝撕破堆在脚踝', timeOfDay: 'night', lighting: 'warm_lamp_light', camera: 'close_up', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'pantyhose'],
    prose: 'On a soft white bed at night, a gentle purple-haired girl lies on her back with her legs bent and parted toward the camera, torn black pantyhose bunched around her ankles, a tender blushing expression in warm dim light.',
    nsfwProse: 'completely naked with zero clothes, voluptuous body, heavy bare breasts with pink nipples, exposed pink pussy and detailed vulva, bent legs with detailed bare soles and toes, torn black pantyhose bunched at ankles, tender blush, warm intimate light',
    hint: 'r18_sensual_cg',
  },
  sakura_r18_dark_shadow_bedroom: {
    location: '幽暗黑化结界', action: '浮于黑暗触手之上，红纹流转', timeOfDay: 'night', lighting: 'crimson_glow', camera: 'medium_shot', mood: 'intense',
    negExtra: ['dress', 'clothes', 'underwear', 'happy', 'bright'],
    prose: 'In a dimly lit chamber, a purple-haired girl floats slightly above dark shadow tendrils, her form dissolved into darkness with crimson glowing magic vein patterns tracing her porcelain skin, an ecstatic devoted expression in the eerie red glow.',
    nsfwProse: 'completely naked floating above shadow tendrils, crimson glowing magic markings along bare porcelain skin, heavy bare breasts with pink nipples, exposed pink pussy and detailed vulva, thighs parted wide, ecstatic devoted expression, dark crimson glow',
    hint: 'r18_sensual_cg',
  },
  // ── yor_forger ──
  yor_moonlit_rooftop_stiletto: {
    location: '月光下的屋顶', action: '荆棘公主装束立于月下，杀气凛然', timeOfDay: 'night', lighting: 'moonlight', camera: 'medium_shot', mood: 'tense',
    negExtra: ['indoor', 'day', 'cozy', 'crowd'],
  },
  yor_living_room_family_tea: {
    location: '福杰家客厅', action: '沙发红茶，微醺的娇羞', timeOfDay: 'evening', lighting: 'warm_lamp_light', camera: 'medium_portrait', mood: 'cozy',
    negExtra: ['outdoor', 'night', 'combat', 'blood'],
  },
  yor_park_autumn_leaves_stroll: {
    location: '秋日公园林荫道', action: '踩着落叶散步，秋阳洒肩', timeOfDay: 'afternoon', lighting: 'soft_autumn_light', camera: 'medium_portrait', mood: 'calm',
    negExtra: ['night', 'rain', 'combat', 'winter'],
  },
  yor_r18_bedroom_red_sweater_lift: {
    location: '主卧床边', action: '咬住毛衣下摆，眼神迷离', timeOfDay: 'night', lighting: 'warm_lamp_light', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['tights', 'pants', 'skirt', 'dress'],
    prose: 'On the edge of a king-sized bed at night, a black-haired woman with a low bun lifts the hem of her chunky red knit sweater to hold it in her teeth, an intoxicated blush and teary seductive eyes under warm bedside lamp light.',
    nsfwProse: 'red knit sweater lifted up, completely bottomless with black tights peeled off, heavy bare breasts with pink nipples, exposed pink pussy and detailed vulva, spread thighs, intoxicated blush with teary seductive eyes, warm bedside glow',
    hint: 'r18_elegant_boudoir',
  },
  yor_r18_thorn_princess_couch_soles: {
    location: '古董皮沙发', action: '黑礼服滑落腰间，双腿高抬分向镜头', timeOfDay: 'night', lighting: 'dim_lamp', camera: 'close_up', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'heels'],
    prose: 'On an antique leather couch at night, a black-haired woman in the Thorn Princess assassin dress reclines as the black dress slides off her hips, her long athletic legs raised and spread toward the camera, flustered panting under dim warm light.',
    nsfwProse: 'black assassin dress unfastened and sliding off hips, completely naked underneath with zero underwear, firm shapely bare breasts with pink nipples, exposed pink pussy and detailed vulva, raised legs with detailed smooth bare soles and toes, flustered panting, dim warm light',
    hint: 'r18_sensual_cg',
  },
  yor_r18_shower_steam_wet_hair: {
    location: '玻璃淋浴间', action: '花洒下侧身，湿发贴背', timeOfDay: 'night', lighting: 'warm_bath_light', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['towel', 'swimsuit', 'bikini', 'bathrobe', 'fabric'],
    prose: 'In a warm steamy glass shower at night, a black-haired woman stands under the flowing spray, wet hair clinging to her toned back, water droplets glistening on smooth skin as she turns sideways, a sultry blushing gaze through the steam.',
    nsfwProse: 'completely naked under the shower spray with zero clothes, wet toned body, bare breasts with pink nipples, exposed pink pussy and detailed vulva shining with moisture, side view with parted thighs, sultry blush, warm steamy light',
    hint: 'r18_sensual_cg',
  },
  // ── reze_chainsaw ──
  reze_cafe_crossroad_smile: {
    location: '街角咖啡馆柜台', action: '托腮微笑，阳光透窗', timeOfDay: 'afternoon', lighting: 'window_light', camera: 'medium_portrait', mood: 'playful',
    negExtra: ['night', 'outdoor', 'rain', 'crowd'],
  },
  reze_rainy_phone_booth_glance: {
    location: '暴雨中的电话亭', action: '湿发回眸，雨幕模糊街景', timeOfDay: 'day', lighting: 'overcast', camera: 'close_up', mood: 'tense',
    negExtra: ['indoor', 'sunny', 'crowd'],
  },
  reze_night_school_pool_summer: {
    location: '深夜学校泳池', action: '月下从水面轻盈出水', timeOfDay: 'night', lighting: 'moonlight', camera: 'medium_shot', mood: 'serene',
    negExtra: ['indoor', 'day', 'crowd'],
  },
  reze_r18_school_pool_edge_spread: {
    location: '深夜泳池台阶', action: '坐在池边，死库水褪至腰间', timeOfDay: 'night', lighting: 'moonlight', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['swimsuit', 'bikini', 'towel', 'clothes'],
    prose: 'At a school pool under the midnight moon, a girl with short pink-purple hair sits on the wet pool steps, her dark navy school swimsuit pushed down to her waist, water dripping from her hair as she tilts her head with a playful dangerous smile.',
    nsfwProse: 'school swimsuit pushed down, completely naked upper body with zero clothes, slender toned body, bare breasts with pink nipples, exposed pink pussy and detailed vulva, parted thighs at the water edge, choker pin still on, moonlight on wet skin',
    hint: 'r18_sensual_cg',
  },
  reze_r18_bedroom_soles_choker_pull: {
    location: '破旧公寓床榻', action: '仰卧抬腿，手拉颈环', timeOfDay: 'night', lighting: 'dim_lamp', camera: 'close_up', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'fabric'],
    prose: 'On a worn mattress in a shabby apartment at night, a girl with short pink-purple hair lies back with her legs raised, one hand tugging her black choker pin, a teasing smile in the dim flickering lamplight.',
    nsfwProse: 'completely naked with zero clothes except the black choker pin, slender toned body, bare breasts with pink nipples, exposed pink pussy and detailed vulva, raised legs with detailed bare soles and toes, hand pulling choker, teasing smile, dim warm light',
    hint: 'r18_sensual_cg',
  },
  reze_r18_morning_shirt_couch_side: {
    location: '晨光沙发', action: '单穿白衬衫侧卧，衣摆堆在腰际', timeOfDay: 'morning', lighting: 'morning_sunlight', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['pants', 'shorts', 'pajamas', 'blanket'],
    prose: 'On a small sofa in bright morning sunlight, a girl with short pink-purple hair lies on her side wearing only a loose white shirt, the hem riding up to her waist, her head propped on her hand with a lazy satisfied smile.',
    nsfwProse: 'single white shirt half on, completely bottomless with zero underwear, bare hips and slender thighs, exposed pink pussy and detailed vulva, side lying pose with shirt bunched at waist, choker pin, lazy teasing smile, bright morning light',
    hint: 'r18_elegant_boudoir',
  },
  // ── fern_frieren ──
  fern_forest_staff_casting: {
    location: '晨雾森林', action: '法杖凝聚魔法光球', timeOfDay: 'morning', lighting: 'misty_light', camera: 'medium_shot', mood: 'focused',
    negExtra: ['indoor', 'modern', 'night', 'crowd'],
  },
  fern_sweet_shop_dessert: {
    location: '城镇甜品店', action: '巨型圣代前满足地眯眼', timeOfDay: 'afternoon', lighting: 'window_light', camera: 'medium_portrait', mood: 'joyful',
    negExtra: ['outdoor', 'night', 'crowd'],
  },
  fern_sunset_wagon_travel: {
    location: '落日下的旅行马车', action: '车厢里翻书，余晖染发', timeOfDay: 'sunset', lighting: 'golden_hour', camera: 'medium_portrait', mood: 'wistful',
    negExtra: ['indoor', 'modern', 'night', 'crowd'],
  },
  fern_r18_inn_bed_spread_pout: {
    location: '旅馆床榻', action: '侧卧气鼓鼓地嘟嘴，睡裙滑落', timeOfDay: 'night', lighting: 'warm_lamp_light', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['pajamas', 'nightgown', 'blanket', 'clothes'],
    prose: 'In a cozy inn room at night, a girl with long purple hair in a low side ponytail lies on the bed with a pouty flustered expression, her loose white cotton nightgown slipping off her shoulder, warm lamplight softening her composed features.',
    nsfwProse: 'nightgown slipping off one shoulder, completely naked underneath with zero clothes, very soft voluptuous body, very large bare breasts with pink nipples, exposed pink pussy and detailed vulva, legs gently parted, pouting blush, warm intimate light',
    hint: 'r18_elegant_boudoir',
  },
  fern_r18_bedroom_soles_stockings: {
    location: '床榻', action: '圆润双腿屈起分向镜头，白丝半褪', timeOfDay: 'night', lighting: 'warm_lamp_light', camera: 'close_up', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'stockings'],
    prose: 'On a soft bed at night, a girl with long purple hair lies back with her round soft legs bent and parted toward the camera, white stockings peeled halfway down, a quiet flustered blush in warm dim light.',
    nsfwProse: 'completely naked with zero clothes, very soft voluptuous body, very large bare breasts with pink nipples, exposed pink pussy and detailed vulva, bent legs with detailed bare soles and toes, white stockings half peeled, quiet pouting blush, warm intimate light',
    hint: 'r18_sensual_cg',
  },
  fern_r18_hotel_mirror_dressing_gown: {
    location: '旅馆更衣镜前', action: '睡袍从肩头滑落，镜中映出圆润倒影', timeOfDay: 'night', lighting: 'warm_light', camera: 'back_view', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'dressing_gown'],
    prose: 'Before the dressing mirror of a quiet inn room at night, a girl with long purple hair stands as her loose dressing gown slides off her shoulders, the mirror reflecting her soft curves, a faint blush on her composed face.',
    nsfwProse: 'dressing gown sliding off shoulders, completely naked with zero clothes, very soft voluptuous body, very large bare breasts with pink nipples visible in the mirror, exposed pink pussy and detailed vulva, back view with soft curves, faint blush, warm intimate light',
    hint: 'r18_elegant_boudoir',
  },
  // ── mimori_byakuya ──
  byakuya_sunset_rooftop_bento: {
    location: '学校天台', action: '夕阳下吃便当，清贫的平静', timeOfDay: 'sunset', lighting: 'golden_hour', camera: 'medium_portrait', mood: 'wistful',
    negExtra: ['night', 'indoor', 'modern', 'crowd'],
  },
  byakuya_magical_combat_alley: {
    location: '雨中小巷', action: '魔法少女变身，星尘光阵展开', timeOfDay: 'night', lighting: 'magic_glow', camera: 'wide_shot', mood: 'intense',
    negExtra: ['indoor', 'day', 'peaceful', 'crowd'],
  },
  byakuya_convenience_store_night: {
    location: '深夜便利店', action: '打工下班数着硬币', timeOfDay: 'night', lighting: 'fluorescent_light', camera: 'medium_portrait', mood: 'quiet',
    negExtra: ['outdoor', 'day', 'crowd'],
  },
  byakuya_r18_tatami_room_unbuttoned_spread: {
    location: '简陋出租屋榻榻米', action: '旧水手服解扣，纤细身体发颤', timeOfDay: 'night', lighting: 'dim_lamp', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['sweater', 'dress', 'clothes', 'underwear'],
    prose: 'In a shabby rented tatami room at night, a girl with silver-white spiral horn buns kneels on a thin futon, her faded navy sailor uniform unbuttoned and slipping off her slender shoulders, a deadpan face betrayed by a faint blush under the dim flickering lamp.',
    nsfwProse: 'old sailor uniform unbuttoned and falling open, completely bottomless with zero underwear, delicate slender petite body, small bare breasts with pink nipples, exposed pink pussy and detailed vulva, spread thin thighs, deadpan faint blush, dim warm light',
    hint: 'r18_elegant_boudoir',
  },
  byakuya_r18_bedroom_soles_shackled: {
    location: '出租屋床榻', action: '蜷缩脚趾，足底朝向镜头', timeOfDay: 'night', lighting: 'dim_lamp', camera: 'close_up', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'chains'],
    prose: 'On a thin mattress in a shabby room at night, a girl with silver-white spiral horn buns lies curled up, her bare feet tucked toward the camera with toes curling, a quiet deadpan blush in the dim warm lamplight.',
    nsfwProse: 'completely naked with zero clothes, delicate slender petite frame, small bare breasts with pink nipples, exposed pink pussy and detailed vulva, curled legs with detailed bare soles and toes facing camera, deadpan blush, dim warm light',
    hint: 'r18_sensual_cg',
  },
  byakuya_r18_magical_girl_torn_dress: {
    location: '战后废墟', action: '破碎战服半挂，无防备地跌坐', timeOfDay: 'night', lighting: 'moonlight', camera: 'medium_shot', mood: 'intense',
    negExtra: ['armor', 'cape', 'banner', 'weapons'],
    prose: 'In the rubble of a ruined alley at night, a girl with silver-white spiral horn buns sits dazed in her torn pink magical girl dress, moonlight tracing her delicate silhouette as her magic wand lies beside her.',
    nsfwProse: 'torn magical girl dress hanging off one shoulder, completely naked underneath with zero clothes, delicate slender petite body, small bare breasts with pink nipples, exposed pink pussy and detailed vulva, legs parted in a dazed sitting pose, deadpan vulnerable expression, cold moonlight',
    hint: 'r18_sensual_cg',
  },
  // ── saint_cecilia ──
  cecilia_church_stained_glass_praying: {
    location: '教堂彩绘玻璃前', action: '双手合十祈祷，圣光洒落', timeOfDay: 'day', lighting: 'stained_glass_light', camera: 'medium_portrait', mood: 'serene',
    negExtra: ['outdoor', 'night', 'dark', 'crowd'],
  },
  cecilia_living_room_lazy_scone: {
    location: '教会起居室沙发', action: '抱着抱枕等司康饼出炉', timeOfDay: 'afternoon', lighting: 'window_light', camera: 'medium_portrait', mood: 'cozy',
    negExtra: ['outdoor', 'night', 'crowd'],
  },
  cecilia_town_market_summer_walk: {
    location: '小镇夏日市集', action: '向日葵花摊前回眸一笑', timeOfDay: 'day', lighting: 'sunny', camera: 'medium_shot', mood: 'joyful',
    negExtra: ['indoor', 'night', 'rain', 'crowd'],
  },
  cecilia_r18_church_altar_spread: {
    location: '教堂祭坛前', action: '修女长袍褪尽，虔诚又迷乱', timeOfDay: 'night', lighting: 'candlelight', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['habit', 'veil', 'robe', 'clothes'],
    prose: 'Before the altar of the quiet church at night, a saint with mint-green hair in a low bun kneels on the stone floor, her pure white habit slipping off her shoulders, candlelight flickering across her tearful devout expression.',
    nsfwProse: 'white nun habit slipping off, completely naked underneath with zero clothes, holy porcelain skin, shapely bare breasts with pink nipples, exposed pink pussy and detailed vulva, kneeling with parted thighs, tearful devout blush, warm candlelight',
    hint: 'r18_elegant_boudoir',
  },
  cecilia_r18_bedroom_soles_nun_veil: {
    location: '教堂寝室', action: '头纱半掩，足底朝向镜头', timeOfDay: 'night', lighting: 'moonlight', camera: 'close_up', mood: 'sensual',
    negExtra: ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'habit'],
    prose: 'In the modest church bedroom at night, a saint with mint-green hair lies on white sheets with her bare feet toward the camera, the white nun veil half-covering her blushing face, silver moonlight streaming through the window.',
    nsfwProse: 'completely naked with zero clothes, holy porcelain skin, shapely bare breasts with pink nipples, exposed pink pussy and detailed vulva, raised legs with detailed bare soles and toes facing camera, white veil half over blushing face, moonlight',
    hint: 'r18_sensual_cg',
  },
  cecilia_r18_pastor_shirt_open_couch: {
    location: '教会起居室长椅', action: '牧师黑衬衫敞开，双腿并拢微颤', timeOfDay: 'evening', lighting: 'warm_lamp_light', camera: 'medium_shot', mood: 'sensual',
    negExtra: ['pants', 'shorts', 'pajamas', 'blanket'],
    prose: 'On the living room couch of the church at evening, a saint with mint-green hair sits wearing only Lawrence\'s oversized black pastor shirt, the collar hanging open, her bare legs pressed together, an innocent flustered blush in the warm lamplight.',
    nsfwProse: 'oversized black pastor shirt hanging open, completely bottomless with zero underwear, holy porcelain skin, shapely bare breasts with pink nipples, exposed pink pussy and detailed vulva, bare legs pressed together trembling, innocent flustered blush, warm lamp light',
    hint: 'r18_elegant_boudoir',
  },
};

// ── 执行 ────────────────────────────────────────────────────
let fixed = 0, r18Fixed = 0;
for (const b of data.blueprints) {
  const fix = FIX[b.id];
  if (!fix) continue;
  const identitySet = identitySets[b.characterId] || new Set();
  // 1) tokens 剥离身份 token
  const before = b.promptTokens.length;
  b.promptTokens = b.promptTokens.filter(t => !identitySet.has(t));
  if (b.promptTokens.length === 0) throw new Error(b.id + ' lost all tokens');
  // 2) 具体化字段
  Object.assign(b, {
    location: fix.location,
    action: fix.action,
    timeOfDay: fix.timeOfDay,
    lighting: fix.lighting,
    camera: fix.camera,
    mood: fix.mood,
  });
  // 3) negative 补齐
  const base = b.adult ? NEG_R18 : NEG_BASE;
  b.negativeTokens = dedupe([...base, ...(fix.negExtra || [])]);
  // 4) SFW 移除 adultArtistHint；R18 补齐 hint/rating + 重写 prose
  if (b.adult) {
    b.promptProse = fix.prose;
    b.nsfwProse = fix.nsfwProse;
    b.kreaStyleHint = fix.hint;
    b.animaStyleHint = fix.hint;
    b.sampleRating = 'R18';
    r18Fixed++;
  } else {
    delete b.adultArtistHint;
  }
  fixed++;
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('OK: fixed ' + fixed + ' scenes (' + r18Fixed + ' R18), tokens stripped, negatives rebuilt');

// 验证
const check = JSON.parse(fs.readFileSync(file, 'utf8'));
const ids = ['sylphiette','yuigahama_yui','jeanne_alter','matou_sakura','yor_forger','reze_chainsaw','fern_frieren','mimori_byakuya','saint_cecilia'];
for (const id of ids) {
  const arr = check.blueprints.filter(b=>b.characterId===id);
  const badNeg = arr.filter(b => (Array.isArray(b.negativeTokens) ? b.negativeTokens.length : String(b.negativeTokens||'').length) < 12);
  const badTokens = arr.filter(b => b.promptTokens.some(t => identitySets[id].has(t)));
  const r18 = arr.filter(b=>b.adult);
  const badHint = r18.filter(b => !b.kreaStyleHint || !b.kreaStyleHint.startsWith('r18_') || !b.sampleRating);
  const sfwArtist = arr.filter(b=>!b.adult && b.adultArtistHint);
  console.log(id, '| negShort:', badNeg.length, '| identityTokensLeft:', badTokens.length, '| r18NoHint:', badHint.length, '| sfwArtist:', sfwArtist.length);
}
