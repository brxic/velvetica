import type { Coordinate } from '@/lib/domain'

export function decodePolyline(encoded: string, precision = 6): Coordinate[] {
  const coordinates: Coordinate[] = []; const factor = 10 ** precision
  let index = 0; let latitude = 0; let longitude = 0
  while (index < encoded.length) {
    let result = 0; let shift = 0; let byte: number
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
    latitude += result & 1 ? ~(result >> 1) : result >> 1
    result = 0; shift = 0
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
    longitude += result & 1 ? ~(result >> 1) : result >> 1
    coordinates.push([longitude / factor, latitude / factor])
  }
  return coordinates
}

