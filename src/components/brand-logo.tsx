import Image from 'next/image'
import markLight from '../../velvetia-light.png'
import markDark from '../../velvetia-dark.png'

// The supplied full lockups have an opaque background. Keep the original assets
// intact and compose the transparent signet with the supplied brand typeface.
export function BrandLogo({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return <span className={`brand-lockup brand-lockup--${theme}`} aria-hidden="true"><Image className="brand-signet" src={theme === 'dark' ? markDark : markLight} alt="" priority /><span className="brand-wordmark">Velvetia</span></span>
}
