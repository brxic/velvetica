import { describe, expect, it } from 'vitest'
import { mapInsets, type PanelRect } from './map-layout'
const rect = (left: number, top: number, width: number, height: number): PanelRect => ({ left, top, width, height, right: left + width, bottom: top + height })

describe('shared map work area', () => {
  it('accounts for a desktop planner and a compact route summary', () => {
    const padding = mapInsets(1440, 900, rect(16, 16, 1408, 60), [rect(16, 144, 336, 740), rect(368, 500, 720, 384)])
    expect(padding).toMatchObject({ top: 88, left: 368, right: 20, bottom: 416 })
  })
  it('reserves right-side details instead of sacrificing the map bottom', () => {
    const padding = mapInsets(1440, 900, rect(16, 16, 1408, 60), [rect(984, 92, 440, 792)])
    expect(padding).toMatchObject({ left: 20, right: 472, bottom: 20 })
  })
  it('keeps mobile controls above the sheet and ignores hidden panels', () => {
    const padding = mapInsets(390, 667, rect(12, 12, 366, 60), [rect(0, 250, 390, 417), rect(0, 0, 0, 0)])
    expect(padding.bottom).toBe(433)
    expect(padding.top + padding.bottom).toBeLessThan(667 - 140)
  })
})
