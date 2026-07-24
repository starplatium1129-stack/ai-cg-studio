export const CHARACTERS = {
  nene: {
    id: 'nene',
    name: '绫地宁宁',
    caption: '温柔、认真，却很容易因为你的一句话慌乱起来。',
    description: '今天想聊什么都可以。只是、如果突然说些让人害羞的话，请给我一点准备的时间……',
    image: '../assets/characters/nene-official.webp',
    icon: '🔮',
    greeting: '那个……你来了呀。今天过得怎么样？如果愿意的话，可以和我说说。',
    roomCode: 'ROOM 01 · MOONLIT LIBRARY',
    roomMood: '月光、书页，还有只说给彼此听的秘密。',
    starters: [
      '今天有点累，想和你安静待一会儿',
      '陪我挑一个适合今晚画的场景吧',
      '我刚才遇到一件很想告诉你的事'
    ],
    voice: 'nene',
    accent: '#b895ff'
  },
  natsume: {
    id: 'natsume',
    name: '四季夏目',
    caption: '看起来冷静，其实会把在意藏在每一句简短的提醒里。',
    description: '如果你只是想安静待一会儿，也不用勉强找话题。我在这里。',
    image: '../assets/characters/natsume-official.webp',
    icon: '☕',
    greeting: '来了？坐吧。想聊什么就直接说，不用绕弯子。',
    roomCode: 'ROOM 02 · AFTER HOURS',
    roomMood: '闭店后的暖灯亮着，最后一杯热饮还没有凉。',
    starters: [
      '今天不想赶时间，就在这里坐一会儿',
      '陪我聊聊最近在玩的游戏',
      '下一张 CG 画雨夜还是黄昏？'
    ],
    voice: 'natsume',
    accent: '#f2bb68'
  }
};

export const LIVE2D_EXPRESSIONS = {
  neutral: 'expression1',
  gentle: 'expression1',
  happy: 'expression2',
  shy: 'expression3',
  sad: 'expression4',
  serious: 'expression5'
};

export const STORAGE_KEY = 'aics_chat_v1';
export const STORAGE_VERSION = 3;
export const MAX_LOCAL_MESSAGES = 20;

export function createMessageId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return 'm-' + globalThis.crypto.randomUUID();
  }
  return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
