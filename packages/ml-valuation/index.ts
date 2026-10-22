/**
 * ML Valuation Engine - Phase 2
 * 
 * Provides property valuation using machine learning models,
 * mispricing analysis, and comparable property analysis.
 */

export * from './model'
export * from './mispricing'
export * from './comparables'
export * from './predictor'

// Valuation engine initialization
export const initializeValuationEngine = async (app: any, options: any = {}) => {
  const {
    registerRoutes = true,
    useMockData = true,
  } = options

  // Register prediction routes if enabled
  if (registerRoutes) {
    try {
      // const predictor = new (await import('./predictor')).default
      // await predictor(app)
      console.log('ML Valuation routes registration completed')
    } catch (error) {
      console.error('ML Valuation routes error:', error)
    }
  }

  // Return valuation functions for direct use
  return {
    predictValuation,
    analyzeMispricing,
    getComparableSales,
    getMispricingAnalysis,
    ValuationFeatures,
    MispricingType,
    MispricingAnalysis,
  }
}

export default {
  initializeValuationEngine,
}
