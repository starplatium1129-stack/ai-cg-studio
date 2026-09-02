import { describe, expect, it } from 'vitest'
import { justifyRows } from './justifiedRows'

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
