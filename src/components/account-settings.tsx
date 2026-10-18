'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Input } from './ui/input'
import { useRouter } from 'next/navigation'
import { Download, Home, Trash2 } from 'lucide-react'
import type { HomePoint, Locale } from '@/lib/domain'
import { authenticatedFetch, announceAuthState } from '@/lib/auth-client'
import { defaultAccountPreferences, type AccountPreferences } from '@/lib/account-preferences'
import { getBrowserSupabase } from '@/lib/supabase/browser'

export const PREFERENCES_EVENT = 'velvetia:preferences-changed'

export function AccountSettings({ locale }: { locale: Locale }) {
  const de = locale === 'de'
  const router = useRouter()
  const [values, setValues] = useState<AccountPreferences>(defaultAccountPreferences)
  const [home, setHome] = useState<HomePoint | null>(null)
  const [pending, setPending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([authenticatedFetch('/api/account/preferences'), authenticatedFetch('/api/account/home')]).then(async ([preferences, homeResponse]) => {
      if (!preferences.ok || !homeResponse.ok) throw new Error('UNAVAILABLE')
      const [p, h] = await Promise.all([preferences.json(), homeResponse.json()])
      if (active) { setValues(p.preferences); setHome(h.home); setLoaded(true) }
    }).catch(() => { if (active) setNotice(de ? 'Kontoeinstellungen sind gerade nicht erreichbar. Bitte öffne das Konto erneut.' : 'Account settings are unavailable. Please reopen your account.') })
    return () => { active = false }
  }, [de])

  async function save(event: FormEvent) {
    event.preventDefault(); setPending(true); setNotice('')
    try {
      const response = await authenticatedFetch('/api/account/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      if (!response.ok) throw new Error('FAILED')
      window.dispatchEvent(new CustomEvent(PREFERENCES_EVENT, { detail: values }))
      setNotice(de ? 'Standards gespeichert. Sie gelten für deine nächste Planung.' : 'Defaults saved. They apply to your next plan.')
    } catch { setNotice(de ? 'Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten.' : 'Could not save. Your changes are still here.') }
    finally { setPending(false) }
  }

  async function removeHome() {
    setPending(true)
    try {
      const response = await authenticatedFetch('/api/account/home', { method: 'DELETE' })
      if (!response.ok) throw new Error('FAILED')
      setHome(null); window.dispatchEvent(new CustomEvent(PREFERENCES_EVENT))
      setNotice(de ? 'Zuhause entfernt. Du kannst im Planer einen neuen Startort speichern.' : 'Home removed. Save a new starting point in the planner.')
    } catch { setNotice(de ? 'Zuhause konnte nicht entfernt werden.' : 'Could not remove home.') }
    finally { setPending(false) }
  }

  async function downloadData() {
    setPending(true)
    try {
      const response = await authenticatedFetch('/api/account/data')
      if (!response.ok) throw new Error('FAILED')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = url; link.download = 'velvetia-account.json'; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setNotice(de ? 'Datenexport fehlgeschlagen. Bitte erneut versuchen.' : 'Export failed. Please try again.') }
    finally { setPending(false) }
  }

  async function removeAccount(event: FormEvent) {
    event.preventDefault(); setPending(true)
    try {
      const session = await getBrowserSupabase()?.auth.getSession()
      const userId = session?.data.session?.user.id
      const response = await authenticatedFetch('/api/account/data', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, confirmation }) })
      if (!response.ok) { setNotice(response.status === 403 ? (de ? 'Das Passwort ist nicht korrekt.' : 'The password is incorrect.') : (de ? 'Konto konnte nicht gelöscht werden. Bitte erneut versuchen.' : 'Could not delete account. Please try again.')); return }
      await getBrowserSupabase()?.auth.signOut({ scope: 'local' })
      if (userId) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`user:${userId}`))
        const scope = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 24)
        localStorage.removeItem(`velvetia.saved-routes.v2.${scope}`)
      }
      announceAuthState(null)
      router.replace('/'); router.refresh()
    } catch { setNotice(de ? 'Die Kontolöschung wurde nicht bestätigt. Prüfe deine Verbindung und melde dich erneut an, um den Kontostatus zu prüfen.' : 'Account deletion has not been confirmed. Check your connection and sign in again to check the account status.') }
    finally { setPending(false) }
  }

  return <div className="account-settings">
    <form onSubmit={(event) => void save(event)} className="settings-form">
      <div className="settings-section-title"><h3>{de ? 'Voreinstellungen' : 'Planning defaults'}</h3><p>{de ? 'Neue Routen übernehmen diese Einstellungen.' : 'New routes use these settings.'}</p></div>
      <fieldset disabled={pending || !loaded}>
        <label>{de ? 'Fahrradtyp' : 'Bike type'}<select value={values.profile} onChange={(e) => setValues({ ...values, profile: e.target.value as AccountPreferences['profile'] })}><option value="road">{de ? 'Rennrad' : 'Road'}</option><option value="gravel">Gravel</option><option value="touring">Touring</option><option value="city">City</option></select></label>
        <div className="settings-pair"><label>{de ? 'Rundtour · km' : 'Round trip · km'}<Input type="number" min={5} max={250} required value={values.distanceKm} onChange={(e) => setValues({ ...values, distanceKm: Number(e.target.value) })} /></label><label>{de ? 'Tempo · km/h' : 'Pace · km/h'}<Input type="number" min={5} max={50} step="0.5" required value={values.speedKmh} onChange={(e) => setValues({ ...values, speedKmh: Number(e.target.value) })} /></label></div>
        <label>{de ? 'Untergrund' : 'Surface'}<select value={values.surface} onChange={(e) => setValues({ ...values, surface: e.target.value as AccountPreferences['surface'] })}><option value="balanced">{de ? 'Ausgewogen' : 'Balanced'}</option><option value="mostly-paved">{de ? 'Möglichst Asphalt' : 'Mostly paved'}</option><option value="unpaved-friendly">{de ? 'Mehr Naturwege' : 'More unpaved'}</option></select></label>
        <div className="settings-pair"><label>{de ? 'Steigungen' : 'Climbing'}<select value={values.climbing} onChange={(e) => setValues({ ...values, climbing: e.target.value as AccountPreferences['climbing'] })}><option value="avoid">{de ? 'Eher flach' : 'Flatter'}</option><option value="balanced">{de ? 'Ausgewogen' : 'Balanced'}</option><option value="challenge">{de ? 'Sportlich' : 'Challenge'}</option></select></label><label>{de ? 'Strassenwahl' : 'Road choice'}<select value={values.safety} onChange={(e) => setValues({ ...values, safety: e.target.value as AccountPreferences['safety'] })}><option value="quiet">{de ? 'Ruhig' : 'Quiet'}</option><option value="balanced">{de ? 'Ausgewogen' : 'Balanced'}</option><option value="direct">{de ? 'Direkt' : 'Direct'}</option></select></label></div>
        <button className="primary-button" type="submit">{pending ? (de ? 'Speichert …' : 'Saving …') : (de ? 'Standards speichern' : 'Save defaults')}</button>
      </fieldset>
    </form>
    <div className="settings-home"><Home size={18} /><div><strong>{de ? 'Zuhause' : 'Home'}</strong><p>{home?.label ?? (de ? 'Wähle deinen Startort auf der Karte und speichere ihn als Zuhause.' : 'Choose a starting point on the map and save it as home.')}</p></div>{home && <button className="icon-button" onClick={() => void removeHome()} disabled={pending} aria-label={de ? 'Zuhause entfernen' : 'Remove home'}><Trash2 size={16} /></button>}</div>
    <button className="secondary-button account-submit" onClick={() => void downloadData()} disabled={pending}><Download size={16} />{de ? 'Alle Kontodaten exportieren' : 'Export all account data'}</button>
    <details className="danger-zone" open={deleting} onToggle={(e) => setDeleting(e.currentTarget.open)}><summary>{de ? 'Konto endgültig löschen' : 'Permanently delete account'}</summary><p>{de ? 'Löscht dein Konto, alle Routen, Versionen, Freigaben und Einstellungen. Dieser Vorgang lässt sich nicht rückgängig machen. Exportiere vorher deine Daten.' : 'Deletes your account, routes, versions, shares and settings. This cannot be undone. Export your data first.'}</p><form onSubmit={(e) => void removeAccount(e)} className="settings-form"><label>{de ? 'Aktuelles Passwort' : 'Current password'}<Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label><label>{de ? 'Zur Bestätigung DELETE eingeben' : 'Type DELETE to confirm'}<Input required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} pattern="DELETE" /></label><button type="submit" className="primary-button" disabled={pending || confirmation !== 'DELETE'}>{de ? 'Mein Konto und alle Daten löschen' : 'Delete my account and all data'}</button></form></details>
    {notice && <p className="account-message" role="status">{notice}</p>}
  </div>
}
