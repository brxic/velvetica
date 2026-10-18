'use client'

import { ChevronLeft, ChevronRight, MapPin, MousePointer2, Route, X } from 'lucide-react'
import { useState } from 'react'
import type { Locale } from '@/lib/domain'
import { AppDialog } from './ui/dialog'

const guides = {
  de: [
    { icon: MapPin, title: 'Start setzen', text: 'Klicke auf die Karte oder nutze die Ortssuche, um deinen Startpunkt zu wählen.' },
    { icon: Route, title: 'Route planen', text: 'Wähle deinen Fahrradtyp. Für eine Rundtour gibst du die Distanz an, für One-Way ein Ziel.' },
    { icon: MousePointer2, title: 'Verlauf ändern', text: 'Wähle «Route bearbeiten». Ziehe die Routenlinie an eine andere Stelle oder tippe sie an, um einen Zwischenpunkt zu setzen. Über «Wegpunkte» kannst du Orte auch suchen und ändern.' },
  ],
  en: [
    { icon: MapPin, title: 'Choose a start', text: 'Click the map or use place search to choose your starting point.' },
    { icon: Route, title: 'Plan a route', text: 'Choose your bike type. Set a distance for a round trip or a destination for a one-way ride.' },
    { icon: MousePointer2, title: 'Change the route', text: 'Choose “Edit route”. Drag the route line to another place or tap it to add a waypoint. Use “Waypoints” to find and change places without dragging.' },
  ],
}

export function Onboarding({ onClose, locale }: { onClose: () => void; locale: Locale }) {
  const [step, setStep] = useState(0); const steps = guides[locale]; const current = steps[step]; const Icon = current.icon
  return <AppDialog open onOpenChange={(open) => { if (!open) onClose() }} label={current.title} className="onboarding">
      <button className="icon-button onboarding-close" onClick={onClose} aria-label={locale === 'de' ? 'Anleitung schliessen' : 'Close guide'}><X size={20} /></button>
      <div className="onboarding-icon"><Icon size={28} /></div>
      <p className="eyebrow">{locale === 'de' ? `Schritt ${step + 1} von ${steps.length}` : `Step ${step + 1} of ${steps.length}`}</p>
      <h2 id="guide-title">{current.title}</h2><p>{current.text}</p>
      <div className="onboarding-dots">{steps.map((_, index) => <span key={index} className={index === step ? 'is-active' : ''} />)}</div>
      <div className="onboarding-actions">
        <button className="text-button" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ChevronLeft size={18} /> {locale === 'de' ? 'Zurück' : 'Back'}</button>
        {step < steps.length - 1
          ? <button className="primary-button" onClick={() => setStep((value) => value + 1)}>{locale === 'de' ? 'Weiter' : 'Next'} <ChevronRight size={18} /></button>
          : <button className="primary-button" onClick={onClose}>{locale === 'de' ? 'Zur Karte' : 'Go to map'}</button>}
      </div>
  </AppDialog>
}
