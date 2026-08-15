import { describe, expect, it } from 'vitest'
import { summarizeTraceEdges } from './valhalla'

describe('Valhalla route attributes', () => {
  it('weights surface and cycleway percentages by edge length', () => {
    const summary = summarizeTraceEdges([
      { length: 8, surface: 'paved_smooth', use: 'road', cycle_lane: 'none' },
      { length: 2, surface: 'gravel', use: 'cycleway', cycle_lane: 'dedicated' },
    ])
    expect(summary.asphaltPercent).toBe(80)
    expect(summary.cyclewayPercent).toBe(20)
    expect(summary.warnings[0]).toContain('20 %')
  })

  it('reports tunnel and dismount evidence without claiming objective safety', () => {
    const summary = summarizeTraceEdges([
      { length: .5, surface: 'paved', use: 'road', tunnel: true },
      { length: .1, surface: 'paved', use: 'steps', dismount: true },
    ])
    expect(summary.warnings).toEqual(expect.arrayContaining([expect.stringContaining('Tunnel'), expect.stringContaining('Schiebe-')]))
    expect(summary.warnings.join(' ')).not.toContain('sicher')
  })
})
