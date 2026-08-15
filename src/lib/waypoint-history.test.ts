import { describe, expect, it } from 'vitest'
import type { Waypoint } from './domain'
import { initialWaypointHistory, waypointHistoryReducer } from './waypoint-history'

const start: Waypoint = { id: 'start', coordinate: [7.44, 46.95], label: 'Bern', kind: 'start' }
const via: Waypoint = { id: 'via', coordinate: [7.5, 46.9], label: 'Via', kind: 'via' }

describe('waypoint history', () => {
  it('supports undo and redo without losing snapshots', () => {
    const one = waypointHistoryReducer(initialWaypointHistory, { type: 'commit', waypoints: [start] })
    const two = waypointHistoryReducer(one, { type: 'commit', waypoints: [start, via] })
    const undone = waypointHistoryReducer(two, { type: 'undo' })
    expect(undone.present).toEqual([start])
    expect(waypointHistoryReducer(undone, { type: 'redo' }).present).toEqual([start, via])
  })

  it('clears history when a saved route is loaded', () => {
    const changed = waypointHistoryReducer(initialWaypointHistory, { type: 'commit', waypoints: [start] })
    expect(waypointHistoryReducer(changed, { type: 'reset', waypoints: [start, via] })).toEqual({ past: [], present: [start, via], future: [] })
  })
})
