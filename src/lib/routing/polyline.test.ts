import { describe, expect, it } from 'vitest'
import { decodePolyline } from './polyline'

describe('Valhalla polyline decoder', () => {
  it('decodes the canonical precision-5 polyline', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual([
      [-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252],
    ])
  })
})

