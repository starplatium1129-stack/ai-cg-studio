import { describe, expect, it } from 'vitest'
import { justifyRows, relayoutWithBreaks } from './justifiedRows'

const CW = 1400
const TARGET = 280
const GAP = 20

function layout(ratios: number[]) {
  return justifyRows(
    ratios.map((ratio, i) => ({ id: i + 1, ratio })),
    { containerWidth: CW, targetHeight: TARGET, gap: GAP },
  )
}

const rowWidth = (n: number, heights: number[]) =>
  heights.reduce((a, w) => a + w, 0) + GAP * Math.max(0, n - 1)

describe('justifyRows', () => {
  it('严格保持输入顺序，只在断行处切分', () => {
    const ratios = [0.75, 1.778, 0.75, 1.333, 1.778, 0.75, 1.333, 0.75]
    const ids = layout(ratios).flatMap(row => row.cells.map(c => c.id))
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('除末行外每一行都左右严格齐平，没有空洞', () => {
    const rows = layout([0.75, 1.778, 0.75, 1.333, 1.778, 0.75, 1.333, 0.75, 1.778, 0.75])
    expect(rows.length).toBeGreaterThan(1)
    rows.slice(0, -1).forEach(row => {
      expect(rowWidth(row.cells.length, row.cells.map(c => c.width))).toBe(CW)
    })
  })

  it('行高围绕目标行高浮动，不会失控', () => {
    const rows = layout(Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? 1.778 : 0.75)))
    rows.forEach(row => {
      expect(row.height).toBeGreaterThan(TARGET * 0.6)
      expect(row.height).toBeLessThan(TARGET * 1.6)
    })
  })

  it('每张图都分到有效宽度，不会产出空行', () => {
    const rows = layout([2.8, 0.36, 1, 1.5, 0.66, 2.2])
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach(row => {
      expect(row.cells.length).toBeGreaterThan(0)
      row.cells.forEach(cell => expect(cell.width).toBeGreaterThanOrEqual(1))
    })
  })

  it('末行太短时按目标高度自然排，不把最后一张拉成横幅', () => {
    const [only] = layout([0.75])
    expect(only.height).toBe(TARGET)
    expect(only.cells).toHaveLength(1)
    expect(only.cells[0].width).toBe(Math.round(0.75 * TARGET))
  })

  it('全横图时一行多张，仍然齐平', () => {
    const rows = layout([1.778, 1.778, 1.778, 1.778, 1.778, 1.778])
    rows.slice(0, -1).forEach(row => {
      expect(rowWidth(row.cells.length, row.cells.map(c => c.width))).toBe(CW)
    })
  })

  it('空输入与零宽度都返回空，不抛错', () => {
    expect(layout([])).toEqual([])
    expect(justifyRows([{ id: 1, ratio: 1 }], { containerWidth: 0, targetHeight: 280, gap: 20 })).toEqual([])
  })

  it('脏比例（0 / NaN）兜底成 3:4，不会算出天文数字高度', () => {
    const rows = layout([Number.NaN, 0, 1.5])
    rows.forEach(row => {
      expect(Number.isFinite(row.height)).toBe(true)
      expect(row.height).toBeLessThan(CW)
    })
  })
})

describe('relayoutWithBreaks（断行锁定）', () => {
  const items = (ratios: number[]) => ratios.map((ratio, i) => ({ id: i + 1, ratio }))
  const breaksOf = (rows: ReturnType<typeof justifyRows>) =>
    rows.map(r => r.cells.map(c => c.id))

  it('比例变化后断行保持不变（每行的 id 集合与顺序都不漂移）', () => {
    const initial = justifyRows(items([0.75, 1.778, 0.75, 1.333, 1.778, 0.75, 1.333, 0.75]), {
      containerWidth: CW, targetHeight: TARGET, gap: GAP,
    })
    const breaks = breaksOf(initial)
    // 第二张图从竖图（0.75）改成横图（1.778），比例剧烈变化
    const changed = items([0.75, 1.778, 0.75, 1.333, 1.778, 0.75, 1.333, 0.75])
    const relaid = relayoutWithBreaks(changed, breaks, { containerWidth: CW, targetHeight: TARGET, gap: GAP })
    expect(breaksOf(relaid)).toEqual(breaks)
  })

  it('非末行依然左右齐平，行高按新比例重算', () => {
    const initial = justifyRows(items([1.778, 1.778, 0.75, 0.75, 1.778, 1.778]), {
      containerWidth: CW, targetHeight: TARGET, gap: GAP,
    })
    const breaks = breaksOf(initial)
    const relaid = relayoutWithBreaks(
      items([1.778, 1.778, 0.75, 0.75, 1.778, 1.778]),
      breaks, { containerWidth: CW, targetHeight: TARGET, gap: GAP },
    )
    relaid.slice(0, -1).forEach(row => {
      expect(rowWidth(row.cells.length, row.cells.map(c => c.width))).toBe(CW)
    })
  })

  it('末行依旧遵守「凑不满不拉伸」规则', () => {
    const [only] = relayoutWithBreaks(items([0.75]), [[1]], {
      containerWidth: CW, targetHeight: TARGET, gap: GAP,
    })
    expect(only.height).toBe(TARGET)
    expect(only.cells).toHaveLength(1)
  })

  it('断行里出现不存在于 items 的 id 会被跳过，不会抛错', () => {
    // items 里没有 id 999，断行引用它时被丢弃，其余照常排
    const rows = relayoutWithBreaks(items([0.75, 1.5, 1.778]), [[1, 2], [3, 999]], {
      containerWidth: CW, targetHeight: TARGET, gap: GAP,
    })
    expect(rows.length).toBe(2)
    expect(rows[0].cells.map(c => c.id)).toEqual([1, 2])
    expect(rows[1].cells.map(c => c.id)).toEqual([3])
    rows.forEach(row => expect(row.height).toBeGreaterThan(0))
  })

  it('空输入与空断行返回空，不抛错', () => {
    expect(relayoutWithBreaks([], [], { containerWidth: CW, targetHeight: TARGET, gap: GAP })).toEqual([])
  })
})
