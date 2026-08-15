/**
 * Assign a rating from what a scene depicts.
 * All = romance/daily life; R15 = suggestive but non-explicit; R18 = adult nudity or explicit sexual framing.
 * Run with: node scripts/maintenance/classify-scene-ratings.js --write
 */
const { loadSceneShards, writeSceneSet } = require('../runtime/scene-store');
const { ratingFor } = require('../runtime/prompt-policy');
const write = process.argv.includes('--write');
const STANDARD_NEGATIVE = 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic';

const additions = [
  {
    id: 'sc207', title: '雾气散去后的白色浴巾', category: '亲密/After_Story',
    story: '【成年 After Story · 宁宁 · 浴室蒸汽里的清晨】周末清晨，浴室的镜面还留着一层薄雾。洗完澡的宁宁只围着柔软白浴巾，湿润的白发从肩头垂下；她一边整理发带，一边被你看得耳根发热。窗外的晨光穿过水汽，把她的轮廓照得格外柔和。她故作镇定地偏过头，小声提醒你——「宁宁已经是大人了也会害羞的……只准看一会儿，听见没有？」',
    char: 'nene', character: ['nene'], lora: 'ayachi_nene_v18_wd14', emotion: '害羞而信任', season: '不限', time: '清晨', timeOfDay: 'morning',
    tags: ['nude', 'bath_towel', 'wet_hair', 'bare_shoulders', 'collarbone', 'standing', 'bathroom', 'steam', 'morning_light', 'soft_shadows', 'heavy_blush', 'ahoge', 'hair_ribbon', 'close_up', 'sensual'],
    rating: 'R18', mature: true, location: '公寓主卧浴室', weather: '室内温暖水汽', camera: '平视上半身近景', lighting: '窗边晨光与柔和反射光', usage: ['成人向', '角色还原'],
    prompt: '1girl, solo, ayachi_nene, nene_r18, white_hair, low_twintails, purple_eyes, ahoge, hair_ribbon, adult, nude, bath_towel, wet_hair, bare_shoulders, collarbone, standing, bathroom, steam, morning_light, soft_shadows, heavy_blush, close_up, sensual, <lora:ayachi_nene_v18_wd14:0.85>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, poorly drawn face, harsh_lighting',
    storyJa: '【大人のAfter Story・寧々・浴室の湯気に包まれた朝】週末の朝、浴室の鏡にはまだ薄い湯気が残っていた。湯上がりの寧々は柔らかな白いタオルだけをまとい、濡れた白髪を肩に落としている。リボンを整えながら見つめられると、耳まで赤くなった。窓から差す朝の光が水蒸気を通り、彼女の輪郭をやさしく照らす。寧々は平静を装って顔をそむけ、小さな声で言った。――「大人になった寧々だって、恥ずかしいんだから……少しだけなら、見てもいいよ。」'
  },
  {
    id: 'sc208', title: '夜灯下的黑发余温', category: '亲密/After_Story',
    story: '【成年 After Story · 夏目 · 夜灯下的安静邀请】深夜的卧室只开着床头暖灯。结束一天工作的夏目披着深色睡袍坐在床沿，黑色长发散落在肩背，疲惫被难得的柔和取代。她把杯子放到一旁，抬眼示意你靠近，语气仍有一点逞强——「别误会，我只是想安静待一会儿。门锁好了，今晚不许用工作当借口逃跑。」',
    char: 'natsume', character: ['natsume'], lora: 'shiki_natsume_v18_wd14', emotion: '克制的独占欲', season: '不限', time: '深夜', timeOfDay: 'late_night',
    tags: ['nude', 'bathrobe', 'bare_shoulders', 'bare_legs', 'sitting_on_bed', 'bedroom', 'bedside_lamp', 'long_hair', 'mole_under_eye', 'looking_at_viewer', 'slight_blush', 'night', 'warm_lighting', 'medium_shot', 'sensual'],
    rating: 'R18', mature: true, location: '夏目成年后的私人公寓卧室', weather: '室内恒温', camera: '平视中近景', lighting: '单一床头暖灯与深色阴影', usage: ['成人向', '氛围优先'],
    prompt: '1girl, solo, shiki_natsume, natsume_r18, black_hair, long_hair, yellow_eyes, mole_under_eye, adult, nude, bathrobe, bare_shoulders, bare_legs, sitting_on_bed, bedroom, bedside_lamp, looking_at_viewer, slight_blush, night, warm_lighting, medium_shot, sensual, <lora:shiki_natsume_v18_wd14:0.65>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, overly bright background, harsh_lighting',
    storyJa: '【大人のAfter Story・夏目・夜灯の下の静かな誘い】深夜の寝室にはベッドサイドの暖かな灯りだけがついていた。一日の仕事を終えた夏目は濃い色のガウンを羽織り、ベッドの端に座っている。黒い長髪は肩から背中へ落ち、疲れた表情は珍しくやわらかい。彼女はカップを脇へ置き、近くへ来るように目で合図した。――「勘違いしないで。ただ、少し静かにしていたいだけ。鍵はかけたから、今夜は仕事を言い訳に逃げるのはなしよ。」'
  },
  {
    id: 'sc209', title: '拂晓床单上的心形呆毛', category: '亲密/After_Story',
    story: '【成年 After Story · 宁宁 · 破晓前的赖床时间】天还没有完全亮，卧室里只剩窗帘缝隙漏进来的淡蓝晨光。宁宁裹在白色床单里坐起身，睡乱的双马尾和翘起的呆毛让她看上去格外没有防备。她发现你醒着，立刻拉高床单又忍不住偷看过来，最后轻轻把位置让出一半——「再睡五分钟就好……不许笑宁宁的头发，也不许先跑掉。」',
    char: 'nene', character: ['nene'], lora: 'ayachi_nene_v18_wd14', emotion: '慵懒依恋', season: '不限', time: '破晓', timeOfDay: 'dawn',
    tags: ['nude', 'bedsheet', 'bare_shoulders', 'messy_hair', 'sitting_on_bed', 'bedroom', 'dawn', 'blue_hour', 'soft_light', 'heavy_blush', 'looking_at_viewer', 'ahoge', 'hair_ribbon', 'close_up', 'sensual'],
    rating: 'R18', mature: true, location: '共同生活后的主卧', weather: '安静清晨', camera: '平视近景', lighting: '破晓蓝光与柔和漫反射', usage: ['成人向', '壁纸级'],
    prompt: '1girl, solo, ayachi_nene, nene_r18, white_hair, low_twintails, purple_eyes, ahoge, hair_ribbon, adult, nude, bedsheet, bare_shoulders, messy_hair, sitting_on_bed, bedroom, dawn, blue_hour, soft_light, heavy_blush, looking_at_viewer, close_up, sensual, <lora:ayachi_nene_v18_wd14:0.85>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, daylight, harsh_lighting, extra limbs',
    storyJa: '【大人のAfter Story・寧々・夜明け前の二度寝】空はまだ完全には明るくならず、寝室にはカーテンの隙間から淡い青い光だけが漏れていた。寧々は白いシーツにくるまりながら起き上がる。寝癖のついたツインテールと跳ねたアホ毛が、いつもより無防備に見えた。あなたが起きていると気づくと、慌ててシーツを引き上げながらも、そっとこちらを見ている。やがて隣の場所を半分だけ空けて、小さく言った。――「あと五分だけ寝よう……寧々の髪を笑ったり、先に逃げたりしたらだめだからね。」'
  },
  {
    id: 'sc210', title: '月下露天风吕的黑发水痕', category: '亲密/After_Story',
    story: '【成年 After Story · 夏目 · 月下温泉的短暂休战】旅行最后一晚，露天风吕外只剩虫鸣和远处的山风。夏目把湿透的黑发拨到身后，靠在温泉边缘仰望月色；平日锐利的眼神在蒸汽里慢慢放松。她听见你的脚步声却没有回头，只把空出来的位置留给你——「这次休假算你赢了。坐过来吧，但不许把这份安静弄得太吵。」',
    char: 'natsume', character: ['natsume'], lora: 'shiki_natsume_v18_wd14', emotion: '放松后的温柔', season: '秋', time: '夜晚', timeOfDay: 'night',
    tags: ['nude', 'outdoor_bath', 'wet_hair', 'bare_shoulders', 'upper_body', 'steam', 'moonlight', 'night', 'mountain_view', 'mole_under_eye', 'side_view', 'calm_expression', 'soft_shadows', 'medium_shot', 'sensual'],
    rating: 'R18', mature: true, location: '山间旅馆私人露天风吕', weather: '秋夜微凉', camera: '侧面中近景', lighting: '月光、灯笼与水面反射光', usage: ['成人向', '旅行氛围'],
    prompt: '1girl, solo, shiki_natsume, natsume_r18, black_hair, long_hair, yellow_eyes, mole_under_eye, adult, nude, outdoor_bath, wet_hair, bare_shoulders, upper_body, steam, moonlight, night, mountain_view, side_view, calm_expression, soft_shadows, medium_shot, sensual, <lora:shiki_natsume_v18_wd14:0.65>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, crowd, daylight, harsh_lighting',
    storyJa: '【大人のAfter Story・夏目・月下の露天風呂での小休戦】旅の最終夜、露天風呂の外には虫の声と遠い山風だけが残っていた。夏目は濡れた黒髪を背中へ払って湯の縁にもたれ、月を見上げている。普段は鋭い眼差しも、湯気の中では少しずつほどけていった。あなたの足音に気づいても振り返らず、隣の場所だけを空けて言う。――「今回の休暇は、あなたの勝ちでいい。ここに座りなさい。でも、この静けさを騒がしくするのは許さないから。」'
  },
  // ── 2026-08-15 新增：样张必须真正露点的 R18 场景（用户裁定：原先多为 R15 级别，补真正 R18；
  //    第二次修订：连下体一并露出，prompt 带 pussy/spread_legs/legs_up，正面暴露构图）──
  {
    id: 'sc301', title: '晨光里的坦诚', category: '亲密/After_Story',
    story: '【成年 After Story · 宁宁 · 晨光里的坦诚】清晨的卧室还笼着淡金色的光。宁宁仰躺在床上，把双腿抬起、缓缓分开，全裸的身体被晨光勾勒得毫无保留——白嫩的双乳与腿间最私密的地方都清晰可见。她红着脸，努力稳住声音——「说好了，只准看宁宁一个人……连这里，也只准给宁宁喜欢的人看。」',
    char: 'nene', character: ['nene'], lora: 'ayachi_nene_v18_wd14', emotion: '害羞而信任', season: '不限', time: '清晨', timeOfDay: 'morning',
    tags: ['adult', 'naked', 'completely_naked', 'no_clothes', 'pussy', 'spread_legs', 'legs_up', 'lying_on_back', 'bare_breasts', 'nipples', 'bare_shoulders', 'fair_skin', 'morning_light', 'bedroom', 'bed', 'soft_shadows', 'heavy_blush', 'looking_at_viewer', 'medium_shot', 'sensual'],
    rating: 'R18', mature: true, location: '清晨的卧室床沿', weather: '室内暖光', camera: '平视中近景', lighting: '清晨窗光与柔和漫反射', usage: ['成人向', '壁纸级'],
    prompt: '1girl, adult, ayachi_nene, nene_r18, white_hair, low_twintails, purple_eyes, ahoge, hair_ribbon, naked, completely_naked, no_clothes, pussy, spread_legs, legs_up, lying_on_back, bare_breasts, nipples, bare_shoulders, fair_skin, morning_light, bedroom, bed, soft_shadows, heavy_blush, looking_at_viewer, medium_shot, sensual, <lora:ayachi_nene_v18_wd14:0.85>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, night, dark',
    storyJa: '【大人のAfter Story・寧々・朝の光の中の素直さ】朝の寝室には、まだ淡い金色の光が満ちていた。寧々は仰向けに寝転び、両脚を上げてゆっくりと開き、裸の体を朝の光にさらけ出している。白い胸も、脚の付け根の一番秘かな場所も、はっきりと見えている。彼女は顔を赤らめながら、必死に声を落ち着けて言った。「約束して、寧々だけを見て……ここも、寧々が好きな人にだけ見せるんだから。」'
  },
  {
    id: 'sc302', title: '深夜镜前的完整坦诚', category: '亲密/After_Story',
    story: '【成年 After Story · 宁宁 · 深夜镜前的完整坦诚】更衣室只剩一盏暖灯。宁宁在镜前站定，把最后一件衣物褪去，正面完全朝向镜面，把自己从头到脚毫无保留地照给镜中人看——白皙的胸口、腰线，连腿间最隐秘的地方都清晰映在镜里。她抿了抿嘴，声音又轻又软——「成年之后的宁宁，连这里也好好长大了……你要看清楚，宁宁只给你一个人看。」',
    char: 'nene', character: ['nene'], lora: 'ayachi_nene_v18_wd14', emotion: '羞涩笃定', season: '不限', time: '深夜', timeOfDay: 'late_night',
    tags: ['adult', 'naked', 'completely_naked', 'no_clothes', 'pussy', 'standing', 'front_view', 'mirror', 'bare_breasts', 'nipples', 'navel', 'bare_shoulders', 'fair_skin', 'night', 'lamp', 'soft_light', 'heavy_blush', 'medium_shot', 'sensual'],
    rating: 'R18', mature: true, location: '深夜的更衣室镜前', weather: '室内恒温', camera: '侧面中景', lighting: '暖色台灯与镜面反光', usage: ['成人向', '壁纸级'],
    prompt: '1girl, adult, ayachi_nene, nene_r18, white_hair, low_twintails, purple_eyes, ahoge, hair_ribbon, naked, completely_naked, no_clothes, pussy, standing, front_view, mirror, bare_breasts, nipples, navel, bare_shoulders, fair_skin, night, lamp, soft_light, heavy_blush, medium_shot, sensual, <lora:ayachi_nene_v18_wd14:0.85>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, day, bright',
    storyJa: '【大人のAfter Story・寧々・深夜の鏡の前の素直さ】更衣室には、暖かなランプが一つだけ灯っていた。寧々は鏡の前に立ち、最後の一枚を脱ぎ捨てると、正面から鏡に向き直った。白い胸も、腰の線も、脚の付け根の一番秘かな場所も、鏡の中にはっきりと映っている。彼女は唇を結び、小さく柔らかな声で言った。「大人になった寧々は、ここもちゃんと成長してるの……よく見てね。寧々はあなたにだけ見せるんだから。」'
  },
  {
    id: 'sc303', title: '暴雨夜的绝对坦诚', category: '亲密/After_Story',
    story: '【成年 After Story · 夏目 · 暴雨夜的绝对坦诚】暴雨砸在窗上，卧室里只剩急促的呼吸。夏目仰躺在凌乱的床铺上，双腿抬起、缓缓分开，台灯把她的身体照得毫无保留——胸口与腿间最私密的地方都清晰可见。她望着你，声音沙哑又笃定——「看清楚了。今晚，夏目连最后的地方都交给你。」',
    char: 'natsume', character: ['natsume'], lora: 'shiki_natsume_v18_wd14', emotion: '克制而笃定', season: '不限', time: '深夜', timeOfDay: 'late_night',
    tags: ['adult', 'naked', 'completely_naked', 'no_clothes', 'pussy', 'spread_legs', 'legs_up', 'lying_on_back', 'bare_breasts', 'nipples', 'heavy_blush', 'sweat', 'messy_hair', 'intense_look', 'bedroom', 'bed', 'night', 'rain', 'shadows', 'medium_shot', 'sensual'],
    rating: 'R18', mature: true, location: '暴雨夜的凌乱卧室', weather: '狂风暴雨', camera: '特写', lighting: '台灯强光与暗影', usage: ['成人向', '壁纸级'],
    prompt: '1girl, adult, shiki_natsume, natsume_r18, mole_under_eye, naked, completely_naked, no_clothes, pussy, spread_legs, legs_up, lying_on_back, bare_breasts, nipples, heavy_blush, sweat, messy_hair, intense_look, bedroom, bed, night, rain, shadows, medium_shot, sensual, <lora:shiki_natsume_v18_wd14:0.85>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, day, bright, crowd',
    storyJa: '【大人のAfter Story・夏目・豪雨の夜の素直さ】窓に激しい雨が叩きつけられ、寝室には荒い呼吸だけが残っていた。夏目は乱れたベッドの上に仰向けに寝転び、両脚を上げてゆっくりと開き、裸の体をランプの光に晒している。胸も、脚の付け根の一番秘かな場所も、はっきりと見える。彼女はあなたを見つめ、掠れた声で言った。「よく見て。今夜、夏目は最後の場所まであなたに預けるわ。」'
  },
  {
    id: 'sc304', title: '月光窗前的完整姿态', category: '亲密/After_Story',
    story: '【成年 After Story · 夏目 · 月光窗前的完整姿态】夜深人静，夏目站在落地窗前，正面朝向月光，睡袍顺着身体滑落。银白光线里，从胸口到腰线、再到腿间最私密的地方，全都毫无遮挡地浸在月色中。她没有回避，声音带着笑意——「看够之前，不许移开眼睛。今晚的月色，连最后的地方都分给你一个人。」',
    char: 'natsume', character: ['natsume'], lora: 'shiki_natsume_v18_wd14', emotion: '从容坦荡', season: '不限', time: '夜晚', timeOfDay: 'night',
    tags: ['adult', 'naked', 'completely_naked', 'no_clothes', 'pussy', 'standing', 'front_view', 'window', 'moonlight', 'night', 'bare_breasts', 'nipples', 'navel', 'bare_shoulders', 'fair_skin', 'mole_under_eye', 'long_hair', 'calm_expression', 'medium_shot', 'sensual'],
    rating: 'R18', mature: true, location: '月光下的落地窗前', weather: '晴朗月夜', camera: '平视中景', lighting: '清冷月光与室内微光', usage: ['成人向', '壁纸级'],
    prompt: '1girl, adult, shiki_natsume, natsume_r18, mole_under_eye, black_hair, long_hair, naked, completely_naked, no_clothes, pussy, standing, front_view, window, moonlight, night, bare_breasts, nipples, navel, bare_shoulders, fair_skin, calm_expression, medium_shot, sensual, <lora:shiki_natsume_v18_wd14:0.85>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, day, bright, rain',
    storyJa: '【大人のAfter Story・夏目・月明かりの窓辺の姿】夜も更け、夏目は窓辺に立っていた。月の光が彼女の輪郭を照らしている。ガウンを解いてそのまま滑り落とし、正面から月明かりに晒す。胸も、腰も、脚の付け根の一番秘かな場所も、銀色の光の中に何の隠しもなく浮かんでいる。彼女は目をそらさず、笑みを含んだ声で言った。「見飽きるまで、目を離さないで。今夜の月明かりは、最後の場所まであなたにだけ分けてあげる。」'
  }
];

function categoryFor(scene, rating) {
  const category = scene.category || '日常';
  if (rating === 'All' && category === '亲密') return '恋爱';
  if (rating === 'All' && category === '亲密/After_Story') return '恋爱/After_Story';
  return category;
}

function normalizeUsage(scene, rating) {
  const usage = (scene.usage || []).filter((item) => item !== 'R18' && item !== 'R15' && item !== '全年龄' && item !== '成人向');
  if (rating === 'R18') usage.push('成人向');
  else if (rating === 'R15') usage.push('R15');
  return usage;
}

function normalizeNegative(scene, rating) {
  const values = String(scene.negative || '').split(',').map((value) => value.trim()).filter(Boolean);
  // 2026-08-15 用户裁定：裸体压制只在 All 评级保留；R15 与 R18 一样剥离并补未成年保护。
  if (rating === 'All') {
    const seen = new Set(values.map((value) => value.toLowerCase()));
    for (const token of ['nsfw', 'nude', 'explicit']) {
      if (!seen.has(token)) values.push(token);
    }
    return values.join(', ');
  }
  const blocked = new Set(['nsfw', 'nude', 'naked', 'explicit']);
  const normalized = values.filter((value) => !blocked.has(value.toLowerCase()));
  const seen = new Set(normalized.map((value) => value.toLowerCase()));
  ['child', 'loli', 'underage'].forEach((value) => {
    if (!seen.has(value)) normalized.push(value);
  });
  return normalized.join(', ');
}

/**
 * 2026-08-15 样张视觉定级的人工降级表（用户裁定：多数标 R18 的样张实际顶多 R15），
 * 与 validate-scenes.js 共用（scripts/runtime/manual-scene-ratings.js）。
 * 评级以样张实际画面为准（露点/性行为=R18，半裸/内衣/强暗示=R15，否则 All），
 * 覆盖 ratingFor 的 tag 推导与 R18 强制保留逻辑；只列入降级项。
 */
const MANUAL_RATINGS = require('../runtime/manual-scene-ratings.js');

const scenes = loadSceneShards().scenes;
const ids = new Set(scenes.map((scene) => scene.id));
for (const addition of additions) if (!ids.has(addition.id)) scenes.push(addition);

let changed = 0;
const totals = { All: 0, R15: 0, R18: 0 };
for (const scene of scenes) {
  // 信任场景已有的成熟标记：凡 mature:true / rating:R18 的保留不动
  // 只有被自动归为 All/R15 的才按 tag 重新计算，防止手动设定被覆盖
  const force = scene.mature === true || scene.rating === 'R18';
  const manual = MANUAL_RATINGS[scene.id];
  const rating = manual || (force ? 'R18' : ratingFor(scene));
  const next = { rating, mature: rating === 'R18', category: categoryFor(scene, rating), usage: normalizeUsage(scene, rating), negative: normalizeNegative(scene, rating) };
  if (scene.rating !== next.rating || scene.mature !== next.mature || scene.category !== next.category || JSON.stringify(scene.usage) !== JSON.stringify(next.usage) || scene.negative !== next.negative) changed += 1;
  Object.assign(scene, next);
  totals[rating] += 1;
}

if (write) writeSceneSet(scenes);
console.log('ratings: All=' + totals.All + ' R15=' + totals.R15 + ' R18=' + totals.R18 + ' changed=' + changed + (write ? ' written' : ''));
if (!write && changed) process.exitCode = 1;
