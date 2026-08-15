/**
 * videoPromptProse.ts — 出图词条流 → 视频提示词自然语言（确定性转换，零依赖）。
 *
 * MiniMax H3 是自然语言模型，直接吃 Danbooru 词条流（1girl, red hair, …）
 * 语义碎片化、效果差。这里做「主体/外观语法化组装」：
 *   - 过滤质量/安全/评分类无意义词条（safe / score_9 / masterpiece …）
 *   - 主体计数词（1girl / solo …）与外观词（red hair / blue eyes …）
 *     组装进主句（a girl with red hair and blue eyes, …）
 *   - 其余词条（服装/场景/动作/角色标识）原样保留（不翻译——tag 转译会引入
 *     错误语义，与 video-generation-roadmap 的「不做 tag 翻译」原则一致）
 *   - 已像自然语言的提示词（Anima prose 等）原样返回，不误伤
 */

/** 出图提示词里对视频无语义的质量/安全/评分词条 */
const DROP_TAG = /^(safe|score_\d+|best quality|high quality|masterpiece|absurdres|highres|newest|ultra[- ]detailed|amateur|official art|rating:\S+|source:\S+)$/i

/** 主体计数词 → 自然语言短语 */
const SUBJECT_PHRASE: Record<string, string> = {
  '1girl': 'a girl',
  '2girls': 'two girls',
  '1boy': 'a boy',
  '2boys': 'two boys',
  '1woman': 'a woman',
  '1man': 'a man',
  'solo': 'solo',
  'no_humans': 'no humans',
}

function looksLikeTagStream(prompt: string): boolean {
  const tokens = prompt.split(',').map(token => token.trim()).filter(Boolean)
  if (tokens.length < 5) return false
  const hasSubject = tokens.some(token => Object.prototype.hasOwnProperty.call(SUBJECT_PHRASE, token.toLowerCase()))
  if (hasSubject) return true
  const avgLength = tokens.reduce((sum, token) => sum + token.length, 0) / tokens.length
  return avgLength <= 25
}

/**
 * 词条流 → 视频提示词自然语言；已像自然语言的输入原样返回。
 * 例：safe, 1girl, solo, red hair, red eyes, techwear, dorm room
 *   → a girl with red hair and red eyes, solo, techwear, dorm room
 */
export function tagsToVideoProse(prompt: string): string {
  const input = String(prompt || '').trim()
  if (!input) return ''
  if (!looksLikeTagStream(input)) return input

  const tokens = input.split(',').map(token => token.trim()).filter(Boolean)
  const kept: string[] = []
  let subject = ''
  let hair = ''
  let eyes = ''
  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (DROP_TAG.test(token)) continue
    if (Object.prototype.hasOwnProperty.call(SUBJECT_PHRASE, lower) && !subject) {
      subject = SUBJECT_PHRASE[lower]
      continue
    }
    if (/hair$/i.test(lower) && !hair) {
      hair = token
      continue
    }
    if (/eyes?$/i.test(lower) && !eyes) {
      eyes = token
      continue
    }
    kept.push(token)
  }

  const looks = [hair, eyes].filter(Boolean)
  const head = subject
    ? `${subject}${looks.length ? ' with ' + looks.join(' and ') : ''}`
    : looks.length ? `a figure with ${looks.join(' and ')}` : ''
  return [head, ...kept].filter(Boolean).join(', ')
}
