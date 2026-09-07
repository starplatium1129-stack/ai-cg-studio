import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { franchiseLabel, hasFranchiseLabel, franchiseKey } from './franchiseLabel'
const catalog = JSON.parse(readFileSync(resolve('data/popular-characters.json'), 'utf8')) as { characters: { franchise: string }[] }
const franchises = [...new Set(catalog.characters.map(character => character.franchise))]

describe('Chinese franchise labels', () => {
  it.each(franchises)('registers a Chinese display label for catalog franchise %s', franchise => {
    expect(hasFranchiseLabel(franchise), '新增系列必须同步登记中文显示名：' + franchise).toBe(true)
    expect(franchiseLabel(franchise)).toMatch(/[\u4e00-\u9fff]/)
  })
  it('uses the same label for raw names and bracketed source strings', () => {
    expect(franchiseLabel('Blue Archive')).toBe('蔚蓝档案')
    expect(franchiseLabel('NEXON《Blue Archive》')).toBe('蔚蓝档案')
    expect(franchiseLabel('  Honkai: Star Rail  ')).toBe('崩坏：星穹铁道')
    expect(franchiseLabel('作者《原神 / Genshin Impact》')).toBe('原神')
  })
  it('preserves identity for unknown imports instead of fabricating a translation', () => {
    expect(hasFranchiseLabel('Unregistered Series')).toBe(false)
    expect(franchiseLabel('Unregistered Series')).toBe('Unregistered Series')
    expect(franchiseLabel('constructor')).toBe('constructor')
    expect(franchiseLabel('')).toBe('')
  })
})


describe('work identity grouping', () => {
  it.each([
    ['Oregairu', '渡航《我的青春恋爱物语果然有问题 / Oregairu》'],
    ['Saenai Heroine no Sodatekata', '丸戸史明《路人女主的养成方法 / Saenai Heroine no Sodatekata》'],
    ['Fate', 'TYPE-MOON《Fate/stay night》'],
    ['Re:Zero', '長月達平《Re:从零开始的异世界生活 / Re:Zero》'],
    ['86 -Eighty Six-', '安里アサト《86-不存在的战区 / 86 -Eighty Six-》'],
  ])('merges equivalent source spellings: %s', (raw, full) => expect(franchiseKey(raw)).toBe(franchiseKey(full)))
  it('keeps distinct titles from the same publisher separate', () => {
    expect(franchiseKey('TYPE-MOON《空之境界 / Kara no Kyoukai》')).not.toBe(franchiseKey('TYPE-MOON《月姬 / Tsukihime》'))
    expect(franchiseKey('Arknights')).not.toBe(franchiseKey('Arknights: Endfield'))
    expect(franchiseKey('YUZUSOFT《魔女的夜宴》')).not.toBe(franchiseKey('YUZUSOFT《千恋＊万花》'))
  })
})
