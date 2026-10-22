/**
 * UAE AI Act Tier Classification - Phase 5
 * 
 * Provides the official UAE AI Act Tier 1-4 classification framework with
 * compliance obligations for each tier. Based on the UAE AI Regulation
 * Office guidelines and international best practices.
 */

// AI Act Tier levels
export enum AITier {
  TIER_1 = 1, // Minimal risk
  TIER_2 = 2, // Limited risk
  TIER_3 = 3, // High risk
  TIER_4 = 4, // Unacceptable risk
}

// AI System risk classification
export enum AISystemRisk {
  MINIMAL = 'Minimal',
  LIMITED = 'Limited',
  HIGH = 'High',
  UNACCEPTABLE = 'Unacceptable',
}

// Tier compliance obligations
export interface AITierCompliance {
  tier: AITier
  tierName: string
  description: string
  obligations: string[]
  monitoringRequirements: string[]
  reportingFrequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annually'
  penalties: {
    maxFine: number // in AED
    violationType: string
  }
}

// AI System classification result
export interface AIClassificationResult {
  systemId: string
  systemName: string
  tier: AITier
  riskLevel: AISystemRisk
  compliance: AITierCompliance
  classificationDate: string
  classifiedBy: string
  validUntil: string
  conditions: string[]
}

// UAE AI Act Tier definitions
export const aitTierDefinitions: Record<AITier, AITierCompliance> = {
  [AITier.TIER_1]: {
    tier: AITier.TIER_1,
    tierName: 'Minimal Risk',
    description: 'AI systems with minimal risk to health, safety, or fundamental rights',
    obligations: [
      'Basic transparency: inform users they are interacting with AI',
      'Label AI-generated content',
      'Maintain simple documentation',
    ],
    monitoringRequirements: [
      'Annual review of AI system performance',
      'User feedback collection',
    ],
    reportingFrequency: 'Annually',
    penalties: {
      maxFine: 50000,
      violationType: 'Failure to provide basic transparency',
    },
  },
  [AITier.TIER_2]: {
    tier: AITier.TIER_2,
    tierName: 'Limited Risk',
    description: 'AI systems with limited risk requiring some oversight',
    obligations: [
      'Transparency: inform users about AI capabilities and limitations',
      'Human oversight: implement human-in-the-loop for critical decisions',
      'Data governance: ensure training data quality and bias mitigation',
      'Documentation: maintain detailed system documentation',
    ],
    monitoringRequirements: [
      'Quarterly performance monitoring',
      'Bias audits every 6 months',
      'User complaint tracking',
    ],
    reportingFrequency: 'Quarterly',
    penalties: {
      maxFine: 150000,
      violationType: 'Failure to implement human oversight',
    },
  },
  [AITier.TIER_3]: {
    tier: AITier.TIER_3,
    tierName: 'High Risk',
    description: 'AI systems making significant decisions affecting property, finance, or employment',
    obligations: [
      'Pre-deployment conformity assessment: mandatory before launch',
      'High-quality data: ensure training data is representative and bias-free',
      'Documentation: comprehensive technical and ethical documentation',
      'Human oversight: mandatory human review of all significant decisions',
      'Robustness and security: ensure system resilience against attacks',
      'Traceability: log all decisions and outputs for audit',
      'Information provision: inform users about AI system nature',
    ],
    monitoringRequirements: [
      'Monthly performance monitoring',
      'Quarterly bias and fairness audits',
      'Incident reporting within 24 hours of detection',
      'Annual full conformity assessment',
    ],
    reportingFrequency: 'Monthly',
    penalties: {
      maxFine: 500000,
      violationType: 'Failure to conduct pre-deployment assessment',
    },
  },
  [AITier.TIER_4]: {
    tier: AITier.TIER_4,
    tierName: 'Unacceptable Risk',
    description: 'AI systems prohibited or heavily restricted per UAE AI Act',
    obligations: [
      'Prohibition compliance: ensure system does not fall in prohibited categories',
      'Immediate cessation: halt prohibited AI system operations',
      'Risk mitigation: implement controls for borderline cases',
      'Legal compliance: full compliance with all prohibitions and restrictions',
    ],
    monitoringRequirements: [
      'Immediate action on prohibition alerts',
      'Weekly compliance reviews until resolved',
      'Legal consultation for borderline cases',
    ],
    reportingFrequency: 'Weekly',
    penalties: {
      maxFine: 1000000,
      violationType: 'Operation of prohibited AI system',
    },
  },
}

// Property valuation AI classification (from earlier phases)
export const propertyValuationTier: AITierCompliance = {
  tier: AITier.TIER_3,
  tierName: 'High Risk',
  description: 'Property valuation AI systems determining market values affecting financial decisions',
  obligations: [
    'Pre-deployment conformity assessment: mandatory before launch',
    'High-quality data: ensure training data represents UAE property market',
    'Human oversight: mandatory human review of all valuation outputs',
    'Robustness and security: protect against valuation manipulation',
    'Traceability: log all valuations with inputs and outputs',
    'Information provision: inform clients AI is used for valuation',
    'Fair value assurance: prevent systematic undervaluation or overvaluation',
  ],
  monitoringRequirements: [
    'Monthly performance monitoring',
    'Quarterly bias and fairness audits',
    'Incident reporting within 24 hours of detection',
    'Annual full conformity assessment',
    'Client feedback collection and analysis',
  ],
  reportingFrequency: 'Monthly',
  penalties: {
    maxFine: 500000,
    violationType: 'Failure to conduct pre-deployment assessment',
  },
}

// Real estate agent AI classification
export const agentAICompliance: AITierCompliance = {
  tier: AITier.TIER_2,
  tierName: 'Limited Risk',
  description: 'AI assistance for real estate agents (valuation aids, market analysis)',
  obligations: [
    'Transparency: inform clients AI is assisting (not replacing) agent',
    'Human oversight: agent must review and approve AI recommendations',
    'Data governance: ensure training data is current and representative',
    'Documentation: maintain records of AI assistance in deal files',
    'No autonomous decision-making: AI cannot finalize deals or contracts',
  ],
  monitoringRequirements: [
    'Quarterly performance monitoring',
    'Bias audits every 6 months',
    'User complaint tracking',
  ],
  reportingFrequency: 'Quarterly',
  penalties: {
    maxFine: 150000,
    violationType: 'Failure to implement human oversight',
  },
}

// RERA AI control requirements
export const reraAIControls: Record<string, any> = {
  mandatoryDisclosure: {
    enabled: true,
    requirements: [
      'Agent must disclose AI-assisted valuation to all clients',
      'Clear labeling of AI-generated property recommendations',
      'Documentation of AI role in deal files',
    ],
  },
  agentCompetency: {
    enabled: true,
    requirements: [
      'Agents must complete AI literacy training (minimum 4 hours)',
      'Regular updates on AI capabilities and limitations',
      'Competency assessment annually',
    ],
  },
  dataProtection: {
    enabled: true,
    requirements: [
      'Client data must be pseudonymized when used for AI training',
      'Explicit consent required for AI-assisted analysis',
      'Data retention policy: maximum 2 years for AI training data',
    ],
  },
  pricingIntegrity: {
    enabled: true,
    requirements: [
      'AI valuation must include disclaimer: "AI estimate, subject to market verification"',
      'Human agent must take responsibility for final valuation',
      'No AI system may set final sale/rental prices autonomously',
    ],
  },
}

// AI system classification function
export function classifyAISystem(
  systemType: string,
  involvesFinancialDecisions: boolean,
  involvesPersonalData: boolean,
  affectsPropertyValue: boolean,
  isAutonomous: boolean
): AIClassificationResult {
  let tier: AITier
  let riskLevel: AISystemRisk
  const obligations = [...(aitTierDefinitions[AITier.TIER_1].obligations)]
  let monitoringFreq = 'Annually'
  let maxFine = 50000
  let violationType = ''

  // Determine tier based on system characteristics
  if (isAutonomous && involvesFinancialDecisions) {
    tier = AITier.TIER_4
    riskLevel = AISystemRisk.UNACCEPTABLE
    obligations.length = 0
    obligations.push(...aitTierDefinitions[AITier.TIER_4].obligations)
    monitoringFreq = 'Weekly'
    maxFine = 1000000
    violationType = 'Autonomous financial decision system'
  } else if (affectsPropertyValue && involvesFinancialDecisions) {
    tier = AITier.TIER_3
    riskLevel = AISystemRisk.HIGH
    obligations.length = 0
    obligations.push(...aitTierDefinitions[AITier.TIER_3].obligations)
    monitoringFreq = 'Monthly'
    maxFine = 500000
    violationType = 'Property valuation AI'
  } else if (involvesPersonalData && !isAutonomous) {
    tier = AITier.TIER_2
    riskLevel = AISystemRisk.LIMITED
    obligations.length = 0
    obligations.push(...aitTierDefinitions[AITier.TIER_2].obligations)
    monitoringFreq = 'Quarterly'
    maxFine = 150000
    violationType = 'Personal data AI'
  } else {
    tier = AITier.TIER_1
    riskLevel = AISystemRisk.MINIMAL
    obligations.length = 0
    obligations.push(...aitTierDefinitions[AITier.TIER_1].obligations)
    monitoringFreq = 'Annually'
    maxFine = 50000
    violationType = 'Minimal risk AI'
  }

  const compliance: AITierCompliance = {
    tier,
    tierName: aitTierDefinitions[tier].tierName,
    description: aitTierDefinitions[tier].description,
    obligations,
    monitoringRequirements: [...aitTierDefinitions[tier].monitoringRequirements],
    reportingFrequency: monitoringFreq,
    penalties: {
      maxFine,
      violationType,
    },
  }

  return {
    systemId: `${systemType}-${Date.now()}`,
    systemName: systemType,
    tier,
    riskLevel,
    compliance,
    classificationDate: new Date().toISOString(),
    classifiedBy: 'UAE AI Act Classification Office',
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    conditions: [ ...aitTierDefinitions[tier].conditions, ...(compliance.obligations.slice(0, 3)) ],
  }
}

// Export types
export type { AITier, AISystemRisk, AITierCompliance, AIClassificationResult }
