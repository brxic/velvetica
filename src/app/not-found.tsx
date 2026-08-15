import Link from 'next/link'

export default function NotFound() { return <main className="error-page"><p className="eyebrow">404</p><h1>Diese Route gibt es nicht.</h1><Link className="primary-button" href="/">Zum Routenplaner</Link></main> }
