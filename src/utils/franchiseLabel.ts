/**
 * franchiseLabel.ts — 作品（franchise / 作品源）中文展示名（跨页面共享）。
 *
 * 数据源两种形态，两处页面（角色档案 / 角色场景）共用同一份映射：
 * - characters.json 的 source 写成「公司《中文名 / 英文名》」：
 *     miHoYo《原神 / Genshin Impact》 / TYPE-MOON《Fate/stay night》
 * - popular-characters.json 的 franchise 是纯英文：Genshin Impact / Re:Zero …
 *
 * 规则（确定性，不碰数据文件）：
 * 1. 整串已知映射（Arknights / Arknights: Endfield 等）；
 * 2. 《》括号内整段已知映射（Fate/stay night 等纯 ASCII 作品名）；
 * 3. 《》内取「纯汉字段」（无假名）优先，其次任何 CJK 段；
 * 4. 仍未命中保留原文。
 */

/** 纯英文作品名 → 中文展示名 */
const FRANCHISE_CN: Record<string, string> = {
  'Arknights': '明日方舟',
  'Arknights: Endfield': '明日方舟：终末地',
  'Genshin Impact': '原神',
  'Fate': 'Fate 系列',
  'Fate/stay night': '命运之夜',
  'Re:Zero': 'Re：从零开始的异世界生活',
  'Rascal Does Not Dream of Bunny Girl Senpai': '青春猪头少年不会梦到兔女郎学姐',
  'Date A Live': '约会大作战',
  "Frieren: Beyond Journey's End": '葬送的芙莉莲',
  'Guilty Crown': '罪恶王冠',
  'Oregairu': '我的青春恋爱物语果然有问题',
  'Wandering Witch': '魔女之旅',
  'A Certain Scientific Railgun': '某科学的超电磁炮',
  'Chainsaw Man': '电锯人',
  'Mushoku Tensei': '无职转生',
  'My Dress-Up Darling': '更衣人偶坠入爱河',
  'Engage Kiss': '契约之吻',
  'VOCALOID': 'VOCALOID',
}

const HAS_HAN = /[\u4e00-\u9fff]/
const HAS_KANA = /[\u3040-\u30ff]/

/** 作品展示名：映射表优先 → 《》内纯汉字段 → 《》内 CJK 段 → 原文。 */
export function franchiseLabel(source: string): string {
  const raw = String(source || '').trim()
  if (!raw) return ''
  if (FRANCHISE_CN[raw]) return FRANCHISE_CN[raw]
  // 取最后一对《》（同一出处可能写多个作品，如御坂美琴的
  // 「《魔法禁书目录》/《某科学的超电磁炮》」，角色所属取最后的作品）。
  const brackets = raw.match(/《([^》]+)》/g)
  const bracket = brackets && brackets.length ? brackets[brackets.length - 1] : null
  if (bracket) {
    const inner = bracket.slice(1, -1)
    if (FRANCHISE_CN[inner]) return FRANCHISE_CN[inner]
    const parts = inner.split('/').map(part => part.trim()).filter(Boolean)
    if (!parts.length) return inner
    const han = parts.find(part => HAS_HAN.test(part) && !HAS_KANA.test(part))
    if (han) return han
    const cjk = parts.find(part => HAS_HAN.test(part))
    if (cjk) return cjk
    return inner
  }
  return raw
}