import { describe, expect, it } from 'vitest'
import { plainEnglish } from './promptCompiler'

/** plainEnglish：仅放行「纯 ASCII 可打印」的英文短语文本；其余（CJK/空/非字符串）归零。
 *  这是词条→英文短语映射链的守门函数——中文场景描述必须走映射表而非直通。 */
describe('plainEnglish', () => {
  it('纯 ASCII 英文短语原样返回并去除首尾空白', () => {
    expect(plainEnglish('  inside a bedroom  ')).toBe('inside a bedroom')
    expect(plainEnglish('night, window light')).toBe('night, window light')
  })

  it('含 CJK 的输入一律拒绝', () => {
    expect(plainEnglish('卧室')).toBe('')
    expect(plainEnglish('bedroom 卧室')).toBe('')
  })

  it('空值与非字符串安全归零', () => {
    expect(plainEnglish('')).toBe('')
    expect(plainEnglish(null)).toBe('')
    expect(plainEnglish(undefined)).toBe('')
  })
})
