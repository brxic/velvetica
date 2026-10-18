'use client'

import { Autocomplete } from '@base-ui/react/autocomplete'
import { MapPin, Search, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { Coordinate, Locale } from '@/lib/domain'
import { Button } from './ui/button'

type Place = { label: string; coordinate: Coordinate }
type Props = { kind: 'start' | 'end' | 'via'; locale: Locale; value?: string; label?: string; onSelect: (place: Place) => boolean | void | Promise<boolean | void>; onClear?: () => boolean | void | Promise<boolean | void> }
type SearchState = { query: string; status: 'idle' | 'loading' | 'ready' | 'error'; results: Place[] }

// An externally selected home/route is a new search session; typing never falls
// back to the selected label when the user intentionally empties the input.
export function PlaceSearch(props: Props) { return <PlaceSearchInput key={props.value ?? ''} {...props} /> }

function PlaceSearchInput({ kind, locale, value, label, onSelect, onClear }: Props) {
  const id = useId()
  const de = locale === 'de'
  const [query, setQuery] = useState(value ?? '')
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState<SearchState>({ query: '', status: 'idle', results: [] })
  const canSearch = query.trim().length >= 2 && query !== value
  const results = search.query === query ? search.results : []

  useEffect(() => {
    if (!canSearch) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearch({ query, status: 'loading', results: [] })
      try {
        const response = await fetch(`/api/places/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        if (!response.ok) throw new Error('SEARCH_FAILED')
        const data = await response.json() as { results: Place[] }
        if (!controller.signal.aborted) setSearch({ query, status: 'ready', results: data.results })
      } catch { if (!controller.signal.aborted) setSearch({ query, status: 'error', results: [] }) }
    }, 280)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [query, canSearch, attempt])

  const placeholder = label ?? (kind === 'start' ? (de ? 'Startort suchen' : 'Search start') : kind === 'end' ? (de ? 'Zielort suchen' : 'Search destination') : (de ? 'Zwischenpunkt suchen' : 'Search waypoint'))
  const pending = canSearch && (search.query !== query || search.status === 'loading' || search.status === 'idle')
  return <Autocomplete.Root items={results} filter={null} value={query} open={open && canSearch} onOpenChange={setOpen} itemToStringValue={(place) => place.label} onValueChange={async (next, details) => {
    if (details.reason === 'item-press') {
      const place = results.find((item) => item.label === next)
      if (place && await onSelect(place) === false) { setQuery(value ?? ''); setOpen(false); return }
      setOpen(false)
    } else setOpen(true)
    setQuery(next)
  }}>
    <Autocomplete.InputGroup className="place-search">
      <label htmlFor={id} className="sr-only">{placeholder}</label><Search size={18} aria-hidden="true" />
      <Autocomplete.Input id={id} placeholder={placeholder} autoComplete="off" />
      {pending ? <span className="search-loader" aria-hidden="true" /> : null}
      {(value || query) ? <Button variant="icon" className="place-clear" aria-label={de ? 'Ort entfernen' : 'Remove place'} onClick={async () => { const accepted = await onClear?.(); setQuery(accepted === false ? value ?? '' : ''); setOpen(false) }}><X size={16} /></Button> : null}
    </Autocomplete.InputGroup>
    <Autocomplete.Portal>
      <Autocomplete.Positioner className="place-positioner" sideOffset={6} align="start">
        <Autocomplete.Popup className="place-popup" aria-busy={pending}>
          {pending ? <Autocomplete.Status className="place-search-status">{de ? 'Orte werden gesucht …' : 'Searching places …'}</Autocomplete.Status> : search.status === 'error' && search.query === query ? <div className="place-search-status" role="status">{de ? 'Ortssuche nicht erreichbar.' : 'Place search unavailable.'}<Button variant="text" onClick={() => setAttempt((value) => value + 1)}>{de ? 'Erneut versuchen' : 'Try again'}</Button></div> : results.length === 0 ? <Autocomplete.Status className="place-search-status">{de ? 'Keine Orte gefunden. Suche genauer oder wähle einen Punkt auf der Karte.' : 'No places found. Refine your search or choose a point on the map.'}</Autocomplete.Status> : null}
          <Autocomplete.List className="place-results">{(place: Place) => <Autocomplete.Item className="place-option" key={`${place.coordinate.join(',')}-${place.label}`} value={place}><MapPin size={17} aria-hidden="true" /><span>{place.label}</span></Autocomplete.Item>}</Autocomplete.List>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  </Autocomplete.Root>
}
