export interface CharacterConfig {
  id: string
  name: string
  caption: string
  description: string
  image: string
  icon: string
  greeting: string
  roomCode: string
  roomMood: string
  starters: string[]
  voice: string
  accent: string
  live2dLayout: {
    scale: number
    anchorX: number
    bottomOffset: number
  }
  officialQuote?: string
  officialQuoteCn?: string
  birthday?: string
  bloodType?: string
  height?: string
  threeSizes?: string
}

export const CHARACTERS: Record<string, CharacterConfig> = {
  nene: {
    id: 'nene',
    name: '绫地宁宁',
    caption: '《魔女的夜宴》姬松学园完美女神，暗藏心之碎片契约；极易因羞耻或直球告白陷入慌乱发赤。',
    description: '无论是心之碎片的秘密、工坊绘制还是日常琐事，我都愿意听你说……不过，要是不小心触发了魔女副作用，请、请千万不要一直盯着看！',
    image: '/assets/characters/nene-official.webp',
    icon: '🔮',
    greeting: '那个……你来了呀。今天辛苦啦。如果有想和我说的秘密，或者只是想静静待一会儿……我都随时陪着你哦。',
    roomCode: 'ROOM 01 · MOONLIT LIBRARY',
    roomMood: '姬松学园研究室的夜晚，月光洒在魔导书上，藏着只属于两人的魔法秘密。',
    starters: [
      '今天有点累，想和你安静待一会儿',
      '聊聊收集心之碎片的秘密吧',
      '今晚要不要尝试画一张魔女服的 CG？',
    ],
    voice: 'nene',
    accent: '#b895ff',
    live2dLayout: { scale: 1.1, anchorX: 0.5, bottomOffset: 34 },
    officialQuote: '「……あの、さっきのコト……忘れちゃってくださいね？」',
    officialQuoteCn: '“……那个，刚才发生的事情……请您彻底忘掉好吗？”',
    birthday: '7月21日（巨蟹座）',
    bloodType: 'A型',
    height: '154 cm',
    threeSizes: 'B88 (F-Cup) / W58 / H85',
  },
  natsume: {
    id: 'natsume',
    name: '四季夏目',
    caption: '《CAFÉ STELLA 与死神之蝶》干练咖啡师，泪痣与酷娇酷妹；毒舌冷幽默下纯情度 100%。',
    description: '坐吧，浓缩黑咖啡和热可可都备好了。今晚是聊咖啡特调还是工坊 CG？……别用那种眼神看我，我又没说不陪你。',
    image: '/assets/characters/natsume-official.webp',
    icon: '☕',
    greeting: '来了？坐吧。刚冲好的浓缩黑咖啡温度正合适。今天有什么想聊的，直接说就好。',
    roomCode: 'ROOM 02 · AFTER HOURS',
    roomMood: '闭店后 Café Stella 的琥珀暖灯，浓郁黑咖啡香与独属于两人的安静时光。',
    starters: [
      '今天不想赶时间，就在这里坐一会儿',
      '昨晚你是不是又通宵打游戏了？',
      '下一张 CG 画雨夜还是黄昏？',
    ],
    voice: 'natsume',
    accent: '#f2bb68',
    live2dLayout: { scale: 1, anchorX: 0.5, bottomOffset: 0 },
    officialQuote: '「私を雇えば、もれなく優秀なアルバイトがついてきますよ」',
    officialQuoteCn: '“如果雇佣我的话，就会无条件附赠一名极其优秀的兼职员工哦。”',
    birthday: '8月12日（狮子座）',
    bloodType: 'AB型',
    height: '158 cm',
    threeSizes: 'B82 (C-Cup) / W57 / H82',
  },
}

export const LIVE2D_OUTFITS = [
  { id: 'school', label: '校服', expression: 'expression1' },
  { id: 'casual', label: '常服', expression: 'expression2' },
  { id: 'sleepwear', label: '睡衣', expression: 'expression3' },
  { id: 'cosplay', label: 'COS 服', expression: 'expression4' },
  { id: 'witch', label: '魔女服', expression: 'expression5' },
] as const

export type Live2DOutfitId = typeof LIVE2D_OUTFITS[number]['id']
export const DEFAULT_LIVE2D_OUTFIT: Live2DOutfitId = 'school'

export function findLive2DOutfit(id: string) {
  return LIVE2D_OUTFITS.find(outfit => outfit.id === id) ?? LIVE2D_OUTFITS[0]
}

/** 夏目当前只有源模型自带的咖啡店制服，没有可验证的换装层。 */
export const NATSUME_OUTFITS = [
  {
    id: 'natsume-cafe', label: '咖啡店制服',
  },
] as const

export type NatsumeOutfitId = typeof NATSUME_OUTFITS[number]['id']
export const DEFAULT_NATSUME_OUTFIT: NatsumeOutfitId = 'natsume-cafe'

export function findNatsumeOutfit(id: string) {
  return NATSUME_OUTFITS.find(outfit => outfit.id === id) ?? NATSUME_OUTFITS[0]
}

export const STORAGE_KEY = 'aics_chat_v1'
export const STORAGE_VERSION = 3
export const MAX_LOCAL_MESSAGES = 20

export function createMessageId(): string {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return 'm-' + globalThis.crypto.randomUUID()
  }
  return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}
