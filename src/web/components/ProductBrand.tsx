export function ProductBrand({ compact = false }: { compact?: boolean }) {
  return (
    <a href="https://swkpropertiesuae.com" target="_blank" rel="noopener noreferrer"
      className={compact ? 'product-brand product-brand-compact' : 'product-brand'}
      aria-label="Brand partner · SWK OS">
      {compact
        ? <><span>Brand partner</span><img src="/brand/SWK OS-wordmark.webp" alt="SWK OS" width="120" height="23" /></>
        : <><span>Brand partner ·</span><img src="/brand/SWK OS-wordmark.webp" alt="SWK OS" width="132" height="25" /></>}
    </a>
  )
}
