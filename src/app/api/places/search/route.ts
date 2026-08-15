import { z } from 'zod'

const resultSchema = z.object({
  results: z.array(z.object({
    attrs: z.object({
      lat: z.number(),
      lon: z.number(),
      label: z.string(),
      origin: z.string().optional(),
    }),
  })),
})

function plainText(value: string) {
  return value.replace(/<[^>]+>/g, '').replaceAll('&nbsp;', ' ').trim()
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim()
  if (!query || query.length < 2) return Response.json({ results: [] })

  const url = new URL('https://api3.geo.admin.ch/rest/services/api/SearchServer')
  url.searchParams.set('searchText', query.slice(0, 120))
  url.searchParams.set('type', 'locations')
  url.searchParams.set('origins', 'address,zipcode,gg25')
  url.searchParams.set('limit', '6')
  url.searchParams.set('sr', '4326')

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 3600 } })
    if (!response.ok) throw new Error('Swiss search failed')
    const payload = resultSchema.parse(await response.json())
    return Response.json({
      results: payload.results.map(({ attrs }) => ({
        label: plainText(attrs.label),
        coordinate: [attrs.lon, attrs.lat],
        origin: attrs.origin,
      })),
    })
  } catch {
    return Response.json({ code: 'SEARCH_FAILED', results: [] }, { status: 502 })
  }
}
