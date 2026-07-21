/**
 * One-time scene curation pass.
 * It preserves the existing collection, repairs structural metadata and adds
 * two safe, character-faithful signature scenes to close missing IDs.
 * Run with: node scripts/refine-scenes.js --write
 */
const { loadSceneShards, writeSceneSet } = require('./scene-store');
const write = process.argv.includes('--write');
const standardNegative = 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, nsfw, nude, explicit';

const japaneseRewrites = {
  sc240: '【寧々・雨のバス停】放課後の急な雷雨で、通りはすっかり濡れていた。寧々はバス停の小さな屋根の下で、図書館から借りた古書を大切に抱えている。あなたが傘を彼女の方へ傾けると、自分の肩が雨に濡れた。寧々はそっと近づき、ハンカチでその雫を拭う――「ばか……もう少し自分の方へ傘を寄せてもよかったのに。風邪をひくよ？」',
  sc242: '【寧々・絵馬に隠した願い】元旦の朝、薄い雪が残る神社の石段。振袖姿の寧々は絵馬に願い事を書き終えるが、あなたの視線に気づいて慌てて背中へ隠す。寒風の中、アホ毛まで揺れていた――「み、見ちゃだめ！ 願い事は見られたら叶わないんだから……柊史のことなんて、書いてないよ！」',
  sc244: '【寧々・午後の膝枕】週末の午後、超自然研究会の資料を読んでいた寧々は、いつの間にかソファで眠ってしまう。あなたがそっと彼女の頭を膝へ移すと、銀色の髪が陽だまりにほどけた。安心したように頬を寄せ、彼女は寝言をこぼす――「柊史の匂い……安心する……」',
  sc246: '【寧々・旅先のほどけた襟元】夏の温泉旅館。湯上がりの寧々は、少し緩んだ浴衣の帯に気づかないまま畳の上で写真を整理していた。あなたに教えられると、彼女は真っ赤になって襟元を押さえる――「どこまで見たの！？ 思い出すのもだめ！ 浴衣の紐が滑りやすいだけなんだから……後ろ向いて！」',
  sc249: '【夏目・豪雨の車内】深夜の豪雨で、同人AUの任務車両は路肩に止まっていた。疲れた夏目は後部座席で体勢を崩し、揺れの拍子にあなたの方へ寄りかかる。耳を赤くしながらも、彼女は平静を装った――「……勘違いしないで。これはただの慣性。体温を保つなら、これが一番効率的なだけ」',
  sc250: '【寧々・毛布の下の距離】冬の夜、暖房の弱いリビングで寧々はソファの隅にいた。あなたが隣に座ると、彼女は迷いながら毛布の半分を差し出す。灯りの下でアホ毛が小さく揺れた――「……二人で使った方が暖かいだけ。近すぎるけど……もう少しだけなら、いいよ」',
  sc251: '【夏目・風にほどける髪】秋の午後のベランダ。読書中の夏目の黒髪が風に舞い、あなたの頬をかすめた。髪が肩に絡んで初めて、彼女は近すぎる距離に気づく。赤い耳を隠すように視線をそらし――「……風のせい。私が近づいたわけじゃないし、あなたも避けなかったでしょ」'
};

const additions = [
  {
    id: 'sc215', title: '月光书页里的小小勇气', category: '校园',
    story: '【宁宁 · 图书馆的月光练习】闭馆前的图书馆安静得只剩翻页声。宁宁把一本关于魔法史的旧书抱在胸前，犹豫了很久才邀请你一起核对笔记。窗外的月光落在她银白色的发带上，她明明紧张得指尖发凉，却还是认真地抬起眼睛——「这次不是因为害怕才找你帮忙。只是……我想和你一起把它读完。」',
    storyJa: '【寧々・月明かりの読書室】閉館前の図書室には、ページをめくる音だけが残っていた。寧々は魔法史の古い本を胸に抱え、迷った末にあなたへノートを照らし合わせようと誘う。月明かりが銀色の髪飾りに落ちる中、震える指先を隠して彼女は顔を上げた――「怖いから頼るんじゃないの。一緒に最後まで読みたいだけ……」',
    char: 'nene', character: ['nene'], lora: 'ayachi_nene_v11', emotion: '鼓起勇气的信任', season: '秋', time: '闭馆前', timeOfDay: 'evening',
    tags: ['white_hair', 'very_long_hair', 'low_twintails', 'purple_eyes', 'ahoge', 'hair_ribbon', 'school_uniform', 'library', 'bookshelf', 'moonlight', 'holding_book', 'soft_smile', 'medium_shot'],
    rating: 'All', mature: false, location: '学院图书馆深处', weather: '秋夜晴朗', camera: '平视中景，书架形成纵深', lighting: '月光与书桌暖灯交织', usage: ['角色还原', '氛围优先'],
    prompt: '1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, hair_ribbon, school_uniform, library, bookshelf, holding_book, moonlight, desk_lamp, soft_smile, looking_at_viewer, medium_shot, cinematic_composition, soft_lighting, cozy',
    negative: standardNegative
  },
  {
    id: 'sc256', title: '闭店后留给你的那杯热可可', category: '日常',
    story: '【夏目 · 不必说明的照顾】Café Stella 打烊后，夏目把最后一盏吧台灯留了下来。你刚从雨里进门，她没有问太多，只是把一杯热可可推到你面前，又把干毛巾搭在椅背上。等你抬头时，她已经假装在整理账本——「……别误会。客人感冒会影响明天的营业效率。喝完再走。」',
    storyJa: '【夏目・閉店後のホットココア】Café Stellaの閉店後、夏目はカウンターの灯りを一つだけ残していた。雨の中から入ってきたあなたへ、何も聞かずに温かいココアと乾いたタオルを差し出す。帳簿へ視線を落としたまま、彼女は小さく言った――「……勘違いしないで。風邪をひかれたら明日の営業に困るだけ。飲んでから帰って」',
    char: 'natsume', character: ['natsume'], lora: 'shiki_natsume_v11', emotion: '沉默的关心', season: '冬', time: '闭店后', timeOfDay: 'night',
    tags: ['black_hair', 'long_hair', 'yellow_eyes', 'mole_under_eye', 'hairclip', 'cafe_uniform', 'cafe', 'holding_cup', 'rain', 'window', 'warm_lighting', 'medium_shot', 'reserved_expression'],
    rating: 'All', mature: false, location: 'Café Stella 吧台', weather: '冬夜小雨', camera: '吧台侧面中景，人物与热饮同框', lighting: '单盏暖灯、窗外冷色雨光', usage: ['角色还原', '日常叙事'],
    prompt: '1girl, solo, shiki_natsume, black_hair, long_hair, yellow_eyes, mole_under_eye, hairclip, cafe_uniform, cafe, holding_cup, hot_chocolate, rain, window, warm_lighting, reserved_expression, slight_blush, looking_at_viewer, medium_shot, cinematic_composition, cozy',
    negative: standardNegative
  }
];

function normalise(scene) {
  if (scene.timeOfDay === 'daytime') scene.timeOfDay = 'all_day';
  if (!scene.mature && !String(scene.negative).split(',').map((item) => item.trim()).includes('nsfw')) {
    scene.negative = String(scene.negative || standardNegative).replace(/\s*,?\s*$/, '') + ', nsfw, nude, explicit';
  }
  if (scene.mature && scene.char === 'nene' && !/(成年|adult)/i.test(String(scene.story).slice(0, 80))) {
    scene.story = '【成年 After Story · 宁宁】' + scene.story;
  }
  if (scene.id === 'sc232') {
    scene.story = String(scene.story).replace('官方复刻', '灵感复刻').replace(/魅魔/g, '魔女');
  }
  if (scene.id === 'sc249' && !/同人 AU/.test(scene.story)) {
    scene.story = scene.story.replace('【夏目 ·', '【同人 AU · 夏目 ·');
    scene.category = '恋爱/同人/After_Story';
    if (!scene.tags.includes('fanwork_au')) scene.tags.push('fanwork_au');
  }
  if (japaneseRewrites[scene.id]) scene.storyJa = japaneseRewrites[scene.id];
  const expectedHeader = scene.char === 'nene' ? '【寧々】' : scene.char === 'natsume' ? '【夏目】' : '';
  if (expectedHeader && !String(scene.storyJa).split('】', 1)[0].includes(expectedHeader.slice(1, -1))) {
    scene.storyJa = expectedHeader + scene.storyJa;
  }
  return scene;
}

const scenes = loadSceneShards().scenes;
const ids = new Set(scenes.map((scene) => scene.id));
for (const addition of additions) if (!ids.has(addition.id)) scenes.push(addition);
scenes.forEach(normalise);

if (write) writeSceneSet(scenes);
console.log('curated scenes=' + scenes.length + (write ? ' written' : ' checked'));
