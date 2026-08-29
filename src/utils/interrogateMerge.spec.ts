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

describe('interrogateMerge · 互斥组冲突消解（2026-08-29 修复「校服 + 泳装并存」）', () => {
  it('校服角色 + 反推泳装 → 判冲突跳过（圣园未花 trinity_uniform 真实场景）', () => {
    const result = mergeInterrogatedTags({
      tags: ['swimsuit', 'bikini', 'white_hair', '1girl'],
      manualTags: new Set(),
      identityTokens: ['misono_mika', '1girl', 'school_uniform', 'pleated_skirt', 'white_tights'],
    })
    expect(result.conflicts.map(c => c.tag)).toEqual(['swimsuit', 'bikini'])
    expect(result.accepted).not.toContain('swimsuit')
    expect(result.accepted).not.toContain('bikini')
    // 非互斥组词条照常叠加；1girl 已在身份行判为重复
    expect(result.accepted).toContain('white_hair')
    expect(result.duplicates).toContain('1girl')
  })

  it('同服装族内叠加不冲突（校服族已占，反推 sailor_uniform / blazer 放行）', () => {
    const result = mergeInterrogatedTags({
      tags: ['sailor_uniform', 'blazer'],
      manualTags: new Set(),
      identityTokens: ['school_uniform', 'pleated_skirt'],
    })
    expect(result.conflicts).toEqual([])
    expect(result.accepted).toEqual(['sailor_uniform', 'blazer'])
  })

  it('身份行无服装词时，反推服装正常叠加', () => {
    const result = mergeInterrogatedTags({
      tags: ['swimsuit'],
      manualTags: new Set(),
      identityTokens: ['1girl', 'pink_hair'],
    })
    expect(result.accepted).toEqual(['swimsuit'])
    expect(result.conflicts).toEqual([])
  })

  it('反向对称：泳装角色 + 反推校服 同样判冲突', () => {
    const result = mergeInterrogatedTags({
      tags: ['school_uniform'],
      manualTags: new Set(),
      identityTokens: ['swimsuit'],
    })
    expect(result.conflicts.map(c => c.tag)).toEqual(['school_uniform'])
  })

  it('冲突原因点明双方服装族，便于用户判断与处置', () => {
    const result = mergeInterrogatedTags({
      tags: ['swimsuit'],
      manualTags: new Set(),
      identityTokens: ['school_uniform'],
    })
    expect(result.conflicts[0].domain).toBe('服装')
    expect(result.conflicts[0].reason).toContain('泳装')
    expect(result.conflicts[0].reason).toContain('校服/水手服')
  })

  it('时段互斥一并消解（身份行 night + 反推 day）', () => {
    const result = mergeInterrogatedTags({
      tags: ['day'],
      manualTags: new Set(),
      identityTokens: ['night'],
    })
    expect(result.conflicts.map(c => c.tag)).toEqual(['day'])
    expect(result.conflicts[0].domain).toBe('时段')
  })

  it('回归：发色身份域行为不受影响（域内互斥）', () => {
    const result = mergeInterrogatedTags({
      tags: ['blonde_hair'],
      manualTags: new Set(),
      identityTokens: ['pink_hair'],
    })
    expect(result.conflicts.map(c => c.tag)).toEqual(['blonde_hair'])
  })

  it('未纳入互斥词表的服装词（ballgown）不参与判定，照常叠加', () => {
    // OUTFIT_FAMILIES 只覆盖 6 个高频易冲突族，其余属词表覆盖度问题，非本次修复范围
    const result = mergeInterrogatedTags({
      tags: ['ballgown'],
      manualTags: new Set(),
      identityTokens: ['school_uniform'],
    })
    expect(result.accepted).toEqual(['ballgown'])
    expect(result.conflicts).toEqual([])
  })
})
