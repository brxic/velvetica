'use client'

import type { User } from '@supabase/supabase-js'
import { Check, Cloud, LockKeyhole, LogIn, LogOut, Mail, UserRound, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import type { Locale } from '@/lib/domain'
import { announceAuthState } from '@/lib/auth-client'
import { getBrowserSupabase } from '@/lib/supabase/browser'

type AuthView = 'sign-in' | 'sign-up' | 'forgot-password' | 'update-password'
type Notice = { text: string; tone: 'success' | 'error' }

const MIN_PASSWORD_LENGTH = 8

export function AccountMenu({ locale }: { locale: Locale }) {
  const supabase = getBrowserSupabase()
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState<AuthView>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const de = locale === 'de'

  useEffect(() => {
    if (!supabase) return
    let lastUserId: string | null | undefined
    const updateUser = (nextUser: User | null) => {
      setUser(nextUser)
      const nextUserId = nextUser?.id ?? null
      if (lastUserId !== undefined && nextUserId !== lastUserId) announceAuthState(nextUserId)
      lastUserId = nextUserId
    }
    void supabase.auth.getUser().then(({ data }) => updateUser(data.user))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => updateUser(session?.user ?? null))
    const result = new URL(window.location.href).searchParams.get('auth')
    if (result) {
      const timer = window.setTimeout(() => {
        if (result === 'recovery') {
          setView('update-password')
          setNotice({ tone: 'success', text: de ? 'Lege jetzt dein neues Passwort fest.' : 'Set your new password now.' })
        } else {
          setNotice(result === 'success'
            ? { tone: 'success', text: de ? 'Deine E-Mail ist bestätigt. Du bist angemeldet.' : 'Your email is confirmed. You are signed in.' }
            : { tone: 'error', text: de ? 'Der Bestätigungslink ist ungültig oder abgelaufen.' : 'The confirmation link is invalid or expired.' })
        }
        setOpen(true)
      }, 0)
      window.history.replaceState({}, '', window.location.pathname)
      return () => { window.clearTimeout(timer); data.subscription.unsubscribe() }
    }
    return () => data.subscription.unsubscribe()
  }, [de, supabase])

  function selectView(nextView: AuthView) {
    setView(nextView)
    setPassword('')
    setPasswordConfirmation('')
    setNotice(null)
  }

  function validPasswordConfirmation() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setNotice({ tone: 'error', text: de ? 'Das Passwort muss mindestens 8 Zeichen lang sein.' : 'The password must be at least 8 characters long.' })
      return false
    }
    if (password !== passwordConfirmation) {
      setNotice({ tone: 'error', text: de ? 'Die Passwörter stimmen nicht überein.' : 'The passwords do not match.' })
      return false
    }
    return true
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !email.trim() || !password) return
    setPending(true); setNotice(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (error) {
      setNotice({ tone: 'error', text: de ? 'E-Mail oder Passwort ist nicht korrekt.' : 'The email or password is incorrect.' })
      return
    }
    setUser(data.user)
    setPassword('')
    setNotice({ tone: 'success', text: de ? 'Du bist angemeldet. Deine Routen werden synchronisiert.' : 'You are signed in. Your routes are being synced.' })
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !email.trim() || !validPasswordConfirmation()) return
    setPending(true); setNotice(null)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: new URL('/auth/confirm', window.location.origin).toString() },
    })
    setPending(false)
    if (error) {
      setNotice({ tone: 'error', text: de ? 'Das Konto konnte nicht erstellt werden. Prüfe E-Mail und Passwort.' : 'The account could not be created. Check your email and password.' })
      return
    }
    setPassword(''); setPasswordConfirmation('')
    if (data.session) {
      setUser(data.user)
      setNotice({ tone: 'success', text: de ? 'Dein Konto wurde erstellt und du bist angemeldet.' : 'Your account was created and you are signed in.' })
    } else {
      setNotice({ tone: 'success', text: de ? 'Konto erstellt. Bestätige jetzt deine E-Mail über den zugesandten Link.' : 'Account created. Confirm your email using the link we sent.' })
    }
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !email.trim()) return
    setPending(true); setNotice(null)
    const redirectTo = new URL('/auth/confirm', window.location.origin)
    redirectTo.searchParams.set('flow', 'recovery')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo.toString() })
    setPending(false)
    setNotice(error
      ? { tone: 'error', text: de ? 'Die Reset-E-Mail konnte nicht gesendet werden.' : 'The reset email could not be sent.' }
      : { tone: 'success', text: de ? 'Falls ein Konto existiert, erhältst du jetzt eine E-Mail zum Zurücksetzen.' : 'If an account exists, you will receive a password reset email.' })
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !validPasswordConfirmation()) return
    setPending(true); setNotice(null)
    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (error) {
      setNotice({ tone: 'error', text: de ? 'Das Passwort konnte nicht gespeichert werden.' : 'The password could not be saved.' })
      return
    }
    setPassword(''); setPasswordConfirmation(''); setView('sign-in')
    setNotice({ tone: 'success', text: de ? 'Dein Passwort wurde gespeichert.' : 'Your password has been saved.' })
  }

  async function signOut() {
    if (!supabase) return
    setPending(true)
    await supabase.auth.signOut({ scope: 'local' })
    window.location.reload()
  }

  const isUpdatingPassword = Boolean(user && view === 'update-password')
  const title = user && !isUpdatingPassword
    ? (de ? 'Dein Konto' : 'Your account')
    : view === 'sign-up'
      ? (de ? 'Konto erstellen' : 'Create account')
      : view === 'forgot-password'
        ? (de ? 'Passwort zurücksetzen' : 'Reset password')
        : view === 'update-password'
          ? (de ? 'Neues Passwort' : 'New password')
          : (de ? 'Willkommen zurück' : 'Welcome back')

  return <>
    <button className={`icon-button account-button ${user ? 'is-authenticated' : ''}`} onClick={() => setOpen(true)} aria-label={user ? (de ? 'Konto öffnen' : 'Open account') : (de ? 'Anmelden' : 'Sign in')}>
      {user ? <UserRound size={18} /> : <LogIn size={18} />}<span>{user ? (de ? 'Konto' : 'Account') : (de ? 'Anmelden' : 'Sign in')}</span>
    </button>
    {open && <div className="account-backdrop" onClick={() => setOpen(false)}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="icon-button account-close" onClick={() => setOpen(false)} aria-label={de ? 'Schliessen' : 'Close'}><X size={18} /></button>
        <div className="account-icon">{user && !isUpdatingPassword ? <UserRound /> : <Cloud />}</div>
        <p className="eyebrow">Velvetia Cloud</p>
        <h2 id="account-title">{title}</h2>
        {!supabase ? <>
          <p>{de ? 'Die App ist vorbereitet. Sobald die Supabase-Zugangsdaten gesetzt sind, wird die sichere Anmeldung hier automatisch aktiviert.' : 'The app is ready. Secure sign-in will activate here once the Supabase credentials are configured.'}</p>
          <div className="account-feature"><Check size={16} />{de ? 'Lokales Planen und Speichern funktioniert weiterhin.' : 'Local planning and saving continues to work.'}</div>
        </> : user && !isUpdatingPassword ? <>
          <div className="account-user"><span>{de ? 'Angemeldet als' : 'Signed in as'}</span><strong>{user.email}</strong></div>
          <div className="account-feature"><Check size={16} />{de ? 'Deine Routen und Versionen werden diesem Konto zugeordnet.' : 'Your routes and versions are linked to this account.'}</div>
          <button type="button" className="secondary-button account-submit" onClick={() => selectView('update-password')} disabled={pending}><LockKeyhole size={17} />{de ? 'Passwort festlegen oder ändern' : 'Set or change password'}</button>
          <button type="button" className="account-link account-signout" onClick={() => void signOut()} disabled={pending}><LogOut size={15} />{de ? 'Abmelden' : 'Sign out'}</button>
        </> : view === 'forgot-password' ? <>
          <p>{de ? 'Wir senden dir einen sicheren Link, mit dem du ein neues Passwort festlegen kannst.' : 'We will send you a secure link to set a new password.'}</p>
          <form className="account-form" onSubmit={(event) => void requestPasswordReset(event)}>
            <EmailField email={email} setEmail={setEmail} de={de} />
            <button className="primary-button account-submit" disabled={pending}>{pending ? (de ? 'Wird gesendet …' : 'Sending …') : (de ? 'Reset-Link senden' : 'Send reset link')}</button>
          </form>
          <button type="button" className="account-link" onClick={() => selectView('sign-in')}>{de ? 'Zurück zur Anmeldung' : 'Back to sign in'}</button>
        </> : view === 'update-password' ? <>
          <p>{de ? 'Verwende mindestens 8 Zeichen. Ein längerer, einzigartiger Satz ist am sichersten.' : 'Use at least 8 characters. A longer, unique phrase is safest.'}</p>
          <PasswordForm password={password} setPassword={setPassword} passwordConfirmation={passwordConfirmation} setPasswordConfirmation={setPasswordConfirmation} pending={pending} de={de} onSubmit={updatePassword} submitLabel={de ? 'Passwort speichern' : 'Save password'} />
          {user && <button type="button" className="account-link" onClick={() => selectView('sign-in')}>{de ? 'Zurück zum Konto' : 'Back to account'}</button>}
        </> : view === 'sign-up' ? <>
          <p>{de ? 'Erstelle dein Konto mit E-Mail und Passwort. Danach bestätigst du einmalig deine E-Mail.' : 'Create your account with email and password, then confirm your email once.'}</p>
          <form className="account-form" onSubmit={(event) => void signUp(event)}>
            <EmailField email={email} setEmail={setEmail} de={de} />
            <PasswordFields password={password} setPassword={setPassword} passwordConfirmation={passwordConfirmation} setPasswordConfirmation={setPasswordConfirmation} de={de} />
            <button className="primary-button account-submit" disabled={pending}>{pending ? (de ? 'Wird erstellt …' : 'Creating …') : (de ? 'Konto erstellen' : 'Create account')}</button>
          </form>
          <button type="button" className="account-link" onClick={() => selectView('sign-in')}>{de ? 'Bereits registriert? Anmelden' : 'Already registered? Sign in'}</button>
        </> : <>
          <p>{de ? 'Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.' : 'Sign in with your email address and password.'}</p>
          <form className="account-form" onSubmit={(event) => void signIn(event)}>
            <EmailField email={email} setEmail={setEmail} de={de} />
            <label><span>{de ? 'Passwort' : 'Password'}</span><div><LockKeyhole size={17} /><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
            <button className="primary-button account-submit" disabled={pending}>{pending ? (de ? 'Anmeldung läuft …' : 'Signing in …') : (de ? 'Anmelden' : 'Sign in')}</button>
          </form>
          <div className="account-links">
            <button type="button" className="account-link" onClick={() => selectView('forgot-password')}>{de ? 'Passwort vergessen?' : 'Forgot password?'}</button>
            <button type="button" className="account-link" onClick={() => selectView('sign-up')}>{de ? 'Konto erstellen' : 'Create account'}</button>
          </div>
          <small>{de ? 'Deine bisherigen anonymen Routen werden beim ersten Login automatisch übernommen.' : 'Your existing anonymous routes are transferred automatically on first sign-in.'}</small>
        </>}
        {notice && <div className={`account-message ${notice.tone === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">{notice.text}</div>}
      </section>
    </div>}
  </>
}

function EmailField({ email, setEmail, de }: { email: string; setEmail: (value: string) => void; de: boolean }) {
  return <label><span>{de ? 'E-Mail-Adresse' : 'Email address'}</span><div><Mail size={17} /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@beispiel.ch" /></div></label>
}

function PasswordFields({ password, setPassword, passwordConfirmation, setPasswordConfirmation, de }: { password: string; setPassword: (value: string) => void; passwordConfirmation: string; setPasswordConfirmation: (value: string) => void; de: boolean }) {
  return <>
    <label><span>{de ? 'Passwort' : 'Password'}</span><div><LockKeyhole size={17} /><input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
    <label><span>{de ? 'Passwort wiederholen' : 'Confirm password'}</span><div><LockKeyhole size={17} /><input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></div></label>
  </>
}

function PasswordForm({ password, setPassword, passwordConfirmation, setPasswordConfirmation, pending, de, onSubmit, submitLabel }: { password: string; setPassword: (value: string) => void; passwordConfirmation: string; setPasswordConfirmation: (value: string) => void; pending: boolean; de: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; submitLabel: string }) {
  return <form className="account-form" onSubmit={(event) => void onSubmit(event)}>
    <PasswordFields password={password} setPassword={setPassword} passwordConfirmation={passwordConfirmation} setPasswordConfirmation={setPasswordConfirmation} de={de} />
    <button className="primary-button account-submit" disabled={pending}>{pending ? (de ? 'Wird gespeichert …' : 'Saving …') : submitLabel}</button>
  </form>
}
