/**
 * Assign a rating from what a scene depicts.
 * All = romance/daily life; R15 = suggestive but non-explicit; R18 = adult nudity or explicit sexual framing.
 * Run with: node scripts/classify-scene-ratings.js --write
 */
const { loadSceneShards, writeSceneSet } = require('./scene-store');
const { ratingFor } = require('./prompt-policy');
const write = process.argv.includes('--write');
const STANDARD_NEGATIVE = 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic';

const additions = [
  {
    id: 'sc207', title: '雾气散去后的白色浴巾', category: '亲密/After_Story',
    story: '【成年 After Story · 宁宁 · 浴室蒸汽里的清晨】周末清晨，浴室的镜面还留着一层薄雾。洗完澡的宁宁只围着柔软白浴巾，湿润的白发从肩头垂下；她一边整理发带，一边被你看得耳根发热。窗外的晨光穿过水汽，把她的轮廓照得格外柔和。她故作镇定地偏过头，小声提醒你——「宁宁已经是大人了也会害羞的……只准看一会儿，听见没有？」',
    char: 'nene', character: ['nene'], lora: 'ayachi_nene_v11', emotion: '害羞而信任', season: '不限', time: '清晨', timeOfDay: 'morning',
    tags: ['nude', 'bath_towel', 'wet_hair', 'bare_shoulders', 'collarbone', 'standing', 'bathroom', 'steam', 'morning_light', 'soft_shadows', 'heavy_blush', 'ahoge', 'hair_ribbon', 'close_up', 'sensual'],
    rating: 'R18', mature: true, location: '公寓主卧浴室', weather: '室内温暖水汽', camera: '平视上半身近景', lighting: '窗边晨光与柔和反射光', usage: ['成人向', '角色还原'],
    prompt: '1girl, solo, ayachi_nene, white_hair, low_twintails, purple_eyes, ahoge, hair_ribbon, adult, nude, bath_towel, wet_hair, bare_shoulders, collarbone, standing, bathroom, steam, morning_light, soft_shadows, heavy_blush, close_up, sensual, <lora:ayachi_nene_v11:0.78>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, poorly drawn face, harsh_lighting',
    storyJa: '【大人のAfter Story・寧々・浴室の湯気に包まれた朝】週末の朝、浴室の鏡にはまだ薄い湯気が残っていた。湯上がりの寧々は柔らかな白いタオルだけをまとい、濡れた白髪を肩に落としている。リボンを整えながら見つめられると、耳まで赤くなった。窓から差す朝の光が水蒸気を通り、彼女の輪郭をやさしく照らす。寧々は平静を装って顔をそむけ、小さな声で言った。――「大人になった寧々だって、恥ずかしいんだから……少しだけなら、見てもいいよ。」'
  },
  {
    id: 'sc208', title: '夜灯下的黑发余温', category: '亲密/After_Story',
    story: '【成年 After Story · 夏目 · 夜灯下的安静邀请】深夜的卧室只开着床头暖灯。结束一天工作的夏目披着深色睡袍坐在床沿，黑色长发散落在肩背，疲惫被难得的柔和取代。她把杯子放到一旁，抬眼示意你靠近，语气仍有一点逞强——「别误会，我只是想安静待一会儿。门锁好了，今晚不许用工作当借口逃跑。」',
    char: 'natsume', character: ['natsume'], lora: 'shiki_natsume_v11', emotion: '克制的独占欲', season: '不限', time: '深夜', timeOfDay: 'late_night',
    tags: ['nude', 'bathrobe', 'bare_shoulders', 'bare_legs', 'sitting_on_bed', 'bedroom', 'bedside_lamp', 'long_hair', 'mole_under_eye', 'looking_at_viewer', 'slight_blush', 'night', 'warm_lighting', 'medium_shot', 'sensual'],
    rating: 'R18', mature: true, location: '夏目成年后的私人公寓卧室', weather: '室内恒温', camera: '平视中近景', lighting: '单一床头暖灯与深色阴影', usage: ['成人向', '氛围优先'],
    prompt: '1girl, solo, shiki_natsume, black_hair, long_hair, yellow_eyes, mole_under_eye, adult, nude, bathrobe, bare_shoulders, bare_legs, sitting_on_bed, bedroom, bedside_lamp, looking_at_viewer, slight_blush, night, warm_lighting, medium_shot, sensual, <lora:shiki_natsume_v11:0.78>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, overly bright background, harsh_lighting',
    storyJa: '【大人のAfter Story・夏目・夜灯の下の静かな誘い】深夜の寝室にはベッドサイドの暖かな灯りだけがついていた。一日の仕事を終えた夏目は濃い色のガウンを羽織り、ベッドの端に座っている。黒い長髪は肩から背中へ落ち、疲れた表情は珍しくやわらかい。彼女はカップを脇へ置き、近くへ来るように目で合図した。――「勘違いしないで。ただ、少し静かにしていたいだけ。鍵はかけたから、今夜は仕事を言い訳に逃げるのはなしよ。」'
  },
  {
    id: 'sc209', title: '拂晓床单上的心形呆毛', category: '亲密/After_Story',
    story: '【成年 After Story · 宁宁 · 破晓前的赖床时间】天还没有完全亮，卧室里只剩窗帘缝隙漏进来的淡蓝晨光。宁宁裹在白色床单里坐起身，睡乱的双马尾和翘起的呆毛让她看上去格外没有防备。她发现你醒着，立刻拉高床单又忍不住偷看过来，最后轻轻把位置让出一半——「再睡五分钟就好……不许笑宁宁的头发，也不许先跑掉。」',
    char: 'nene', character: ['nene'], lora: 'ayachi_nene_v11', emotion: '慵懒依恋', season: '不限', time: '破晓', timeOfDay: 'dawn',
    tags: ['nude', 'bedsheet', 'bare_shoulders', 'messy_hair', 'sitting_on_bed', 'bedroom', 'dawn', 'blue_hour', 'soft_light', 'heavy_blush', 'looking_at_viewer', 'ahoge', 'hair_ribbon', 'close_up', 'sensual'],
    rating: 'R18', mature: true, location: '共同生活后的主卧', weather: '安静清晨', camera: '平视近景', lighting: '破晓蓝光与柔和漫反射', usage: ['成人向', '壁纸级'],
    prompt: '1girl, solo, ayachi_nene, white_hair, low_twintails, purple_eyes, ahoge, hair_ribbon, adult, nude, bedsheet, bare_shoulders, messy_hair, sitting_on_bed, bedroom, dawn, blue_hour, soft_light, heavy_blush, looking_at_viewer, close_up, sensual, <lora:ayachi_nene_v11:0.78>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, daylight, harsh_lighting, extra limbs',
    storyJa: '【大人のAfter Story・寧々・夜明け前の二度寝】空はまだ完全には明るくならず、寝室にはカーテンの隙間から淡い青い光だけが漏れていた。寧々は白いシーツにくるまりながら起き上がる。寝癖のついたツインテールと跳ねたアホ毛が、いつもより無防備に見えた。あなたが起きていると気づくと、慌ててシーツを引き上げながらも、そっとこちらを見ている。やがて隣の場所を半分だけ空けて、小さく言った。――「あと五分だけ寝よう……寧々の髪を笑ったり、先に逃げたりしたらだめだからね。」'
  },
  {
    id: 'sc210', title: '月下露天风吕的黑发水痕', category: '亲密/After_Story',
    story: '【成年 After Story · 夏目 · 月下温泉的短暂休战】旅行最后一晚，露天风吕外只剩虫鸣和远处的山风。夏目把湿透的黑发拨到身后，靠在温泉边缘仰望月色；平日锐利的眼神在蒸汽里慢慢放松。她听见你的脚步声却没有回头，只把空出来的位置留给你——「这次休假算你赢了。坐过来吧，但不许把这份安静弄得太吵。」',
    char: 'natsume', character: ['natsume'], lora: 'shiki_natsume_v11', emotion: '放松后的温柔', season: '秋', time: '夜晚', timeOfDay: 'night',
    tags: ['nude', 'outdoor_bath', 'wet_hair', 'bare_shoulders', 'upper_body', 'steam', 'moonlight', 'night', 'mountain_view', 'mole_under_eye', 'side_view', 'calm_expression', 'soft_shadows', 'medium_shot', 'sensual'],
    rating: 'R18', mature: true, location: '山间旅馆私人露天风吕', weather: '秋夜微凉', camera: '侧面中近景', lighting: '月光、灯笼与水面反射光', usage: ['成人向', '旅行氛围'],
    prompt: '1girl, solo, shiki_natsume, black_hair, long_hair, yellow_eyes, mole_under_eye, adult, nude, outdoor_bath, wet_hair, bare_shoulders, upper_body, steam, moonlight, night, mountain_view, side_view, calm_expression, soft_shadows, medium_shot, sensual, <lora:shiki_natsume_v11:0.78>',
    negative: STANDARD_NEGATIVE + ', school_uniform, gym_uniform, child, loli, underage, crowd, daylight, harsh_lighting',
    storyJa: '【大人のAfter Story・夏目・月下の露天風呂での小休戦】旅の最終夜、露天風呂の外には虫の声と遠い山風だけが残っていた。夏目は濡れた黒髪を背中へ払って湯の縁にもたれ、月を見上げている。普段は鋭い眼差しも、湯気の中では少しずつほどけていった。あなたの足音に気づいても振り返らず、隣の場所だけを空けて言う。――「今回の休暇は、あなたの勝ちでいい。ここに座りなさい。でも、この静けさを騒がしくするのは許さないから。」'
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

const scenes = loadSceneShards().scenes;
const ids = new Set(scenes.map((scene) => scene.id));
for (const addition of additions) if (!ids.has(addition.id)) scenes.push(addition);

let changed = 0;
const totals = { All: 0, R15: 0, R18: 0 };
for (const scene of scenes) {
  const rating = ratingFor(scene);
  const next = { rating, mature: rating === 'R18', category: categoryFor(scene, rating), usage: normalizeUsage(scene, rating) };
  if (scene.rating !== next.rating || scene.mature !== next.mature || scene.category !== next.category || JSON.stringify(scene.usage) !== JSON.stringify(next.usage)) changed += 1;
  Object.assign(scene, next);
  totals[rating] += 1;
}

if (write) writeSceneSet(scenes);
console.log('ratings: All=' + totals.All + ' R15=' + totals.R15 + ' R18=' + totals.R18 + ' changed=' + changed + (write ? ' written' : ''));
if (!write && changed) process.exitCode = 1;
