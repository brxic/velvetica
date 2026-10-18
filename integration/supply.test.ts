import { afterAll, beforeAll, expect, it } from 'vitest'
import { Pool } from 'pg'
import { readFile } from 'node:fs/promises'
import { importSupply, classifySupply } from '../scripts/import-supply.mjs'
import { nearbySupply } from '@/lib/supply-store'

const url = process.env.DATABASE_URL ?? ''
if (new URL(url).hostname !== '127.0.0.1' || new URL(url).port !== (process.env.VELVETIA_QA_DATABASE_PORT ?? '54328') || !url.endsWith('/velvetia_test')) throw new Error('Supply tests require the isolated QA database')
const db = new Pool({ connectionString: url })
beforeAll(async () => {
  await db.query(`CREATE EXTENSION IF NOT EXISTS postgis;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$;`)
  await db.query(await readFile('supabase/migrations/20261018160701_supply_pois.sql', 'utf8'))
})
afterAll(async () => { await globalThis.velvetiaRoutePool?.end(); globalThis.velvetiaRoutePool = undefined; await db.end() })
it('indexes points and polygons, filters private/non-potable records and applies a real geographic corridor', async () => {
  expect(classifySupply({ amenity: 'fountain' })).toBeNull()
  expect(classifySupply({ amenity: 'fountain', drinking_water: 'yes' })).toBe('water')
  expect(classifySupply({ tourism: 'camp_site', drinking_water: 'yes' })).toBeNull()
  expect(classifySupply({ natural: 'spring', drinking_water: 'yes' })).toBe('water')
  expect(await importSupply('test-fixtures/supply.jsonl', db, 1)).toMatchObject({ count: 4 })
  const result = await nearbySupply([[7.44, 46.95], [7.46, 46.95]], ['water', 'food', 'shop'])
  expect(result.pois.map((p) => p.id)).toEqual(expect.arrayContaining(['node/1', 'node/2', 'way/6']))
  expect(result.pois.some((p) => ['node/3', 'node/4', 'node/5'].includes(p.id))).toBe(false)
  expect(result.pois.find((p) => p.id === 'node/2')?.openingHours).toBe('Mo-Fr 08:00-17:00')
  expect(result.source.snapshotAt).toBe('2026-08-01T00:00:00.000Z')
  expect((await nearbySupply([[7.44, 46.95], [7.46, 46.95]], ['water'])).pois.map((p) => p.id)).toEqual(['node/1'])
})
it('rolls back incomplete replacement imports and has RLS and a spatial index', async () => {
  await expect(importSupply('test-fixtures/supply-incomplete.jsonl', db, 1)).rejects.toThrow('previous index kept')
  await expect(importSupply('test-fixtures/supply.jsonl', db, 1000)).rejects.toThrow('previous index kept')
  expect((await nearbySupply([[7.44, 46.95], [7.46, 46.95]], ['water'])).pois).toHaveLength(1)
  const security = await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='app.supply_pois'::regclass")
  expect(security.rows[0].relrowsecurity).toBe(true)
  const grants = await db.query("SELECT grantee FROM information_schema.role_table_grants WHERE table_schema='app' AND table_name IN ('supply_pois','poi_sources') AND grantee IN ('PUBLIC','anon','authenticated')")
  expect(grants.rows).toEqual([])
  const permissions = await db.query("SELECT has_table_privilege('anon','app.supply_pois','SELECT') AS anon_read, has_table_privilege('authenticated','app.supply_pois','INSERT') AS user_write")
  expect(permissions.rows[0]).toEqual({ anon_read: false, user_write: false })
  const index = await db.query("SELECT indexdef FROM pg_indexes WHERE schemaname='app' AND indexname='supply_pois_position_gix'")
  expect(index.rows[0].indexdef).toContain('gist')
})
