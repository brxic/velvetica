'use client'

import { ChevronLeft, ChevronRight, MapPin, MousePointer2, Route, X } from 'lucide-react'
import { useState } from 'react'
import type { Locale } from '@/lib/domain'

const guides = {
  de: [
    { icon: MapPin, title: 'Start setzen', text: 'Klicke auf die Karte oder nutze die Ortssuche, um deinen Startpunkt zu wählen.' },
    { icon: Route, title: 'Tour beschreiben', text: 'Wähle Rundtour oder One-Way, Fahrradtyp und deine gewünschte Distanz.' },
    { icon: MousePointer2, title: 'Einfach anpassen', text: 'Prüfe den Vorschlag und verschiebe Wegpunkte, bis die Route genau zu dir passt.' },
  ],
  en: [
    { icon: MapPin, title: 'Choose a start', text: 'Click the map or use place search to choose your starting point.' },
    { icon: Route, title: 'Describe your ride', text: 'Choose round trip or one-way, your bike type and preferred distance.' },
    { icon: MousePointer2, title: 'Adjust with ease', text: 'Review the suggestion and move waypoints until the route fits you.' },
  ],
}

export function Onboarding({ onClose, locale }: { onClose: () => void; locale: Locale }) {
  const [step, setStep] = useState(0); const steps = guides[locale]; const current = steps[step]; const Icon = current.icon
  return <div className="onboarding-backdrop" role="presentation">
    <section className="onboarding" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <button className="icon-button onboarding-close" onClick={onClose} aria-label={locale === 'de' ? 'Anleitung schließen' : 'Close guide'}><X size={20} /></button>
      <div className="onboarding-icon"><Icon size={28} /></div>
      <p className="eyebrow">{locale === 'de' ? `Schritt ${step + 1} von ${steps.length}` : `Step ${step + 1} of ${steps.length}`}</p>
      <h2 id="guide-title">{current.title}</h2><p>{current.text}</p>
      <div className="onboarding-dots">{steps.map((_, index) => <span key={index} className={index === step ? 'is-active' : ''} />)}</div>
      <div className="onboarding-actions">
        <button className="text-button" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ChevronLeft size={18} /> {locale === 'de' ? 'Zurück' : 'Back'}</button>
        {step < steps.length - 1
          ? <button className="primary-button" onClick={() => setStep((value) => value + 1)}>{locale === 'de' ? 'Weiter' : 'Next'} <ChevronRight size={18} /></button>
          : <button className="primary-button" onClick={onClose}>{locale === 'de' ? 'Losfahren' : 'Start riding'}</button>}
      </div>
    </section>
  </div>
}
