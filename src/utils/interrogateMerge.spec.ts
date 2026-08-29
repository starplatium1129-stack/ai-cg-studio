import { describe, expect, it } from 'vitest'
import { characterConflictNote, isCensorTag, mergeInterrogatedTags } from './interrogateMerge'

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

describe('interrogateMerge · 同角色等价匹配（2026-08-29）', () => {
  it('WD14 标准词条 vs 项目写法不同 → 不报冲突（mika_(blue_archive) ≙ misono_mika）', () => {
    const note = characterConflictNote(
      ['mika_(blue_archive)'],
      ['misono_mika', '1girl', 'pink_hair', 'halo', 'blue_archive'],
      ['misono_mika', 'mika', 'mika_(blue_archive)', '圣园未花'],
    )
    expect(note).toBeNull()
  })

  it('无 alias 时按基座包含匹配（hina_(blue_archive) 基座 hina ⊆ sorasaki_hina）', () => {
    const note = characterConflictNote(
      ['hina_(blue_archive)'],
      ['sorasaki_hina', '1girl', 'blue_archive'],
    )
    expect(note).toBeNull()
  })

  it('剥作品后缀后相等（artoria_pendragon_(fate) ≙ artoria_pendragon）', () => {
    const note = characterConflictNote(
      ['artoria_pendragon_(fate)'],
      ['artoria_pendragon', 'saber (fate)', '1girl'],
    )
    expect(note).toBeNull()
  })

  it('空格格式与下划线格式归一等价（makima (chainsaw man) ≙ makima_(chainsaw_man)）', () => {
    const note = characterConflictNote(
      ['makima_(chainsaw_man)'],
      ['makima (chainsaw man)', '1girl'],
    )
    expect(note).toBeNull()
  })

  it('真正的其他角色仍报冲突', () => {
    const note = characterConflictNote(
      ['reimu_hakurei'],
      ['misono_mika', '1girl', 'blue_archive'],
    )
    expect(note).toContain('reimu_hakurei')
  })
})
