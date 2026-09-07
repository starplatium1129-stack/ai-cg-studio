import type { ArchiveIconDef } from './types.ts'

// 手绘单线：按语义分别设计轮廓，保留小尺寸的眼口与负空间。
export const compositionDefs = {
  'centercomp': {
    paths: [
      'M5 4.5 H19 Q20.5 4.5 20.5 6 V18 Q20.5 19.5 19 19.5 H5 Q3.5 19.5 3.5 18 V6 Q3.5 4.5 5 4.5 Z',
      'M14 10 A2 2 0 1 1 10 10 A2 2 0 1 1 14 10 M8.5 16 Q12 12.5 15.5 16',
    ],
  },
  'rule3': {
    paths: [
      'M3.5 4.5 H20.5 V19.5 H3.5 Z',
      'M9.2 4.5 V19.5 M14.8 4.5 V19.5 M3.5 9.5 H20.5 M3.5 14.5 H20.5',
    ],
  },
  'leftcomp': {
    paths: [
      'M3.5 4.5 H20.5 V19.5 H3.5 Z',
      'M10 10 A1.8 1.8 0 1 1 6.4 10 A1.8 1.8 0 1 1 10 10 M5.5 16 Q8.2 12.8 11 16',
    ],
  },
  'rightcomp': {
    paths: [
      'M3.5 4.5 H20.5 V19.5 H3.5 Z',
      'M17.6 10 A1.8 1.8 0 1 1 14 10 A1.8 1.8 0 1 1 17.6 10 M13 16 Q15.8 12.8 18.5 16',
    ],
  },
  'foreground': {
    paths: [
      'M3.5 11 V5 H20.5 V19.5 H10',
      'M3.5 20 V14 Q7 14 9 16.5 V20',
      'M10.5 14 L14.5 10 L20 15',
    ],
  },
  'framecomp': {
    paths: [
      'M8 3.5 H3.5 V20.5 H8 M16 3.5 H20.5 V20.5 H16',
      'M8 8 H16 V16 H8 Z',
    ],
  },
  'bywindow': {
    paths: [
      'M3.5 3.5 H13 V16 H3.5 Z M8.3 3.5 V16 M3.5 9.5 H13',
      'M19.7 14 A2.2 2.2 0 1 1 15.3 14 A2.2 2.2 0 1 1 19.7 14 M14 21 Q14.3 18 17.5 18 Q20.7 18 21 21',
    ],
  },
} satisfies Record<string, ArchiveIconDef>
