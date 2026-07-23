const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const candidates = JSON.parse(fs.readFileSync(path.join(root, 'data/official-cg-candidates.json'), 'utf8'));
const byId = new Map(candidates.map((item) => [item.id, item]));
const selection = [
  ['ocn02', 2], ['ocn04', 2], ['ocn07', 3], ['ocn08', 1], ['ocn09', 1],
  ['ocn10', 1], ['ocn11', 2], ['ocn12', 2], ['ocn13', 1], ['ocn14', 1], ['ocn15', 1],
  ['ocs01', 1], ['ocs02', 1], ['ocs04', 1], ['ocs08', 1], ['ocs09', 1],
  ['ocs10', 1], ['ocs11', 1], ['ocs12', 1], ['ocs13', 1], ['ocs14', 1],
  ['ocs15', 1], ['ocs16', 1], ['ocs17', 1], ['ocs18', 1], ['ocs19', 1]
];

const moments = {
  ocn02: '午后的教室只剩风吹窗帘的声音。宁宁把交握的手举到胸前，犹豫很久才望向你：“今天……能再陪我一会儿吗？”',
  ocn04: '清晨的粉色卧室里，宁宁穿着蓝色睡衣从被子里坐起。她揉揉眼睛，小声提醒你：“早安，不过先说好，不准笑我的睡相。”',
  ocn07: '舞台灯火落在宁宁的银发上，她把装满花朵的礼盒抱在怀里。走到你面前时，她终于露出安心的笑：“这个，只想亲手交给你。”',
  ocn08: '紫色星海在魔法阵外翻涌，宁宁压低帽檐，将银色枪口稳稳指向异变中心。“躲在我身后——这一次，轮到我保护你。”',
  ocn09: '成年后的某个黄昏，图书室的安静被宁宁慌乱的呼吸打破。她攥住裙摆又羞恼地瞪来：“既然看见了，就不许丢下我一个人。”',
  ocn10: '同居后的深夜，宁宁侧卧在深蓝床铺上，银色双辫散在枕边。她没有移开目光，只轻声问：“今晚……可以再靠近一点吗？”',
  ocn11: '晨光越过金色软枕，宁宁红着脸拉住滑开的衣襟。她明明紧张得指尖发抖，仍认真地说：“不要躲开，我想让你看见真正的我。”',
  ocn12: '魔女帽落下阴影，宁宁伏在木地板上回头确认你的视线。她咬住唇，小声抱怨：“这套衣服的契约效果……绝对和你想的不一样。”',
  ocn13: '薄荷色睡衣被晨风轻轻吹动，宁宁把衣摆攥在胸前。她从被窝里望来：“再五分钟就好……让我记住你醒来时的样子。”',
  ocn14: '金色软枕间，宁宁的长发与粉色发带散成一圈。她在近得无法逃开的距离里低声说：“今天不准装作没听见我的心跳。”',
  ocn15: '深色枕边，宁宁把藏了许久的小玩具举到唇边，脸红得几乎说不出话。“只、只是想和你商量……以后不要让我一个人忍着。”',
  ocs01: '更衣室安静下来后，夏目坐在折叠椅上整理黑色长袜。察觉你的视线，她故作平静：“看够了吗？看够了就过来帮我系好。”',
  ocs02: '粉色针织衫衬得夏目的神情格外柔和。她把手指抵在唇边，低声提醒：“这件事只告诉你，所以不要转身就忘了。”',
  ocs04: '红金旗袍贴着夏目的身形，她站在门前，双手紧张地交叠。迎上你的目光后，她偏过脸：“只准说适合，不接受其他答案。”',
  ocs08: '清晨的被窝还带着余温，夏目从白色枕边睁开眼。她没有立刻起身，只看着你说：“早安。再躺一分钟，也不算赖床。”',
  ocs09: '木架前的蓝色微光落进夏目的琥珀瞳。她把那枚小小的光点捧到你面前：“别碰得太急，它好像会回应人的心情。”',
  ocs10: '暖灯照着卧室，夏目侧过身，用手臂遮住发烫的脸。“我没有后悔……只是需要一点时间，习惯被你这样珍惜。”',
  ocs11: '成年后的更衣室里，夏目坐上椅背，把一条长腿抬到你面前。她强装镇定地问：“既然是你选的，就负责看到最后。”',
  ocs12: '夜蓝床铺映着黑色蕾丝，夏目把双手交握在胸前。她注视着你，声音比平时更轻：“灯不用关，我想看清你的表情。”',
  ocs13: '木地板的暖色映在夏目脸侧，她把手指轻轻抵住唇。“先别说话，”她看着你，“让我确认现在不是梦。”',
  ocs14: '杯架前，夏目把小点心仔细捧在掌心递来。“试吃品只有一份，”她微笑着补充，“所以你的评价要认真一点。”',
  ocs15: '暖黄床灯下，夏目侧卧着望向你，长发沿肩头铺开。她没有催促，只伸出手：“过来吧，今晚不需要任何借口。”',
  ocs16: '黑色蕾丝滑落后，夏目仍把双手交叠在胸前。她努力维持平静：“不要移开视线……是我自己决定留在这里的。”',
  ocs17: '夜蓝床单微微褶皱，夏目在坦白的姿势里直视着你。“已经到这一步了，”她呼吸一顿，“就别再让我重复邀请。”',
  ocs18: '沙发边，夏目松开吊带裙与衬衫，回头确认你仍在身旁。“帮我整理好，”她轻声说，“但不许假装什么都没看见。”',
  ocs19: '储物架间没有别人，夏目抬起女仆裙摆，俯视着你的反应。“这是闭店后的特别服务，”她笑了笑，“仅此一次。”'
};

const japanese = {
  nene: '「そんなに見つめないで……でも、今はそばにいて。」',
  natsume: '「目を逸らさないで。あなたにだけ、見ていてほしいの。」'
};
const storyDetail = {
  nene: '窗边的光沿着她的银白长发缓缓移动，粉色发带与紫色眼眸让这一刻安静得像被珍藏起来。',
  natsume: '柔和的光落在她的黑色长发与琥珀色眼眸上，眼下泪痣也让克制的表情显得格外清晰。'
};
const baseNegative = 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, child, loli, underage, young-looking';

const files = {
  'nene-core': path.join(root, 'data/scenes/nene-core.json'),
  'nene-after': path.join(root, 'data/scenes/nene-after-story.json'),
  'natsume-core': path.join(root, 'data/scenes/natsume-core.json'),
  'natsume-after': path.join(root, 'data/scenes/natsume-after-story.json')
};
const stores = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, JSON.parse(fs.readFileSync(file, 'utf8'))]));
for (const store of Object.values(stores)) {
  for (let index = store.length - 1; index >= 0; index -= 1) {
    if (store[index].officialCgCandidate) store.splice(index, 1);
  }
}

const assigned = {};
selection.forEach(([candidateId, attempt], index) => {
  const source = byId.get(candidateId);
  if (!source) throw new Error(`Missing candidate ${candidateId}`);
  const id = `sc${String(260 + index).padStart(3, '0')}`;
  const adult = source.rating === 'R18';
  const character = source.character;
  const promptText = source.prompt.replace(/masterpiece, best quality, amazing quality, /, '');
  const originalSize = source.size;
  const [originalWidth, originalHeight] = originalSize.split('×').map(Number);
  const size = originalWidth > originalHeight ? originalSize : '1344×768';
  const [width, height] = size.split('×').map(Number);
  const image = path.join('E:/code/2/lora/AI/OfficialCGAudits/2026-07-23_v14/images', `${candidateId}-a${attempt}.png`);
  if (!fs.existsSync(image)) throw new Error(`Missing approved image ${image}`);
  const scene = {
    id,
    recommendedSize: size,
    title: source.title,
    category: adult ? '亲密/After_Story' : '官方CG灵感',
    story: `${adult ? '【成年 After Story】' : '【官方 CG 灵感】'}${moments[candidateId].replace('“', '「').replace('”', '」')}${storyDetail[character]}`,
    char: character,
    character: [character],
    lora: character === 'nene' ? 'ayachi_nene_v14' : 'shiki_natsume_v14',
    emotion: adult ? '亲密' : '心动',
    season: '不限',
    time: /night|moon|dark|夜|深蓝/.test(source.prompt + source.title) ? '夜晚' : '白天',
    timeOfDay: /night|moon|dark|夜|深蓝/.test(source.prompt + source.title) ? 'night' : 'afternoon',
    tags: ['official_cg', 'visual_audited', 'landscape', character, adult ? 'adult' : 'solo'],
    mature: adult,
    location: /cafe|杯架|储物/.test(source.prompt + source.title) ? '咖啡馆' : /library|图书/.test(source.prompt + source.title) ? '图书室' : /bed|卧室|床|枕/.test(source.prompt + source.title) ? '卧室' : '室内场景',
    weather: '晴',
    camera: width > height ? '官方CG横幅构图' : '官方CG竖幅构图',
    lighting: /night|moon|dark|夜|深蓝/.test(source.prompt + source.title) ? '夜色氛围光' : '柔和自然光',
    usage: ['官方CG灵感', '实机审核通过', '展示图'],
    prompt: promptText,
    negative: [baseNegative, source.negative || '', adult ? '' : 'nsfw, nude, explicit'].filter(Boolean).join(', '),
    storyJa: `${adult ? '【成人After Story' : '【公式CGインスピレーション'}・${character === 'nene' ? '寧々' : '夏目'}】柔らかな光の中で、彼女は大切な人だけに本当の気持ちを見せる。${japanese[character]}`,
    rating: source.rating,
    officialCgCandidate: candidateId,
    audit: { reviewer: 'direct-vision', attempt, seedKey: `official-cg:${candidateId}:${attempt}`, reference: source.reference, image, result: 'pass' }
  };
  const bucket = `${character}-${adult ? 'after' : 'core'}`;
  stores[bucket].push(scene);
  assigned[candidateId] = id;
});

for (const [key, file] of Object.entries(files)) fs.writeFileSync(file, JSON.stringify(stores[key], null, 2) + '\n');

const curationFile = path.join(root, 'data/curation.json');
const curation = JSON.parse(fs.readFileSync(curationFile, 'utf8'));
const curatedCandidates = ['ocn02', 'ocn04', 'ocn08', 'ocn09', 'ocn13', 'ocn14', 'ocs02', 'ocs04', 'ocs08', 'ocs11', 'ocs12', 'ocs13', 'ocs15', 'ocs16', 'ocs19'];
const signatureCandidates = ['ocn08', 'ocn09', 'ocs02', 'ocs04', 'ocs12', 'ocs19'];
const officialSceneIds = new Set(Object.values(assigned));
const existingCurated = curation.curatedSceneIds.filter((id) => !officialSceneIds.has(id));
const existingSignature = curation.signatureSceneIds.filter((id) => !officialSceneIds.has(id));
curation.curatedSceneIds = [...new Set([...curatedCandidates.map((id) => assigned[id]), ...existingCurated])];
curation.signatureSceneIds = [...new Set([...signatureCandidates.map((id) => assigned[id]), ...existingSignature])];
curation.recommendationReasons ||= {};
for (const id of curatedCandidates) curation.recommendationReasons[assigned[id]] = '以官方单人 CG 为参考，并经过本机 WebUI 同尺寸实机生成与直接视觉复核。';
curation.qualityGate.audit = '2026-07-23_v14_official_cg';
curation.qualityGate.reviewer = 'direct-vision';
curation.qualityGate.passed = Object.values(stores).reduce((sum, store) => sum + store.length, 0);
fs.writeFileSync(curationFile, JSON.stringify(curation, null, 2) + '\n');

console.log(JSON.stringify({ added: selection.length, assigned }, null, 2));
