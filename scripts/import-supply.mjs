import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { z } from 'zod'

const metaSchema = z.object({ type: z.literal('metadata'), version: z.literal(1), regionId: z.literal('ch'), snapshotAt: z.string().datetime() })
const point = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
const ring = z.array(point).min(4).max(20_000), polygon = z.array(ring).min(1).max(100)
const featureSchema = z.object({ osmType: z.enum(['node', 'way', 'relation']), osmId: z.string().regex(/^[1-9][0-9]{0,17}$/), sourceUpdatedAt: z.string().datetime().nullable(), properties: z.object({ name: z.string().max(200).optional(), amenity: z.string().max(50).optional(), shop: z.string().max(50).optional(), natural: z.string().max(50).optional(), man_made: z.string().max(50).optional(), drinking_water: z.string().max(30).optional(), access: z.string().max(50).optional(), opening_hours: z.string().max(500).optional() }), geometry: z.discriminatedUnion('type', [z.object({ type: z.literal('Point'), coordinates: point }), z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(polygon).min(1).max(100) })]) })

export function classifySupply(tags) {
  if (['no', 'private'].includes(tags.access)) return null
  const waterFeature = tags.amenity === 'fountain' || tags.man_made === 'water_tap' || tags.natural === 'spring'
  if (tags.drinking_water !== 'no' && (tags.amenity === 'drinking_water' || (waterFeature && tags.drinking_water === 'yes'))) return 'water'
  if (['cafe', 'restaurant', 'fast_food'].includes(tags.amenity)) return 'food'
  if (['supermarket', 'convenience', 'bakery', 'greengrocer', 'deli', 'farm', 'butcher'].includes(tags.shop)) return 'shop'
  return null
}

/** Atomic region replacement. Staging/validation finishes before the live index is touched. */
export async function importSupply(file, database, minimumCount = 1000) {
  const client = await database.connect()
  let lines
  let meta, count = 0, seen = 0, complete = false, batch = []
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL search_path=public,extensions; SET LOCAL statement_timeout='30000ms'")
    await client.query('SELECT pg_advisory_xact_lock(18102026)')
    await client.query('CREATE TEMP TABLE supply_stage (LIKE app.supply_pois INCLUDING DEFAULTS) ON COMMIT DROP')
    lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
    const flush = async () => {
      if (!batch.length) return
      const rows = await client.query(`INSERT INTO supply_stage(region_id,osm_type,osm_id,category,position,properties,source_updated_at)
        SELECT 'ch', x->>'osmType', (x->>'osmId')::bigint, x->>'category', p::geography, x->'properties', (x->>'sourceUpdatedAt')::timestamptz
        FROM jsonb_array_elements($1::jsonb) x CROSS JOIN LATERAL (SELECT ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON(x->'geometry'),4326)) AS p) g
        WHERE ST_X(p) BETWEEN 5.8 AND 10.7 AND ST_Y(p) BETWEEN 45.7 AND 47.9`, [JSON.stringify(batch)])
      count += rows.rowCount; batch = []
    }
    for await (const line of lines) {
      if (line.length > 1_000_000) throw new Error('Oversized POI record')
      if (complete) throw new Error('Unexpected data after completion marker')
      const record = JSON.parse(line)
      if (!meta) { meta = metaSchema.parse(record); continue }
      if (record.type === 'complete') { if (record.count !== seen) throw new Error('Incomplete POI export'); complete = true; continue }
      const feature = featureSchema.parse(record), category = classifySupply(feature.properties)
      seen++
      if (!category) continue
      batch.push({ ...feature, category })
      if (batch.length >= 500) await flush()
      if (count > 200_000) throw new Error('POI import exceeds expected size')
    }
    await flush()
    if (!meta || !complete || count < minimumCount) throw new Error('Incomplete or unexpectedly small POI extract; previous index kept')
    if (Date.parse(meta.snapshotAt) > Date.now() + 86_400_000) throw new Error('Invalid future snapshot')
    const old = await client.query('SELECT snapshot_at FROM app.poi_sources WHERE region_id=$1', [meta.regionId])
    if (old.rows[0] && old.rows[0].snapshot_at.getTime() > Date.parse(meta.snapshotAt)) throw new Error('Refusing an older extract')
    await client.query('INSERT INTO app.poi_sources(region_id,snapshot_at) VALUES($1,$2) ON CONFLICT(region_id) DO UPDATE SET snapshot_at=EXCLUDED.snapshot_at,imported_at=now()', [meta.regionId, meta.snapshotAt])
    await client.query('DELETE FROM app.supply_pois WHERE region_id=$1', [meta.regionId])
    await client.query('INSERT INTO app.supply_pois SELECT * FROM supply_stage')
    await client.query('COMMIT')
    return { count, snapshotAt: meta.snapshotAt }
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { lines?.close(); client.release() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2], connectionString = process.env.POI_IMPORT_DATABASE_URL
  if (!file || !connectionString) { console.error('Usage: set POI_IMPORT_DATABASE_URL explicitly, then node scripts/import-supply.mjs <export.jsonl>. No .env files are read.'); process.exitCode = 1 }
  else {
    const db = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 8000 })
    try { console.log(await importSupply(file, db)) }
    catch { console.error('POI import failed. Previous index kept. Check migration, file format, source age and connection.'); process.exitCode = 1 }
    finally { await db.end() }
  }
}
