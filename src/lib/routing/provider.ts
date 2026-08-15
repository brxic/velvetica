import type { PlannedRoute, PlanningRequest } from '@/lib/domain'

export interface RoutingProvider {
  readonly id: 'preview' | 'valhalla'
  plan(request: PlanningRequest): Promise<PlannedRoute>
}

