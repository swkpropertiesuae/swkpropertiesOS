/**
 * Mispricing Explorer - Phase 2
 * 
 * Identifies properties that are over-valued or under-valued compared to ML predictions.
 * Helps agents and investors find mispriced opportunities in the market.
 */

import { ValuationFeatures, ValuationResult } from './model'

// Mispricing classification
export enum MispricingType {
  UNDER_VALUED = 'Under Valued',
  FAIRLY_PRICED = 'Fairly Priced',
  OVER_VALUED = 'Over Valued',
  UNKNOWN = 'Unknown'
}

// Mispricing analysis result
export interface MispricingAnalysis {
  propertyId: number
  listedPrice: number
  mlValuation: number
  priceDifference: number // AED (listed - estimated)
  priceDifferencePct: number // Percentage
  mispricingType: MispricingType
  confidence: number // 0-100
  investmentOpportunity: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Avoid'
  recommendedAction: string
  risk assessment: 'Low' | 'Medium' | 'High'
}

/**
 * Analyze if a property is mispriced
 * @param listedPrice - The price the property is listed at
 * @param features - Property features for ML valuation
 * @param estimatedPrice - The ML-estimated price (optional, will be computed if not provided)
 * @returns Mispricing analysis
 */
export function analyzeMispricing(
  listedPrice: number,
  features: ValuationFeatures,
  estimatedPrice?: number
): MispricingAnalysis {
  // Compute ML valuation if not provided
  const mlResult = estimatedPrice 
    ? { ...{ estimatedPrice }, ...computeMockValuation(features) }
    : predictValuation(features)
  
  const estimatedPriceVal = estimatedPrice || mlResult.estimatedPrice
  const priceDifference = listedPrice - estimatedPriceVal
  const priceDifferencePct = (priceDifference / estimatedPriceVal) * 100
  
  // Classify mispricing type
  let mispricingType: MispricingType
  let investmentOpportunity: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Avoid'
  let recommendedAction: string
  let riskAssessment: 'Low' | 'Medium' | 'High'
  
  if (Math.abs(priceDifferencePct) < 5) {
    // Within 5% = fairly priced
    mispricingType = MispricingType.FAIRLY_PRICED
    investmentOpportunity = 'Hold'
    recommendedAction = 'Property is fairly priced. Monitor for market changes.'
    riskAssessment = 'Low'
  } else if (priceDifferencePct < -5) {
    // Listed price is significantly below ML valuation = Under valued
    mispricingType = MispricingType.UNDER_VALUED
    
    if (priceDifferencePct < -20) {
      investmentOpportunity = 'Strong Buy'
      recommendedAction = 'Significant under-pricing. High potential for quick sale at market price. Immediate action recommended.'
      riskAssessment = 'Low'
    } else {
      investmentOpportunity = 'Buy'
      recommendedAction = 'Mildly under-priced. Good investment opportunity. Consider market before acting.'
      riskAssessment = 'Low'
    }
  } else {
    // Listed price is significantly above ML valuation = Over valued
    mispricingType = MispricingType.OVER_VALUED
    
    if (priceDifferencePct > 20) {
      investmentOpportunity = 'Sell'
      recommendedAction = 'Significantly over-priced. Difficult to sell at asking price. Consider price reduction.'
      riskAssessment = 'Medium'
    } else {
      investmentOpportunity = 'Avoid'
      recommendedAction = 'Mildly over-priced. May deter buyers. Consider modest price adjustment.'
      riskAssessment = 'Low'
    }
  }
  
  return {
    propertyId: 0, // Will be set by caller
    listedPrice,
    mlValuation: estimatedPriceVal,
    priceDifference,
    priceDifferencePct: Math.round(priceDifferencePct * 100) / 100, // 2 decimal places
    mispricingType,
    confidence: Math.round(mlResult.confidence_score),
    investmentOpportunity,
    recommendedAction,
    riskAssessment,
  }
}

/**
 * Compute mock valuation for mispricing analysis
 * (Used when estimatedPrice is not provided directly)
 */
function computeMockValuation(features: ValuationFeatures) {
  const basePricePerSqft = calculateBasePricePerSqft(features)
  const estimatedPrice = Math.round(features.area_sqft * basePricePerSqft)
  const pricePerSqft = Math.round(basePricePerSqft)
  const confidence = Math.min(75 + Math.random() * 20, 90) // 75-90% for mock
  
  return {
    estimatedPrice,
    pricePerSqft,
    confidence_score: confidence,
  }
}

/**
 * Get mispricing analysis for a property in the database
 * @param propertyId - Property database ID
 * @returns Mispricing analysis or null if not found
 */
export async function getMispricingAnalysis(propertyId: number): Promise<MispricingAnalysis | null> {
  // In production: query database for property and its listing price
  // For now: return null (integration pending)
  
  // Mock: would need listing price from database
  // const listingPrice = await db.property.findPrice(propertyId)
  // if (!listingPrice) return null
  
  // const features = await db.property.getFeatures(propertyId)
  // if (!listingPrice || !features) return null
  
  // return analyzeMispricing(listingPrice, features)
  
  return null // Integration pending
}

// Export types for external use
export type { MispricingAnalysis, MispricingType }
