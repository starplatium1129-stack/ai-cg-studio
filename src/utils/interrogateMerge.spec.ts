import { describe, expect, it } from 'vitest'
import { isCensorTag, mergeInterrogatedTags } from './interrogateMerge'

describe('interrogateMerge · 马赛克/打码词条自动过滤（2026-08-29）', () => {
  it('打码类词条全部进 filtered，不进 accepted', () => {
    const result = mergeInterrogatedTags({
      tags: ['censored', 'mosaic_censoring', 'bar_censor', 'white_hair', 'solo'],
      manualTags: new Set(),
      identityTokens: [],
    })
    expect(result.filtered).toEqual(['censored', 'mosaic_censoring', 'bar_censor'])
    expect(result.accepted).toEqual(['white_hair', 'solo'])
  })

  it('uncensored（无码）属正向属性，保留', () => {
    const result = mergeInterrogatedTags({
      tags: ['uncensored', 'censored_nipples', '1girl'],
      manualTags: new Set(),
      identityTokens: [],
    })
    expect(result.filtered).toEqual(['censored_nipples'])
    expect(result.accepted).toContain('uncensored')
    expect(result.accepted).toContain('1girl')
  })

  it('连字符形式经归一后命中（out-of-frame_censoring）', () => {
    expect(isCensorTag('out-of-frame_censoring')).toBe(true)
    expect(isCensorTag('mosaic_censoring')).toBe(true)
    expect(isCensorTag('uncensored')).toBe(false)
    expect(isCensorTag('censorship')).toBe(false)
  })
})
