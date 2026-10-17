import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { planPreviewRoute } from '@/lib/preview-router'
import { createRouteShare, deleteAccount, deleteSavedRoute, ensureRouteSchema, exportAccount, getAccountPreferences, getHomePoint, listRouteVersions, listSavedRoutes, readRouteShare, removeHomePoint, revokeRouteShare, saveAccountPreferences, saveHomePoint, saveSavedRoute } from '@/lib/saved-route-store'
import type { RouteOwner } from '@/lib/anonymous-owner'
import { defaultAccountPreferences } from '@/lib/account-preferences'

const testUrl = process.env.DATABASE_URL ?? ''
if (new URL(testUrl).hostname !== '127.0.0.1' || new URL(testUrl).port !== '54328' || !testUrl.endsWith('/velvetia_test')) throw new Error('Integration tests require the isolated compose.qa.yaml database')
const db = new Pool({ connectionString: testUrl })
const userA = randomUUID(), userB = randomUUID(), ownerKey = randomUUID()
const owner: RouteOwner = { userId: userA, ownerKey, storageScope: 'test-a', setCookie: false, secure: false }
const other: RouteOwner = { ...owner, ownerKey: randomUUID(), userId: userB, storageScope: 'test-b' }
const draft = planPreviewRoute({ locale: 'de', profile: 'road', mode: 'round-trip', targetDistanceKm: 60, waypoints: [{ id: 'start', coordinate: [7.5886, 47.5596], label: 'Basel', kind: 'start' }], preferences: { surface: 'balanced', climbing: 'balanced', safety: 'quiet' } })

beforeAll(async () => {
  await db.query(`CREATE EXTENSION IF NOT EXISTS postgis; CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
    CREATE TABLE IF NOT EXISTS auth.sessions (id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);`)
  await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2), ($3, $4)', [userA, 'a@test.invalid', userB, 'b@test.invalid'])
  await ensureRouteSchema()
})
afterAll(async () => { await globalThis.velvetiaRoutePool?.end(); globalThis.velvetiaRoutePool = undefined; globalThis.velvetiaSchemaReady = undefined; await db.end() })

describe('account workspace with real PostGIS', () => {
  it('claims guest routes, syncs the same account on a second device and isolates other accounts', async () => {
    await saveSavedRoute({ ...owner, userId: null }, draft)
    const claimed = await listSavedRoutes(owner)
    expect(claimed).toHaveLength(1)
    expect(await listSavedRoutes({ ...owner, ownerKey: randomUUID() })).toEqual(claimed)
    expect(await listSavedRoutes(other)).toEqual([])
    await expect(saveSavedRoute(other, { ...claimed[0], serverVersion: undefined })).rejects.toThrow()
    expect(await listRouteVersions(other, draft.id)).toEqual([])
  })

  it('rejects concurrent stale edits and preserves immutable versions', async () => {
    const [current] = await listSavedRoutes(owner)
    const results = await Promise.allSettled([saveSavedRoute(owner, { ...current, name: 'Rheinrunde' }), saveSavedRoute(owner, { ...current, name: 'Veraltete Änderung' })])
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1)
    const versions = await listRouteVersions(owner, draft.id)
    expect(versions).toHaveLength(2)
    expect(versions[1].route.name).toBe(draft.name)
    const restored = await saveSavedRoute(owner, { ...versions[1].route, serverVersion: versions[0].version })
    expect(restored.serverVersion).toBe(3)
    expect((await listRouteVersions(owner, draft.id))).toHaveLength(3)
  })

  it('stores validated defaults and removes home independently', async () => {
    expect(await getAccountPreferences(userA)).toEqual(defaultAccountPreferences)
    await saveHomePoint(userA, { label: 'Privates Zuhause', coordinate: [7.58, 47.55] })
    await saveAccountPreferences(userA, { ...defaultAccountPreferences, profile: 'gravel', speedKmh: 18, distanceKm: 40 })
    expect((await getHomePoint(userA))?.label).toBe('Privates Zuhause')
    await removeHomePoint(userA)
    expect(await getHomePoint(userA)).toBeNull()
    expect((await getAccountPreferences(userA)).profile).toBe('gravel')
    expect((await getAccountPreferences(userB)).profile).toBe('road')
  })

  it('shares only an explicitly owned route, stores token hashes and supports revocation', async () => {
    expect(await createRouteShare(userB, draft.id)).toBeNull()
    const token = (await createRouteShare(userA, draft.id))!
    expect((await readRouteShare(token))?.name).toBe(draft.name)
    const stored = await db.query('SELECT token_hash FROM app.route_shares WHERE route_id = $1', [draft.id])
    expect(stored.rows[0].token_hash).not.toContain(token)
    const newToken = (await createRouteShare(userA, draft.id))!
    expect(await readRouteShare(token)).toBeNull()
    expect(await readRouteShare(newToken)).not.toBeNull()
    await revokeRouteShare(userB, draft.id)
    expect(await readRouteShare(newToken)).not.toBeNull()
    await revokeRouteShare(userA, draft.id)
    expect(await readRouteShare(newToken)).toBeNull()
  })

  it('exports history and hides soft-deleted routes and shares', async () => {
    const exported = await exportAccount(userA)
    expect(exported.routes).toHaveLength(1)
    expect(exported.versions).toHaveLength(3)
    const token = (await createRouteShare(userA, draft.id))!
    expect(await deleteSavedRoute(other, draft.id)).toBe(false)
    expect(await deleteSavedRoute(owner, draft.id)).toBe(true)
    expect(await listSavedRoutes(owner)).toEqual([])
    expect(await readRouteShare(token)).toBeNull()
  })

  it('deletes only the selected test account and all its data and sessions', async () => {
    await db.query('INSERT INTO auth.sessions (id, user_id) VALUES ($1, $2)', [randomUUID(), userA])
    await deleteAccount(userA)
    expect((await db.query('SELECT id FROM auth.users WHERE id = $1', [userA])).rowCount).toBe(0)
    expect((await db.query('SELECT id FROM auth.users WHERE id = $1', [userB])).rowCount).toBe(1)
    expect((await exportAccount(userA)).routes).toEqual([])
    expect((await db.query('SELECT id FROM auth.sessions WHERE user_id = $1', [userA])).rowCount).toBe(0)
    // Keep synthetic route data for the subsequent pg_dump / pg_restore comparison.
    await saveSavedRoute(other, { ...draft, id: randomUUID(), name: 'Restore QA fixture', serverVersion: undefined })
  })
})
