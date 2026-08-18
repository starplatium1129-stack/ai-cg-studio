'use strict';
// 2026-08-18 审视修复：characters.json 今日新增 9 位角色档案重写
// 按首批角色档案格式（visual_dna 中文全字段 / personality 真实 5 项 / likes /
// classic_cg / identity / tags / palette / weather / alias 罗马音 / bg_story 中文）
// 依据 Research/character-anime/*.json 权威调研
const fs = require('fs');
const file = 'data/characters.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const pc = JSON.parse(fs.readFileSync('data/popular-characters.json', 'utf8'));

function find(id) {
  const c = data.find(x => x.id === id);
  if (!c) throw new Error('missing ' + id);
  return c;
}
// traits 与 popular identityTokens 同步
function syncTraits(id) {
  const popular = pc.characters.find(x => x.id === id);
  const ch = find(id);
  ch.traits = [...popular.identityTokens];
}

// ── sylphiette ──────────────────────────────────────────────
{
  const c = find('sylphiette');
  c.alias = ['Sylphiette', 'Sylphie', 'シルフィエット', '希露菲'];
  c.visual_dna = {
    hair: '幼年绿发 → 青年银白短发（米格路德族长耳族 1/4 混血）',
    hair_color: '绿（幼年）/ 银白（青年）',
    eyes: '红（Ruby Red）',
    hairstyle: '短发 · 齐刘海 · 又长又尖的双耳（高兴时会扑腾）',
    uniform: '学徒法师长袍 / 夏亚魔法学院执事装（菲兹）',
    expression: '温柔羞怯 · 小天使',
    style: 'gentle white-haired elf girl',
    signature: '尖耳、红瞳与绿发变白发的成长线',
  };
  c.personality = ['温柔体贴', '害羞内向', '坚韧成长', '青梅竹马', '小天使'];
  c.likes = ['鲁迪', '魔术学习', '布耶纳村', '平静的日常'];
  c.classic_cg = {
    title: '布耶纳村的大树',
    description: '村口古树下，她捧起晶莹水球，尖尖的耳朵因害羞轻轻扑腾——与你相遇的那一天。',
  };
  c.identity = {
    role: '鲁迪的青梅竹马 / 妻子',
    age: '幼年 → 青年（作品时间跨度）',
    occupation: '魔术师（后任阿斯拉王国宫廷魔术师）',
    faction: '格雷拉特家 / 夏亚魔法大学',
  };
  c.tags = ['尖耳', '红瞳', '白发', '青梅竹马', '小天使'];
  c.bg_story = '希露菲叶特是《无职转生》的女主角之一，鲁迪的青梅竹马。拥有 1/4 长耳族（米格路德族）血统，又长又尖的双耳是她的个人标志。幼年因斯佩路德族般的绿发被欺负，被鲁迪所救后成为朋友并一同学习魔术。青年时期以「菲兹」之名在夏亚魔法学院活跃，最终与鲁迪重逢并结为夫妻。';
  c.palette = ['银白', '草绿', '绯红'];
  c.weather = ['布耶纳村午后', '学院图书馆', '新婚清晨阳台'];
  syncTraits('sylphiette');
}
// ── yuigahama_yui ───────────────────────────────────────────
{
  const c = find('yuigahama_yui');
  c.alias = ['Yuigahama Yui', 'Yui', 'ゆいがはま ゆい', '结衣'];
  c.visual_dna = {
    hair: '橙粉中长发 · 团子头',
    hair_color: '橙粉（Coral）',
    eyes: '琥珀（Amber）',
    hairstyle: '团子头（side bun）· 双色团子发饰 · 微卷',
    uniform: '总武高校服 / 粉色针织开衫',
    expression: '开朗天然 · 治愈笑容',
    style: 'sunny cheerful girl',
    signature: '团子头、琥珀瞳与治愈系笑容',
  };
  c.personality = ['开朗活泼', '天然呆', '善解人意', '重感情', '厨艺苦手'];
  c.likes = ['和朋友们在一起', '甜食', '打扮', '狗狗'];
  c.classic_cg = {
    title: '侍奉部的午休',
    description: '她带着亲手做的（卖相失败的）曲奇走进侍奉部，脸上却是比谁都明亮的笑容。',
  };
  c.identity = {
    role: '总武高中二年生 / 侍奉部成员',
    age: '高中二年级',
    occupation: '学生',
    faction: '总武高中侍奉部',
  };
  c.tags = ['团子头', '琥珀瞳', '开朗', '侍奉部', '治愈'];
  c.bg_story = '由比滨结衣是《春物》的女主角之一，总武高中二年生，侍奉部成员。橙粉色的团子头与琥珀色眼眸是她的标志，开朗天然的笑容背后是细腻的体贴。她努力融入集体、珍惜每一段关系，偶尔笨拙却总是真诚。';
  c.palette = ['橙粉', '樱粉', '琥珀棕'];
  c.weather = ['教室午后', '祭典夏夜', '狗公园'];
  syncTraits('yuigahama_yui');
}
// ── jeanne_alter ────────────────────────────────────────────
{
  const c = find('jeanne_alter');
  c.alias = ["Jeanne d'Arc (Alter)", 'Jeanne Alter', 'Jalter', 'ジャンヌ・ダルク〔オルタ〕', '黑贞德'];
  c.visual_dna = {
    hair: '银白短发 · 姬发式微卷',
    hair_color: '银白（Platinum Silver）',
    eyes: '金（Golden Yellow）',
    hairstyle: '短发 · 齐刘海 · 微卷发尾',
    uniform: '复仇者黑铠 / 新宿皮夹克 / 黑色晚礼服',
    expression: '傲慢恶役微笑 · 实则傲娇',
    style: 'fierce avenger beauty',
    signature: '银发金瞳、黑色战铠与龙之魔女',
  };
  c.personality = ['傲慢', '傲娇', '毒舌', '外冷内热', '独占欲强'];
  c.likes = ['战斗', '嘲笑对手', '不坦率的关心', '御主'];
  c.classic_cg = {
    title: '龙之魔女的旗',
    description: '黑铠少女立于尸山之上，龙旗猎猎作响。她转过脸，金瞳里是傲慢与一点点不知所措。',
  };
  c.identity = {
    role: '复仇者（Avenger）从者',
    age: '英灵（外表约 17 岁）',
    occupation: '英灵 / 龙之魔女',
    faction: '迦勒底（FGO）',
  };
  c.tags = ['银发', '金瞳', '黑铠', '复仇者', '傲娇'];
  c.bg_story = '贞德[Alter]是《Fate/Grand Order》中登场的复仇者职阶从者，由对自身命运的憎恨与诅咒中诞生的「另一面」贞德。银白短发与金色瞳孔、黑色战铠与龙之魔女的旗帜是她的标志。她以傲慢和毒舌武装自己，内心却藏着不坦率的温柔。';
  c.palette = ['玄黑', '银白', '鎏金'];
  c.weather = ['黑贞德城堡', '新宿雨夜', '迦勒底走廊'];
  syncTraits('jeanne_alter');
}
// ── matou_sakura ────────────────────────────────────────────
{
  const c = find('matou_sakura');
  c.alias = ['Matou Sakura', 'Sakura', 'まとう さくら', '樱'];
  c.visual_dna = {
    hair: '紫色长发 · 齐刘海',
    hair_color: '紫（Violet）',
    eyes: '紫（Deep Violet）',
    hairstyle: '长直发 · 脑后红色缎带',
    uniform: '穗群原学园制服 / 白色连衣裙',
    expression: '温柔沉静 · 含情目光',
    style: 'gentle violet-haired beauty',
    signature: '紫发紫瞳、红缎带与温柔的献身感',
  };
  c.personality = ['温柔贤淑', '隐忍坚强', '善解人意', '家务全能', '内敛深情'];
  c.likes = ['做饭', '卫宫家', '侍弄花草', '前辈'];
  c.classic_cg = {
    title: '卫宫家的厨房',
    description: '她系着围裙在厨房里忙碌，回头对你露出安心的微笑——那是她最幸福的日常。',
  };
  c.identity = {
    role: '穗群原学园一年生',
    age: '高中一年级',
    occupation: '学生',
    faction: '卫宫家 / 穗群原学园',
  };
  c.tags = ['紫发', '紫瞳', '红缎带', '温柔', '大和抚子'];
  c.bg_story = '间桐樱是《Fate/stay night》的女主角之一，间桐家收养的少女，穗群原学园一年生。紫色长发与红色缎带是她的标志，性格温柔沉静、家务全能，在卫宫家找到了真正的归宿。黑化形态「Dark Sakura」则是她压抑情感的暴走形态。';
  c.palette = ['紫罗兰', '缎带红', '暖白'];
  c.weather = ['卫宫家厨房', '冬木神社', '黄昏坡道'];
  syncTraits('matou_sakura');
}
// ── yor_forger ──────────────────────────────────────────────
{
  const c = find('yor_forger');
  c.alias = ['Yor Forger', 'Yor Briar', 'Thorn Princess', 'ヨル・フォージャー', '约尔'];
  c.visual_dna = {
    hair: '黑色长发 · 低发髻',
    hair_color: '黑（Raven Black）',
    eyes: '红（Ruby Red）',
    hairstyle: '低丸子头 · 两鬓碎发',
    uniform: '市政厅职业装 / 居家红毛衣 / 荆棘公主礼服',
    expression: '温柔人妻 · 战斗时凌厉',
    style: 'elegant assassin beauty',
    signature: '黑发红瞳、玫瑰耳环与杀手/人妻反差',
  };
  c.personality = ['天然', '温柔', '运动万能', '不善社交', '反差萌'];
  c.likes = ['家人', '做饭（努力中）', '花生', '平静的生活'];
  c.classic_cg = {
    title: '福杰家的晚餐',
    description: '她系着熊熊围裙端上卖相微妙的料理，丈夫和女儿却都笑得很开心——这就是她守护的日常。',
  };
  c.identity = {
    role: '市政厅职员 / 代号「荆棘公主」的杀手',
    age: '27 岁（官方设定）',
    occupation: '公务员（表面）',
    faction: '福杰家 / 伯林特市政厅',
  };
  c.tags = ['黑发', '红瞳', '杀手', '人妻', '反差萌'];
  c.bg_story = '约尔·福杰是《SPY×FAMILY》的女主角，表面是伯林特市政厅的温和职员，真实身份是代号「荆棘公主」的顶尖杀手。黑色长发与红色眼眸、金色玫瑰耳环是她的标志。为完成任务与黄昏组建了福杰家，却在这份「虚假」的家庭里找到了真正的幸福。';
  c.palette = ['绯红', '玄黑', '橄榄绿'];
  c.weather = ['福杰家黄昏', '市政厅午休', '任务雨夜'];
  syncTraits('yor_forger');
}
// ── reze_chainsaw ───────────────────────────────────────────
{
  const c = find('reze_chainsaw');
  c.alias = ['Reze', 'レゼ', '蕾塞', 'Bomb Devil'];
  c.visual_dna = {
    hair: '粉紫渐变短发 · 齐刘海',
    hair_color: '粉紫（Pink-Purple）',
    eyes: '绿（Emerald Green）',
    hairstyle: '齐刘海短发 · 微卷发尾',
    uniform: '无袖白衬衫+黑领带 / 咖啡厅围裙 / 死库水',
    expression: '俏皮危险 · 恋爱中的少女',
    style: 'playful dangerous girl',
    signature: '粉紫短发、绿瞳与黑色颈环',
  };
  c.personality = ['俏皮', '率直', '危险又温柔', '恋爱脑', '反差'];
  c.likes = ['电次', '咖啡', '海边的夏天', '甜甜圈'];
  c.classic_cg = {
    title: '咖啡店的午后',
    description: '她端着咖啡探出柜台，歪头冲你笑——像普通女孩一样，让人几乎忘了她是炸弹恶魔。',
  };
  c.identity = {
    role: '苏联特工 / 炸弹恶魔（Bomb Devil）',
    age: '外表约 16-17 岁',
    occupation: '咖啡店店员（表面）',
    faction: '苏联（枪之恶魔阵营）',
  };
  c.tags = ['粉紫短发', '绿瞳', '颈环', '咖啡店', '危险浪漫'];
  c.bg_story = '蕾塞是《电锯人》蕾塞篇的女主角，苏联派来的特工，真实身份是炸弹恶魔。粉紫色的短发、绿色眼眸与黑色颈环是她的标志。她在咖啡店与电次相遇，度过了一个像梦一样的夏天，最后却在任务与真心之间做出了选择。';
  c.palette = ['粉紫', '薄荷绿', '咖啡棕'];
  c.weather = ['咖啡店午后', '海边夏日', '烟花大会'];
  syncTraits('reze_chainsaw');
}
// ── fern_frieren ────────────────────────────────────────────
{
  const c = find('fern_frieren');
  c.alias = ['Fern', 'フェルン', '菲伦'];
  c.visual_dna = {
    hair: '紫色长发 · 低侧马尾',
    hair_color: '紫（Violet）',
    eyes: '紫（Calm Violet）',
    hairstyle: '低侧马尾 · 垂至腰际',
    uniform: '第一阶魔法使白袍 / 冬日大衣',
    expression: '冷静淡然 · 偶尔嘟嘴',
    style: 'cool composed mage',
    signature: '紫发侧马尾、紫瞳与冷静毒舌',
  };
  c.personality = ['冷静', '毒舌', '认真', '爱睡懒觉', '外冷内热'];
  c.likes = ['睡觉', '甜点', '吐槽', '旅行'];
  c.classic_cg = {
    title: '旅途的篝火',
    description: '她裹着毯子在篝火边打瞌睡，脑袋一点一点——芙莉莲轻轻扶住她的头，没有叫醒她。',
  };
  c.identity = {
    role: '第一阶魔法使 / 芙莉莲的弟子',
    age: '人类（旅行中成长）',
    occupation: '魔法使',
    faction: '芙莉莲一行',
  };
  c.tags = ['紫发', '侧马尾', '魔法使', '冷静', '巨乳'];
  c.bg_story = '菲伦是《葬送的芙莉莲》的女主角之一，芙莉莲收留并养育的人类少女，成长为第一阶魔法使。紫色长发束成低侧马尾，紫色眼眸冷静而敏锐。她性格沉稳、偶尔毒舌，最爱睡懒觉，与芙莉莲、修塔尔克一同踏上漫长旅途。';
  c.palette = ['紫藤', '纯白', '篝火橙'];
  c.weather = ['旅途旷野', '旅店清晨', '篝火夜话'];
  syncTraits('fern_frieren');
}
// ── mimori_byakuya ──────────────────────────────────────────
{
  const c = find('mimori_byakuya');
  c.alias = ['Mimori Byakuya', 'Byakuya', 'みもり びゃくや', '白夜'];
  c.visual_dna = {
    hair: '银白长发 · 双螺旋角发包',
    hair_color: '银白（Silver White）',
    eyes: '蓝（Gradient Blue）',
    hairstyle: '双螺旋角发包（twin horn buns）· 长鬓发',
    uniform: '维多利亚蕾丝白洋装 / 打工围裙 / 旧运动外套',
    expression: '天然呆 · 面无表情的可爱',
    style: 'delicate poor magical girl',
    signature: '螺旋角发包、蓝瞳与不幸体质',
  };
  c.personality = ['天然呆', '坚韧', '不幸体质', '认真打工', '内敛温柔'];
  c.likes = ['打工赚钱', '孤儿院的孩子们', '平静的日子', '便宜的食物'];
  c.classic_cg = {
    title: '打工的魔法少女',
    description: '她拎着便利店购物袋在路灯下数零钱，螺旋发包上还沾着蛋糕店的奶油——今天也努力活下去了。',
  };
  c.identity = {
    role: '魔法少女（Glass Happiness）',
    age: '少女（学生）',
    occupation: '魔法少女 / 兼职打工 / 孤儿院助手',
    faction: '孤儿院 / 对抗邪恶组织',
  };
  c.tags = ['银白发', '螺旋角', '蓝瞳', '魔法少女', '贫穷'];
  c.bg_story = '深森白夜是藤原可可亚《魔法少女与恶曾是敌人》的女主角，兼任魔法少女、打工族与孤儿院助手的不幸少女。银白色的长发扎成标志性的双螺旋角发包，蓝色眼眸总是带着天然呆的平静。她与邪恶组织的干部米拉之间，展开了一段意想不到的日常。';
  c.palette = ['银白', '蕾丝白', '天空蓝'];
  c.weather = ['打工的傍晚', '孤儿院午后', '魔法少女的月夜'];
  syncTraits('mimori_byakuya');
}
// ── saint_cecilia ───────────────────────────────────────────
{
  const c = find('saint_cecilia');
  c.alias = ['Cecilia', 'セシリア', '塞西莉亚'];
  c.visual_dna = {
    hair: '浅绿长发 · 低盘发',
    hair_color: '薄荷嫩绿（Mint）',
    eyes: '翠绿（Emerald Green）',
    hairstyle: '低盘发 · 不对称长鬓发 · M形刘海',
    uniform: '纯白圣女修女袍 / 碎花连衣裙',
    expression: '天然呆 · 像小动物一样',
    style: 'pure holy saint',
    signature: '薄荷绿发、翠绿圆瞳与圣女白袍',
  };
  c.personality = ['天然呆', '温柔治愈', '喜怒形于色', '怕打雷', '依赖劳伦斯'];
  c.likes = ['劳伦斯', '司康饼', '教会的人们', '晒太阳'];
  c.classic_cg = {
    title: '教堂的午后',
    description: '她抱着圣经在长椅上打瞌睡，头纱滑落一半——劳伦斯轻轻替她扶正，没有叫醒她。',
  };
  c.identity = {
    role: '小镇教堂的圣女',
    age: '不到二十岁',
    occupation: '圣女',
    faction: '教会（与劳伦斯一起）',
  };
  c.tags = ['薄荷绿发', '绿瞳', '圣女', '天然呆', '巨乳'];
  c.bg_story = '塞西莉亚是和武叶佐乃《白圣女与黑牧师》的女主角，小镇教堂的圣女。薄荷嫩绿的长发盘成低髻，翠绿的眼眸纯净而天真，纯白圣女袍与头纱是她的标志。她天然呆得像小动物，喜怒哀乐全写在脸上，与牧师劳伦斯之间有着温柔又笨拙的日常。';
  c.palette = ['薄荷绿', '圣洁白', '暖黄'];
  c.weather = ['教堂晨光', '小镇集市', '雷雨夜'];
  syncTraits('saint_cecilia');
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('OK: characters.json updated');
const check = JSON.parse(fs.readFileSync(file, 'utf8'));
const ids = ['sylphiette','yuigahama_yui','jeanne_alter','matou_sakura','yor_forger','reze_chainsaw','fern_frieren','mimori_byakuya','saint_cecilia'];
for (const id of ids) {
  const c = check.find(x => x.id === id);
  const ok = c.visual_dna.hair && c.personality.length >= 4 && c.classic_cg && c.identity && c.tags && c.palette && c.weather;
  console.log(id, '| fields:', ok ? 'OK' : 'INCOMPLETE', '| personality:', c.personality.length, '| traits:', c.traits.length);
}
