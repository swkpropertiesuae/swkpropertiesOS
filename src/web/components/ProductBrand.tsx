export function ProductBrand({ compact = false }: { compact?: boolean }) {
  return (
    <a href="https://www.swk.properties" target="_blank" rel="noopener noreferrer"
      className={compact ? 'product-brand product-brand-compact' : 'product-brand'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 8 : 10,
        padding: compact ? '4px 10px 4px 6px' : '6px 14px 6px 8px',
        borderRadius: 10,
        background: 'linear-gradient(135deg, #061022 0%, #0b1a33 100%)',
        border: '1px solid rgba(201,169,110,.42)',
        color: '#f6f2ea',
        textDecoration: 'none',
      }}
      aria-label="SWK Properties LLC · Business Workspace">
      <img src="/brand/swk-os/portal-arch-emblem-transparent.png" alt="" width={compact ? 28 : 34} height={compact ? 28 : 34} style={{ height: compact ? 28 : 34, width: compact ? 28 : 34, objectFit: 'contain' }} />
      <img src="/brand/swk-os/primary-logo-transparent.png" alt="SWK OS" width={compact ? 84 : 104} height={compact ? 36 : 44} style={{ height: compact ? 26 : 32, width: 'auto', objectFit: 'contain' }} />
      <span className="swk-os-badge">{compact ? 'OS' : 'SWK Properties LLC'}</span>
    </a>
  )
}
