'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-page"><p className="eyebrow">Velvetia</p><h1>Das hat nicht geklappt.</h1><p>Bitte versuche es noch einmal.</p><button className="primary-button" onClick={reset}>Erneut versuchen</button></main>
}

