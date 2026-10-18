import { z } from 'zod'
import { nearbySupply } from '@/lib/supply-store'
import { supplyCategory } from '@/lib/supply'
import { cumulativeDistances } from '@/lib/route-analysis'

export const runtime = 'nodejs'
export const maxDuration = 10
const schema = z.object({ coordinates: z.array(z.tuple([z.number().min(5.8).max(10.7), z.number().min(45.7).max(47.9)])).min(2).max(20_000), categories: z.array(supplyCategory).min(1).max(3) })
let active = 0
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (active >= 4) return Response.json({ code: 'SUPPLY_BUSY' }, { status: 429, headers })
  active++
  try {
    // Bound chunked bodies as well as requests with Content-Length.
    const reader = request.body?.getReader(); if (!reader) return Response.json({ code: 'INVALID_REQUEST' }, { status: 400, headers })
    const chunks: Uint8Array[] = []; let bytes = 0
    while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; if (bytes > 1_500_000) { await reader.cancel(); return Response.json({ code: 'REQUEST_TOO_LARGE' }, { status: 413, headers }) }; chunks.push(next.value) }
    let body: unknown
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return Response.json({ code: 'INVALID_REQUEST' }, { status: 400, headers }) }
    const parsed = schema.safeParse(body)
    if (!parsed.success || cumulativeDistances(parsed.data.coordinates).at(-1)! > 600) return Response.json({ code: 'INVALID_REQUEST' }, { status: 400, headers })
    return Response.json(await nearbySupply(parsed.data.coordinates, [...new Set(parsed.data.categories)]), { headers })
  } catch { console.warn('[supply] index query unavailable'); return Response.json({ code: 'SUPPLY_UNAVAILABLE' }, { status: 503, headers }) }
  finally { active-- }
}
