import { databasePool } from './saved-route-store'
import { supplyResultSchema, type SupplyCategory } from './supply'
import type { Coordinate } from './domain'

export async function nearbySupply(coordinates: Coordinate[], categories: SupplyCategory[]) {
  const database = databasePool()
  if (!database) throw new Error('SUPPLY_UNAVAILABLE')
  const client = await database.connect()
  try {
    await client.query('BEGIN READ ONLY')
    await client.query("SET LOCAL statement_timeout = '4000ms'")
    const source = await client.query('SELECT region_id AS "regionId", snapshot_at AS "snapshotAt", imported_at AS "importedAt" FROM app.poi_sources WHERE region_id = $1', ['ch'])
    if (!source.rowCount) throw new Error('SUPPLY_UNAVAILABLE')
    const result = await client.query(`WITH line AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) AS geom), nearby AS (
      SELECT p.*, ST_Distance(p.position, line.geom::geography) AS offset_m,
        ST_LineLocatePoint(line.geom, p.position::geometry) * ST_Length(line.geom::geography) / 1000 AS along
      FROM app.supply_pois p CROSS JOIN line
      WHERE p.region_id = $2 AND p.category = ANY($3::text[]) AND ST_DWithin(p.position, line.geom::geography, 500)
      ORDER BY offset_m, p.osm_type, p.osm_id LIMIT 61
    ) SELECT osm_type || '/' || osm_id AS id, category, COALESCE(properties->>'name','') AS name,
      json_build_array(ST_X(position::geometry),ST_Y(position::geometry)) AS coordinate,
      properties->>'opening_hours' AS "openingHours", properties->>'drinking_water' AS "drinkingWater", properties->>'access' AS access,
      source_updated_at AS "sourceUpdatedAt", offset_m AS "offsetM", along AS "alongKm"
      FROM nearby ORDER BY along, id`, [JSON.stringify({ type: 'LineString', coordinates }), 'ch', categories])
    await client.query('COMMIT')
    const meta = source.rows[0]
    return supplyResultSchema.parse({ pois: result.rows.slice(0, 60).map((p) => ({ ...p, sourceUpdatedAt: p.sourceUpdatedAt?.toISOString() ?? null })), truncated: result.rows.length > 60, corridorM: 500, source: { ...meta, snapshotAt: meta.snapshotAt.toISOString(), importedAt: meta.importedAt.toISOString() } })
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error }
  finally { client.release() }
}
