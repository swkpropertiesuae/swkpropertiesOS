/**
 * RERA AI Controls - Phase 5
 * 
 * RERA-specific AI controls for real estate agents and brokers in UAE.
 * Ensures AI systems comply with RERA regulations and ethical standards.
 */

// RERA AI control types
export enum RERAICControlType {
  MANDATORY_DISCLOSURE = 'Mandatory Disclosure',
  AGENT_COMPETENCY = 'Agent Competency',
  DATA_PROTECTION = 'Data Protection',
  PRICING_INTEGRITY = 'Pricing Integrity',
  TRANSPARENCY = 'Transparency',
}

// RERA AI control status
export enum RERAICControlStatus {
  ENABLED = 'Enabled',
  DISABLED = 'Disabled',
  PARTIALLY_ENABLED = 'Partially Enabled',
  UNDER_REVIEW = 'Under Review',
}

// RERA AI control record
export interface RERAICControl {
  controlId: string
  controlType: RERAICControlType
  status: RERAICControlStatus
  enabledAt?: string
  enabledBy?: string
  lastReviewed?: string
  nextReviewDate?: string
  complianceStatus: 'Compliant' | 'Non-Compliant' | 'Under Review'
  violationCount: number
  lastViolation?: string
}

// RERA AI controls configuration
export const reraAIControlsConfig: Record<RERAICControlType, any> = {
  [RERAICControlType.MANDATORY_DISCLOSURE]: {
    enabled: true,
    status: RERAICControlStatus.ENABLED,
    enabledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    enabledBy: 'RERA AI Compliance Team',
    lastReviewed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    complianceStatus: 'Compliant',
    violationCount: 0,
    requirements: [
      'Agent must disclose AI-assisted valuation to all clients',
      'Clear labeling of AI-generated property recommendations',
      'Documentation of AI role in deal files',
      'Client acknowledgment of AI assistance',
    ],
    monitoring: 'Continuous',
    penalties: {
      firstViolation: 50000,
      repeatViolation: 100000,
      '3rd+ violation': 'License suspension',
    },
  },
  [RERAICControlType.AGENT_COMPETENCY]: {
    enabled: true,
    status: RERAICControlStatus.ENABLED,
    enabledAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
    enabledBy: 'RERA Training & Licensing Department',
    lastReviewed: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    nextReviewDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days from now
    complianceStatus: 'Compliant',
    violationCount: 0,
    requirements: [
      'Agents must complete AI literacy training (minimum 4 hours)',
      'Regular updates on AI capabilities and limitations',
      'Competency assessment annually',
      'Training records must be maintained for 5 years',
    ],
    monitoring: 'Quarterly',
    penalties: {
      missingTraining: 25000,
      expiredCertification: 50000,
      '3rd violation': 'License suspension',
    },
  },
  [RERAICControlType.DATA_PROTECTION]: {
    enabled: true,
    status: RERAICControlStatus.ENABLED,
    enabledAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
    enabledBy: 'RERA Data Protection Office',
    lastReviewed: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days ago
    nextReviewDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days from now
    complianceStatus: 'Compliant',
    violationCount: 0,
    requirements: [
      'Client data must be pseudonymized when used for AI training',
      'Explicit consent required for AI-assisted analysis',
      'Data retention policy: maximum 2 years for AI training data',
      'Data breach notification within 72 hours',
    ],
    monitoring: 'Monthly',
    penalties: {
      dataBreach: 100000,
      inadequateConsent: 50000,
      '3rd violation': 'License suspension',
    },
  },
  [RERAICControlType.PRICING_INTEGRITY]: {
    enabled: true,
    status: RERAICControlStatus.ENABLED,
    enabledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    enabledBy: 'RERA Market Surveillance',
    lastReviewed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    complianceStatus: 'Compliant',
    violationCount: 0,
    requirements: [
      'AI valuation must include disclaimer: "AI estimate, subject to market verification"',
      'Human agent must take responsibility for final valuation',
      'No AI system may set final sale/rental prices autonomously',
      'Valuation must be cross-verified with market data',
    ],
    monitoring: 'Daily',
    penalties: {
      autonomousPricing: 200000,
      missingDisclaimer: 50000,
      '3rd violation': 'License suspension',
    },
  },
  [RERAICControlType.TRANSPARENCY]: {
    enabled: true,
    status: RERAICControlStatus.ENABLED,
    enabledAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
    enabledBy: 'RERA Compliance Department',
    lastReviewed: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
    complianceStatus: 'Compliant',
    violationCount: 0,
    requirements: [
      'All AI-assisted recommendations must be clearly marked',
      'Full disclosure of AI system capabilities and limitations',
      'Regular transparency reports to RERA',
      'Client-facing AI usage statements',
    ],
    monitoring: 'Weekly',
    penalties: {
      missingDisclosure: 25000,
      incompleteTransparency: 50000,
      '3rd violation': 'License suspension',
    },
  },
}

// RERA AI control compliance checker
export function checkRERAIControlCompliance(
  controlType: RERAICControlType,
  currentStatus: RERAICControlStatus,
  violationsThisPeriod: number = 0
): {
  compliant: boolean
  status: RERAICControlStatus
  recommendedAction: string
  penaltyRisk: 'None' | 'Warning' | 'Fine' | 'License Suspension'
} {
  const control = reraAIControlsConfig[controlType]

  if (!control) {
    return { compliant: false, status: RERAICControlStatus.DISABLED, recommendedAction: 'Control not found', penaltyRisk: 'None' }
  }

  const isCurrentlyEnabled = control.status === RERAICControlStatus.ENABLED
  const hasViolations = violationsThisPeriod > 0

  let compliant: boolean
  let recommendedAction: string
  let penaltyRisk: 'None' | 'Warning' | 'Fine' | 'License Suspension'

  if (!isCurrentlyEnabled) {
    compliant = false
    recommendedAction = 'Enable control immediately'
    penaltyRisk = 'Fine'
  } else if (hasViolations && violationsThisPeriod >= 3) {
    compliant = false
    recommendedAction = 'Address violations immediately'
    penaltyRisk = 'License Suspension'
  } else if (hasViolations) {
    compliant = false
    recommendedAction = 'Resolve violations'
    penaltyRisk = 'Fine'
  } else {
    compliant = true
    recommendedAction = 'Maintain compliance'
    penaltyRisk = 'None'
  }

  return { compliant, status: control.status, recommendedAction, penaltyRisk }
}

// RERA AI control audit log
export interface RERAICAuditLog {
  logId: string
  controlId: string
  action: 'ENABLED' | 'DISABLED' | 'REVIEWED' | 'VIOLATION' | 'COMPLIANCE_CHECK'
  timestamp: string
  performedBy: string
  details: string
  beforeStatus?: RERAICControlStatus
  afterStatus: RERAICControlStatus
}

// Export types
export type {
  RERAICControlType,
  RERAICControlStatus,
  RERAICControl,
  RERAICAuditLog,
}
