/**
 * Comparable Property Analysis - Phase 2
 * 
 * Analyzes recently sold properties similar to the target property
 * to support valuation and mispricing analysis.
 */

import { ValuationFeatures } from './model'

// Comparable sale result
export interface ComparableSale {
  propertyId: number
  address: string
  salePrice: number
  pricePerSqFt: number
  saleDate: string
  propertyType: string
  bedrooms: number
  bathrooms: number
  areaSqFt: number
  location: string
  distanceKm: number // Distance from target property
  marketConditionAtSale: 'Buyer' | 'Seller' | 'Balanced'
}

// Get comparable sales for a property
export function getComparableSales(
  features: ValuationFeatures,
  targetPropertyId?: number,
  radiusKm: number = 5
): ComparableSale[] {
  const comparables: ComparableSale[] = []
  
  // Generate mock comparables based on property features
  const count = Math.floor(Math.random() * 5) + 3 // 3-7 comparables
  
  for (let i = 0; i < count; i++) {
    // Generate random but realistic comparable
    const randomDistance = Math.random() * radiusKm
    
    // Ensure at least some comparables are within 2km
    const distance = i < 2 ? Math.random() * 2 : Math.random() * radiusKm
    
    comparables.push({
      propertyId: Math.floor(Math.random() * 9000000) + 1000000,
      address: `${Math.floor(Math.random() * 100) + 1} Street, ${getRandomArea()}`,
      salePrice: Math.floor(
        features.area_sqft * (Math.random() * 8000 + 4000) / 10000 * 10000
      ),
      pricePerSqFt: Math.floor(
        (Math.random() * 8000 + 4000) * (0.9 + Math.random() * 0.2)
      ),
      saleDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      propertyType: features.property_type,
      bedrooms: features.bedrooms,
      bathrooms: features.bathrooms,
      areaSqFt: features.area_sqft,
      location: getRandomArea(),
      distanceKm: Math.round(distance * 10) / 10,
      marketConditionAtSale: 
        Math.random() > 0.7 ? 'Buyer' : 
        Math.random() > 0.5 ? 'Seller' : 'Balanced',
    })
  }
  
  // Sort by distance (closest first)
  comparables.sort((a, b) => a.distanceKm - b.distanceKm)
  
  return comparables
}

/**
 * Get random area name for mock data
 */
function getRandomArea(): string {
  const areas: string[] = [
    'Dubai Marina',
    'Palm Jumeirah',
    'Downtown Dubai',
    'Dubai Hills Estate',
    'Arabian Ranches',
    'Jumeirah Golf Estates',
    'Emirates Hills',
    'Business Bay',
    'DIFC',
    'Downtown',
  ]
  return areas[Math.floor(Math.random() * areas.length)]
}

/**
 * Get recent sales in a specific area
 * @param area - Area name
 * @param propertyType - Property type filter
 * @param monthsBack - How many months back to search
 */
export async function getRecentSalesByArea(
  area: string,
  propertyType?: string,
  monthsBack: number = 6
): Promise<ComparableSale[]> {
  // In production: query database for recent sales
  // For now: return mock data
  
  const count = Math.floor(Math.random() * 10) + 5 // 5-14 sales
  const sales: ComparableSale[] = []
  
  for (let i = 0; i < count; i++) {
    sales.push({
      propertyId: Math.floor(Math.random() * 9000000) + 1000000,
      address: `${Math.floor(Math.random() * 100) + 1} Street, ${area}`,
      salePrice: Math.floor(Math.random() * 5000000) + 1000000,
      pricePerSqFt: Math.floor(Math.random() * 8000) + 3000,
      saleDate: new Date(Date.now() - Math.random() * monthsBack * 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      propertyType: propertyType || getRandomPropertyType(),
      bedrooms: Math.floor(Math.random() * 5) + 1,
      bathrooms: Math.floor(Math.random() * 5) + 1,
      areaSqFt: Math.floor(Math.random() * 2000) + 500,
      location: area,
      distanceKm: 0, // Same area
      marketConditionAtSale: 
        Math.random() > 0.6 ? 'Buyer' : 
        Math.random() > 0.4 ? 'Seller' : 'Balanced',
    })
  }
  
  // Sort by sale date (most recent first)
  sales.sort((a, b) => (a.saleDate > b.saleDate ? -1 : a.saleDate < b.saleDate ? 1 : 0))
  
  return sales
}

/**
 * Get random property type
 */
function getRandomPropertyType(): string {
  const types: string[] = ['Apartment', 'Villa', 'Townhouse', 'Commercial', 'Land']
  return types[Math.floor(Math.random() * types.length)]
}

export { ComparableSale }
