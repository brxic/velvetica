import type { Waypoint } from './domain'

export type WaypointHistory = {
  past: Waypoint[][]
  present: Waypoint[]
  future: Waypoint[][]
}

export type WaypointHistoryAction =
  | { type: 'commit'; waypoints: Waypoint[] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; waypoints?: Waypoint[] }
  | { type: 'rollback'; waypoints: Waypoint[] }
  | { type: 'replace'; waypoints: Waypoint[] }

export const initialWaypointHistory: WaypointHistory = { past: [], present: [], future: [] }

export function waypointHistoryReducer(state: WaypointHistory, action: WaypointHistoryAction): WaypointHistory {
  if (action.type === 'reset') return { past: [], present: action.waypoints ?? [], future: [] }
  if (action.type === 'replace') return { ...state, present: action.waypoints }
  if (action.type === 'rollback') {
    const index = state.past.findLastIndex((points) => JSON.stringify(points) === JSON.stringify(action.waypoints))
    return { past: index >= 0 ? state.past.slice(0, index) : state.past, present: action.waypoints, future: [] }
  }
  if (action.type === 'undo') {
    const previous = state.past.at(-1)
    if (!previous) return state
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future].slice(0, 20) }
  }
  if (action.type === 'redo') {
    const next = state.future[0]
    if (!next) return state
    return { past: [...state.past, state.present].slice(-20), present: next, future: state.future.slice(1) }
  }
  return { past: [...state.past, state.present].slice(-20), present: action.waypoints, future: [] }
}
