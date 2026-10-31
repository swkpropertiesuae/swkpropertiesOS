import { COMMUNITIES, DEVELOPERS, RERA_FORMS } from '../swk/uae'

/**
 * Official SWK Properties OS Brand Assets & High-Resolution Media Registry
 * 100% consistent with the SWK OS "Midnight & Champagne" design language:
 * - Midnight Navy: #08142a / #0b1a33
 * - Royal Navy:    #14305c / #1b3a6b
 * - Champagne Gold:#c9a96e / #dcc8a2 / #f1e3c2
 * - Warm Sand:     #f6f2ea / #fbf8f2
 * - Oasis Emerald: #1f7a7a / #1f9d6b
 * - Dune Signal:   #c4492f
 */
export const SWK_BRAND = {
  logoWhite: '/brand/logos/dark/swk-properties-640.png',
  logoInk: '/brand/logos/light/swk-properties-640.png',
  logoDark: '/brand/logos/dark/swk-properties-640.png',
  logoGold: '/brand/masters/swk-primary.png',
  skylineFront: '/brand/skyline-front.svg',
  skylineBack: '/brand/skyline-back.svg',
  heroDubai: '/media/hero/dubai-skyline-hero.webp',
  appIcon512: '/brand/app-icons/android-chrome-512x512.png',
  appIcon192: '/brand/app-icons/android-chrome-192x192.png',
} as const

export const SWK_PROPERTY_PHOTOS = [
  '/media/properties/marina-sky-penthouse-1.webp',
  '/media/properties/hills-estate-golf-mansion-1.webp',
  '/media/properties/palm-garden-homes-1.webp',
  '/media/properties/creek-harbour-waterside-townhouse-1.webp',
  '/media/properties/business-bay-executive-tower-2.webp',
  '/media/properties/arabian-ranches-courtyard-villa-2.webp',
  '/media/properties/villa-sanctuary-6.webp',
  '/media/properties/river-cove-residences-1.webp',
  '/media/properties/jvc-boulevard-residences-2.webp',
  '/media/properties/golf-fields-1.webp',
  '/media/properties/islands-2-1.webp',
  '/media/properties/raw-district-2-3.webp',
] as const

/**
 * Resolves the highest-quality matching SWK property photograph based on title, building, or index.
 */
export function resolvePropertyPhoto(titleOrBuilding?: string | null, fallbackIndex = 0): string {
  const s = (titleOrBuilding || '').toLowerCase()
  if (s.includes('marina')) return '/media/properties/marina-sky-penthouse-1.webp'
  if (s.includes('hills') || s.includes('golf')) return '/media/properties/hills-estate-golf-mansion-1.webp'
  if (s.includes('palm')) return '/media/properties/palm-garden-homes-1.webp'
  if (s.includes('creek') || s.includes('harbour')) return '/media/properties/creek-harbour-waterside-townhouse-1.webp'
  if (s.includes('business bay') || s.includes('downtown') || s.includes('burj') || s.includes('executive')) {
    return '/media/properties/business-bay-executive-tower-2.webp'
  }
  if (s.includes('arabian') || s.includes('ranches') || s.includes('courtyard')) {
    return '/media/properties/arabian-ranches-courtyard-villa-2.webp'
  }
  if (s.includes('jvc') || s.includes('boulevard') || s.includes('village')) {
    return '/media/properties/jvc-boulevard-residences-2.webp'
  }
  if (s.includes('villa') || s.includes('sanctuary')) return '/media/properties/villa-sanctuary-6.webp'
  if (s.includes('island')) return '/media/properties/islands-2-1.webp'
  if (s.includes('river') || s.includes('cove')) return '/media/properties/river-cove-residences-1.webp'
  return SWK_PROPERTY_PHOTOS[Math.abs(fallbackIndex) % SWK_PROPERTY_PHOTOS.length]!
}

/**
 * Resolves community metadata & high-resolution community photography from SWK OS.
 */
export function resolveCommunityMedia(text?: string | null, fallbackIndex = 0) {
  const s = (text || '').toLowerCase()
  const match = COMMUNITIES.find(
    c => s.includes(c.name.toLowerCase()) || s.includes(c.id.replace(/-/g, ' '))
  )
  return match || COMMUNITIES[Math.abs(fallbackIndex) % COMMUNITIES.length]!
}

/**
 * Resolves official UAE Developer partner logo from `/media/developers/logo-*.png`
 */
export function resolveDeveloperBrand(text?: string | null, fallbackIndex = 0) {
  const s = (text || '').toLowerCase()
  const match = DEVELOPERS.find(d => s.includes(d.name.split(' ')[0]!.toLowerCase()))
  return match || DEVELOPERS[Math.abs(fallbackIndex) % DEVELOPERS.length]!
}

export { COMMUNITIES, DEVELOPERS, RERA_FORMS }
