'use client'

import { useState } from 'react'
import { Input } from './ui/input'
import { Link2, X } from 'lucide-react'
import { authenticatedFetch } from '@/lib/auth-client'
import type { Locale } from '@/lib/domain'
import { AppDialog } from './ui/dialog'

export function RouteShare({ routeId, locale, open: controlledOpen, onOpenChange, hideTrigger = false }: { routeId: string; locale: Locale; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const de = locale === 'de'
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')

  async function change(revoke = false) {
    setPending(true); setNotice('')
    try {
      const response = await authenticatedFetch(`/api/saved-routes/${routeId}/share`, { method: revoke ? 'DELETE' : 'POST' })
      if (!response.ok) throw new Error('FAILED')
      if (revoke) { setUrl(''); setNotice(de ? 'Alle bisherigen Links sind jetzt ungültig.' : 'All previous links are now invalid.') }
      else { const data = await response.json(); setUrl(new URL(data.path, window.location.origin).href) }
    } catch { setNotice(de ? 'Freigabe konnte nicht geändert werden. Prüfe deine Verbindung und Anmeldung.' : 'Could not change sharing. Check your connection and sign-in.') }
    finally { setPending(false) }
  }

  return <>
    {!hideTrigger && <button className="text-button" onClick={() => setOpen(true)}><Link2 size={16} />{de ? 'Teilen' : 'Share'}</button>}
    <AppDialog open={open} onOpenChange={setOpen} label={de ? 'Eine Route. Ein Link.' : 'One route. One link.'} className="account-dialog share-dialog">
      <button className="icon-button account-close" onClick={() => setOpen(false)} aria-label={de ? 'Schliessen' : 'Close'}><X size={18} /></button>
      <p className="eyebrow">Velvetia · {de ? 'Freigabe' : 'Sharing'}</p><h2 id="share-title">{de ? 'Eine Route. Ein Link.' : 'One route. One link.'}</h2>
      <p>{de ? 'Jede Person mit dem Link kann diese Route ansehen und als GPX laden, inklusive Start und Ziel. Dein Konto und dein gespeichertes Zuhause bleiben privat. Änderungen an der gespeicherten Route sind über den Link sichtbar.' : 'Anyone with the link can view this route and download its GPX, including start and destination. Your account and saved home stay private. Changes to the saved route appear through the link.'}</p>
      {url && <label className="share-url">{de ? 'Freigabelink' : 'Share link'}<Input readOnly value={url} onFocus={(e) => e.target.select()} /></label>}
      {url ? <button className="primary-button account-submit" onClick={() => { void navigator.clipboard.writeText(url).then(() => setNotice(de ? 'Link kopiert.' : 'Link copied.')).catch(() => setNotice(de ? 'Bitte den Link markieren und kopieren.' : 'Select and copy the link.')) }}>{de ? 'Link kopieren' : 'Copy link'}</button> : <button className="primary-button account-submit" disabled={pending} onClick={() => void change()}>{de ? 'Freigabelink erstellen' : 'Create share link'}</button>}
      <button className="account-link" disabled={pending} onClick={() => void change(true)}>{de ? 'Alle Links für diese Route widerrufen' : 'Revoke all links for this route'}</button>
      {notice && <div className="account-message" role="status">{notice}</div>}
    </AppDialog>
  </>
}
