import type { ArtistStyleOption } from './artistStyles.ts'

export const ARTIST_STYLE_OPTIONS: readonly ArtistStyleOption[] = Object.freeze([
  // 🎬 电影光影与通透氛围
  { id: 'yoneyama_mai', name: 'Yoneyama Mai', cnName: '米山舞', waiTag: 'yoneyama_mai', animaTag: '@yoneyama mai', description: '电影感调色、松弛流动线条与强情绪光影', category: 'cinematic', verification: 'tag', keywords: ['电影感', '光影', '动态', '去塑料感', 'eva', '神仙画风'] },
  { id: 'rella', name: 'Rella', cnName: 'Rella', waiTag: 'rella', animaTag: '@rella', description: '梦幻夜景辉光、空灵色彩与电影照明', category: 'cinematic', verification: 'curated', keywords: ['星空', '夜景', '梦幻', '水下', '光斑'] },
  { id: 'swav', name: 'SWAV', cnName: 'SWAV', waiTag: 'swav', animaTag: '@swav', description: '高冲击力幻想海报、魔法光照与纵深', category: 'cinematic', verification: 'curated', keywords: ['纵深', '魔法光', '海报', '空间感'] },
  
  // 🌸 清透少女与顶级 Galgame
  { id: 'kantoku', name: 'Kantoku', cnName: '监督', waiTag: 'kantoku', animaTag: '@kantoku', description: '清透日系美少女、柔和暖阳与干净线条', category: 'pure', verification: 'curated', keywords: ['格子裙', '变态王子', '阳光', '清纯', 'galgame'] },
  { id: 'azure_(azure_cpt)', name: 'Azure', cnName: 'あずーる', waiTag: 'azure_(azure_cpt)', animaTag: '@azure', description: '《魔女之旅》原案、空灵水彩发丝与通透旅行感', category: 'pure', verification: 'tag', keywords: ['魔女之旅', '伊蕾娜', '伊雷娜', 'elaina', '旅行', '魔女', '水彩', '通透'] },
  { id: 'hiten_(hitenkei)', name: 'Hiten', cnName: 'Hiten', waiTag: 'hiten_(hitenkei)', animaTag: '@hiten', description: '柔光日系、精致五官与清澈治愈空气感', category: 'pure', verification: 'tag', keywords: ['空气感', '柔光', '精致', '唯美', '清纯'] },
  { id: 'tiv', name: 'Tiv', cnName: 'Tiv', waiTag: 'tiv', animaTag: '@tiv', description: '轻小说封面感、细腻环境光与微风发丝', category: 'pure', verification: 'tag', keywords: ['政宗君', '微风', '轻小说', '回眸'] },
  { id: 'anmi', name: 'Anmi', cnName: 'Anmi', waiTag: 'anmi', animaTag: '@anmi', description: '轻盈马卡龙粉彩、水润水彩质感与优雅体态', category: 'pure', verification: 'curated', keywords: ['粉彩', '水彩', '优雅', '泳装', '透明感'] },
  { id: 'morikura_en', name: 'Morikura En', cnName: '森仓圆', waiTag: 'morikura_en', animaTag: '@morikura en', description: '明亮商业角色插画、日常自然光与元气感', category: 'pure', verification: 'curated', keywords: ['绊爱', '日常', '元气', '商业插画'] },
  { id: 'muririn', name: 'Muririn', cnName: '梦璃凛', waiTag: 'muririn', animaTag: '@muririn', description: '柚子社柔亮赛璐璐、圆润脸型与水灵透明感', category: 'pure', verification: 'project', keywords: ['柚子社', '宁宁', '夏目', '赛璐珞'] },
  { id: 'kobuichi', name: 'Kobuichi', cnName: '小舞一', waiTag: 'kobuichi', animaTag: '@kobuichi', description: '柚子社利落原画、清晰轮廓与鲜亮配色', category: 'pure', verification: 'project', keywords: ['柚子社', '原画', '鲜亮', '轮廓'] },

  // ⚡ 潮流先锋与高饱和
  { id: 'lam_(ramdayo)', name: 'LAM', cnName: 'LAM', waiTag: 'lam_(ramdayo)', animaTag: '@lam', description: '极高饱和霓虹、硬朗潮流眼妆与前卫图形', category: 'trend', verification: 'tag', keywords: ['赛博', '霓虹', '眼妆', '潮流', '撞色'] },
  { id: 'mika_pikazo', name: 'Mika Pikazo', cnName: 'Mika Pikazo', waiTag: 'mika_pikazo', animaTag: '@mika pikazo', description: '高饱和流行波普色、大胆几何撞色与活力', category: 'trend', verification: 'curated', keywords: ['辉夜月', '撞色', '活力', '波普'] },
  { id: 'bunbun', name: 'BUNBUN / abec', cnName: 'abec', waiTag: 'bunbun', animaTag: '@bunbun', description: '动态游戏主视觉、清晰服装设计与动作张力', category: 'trend', verification: 'curated', keywords: ['刀剑神域', '动态', '动作', '帅气'] },

  // 🏰 华丽厚涂与大片级主视觉
  { id: 'shirabi', name: 'Shirabi', cnName: '白身成', waiTag: 'shirabi', animaTag: '@shirabi', description: '利落厚重线条、鲜明轮廓与戏剧性主视觉', category: 'grand', verification: 'curated', keywords: ['86', '龙王的工作', '大片', '戏剧光'] },
  { id: 'ask_(askzy)', name: 'ASK', cnName: 'ASK', waiTag: 'ask_(askzy)', animaTag: '@ask', description: '清冷贵气、丝滑平滑上色与克制高级感', category: 'grand', verification: 'tag', keywords: ['清冷', '贵气', '高级感', '礼服', '丝滑'] },
  { id: 'hxxg', name: 'HxxG', cnName: '刃天', waiTag: 'hxxg', animaTag: '@hxxg', description: '大动态广角透视、炫彩特效逆光与空间深邃感', category: 'grand', verification: 'curated', keywords: ['黑岩射手', '透视', '广角', '特效'] },
  { id: 'nardack', name: 'Nardack', cnName: 'Nardack', waiTag: 'nardack', animaTag: '@nardack', description: '宝石色奇幻、华丽服装与璀璨发光细节', category: 'grand', verification: 'curated', keywords: ['宝石', '华丽', '奇幻', '发光'] },
  { id: 'fuzichoco', name: 'Fuzichoco', cnName: '藤原', waiTag: 'fuzichoco', animaTag: '@fuzichoco', description: '和风幻想世界、繁复多层水彩与装饰细节', category: 'grand', verification: 'curated', keywords: ['和风', '繁复', '金箔', '水彩'] },
  { id: 'lack', name: 'lack', cnName: 'lack', waiTag: 'lack', animaTag: '@lack', description: '浓郁幻想厚涂、成熟厚重色彩与史诗氛围', category: 'grand', verification: 'tag', keywords: ['fgo', '厚涂', '成熟', '暗黑'] },
  { id: 'so-bin', name: 'so-bin', cnName: 'so-bin', waiTag: 'so-bin', animaTag: '@so-bin', description: '暗黑哥特油画厚涂、厚重织物与沉稳史诗感', category: 'grand', verification: 'curated', keywords: ['overlord', '哥特', '油画', '厚重'] },
])
