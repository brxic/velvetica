import { Pool } from 'pg'
import { createClient } from 'redis'

export type HealthState = 'up' | 'down' | 'disabled'

export type HealthCheck = {
  status: HealthState
  latencyMs: number
  version?: string
}

export type HealthChecks = {
  routing: HealthCheck
  database: HealthCheck
  cache: HealthCheck
}

const TIMEOUT_MS = 2_500

function elapsed(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

function unavailable(startedAt: number): HealthCheck {
  return { status: 'down', latencyMs: elapsed(startedAt) }
}

export function summarizeHealth(checks: HealthChecks) {
  return Object.values(checks).some((check) => check.status === 'down') ? 'degraded' : 'healthy'
}

export async function checkRouting(): Promise<HealthCheck> {
  const startedAt = performance.now()

  if (process.env.ROUTING_PROVIDER === 'fossgis') {
    return { status: 'up', latencyMs: elapsed(startedAt), version: 'FOSSGIS public OSM bike' }
  }

  if (process.env.ROUTING_PROVIDER !== 'valhalla') {
    return { status: 'disabled', latencyMs: elapsed(startedAt) }
  }

  try {
    const response = await fetch(`${process.env.VALHALLA_URL ?? 'http://localhost:8002'}/status`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) return unavailable(startedAt)
    const payload = (await response.json()) as { version?: string }
    return { status: 'up', latencyMs: elapsed(startedAt), version: payload.version }
  } catch {
    return unavailable(startedAt)
  }
}

export async function checkDatabase(): Promise<HealthCheck> {
  const startedAt = performance.now()
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return { status: 'disabled', latencyMs: elapsed(startedAt) }

  const pool = new Pool({ connectionString, options: '-c search_path=public,extensions', connectionTimeoutMillis: TIMEOUT_MS, max: 1 })
  try {
    const result = await pool.query<{ version: string }>('SELECT PostGIS_Version() AS version')
    return { status: 'up', latencyMs: elapsed(startedAt), version: result.rows[0]?.version }
  } catch {
    return unavailable(startedAt)
  } finally {
    await pool.end().catch(() => undefined)
  }
}

export async function checkCache(): Promise<HealthCheck> {
  const startedAt = performance.now()
  const url = process.env.REDIS_URL
  if (!url) return { status: 'disabled', latencyMs: elapsed(startedAt) }

  const client = createClient({
    url,
    socket: { connectTimeout: TIMEOUT_MS, reconnectStrategy: false },
  })
  client.on('error', () => undefined)

  try {
    await client.connect()
    const pong = await client.ping()
    return pong === 'PONG' ? { status: 'up', latencyMs: elapsed(startedAt) } : unavailable(startedAt)
  } catch {
    return unavailable(startedAt)
  } finally {
    if (client.isOpen) await client.quit().catch(() => undefined)
  }
}

export async function getHealthChecks(): Promise<HealthChecks> {
  const [routing, database, cache] = await Promise.all([checkRouting(), checkDatabase(), checkCache()])
  return { routing, database, cache }
}
