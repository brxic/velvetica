import { Pool, type PoolClient } from 'pg'
import type { HomePoint, PlannedRoute, RouteVersion } from './domain'
import type { RouteOwner } from './anonymous-owner'

declare global { var velvetiaRoutePool: Pool | undefined; var velvetiaSchemaReady: Promise<void> | undefined }

function pool() {
  if (!process.env.DATABASE_URL) return null
  globalThis.velvetiaRoutePool ??= new Pool({ connectionString: process.env.DATABASE_URL, options: '-c search_path=public,extensions', max: 3, connectionTimeoutMillis: 4_000, idleTimeoutMillis: 30_000 })
  return globalThis.velvetiaRoutePool
}

export function persistenceEnabled() { return Boolean(process.env.DATABASE_URL) }

export async function ensureRouteSchema() {
  const database = pool()
  if (!database) throw new Error('PERSISTENCE_DISABLED')
  globalThis.velvetiaSchemaReady ??= database.query(`
    CREATE SCHEMA IF NOT EXISTS app;
    CREATE TABLE IF NOT EXISTS app.routes (
      id uuid PRIMARY KEY,
      owner_key uuid NOT NULL,
      user_id uuid,
      name varchar(80) NOT NULL,
      current_version integer NOT NULL DEFAULT 1,
      route_data jsonb NOT NULL,
      geometry geometry(LineString, 4326) NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      deleted_at timestamptz
    );
    ALTER TABLE app.routes ADD COLUMN IF NOT EXISTS user_id uuid;
    CREATE INDEX IF NOT EXISTS routes_owner_updated_idx ON app.routes (owner_key, updated_at DESC) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS routes_user_updated_idx ON app.routes (user_id, updated_at DESC) WHERE deleted_at IS NULL AND user_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS routes_geometry_gix ON app.routes USING gist (geometry);
    CREATE TABLE IF NOT EXISTS app.route_versions (
      route_id uuid NOT NULL REFERENCES app.routes(id) ON DELETE CASCADE,
      version integer NOT NULL,
      route_data jsonb NOT NULL,
      geometry geometry(LineString, 4326) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (route_id, version)
    );
    CREATE TABLE IF NOT EXISTS app.user_preferences (
      user_id uuid PRIMARY KEY,
      home_label varchar(200),
      home_longitude double precision,
      home_latitude double precision,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT user_preferences_home_complete CHECK (
        (home_label IS NULL AND home_longitude IS NULL AND home_latitude IS NULL)
        OR (home_label IS NOT NULL AND home_longitude IS NOT NULL AND home_latitude IS NOT NULL)
      )
    );
  `).then(() => undefined).catch((error) => { globalThis.velvetiaSchemaReady = undefined; throw error })
  return globalThis.velvetiaSchemaReady
}

function snapshot(route: PlannedRoute, version: number): PlannedRoute { return { ...route, serverVersion: version } }
function geometryJson(route: PlannedRoute) { return JSON.stringify(route.geometry) }

async function claimAnonymousRoutes(client: PoolClient | Pool, owner: RouteOwner) {
  if (!owner.userId) return
  await client.query('UPDATE app.routes SET user_id = $1, updated_at = GREATEST(updated_at, now()) WHERE owner_key = $2 AND user_id IS NULL', [owner.userId, owner.ownerKey])
}

export async function listSavedRoutes(owner: RouteOwner) {
  await ensureRouteSchema(); const database = pool()!
  await claimAnonymousRoutes(database, owner)
  const query = owner.userId
    ? { text: 'SELECT route_data, current_version FROM app.routes WHERE user_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100', values: [owner.userId] }
    : { text: 'SELECT route_data, current_version FROM app.routes WHERE owner_key = $1 AND user_id IS NULL AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100', values: [owner.ownerKey] }
  const result = await database.query<{ route_data: PlannedRoute; current_version: number }>(query)
  return result.rows.map((row) => snapshot(row.route_data, row.current_version))
}

async function saveInTransaction(client: PoolClient, owner: RouteOwner, route: PlannedRoute) {
  await claimAnonymousRoutes(client, owner)
  const existing = owner.userId
    ? await client.query<{ current_version: number }>('SELECT current_version FROM app.routes WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE', [route.id, owner.userId])
    : await client.query<{ current_version: number }>('SELECT current_version FROM app.routes WHERE id = $1 AND owner_key = $2 AND user_id IS NULL AND deleted_at IS NULL FOR UPDATE', [route.id, owner.ownerKey])
  const version = (existing.rows[0]?.current_version ?? 0) + 1
  const stored = snapshot(route, version)
  if (existing.rowCount) {
    const ownerColumn = owner.userId ? 'user_id' : 'owner_key'
    const ownerValue = owner.userId ?? owner.ownerKey
    await client.query(`UPDATE app.routes SET name = $3, current_version = $4, route_data = $5::jsonb, geometry = ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), updated_at = $7 WHERE id = $1 AND ${ownerColumn} = $2`, [route.id, ownerValue, route.name, version, JSON.stringify(stored), geometryJson(route), route.updatedAt ?? new Date().toISOString()])
  } else {
    await client.query('INSERT INTO app.routes (id, owner_key, user_id, name, current_version, route_data, geometry, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($7), 4326), $8, $9)', [route.id, owner.ownerKey, owner.userId, route.name, version, JSON.stringify(stored), geometryJson(route), route.createdAt, route.updatedAt ?? route.createdAt])
  }
  await client.query('INSERT INTO app.route_versions (route_id, version, route_data, geometry) VALUES ($1, $2, $3::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))', [route.id, version, JSON.stringify(stored), geometryJson(route)])
  return stored
}

export async function saveSavedRoute(owner: RouteOwner, route: PlannedRoute) {
  await ensureRouteSchema(); const client = await pool()!.connect()
  try { await client.query('BEGIN'); const saved = await saveInTransaction(client, owner, route); await client.query('COMMIT'); return saved }
  catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error }
  finally { client.release() }
}

export async function deleteSavedRoute(owner: RouteOwner, id: string) {
  await ensureRouteSchema(); const database = pool()!; await claimAnonymousRoutes(database, owner)
  const result = owner.userId
    ? await database.query('UPDATE app.routes SET deleted_at = now(), updated_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, owner.userId])
    : await database.query('UPDATE app.routes SET deleted_at = now(), updated_at = now() WHERE id = $1 AND owner_key = $2 AND user_id IS NULL AND deleted_at IS NULL', [id, owner.ownerKey])
  return Boolean(result.rowCount)
}

export async function listRouteVersions(owner: RouteOwner, id: string): Promise<RouteVersion[]> {
  await ensureRouteSchema(); const database = pool()!; await claimAnonymousRoutes(database, owner)
  const result = owner.userId
    ? await database.query<{ version: number; created_at: Date; route_data: PlannedRoute }>('SELECT v.version, v.created_at, v.route_data FROM app.route_versions v JOIN app.routes r ON r.id = v.route_id WHERE v.route_id = $1 AND r.user_id = $2 AND r.deleted_at IS NULL ORDER BY v.version DESC LIMIT 30', [id, owner.userId])
    : await database.query<{ version: number; created_at: Date; route_data: PlannedRoute }>('SELECT v.version, v.created_at, v.route_data FROM app.route_versions v JOIN app.routes r ON r.id = v.route_id WHERE v.route_id = $1 AND r.owner_key = $2 AND r.user_id IS NULL AND r.deleted_at IS NULL ORDER BY v.version DESC LIMIT 30', [id, owner.ownerKey])
  return result.rows.map((row) => ({ version: row.version, savedAt: row.created_at.toISOString(), route: snapshot(row.route_data, row.version) }))
}

export async function getHomePoint(userId: string): Promise<HomePoint | null> {
  await ensureRouteSchema()
  const result = await pool()!.query<{ home_label: string | null; home_longitude: number | null; home_latitude: number | null }>(
    'SELECT home_label, home_longitude, home_latitude FROM app.user_preferences WHERE user_id = $1',
    [userId],
  )
  const row = result.rows[0]
  if (!row?.home_label || row.home_longitude === null || row.home_latitude === null) return null
  return { label: row.home_label, coordinate: [row.home_longitude, row.home_latitude] }
}

export async function saveHomePoint(userId: string, home: HomePoint): Promise<HomePoint> {
  await ensureRouteSchema()
  await pool()!.query(
    `INSERT INTO app.user_preferences (user_id, home_label, home_longitude, home_latitude, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id) DO UPDATE SET
       home_label = EXCLUDED.home_label,
       home_longitude = EXCLUDED.home_longitude,
       home_latitude = EXCLUDED.home_latitude,
       updated_at = now()`,
    [userId, home.label, home.coordinate[0], home.coordinate[1]],
  )
  return home
}
