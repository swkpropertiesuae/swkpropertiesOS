export function ProductBrand({ compact = false }: { compact?: boolean }) {
  return (
    <a href="https://digitalburj.com/business-os" target="_blank" rel="noopener noreferrer"
      className={compact ? 'product-brand product-brand-compact' : 'product-brand'}
      aria-label="Brand partner · DigitalBurj Business OS">
      {compact
        ? <><span>Brand partner</span><img src="/brand/digitalburj-wordmark.webp" alt="DigitalBurj Business OS" width="120" height="23" /></>
        : <><span>Brand partner ·</span><img src="/brand/digitalburj-wordmark.webp" alt="DigitalBurj Business OS" width="132" height="25" /></>}
    </a>
  )
}
