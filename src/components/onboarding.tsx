'use client'

import { ChevronLeft, ChevronRight, MapPin, MousePointer2, Route, X } from 'lucide-react'
import { useState } from 'react'

const steps = [
  { icon: MapPin, title: 'Start setzen', text: 'Klicke auf die Karte oder nutze später die Ortssuche, um deinen Startpunkt zu wählen.' },
  { icon: Route, title: 'Tour beschreiben', text: 'Wähle Rundtour oder One-Way, Fahrradtyp und deine gewünschte Distanz.' },
  { icon: MousePointer2, title: 'Einfach anpassen', text: 'Prüfe den Vorschlag und verschiebe Wegpunkte, bis die Route genau zu dir passt.' },
]

export function Onboarding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0); const current = steps[step]; const Icon = current.icon
  return <div className="onboarding-backdrop" role="presentation">
    <section className="onboarding" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <button className="icon-button onboarding-close" onClick={onClose} aria-label="Anleitung schließen"><X size={20} /></button>
      <div className="onboarding-icon"><Icon size={28} /></div>
      <p className="eyebrow">Schritt {step + 1} von {steps.length}</p>
      <h2 id="guide-title">{current.title}</h2><p>{current.text}</p>
      <div className="onboarding-dots">{steps.map((_, index) => <span key={index} className={index === step ? 'is-active' : ''} />)}</div>
      <div className="onboarding-actions">
        <button className="text-button" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ChevronLeft size={18} /> Zurück</button>
        {step < steps.length - 1
          ? <button className="primary-button" onClick={() => setStep((value) => value + 1)}>Weiter <ChevronRight size={18} /></button>
          : <button className="primary-button" onClick={onClose}>Losfahren</button>}
      </div>
    </section>
  </div>
}

