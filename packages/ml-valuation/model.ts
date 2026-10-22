/**
 * ML Valuation Model Interface
 * 
 * Interface for the uae_realestate_ml_model that provides property valuations.
 * In production, this would connect to a trained TensorFlow/PyTorch model.
 * Currently provides a framework with mock predictions.
 */

// Property features for valuation model
export interface ValuationFeatures {
  property_type: 'Apartment' | 'Villa' | 'Townhouse' | 'Commercial' | 'Land'
  bedrooms: number
  bathrooms: number
  area_sqft: number
  area_sqm: number
  floor: number | null
  total_floors: number | null
  tenure: 'Freehold' | 'Leasehold' | 'Usufruct'
  age_years: number // Years since build
  location_score: number // 0-100 based on location metrics
  proximity_marina: number // 0-10 proximity to marina
  proximity_mall: number // 0-10 proximity to mall
  proximity_school: number // 0-10 proximity to school
  view_score: number // 0-10 ( sea view, city view, etc.)
  furnishing: 'Unfurnished' | 'Semi-Furnished' | 'Fully Furnished'
  building_age: number // Years since construction
  floor_level: 'Ground' | 'Middle' | 'Top' | 'Penthouse'
  has_balcony: boolean
  has_parking: boolean
  has_storage: boolean
  renovation_status: 'None' | 'Cosmetic' | 'Renovated' | 'Luxury Renovation'
}

// Valuation result interface
export interface ValuationResult {
  property_id: number
  estimated_price: number
  price_per_sqft: number
  confidence_score: number // 0-100, higher = more confident
  valuation_date: string
  valuation_method: 'ML Model' | 'Comparable' | 'Hybrid'
  comparable_sales: Array<{
    property_id: number
    sale_price: number
    sale_date: string
    price_per_sqft: number
    distance_km: number
  }>
  adjustments: Array<{
    feature: string
    adjustment: number // in AED
    rationale: string
  }>
  risk_factors: Array<{
    factor: string
    impact: 'Positive' | 'Negative' | 'Neutral'
    severity: 'Low' | 'Medium' | 'High'
  }>
  model_version: string
  last_trained: string
}

/**
 * Predict property valuation using ML model
 * @param features - Property features
 * @returns Valuation result
 */
export async function predictValuation(features: ValuationFeatures): Promise<ValuationResult> {
  // Calculate base price using simplified formula
  // In production: call trained ML model
  
  const basePricePerSqft = calculateBasePricePerSqft(features)
  const estimatedPrice = Math.round(features.area_sqft * basePricePerSqft)
  const pricePerSqft = Math.round(basePricePerSqft)
  
  // Confidence score based on feature completeness and location
  let confidence = 70 // Base confidence
  
  if (features.location_score > 80) confidence += 15
  if (features.renovation_status === 'Renovated' || features.renovation_status === 'Luxury Renovation') confidence += 10
  if (features.bathrooms >= 2 && features.bedrooms >= 2) confidence += 5
  if (features.view_score >= 8) confidence += 8
  if (features.has_parking && features.has_storage) confidence += 5
  
  confidence = Math.min(confidence, 95) // Cap at 95
  
  // Get comparable sales (mock data in production would query database)
  const comparableSales = getMockComparableSales(features)
  
  // Calculate adjustments
  const adjustments = calculateAdjustments(features)
  
  // Risk factors
  const riskFactors = calculateRiskFactors(features)
  
  return {
    property_id: 0, // Will be set by caller
    estimated_price,
    price_per_sqft,
    confidence_score: confidence,
    valuation_date: new Date().toISOString(),
    valuation_method: 'ML Model',
    comparable_sales,
    adjustments,
    risk_factors,
    model_version: 'uae_realestate_ml_v1.2',
    last_trained: '2024-06-01',
  }
}

/**
 * Calculate base price per square foot based on property characteristics
 */
function calculateBasePricePerSqft(features: ValuationFeatures): number {
  // Base prices by property type (AED per sqft)
  const basePrices: Record<string, number> = {
    Apartment: 5000,
    Villa: 8000,
    Townhouse: 6500,
    Commercial: 12000,
    Land: 3000,
  }
  
  let base = basePrices[features.property_type] || 5000
  
  // Adjust for bedrooms
  const bedroomMultiplier = [1, 1, 1.2, 1.4, 1.6][Math.min(features.bedrooms - 1, 4)]
  base *= bedroomMultiplier
  
  // Adjust for bathrooms
  const bathroomMultiplier = [1, 1.1, 1.2, 1.35, 1.5][Math.min(features.bathrooms - 1, 4)]
  base *= bathroomMultiplier
  
  // Adjust for age (older = lower price)
  const ageAdjustment = features.age_years > 0 
    ? Math.max(0.5, 1 - (features.age_years * 0.03)) 
    : 1
  base *= ageAdjustment
  
  // Adjust for location score (0-100)
  const locationFactor = 1 + ((features.location_score - 50) * 0.005) // -25% to +25%
  base *= locationFactor
  
  // Adjust for tenure
  const tenureFactor = features.tenure === 'Freehold' ? 1 : features.tenure === 'Leasehold' ? 0.95 : 0.9
  base *= tenureFactor
  
  // Adjust for floor level
  const floorFactors: Record<string, number> = {
    Ground: 0.95,
    Middle: 1,
    Top: 1.1,
    Penthouse: 1.3,
  }
  base *= floorFactors[features.floor_level] || 1
  
  // Adjust for furnishing
  const furnishingFactors: Record<string, number> = {
    Unfurnished: 0.95,
    Semi_Furnished: 1,
    Fully_Furnished: 1.1,
  }
  base *= furnishingFactors[features.furnishing] || 1
  
  // Adjust for balcony
  if (features.has_balcony) base *= 1.05
  
  // Adjust for parking
  if (features.has_parking) base *= 1.03
  
  // Adjust for storage
  if (features.has_storage) base *= 1.02
  
  return Math.round(base * 100) / 100 // Round to 2 decimal places
}

/**
 * Get mock comparable sales (in production: query from database)
 */
function getMockComparableSales(features: ValuationFeatures) {
  const propertyType = features.property_type
  const area = features.area_sqft
  
  // Generate 3-5 mock comparables
  const count = Math.floor(Math.random() * 3) + 3
  const comparables = []
  
  for (let i = 0; i < count; i++) {
    const salePrice = Math.floor(
      (area / 1000) * (Math.random() * 8000 + 4000) // Price based on area
    )
    
    comparables.push({
      property_id: Math.floor(Math.random() * 9000000) + 1000000,
      sale_price: salePrice,
      sale_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      price_per_sqft: Math.floor(salePrice / (area / 10000)),
      distance_km: Math.random() * 10, // 0-10km
    })
  }
  
  return comparables
}

/**
 * Calculate feature adjustments (value add/subtract in AED)
 */
function calculateAdjustments(features: ValuationFeatures) {
  const adjustments: Array<{ feature: string; adjustment: number; rationale: string }> = []
  
  // Renovated property premium
  if (features.renovation_status === 'Renovated') {
    const adj = Math.round(features.area_sqft * 2000) // 2000 AED per sqft renovation premium
    adjustments.push({
      feature: 'Renovation status',
      adjustment: adj,
      rationale: 'Recent renovation adds significant value',
    })
  }
  
  // Penthouse premium
  if (features.floor_level === 'Penthouse') {
    const adj = Math.round(features.area_sqft * 3000)
    adjustments.push({
      feature: 'Penthouse floor level',
      adjustment: adj,
      rationale: 'Premium penthouse location command premium pricing',
    })
  }
  
  // Balcony addition
  if (features.has_balcony) {
    const adj = Math.round(features.area_sqft * 500)
    adjustments.push({
      feature: 'Balcony',
      adjustment: adj,
      rationale: 'Balcony adds outdoor living space value',
    })
  }
  
  // Parking space
  if (features.has_parking) {
    const adj = 50000 // Fixed value for parking space
    adjustments.push({
      feature: 'Parking space',
      adjustment: adj,
      rationale: 'Covered parking space adds value',
    })
  }
  
  // Storage room
  if (features.has_storage) {
    const adj = 30000 // Fixed value
    adjustments.push({
      feature: 'Storage room',
      adjustment: adj,
      rationale: 'Additional storage space',
    })
  }
  
  // Sea view premium
  if (features.view_score >= 8) {
    const adj = Math.round(features.area_sqft * 1500)
    adjustments.push({
      feature: 'High view score',
      adjustment: adj,
      rationale: 'Sea/city view premium',
    })
  }
  
  return adjustments
}

/**
 * Calculate risk factors for the valuation
 */
function calculateRiskFactors(features: ValuationFeatures) {
  const riskFactors: Array<{ factor: string; impact: 'Positive' | 'Negative' | 'Neutral'; severity: 'Low' | 'Medium' | 'High' }> = []
  
  // Age of property
  if (features.age_years > 20) {
    riskFactors.push({
      factor: 'Property age',
      impact: 'Negative',
      severity: features.age_years > 30 ? 'High' : 'Medium',
    })
  }
  
  // Low location score
  if (features.location_score < 40) {
    riskFactors.push({
      factor: 'Location score',
      impact: 'Negative',
      severity: 'High',
    })
  }
  
  // Low floor level
  if (features.floor_level === 'Ground' && !features.has_balcony) {
    riskFactors.push({
      factor: 'Ground floor without balcony',
      impact: 'Negative',
      severity: 'Medium',
    })
  }
  
  // Unfurnished (if comparing furnished market)
  if (features.furnishing === 'Unfurnished' && features.location_score < 50) {
    riskFactors.push({
      factor: 'Unfurnished property in average location',
      impact: 'Negative',
      severity: 'Low',
    })
  }
  
  // No parking
  if (!features.has_parking) {
    riskFactors.push({
      factor: 'No dedicated parking',
      impact: 'Negative',
      severity: 'Medium',
    })
  }
  
  return riskFactors
}

export { ValuationFeatures, ValuationResult }
