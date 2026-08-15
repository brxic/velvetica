'use client'

import { MapPin, Search, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { Coordinate, Locale } from '@/lib/domain'

type Place = { label: string; coordinate: Coordinate }

export function PlaceSearch({ kind, locale, value, onSelect, onClear }: {
  kind: 'start' | 'end'
  locale: Locale
  value?: string
  onSelect: (place: Place) => void
  onClear?: () => void
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2 || query === value) return
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        if (response.ok) { const data = await response.json() as { results: Place[] }; setResults(data.results); setOpen(true) }
      } catch { /* A newer search supersedes this request. */ }
      finally { setLoading(false) }
    }, 280)
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [query, value])

  const placeholder = kind === 'start'
    ? (locale === 'de' ? 'Startort suchen' : 'Search start')
    : (locale === 'de' ? 'Zielort suchen' : 'Search destination')

  return <div className="place-search">
    <label htmlFor={id} className="sr-only">{placeholder}</label>
    <Search size={16} />
    <input id={id} value={query || value || ''} placeholder={placeholder} autoComplete="off" onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} />
    {loading && <span className="search-loader" aria-label={locale === 'de' ? 'Suche läuft' : 'Searching'} />}
    {value && <button type="button" onClick={() => { setQuery(''); setResults([]); onClear?.() }} aria-label={locale === 'de' ? 'Ort entfernen' : 'Remove place'}><X size={15} /></button>}
    {open && query.trim().length >= 2 && results.length > 0 && <ul role="listbox">
      {results.map((place) => <li key={`${place.coordinate.join(',')}-${place.label}`}><button type="button" onClick={() => { setQuery(place.label); setResults([]); setOpen(false); onSelect(place) }}><MapPin size={15} /><span>{place.label}</span></button></li>)}
    </ul>}
  </div>
}
