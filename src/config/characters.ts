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
}

export const CHARACTERS: Record<string, CharacterConfig> = {
  nene: {
    id: 'nene',
    name: '绫地宁宁',
    caption: '姬松学院的完美偶像，藏着魔女与特工秘密；温柔体贴，极易因直球告白而面红耳赤。',
    description: '无论是游戏心得、工坊绘境还是日常琐事，我都愿意倾听……只是，如果突然聊起太害羞的话题，可要给我一点心理准备哦。',
    image: '/assets/characters/nene-official.webp',
    icon: '🔮',
    greeting: '那个……你来了呀。今天辛苦啦。如果有想和我说的事情，或者只是想静静待一会儿……我都随时陪着你哦。',
    roomCode: 'ROOM 01 · MOONLIT LIBRARY',
    roomMood: '姬松学院研究室的软椅与月光，隐藏着只属于两人的魔法秘密。',
    starters: [
      '今天有点累，想和你安静待一会儿',
      '聊聊你平时偷偷玩的 RPG 游戏吧',
      '今晚要不要尝试画一张魔女服的 CG？',
    ],
    voice: 'nene',
    accent: '#b895ff',
  },
  natsume: {
    id: 'natsume',
    name: '四季夏目',
    caption: 'Café Stella 的冷静咖啡师；嘴上带着犀利毒舌，却会在不经意间为你备好最温暖的特调。',
    description: '不用特意寻找话题。坐下来，喝一杯刚冲好的黑咖啡或者热可可，这里随时为你留着位置。',
    image: '/assets/characters/natsume-official.webp',
    icon: '☕',
    greeting: '来了？坐吧。刚冲好的咖啡温度正合适。今天有什么想聊的，直接说就好。',
    roomCode: 'ROOM 02 · AFTER HOURS',
    roomMood: '闭店后 Café Stella 的琥珀暖灯，还有刚研磨好的浓郁咖啡香。',
    starters: [
      '今天不想赶时间，就在这里坐一会儿',
      '昨晚你是不是又偷偷通宵打游戏了？',
      '下一张 CG 画雨夜还是黄昏？',
    ],
    voice: 'natsume',
    accent: '#f2bb68',
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

export const STORAGE_KEY = 'aics_chat_v1'
export const STORAGE_VERSION = 3
export const MAX_LOCAL_MESSAGES = 20

export function createMessageId(): string {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return 'm-' + globalThis.crypto.randomUUID()
  }
  return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}
