import { Check, Coffee, Droplets, ShoppingBasket } from 'lucide-react'
import type { Locale } from '@/lib/domain'
import { supplyLabels, type SupplyCategory } from '@/lib/supply'

const categories = ['water', 'food', 'shop'] as const
const icons = { water: Droplets, food: Coffee, shop: ShoppingBasket }

export function SupplyCategoryPicker({ locale, selected, onToggle }: { locale: Locale; selected: SupplyCategory[]; onToggle: (category: SupplyCategory) => void }) {
  return <div className="supply-category-picker" role="group" aria-label={locale === 'de' ? 'Verpflegungskategorien' : 'Supply categories'}>{categories.map((category) => {
    const Icon = icons[category], checked = selected.includes(category)
    return <button type="button" key={category} aria-label={supplyLabels[locale][category]} aria-pressed={checked} onClick={() => onToggle(category)}><Icon size={18} aria-hidden="true" /><span>{supplyLabels[locale][category]}</span><span className="supply-category-check" aria-hidden="true">{checked && <Check size={13} />}</span></button>
  })}</div>
}
