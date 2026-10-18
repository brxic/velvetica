import { afterEach, expect, it, vi } from 'vitest'
import { POST } from './route'
import { nearbySupply } from '@/lib/supply-store'
vi.mock('@/lib/supply-store', () => ({ nearbySupply: vi.fn() }))
afterEach(() => vi.resetAllMocks())
const input = { coordinates: [[7.44, 46.95], [7.46, 46.95]], categories: ['water'] }
const request = (body: unknown) => new Request('http://localhost/api/pois/nearby', { method: 'POST', body: JSON.stringify(body) })
it('rejects invalid geometry and categories without querying the database', async () => {
  expect((await POST(request({ ...input, categories: ['hotel'] }))).status).toBe(400)
  expect((await POST(request({ ...input, coordinates: [[0, 0], [7, 47]] }))).status).toBe(400)
  expect(nearbySupply).not.toHaveBeenCalled()
})
it('rejects malformed JSON and oversized chunked bodies before touching the index', async () => {
  expect((await POST(new Request('http://localhost/api/pois/nearby', { method: 'POST', body: '{' }))).status).toBe(400)
  expect((await POST(new Request('http://localhost/api/pois/nearby', { method: 'POST', body: ' '.repeat(1_500_001) }))).status).toBe(413)
  expect(nearbySupply).not.toHaveBeenCalled()
})
it('returns controlled, non-cacheable failure if the optional service is unavailable', async () => {
  vi.mocked(nearbySupply).mockRejectedValue(new Error('private connection details'))
  const response = await POST(request(input))
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('private')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
})
it('queries the configured index only, with deduplicated categories', async () => {
  vi.mocked(nearbySupply).mockResolvedValue({ pois: [], truncated: false, corridorM: 500, source: { regionId: 'ch', snapshotAt: '2026-08-01T00:00:00Z', importedAt: '2026-10-18T00:00:00Z' } })
  expect((await POST(request({ ...input, categories: ['water', 'water'] }))).status).toBe(200)
  expect(nearbySupply).toHaveBeenCalledWith(input.coordinates, ['water'])
})
