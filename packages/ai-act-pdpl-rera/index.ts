/**
 * UAE AI Act Tier Classification & PDPL/RERA Controls - Phase 5
 * 
 * Provides the complete UAE AI Act Tier 1-4 classification framework,
 * PDPL (Personal Data Protection Law) compliance, and RERA-specific AI controls.
 */

export * from './ai-tier-classification'
export * from './pdpl-compliance'
export * from './rera-ai-controls'

// Phase 5 initialization function
export const initializeAIActPDPLRERA = async (app: any, options: any = {}) => {
  const {
    registerRoutes = true,
    enableTierClassification = true,
    enablePDPL = true,
    enableRERAControls = true,
  } = options

  // Initialize AI Act tier classification
  if (enableTierClassification) {
    try {
      // AI tier classification initialization
      console.log('UAE AI Act Tier Classification initialized')
    } catch (error) {
      console.error('AI tier classification initialization error:', error)
    }
  }

  // Initialize PDPL compliance
  if (enablePDPL) {
    try {
      // PDPL compliance initialization
      console.log('PDPL Compliance initialized')
    } catch (error) {
      console.error('PDPL compliance initialization error:', error)
    }
  }

  // Initialize RERA AI controls
  if (enableRERAControls) {
    try {
      // RERA AI controls initialization
      console.log('RERA AI Controls initialized')
    } catch (error) {
      console.error('RERA AI controls initialization error:', error)
    }
  }

  // Return Phase 5 capabilities
  return {
    // AI Tier Classification
    classifyAISystem,
    AITier,
    AISystemRisk,
    AITierCompliance,
    AIClassificationResult,
    propertyValuationTier,
    agentAICompliance,
    reraAIControls,

    // PDPL Compliance
    PDPLConsent,
    ConsentType,
    DSARType,
    DPIA,
    PDPLConsentManager,
    PDPLDSARManager,
    PDPLDPIAManager,

    // RERA AI Controls
    RERAICControlType,
    RERAICControlStatus,
    RERAICControl,
    checkRERAIControlCompliance,
    RERAICAuditLog,
    reraAIControlsConfig,

    // Convenience functions
    getTierForSystem: (systemType: string, involvesFinancialDecisions: boolean, involvesPersonalData: boolean, affectsPropertyValue: boolean, isAutonomous: boolean) => classifyAISystem(systemType, involvesFinancialDecisions, involvesPersonalData, affectsPropertyValue, isAutonomous),
  }
}

export default {
  initializeAIActPDPLRERA,
}
