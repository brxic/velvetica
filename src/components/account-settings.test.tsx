import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSettings } from './account-settings'
import { defaultAccountPreferences } from '@/lib/account-preferences'

const { request, signOut } = vi.hoisted(() => ({ request: vi.fn(), signOut: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authenticatedFetch: request, announceAuthState: vi.fn() }))
vi.mock('@/lib/supabase/browser', () => ({ getBrowserSupabase: () => ({ auth: { signOut, getSession: async () => ({ data: { session: null } }) } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }))
beforeEach(() => {
  request.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/preferences') && !options) return Response.json({ preferences: defaultAccountPreferences })
    if (url.endsWith('/home') && !options) return Response.json({ home: { label: 'Basel', coordinate: [7.58, 47.55] } })
    return Response.json({ preferences: defaultAccountPreferences })
  })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('account settings', () => {
  it('loads saved defaults and submits the edited values', async () => {
    render(<AccountSettings locale="de" />)
    const profile = await screen.findByLabelText('Fahrradtyp')
    await waitFor(() => expect(profile).toBeEnabled())
    fireEvent.change(profile, { target: { value: 'gravel' } })
    fireEvent.change(screen.getByLabelText('Rundtour · km'), { target: { value: '80' } })
    fireEvent.click(screen.getByRole('button', { name: 'Standards speichern' }))
    await screen.findByText('Standards gespeichert. Sie gelten für deine nächste Planung.')
    expect(request).toHaveBeenCalledWith('/api/account/preferences', expect.objectContaining({ method: 'PUT', body: expect.stringContaining('"distanceKm":80') }))
  })

  it('keeps input after an outage and removes home only after success', async () => {
    render(<AccountSettings locale="de" />)
    await screen.findByText('Basel')
    request.mockResolvedValue(new Response(null, { status: 503 }))
    fireEvent.click(screen.getByRole('button', { name: 'Zuhause entfernen' }))
    await screen.findByText('Zuhause konnte nicht entfernt werden.')
    expect(screen.getByText('Basel')).toBeVisible()
  })

  it('requires explicit confirmation and reports a wrong deletion password', async () => {
    render(<AccountSettings locale="de" />)
    await screen.findByText('Basel')
    fireEvent.click(screen.getByText('Konto endgültig löschen'))
    const button = screen.getByRole('button', { name: 'Mein Konto und alle Daten löschen' })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Aktuelles Passwort'), { target: { value: 'wrong-password' } })
    fireEvent.change(screen.getByLabelText('Zur Bestätigung DELETE eingeben'), { target: { value: 'DELETE' } })
    request.mockResolvedValue(new Response(null, { status: 403 }))
    fireEvent.click(button)
    await screen.findByText('Das Passwort ist nicht korrekt.')
    expect(signOut).not.toHaveBeenCalled()
  })
})
