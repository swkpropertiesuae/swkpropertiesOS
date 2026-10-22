/**
 * ForestSwarm Agent Tree - Phase 3
 * 
 * Defines the deal lifecycle agent tree with states, transitions,
 * and agent responsibilities at each stage.
 */

// Deal lifecycle stages
export enum DealStage {
  // Initial stages
  LEAD_CAPTURE = 'Lead Capture',
  MANDATE_CREATION = 'Mandate Creation',
  
  // Viewing and offer stages
  VIEWING_SCHEDULE = 'Viewing Schedule',
  VIEWING_CONDUCTED = 'Viewing Conducted',
  OFFER_SUBMITTED = 'Offer Submitted',
  OFFER_NEGOTIATING = 'Offer Negotiating',
  OFFER_ACCEPTED = 'Offer Accepted',
  
  // Contract and DLD stages
  CONTRACT_DRAFT = 'Contract Draft',
  CONTRACT_SIGNED = 'Contract Signed',
  DLD_SUBMISSION = 'DLD Submission',
  DLD_APPROVAL = 'DLD Approval',
  TITLE_DEED_ISSUED = 'Title Deed Issued',
  
  // Closing stages
  HANDOVER = 'Handover',
  DEAL_CLOSED = 'Deal Closed',
  DEAL_CANCELLED = 'Deal Cancelled',
  
  // Post-closing
  POST_CLOSURE_FOLLOWUP = 'Post-Clure Followup',
  RENEWAL_OR_TERMINATION = 'Renewal or Termination',
}

// Agent roles in the deal lifecycle
export enum AgentRole {
  LEAD_AGENT = 'Lead Agent',
  SELLING_AGENT = 'Selling Agent',
  BUYING_AGENT = 'Buying Agent',
  VALUATION_AGENT = 'Valuation Agent',
  LEGAL_AGENT = 'Legal Agent',
  CLOSING_AGENT = 'Closing Agent',
  ADMINISTRATION_AGENT = 'Administration Agent',
}

// Agent state for tracking
export interface AgentState {
  agentId: number
  agentRole: AgentRole
  currentStage: DealStage
  lastActivity: string
  workload: number // 0-100
  availability: 'Available' | 'Busy' | 'Unavailable'
}

// Deal node in the agent tree
export interface DealNode {
  id: string
  stage: DealStage
  name: string
  description: string
  requiredAgents: AgentRole[]
  optionalAgents: AgentRole[]
  transitions: string[] // Next possible stages
  exitConditions: string[] // Conditions to move to next stage
  autoProgression: boolean // Whether stage auto-progresses when conditions met
}

// Complete agent tree for real estate deals
export const dealAgentTree: DealNode[] = [
  {
    id: 'lead-capture',
    stage: DealStage.LEAD_CAPTURE,
    name: 'Lead Capture',
    description: 'Initial lead capture from various sources (website, referral, walk-in, etc.)',
    requiredAgents: [AgentRole.LEAD_AGENT],
    optionalAgents: [],
    transitions: ['Mandate Creation'],
    exitConditions: ['Lead source verified', 'Lead qualified'],
    autoProgression: false,
  },
  {
    id: 'mandate-creation',
    stage: DealStage.MANDATE_CREATION,
    name: 'Mandate Creation',
    description: 'Create sales mandate or rental mandate with property details and pricing',
    requiredAgents: [AgentRole.LEAD_AGENT, AgentRole.SELLING_AGENT],
    optionalAgents: [AgentRole.VALUATION_AGENT],
    transitions: ['VIEWING_SCHEDULE'],
    exitConditions: ['Mandate drafted', 'Mandate signed by owner'],
    autoProgression: true,
  },
  {
    id: 'viewing-schedule',
    stage: DealStage.VIEWING_SCHEDULE,
    name: 'Viewing Schedule',
    description: 'Schedule property viewings with potential buyers/tenants',
    requiredAgents: [AgentRole.LEAD_AGENT],
    optionalAgents: [AgentRole.BUYING_AGENT],
    transitions: ['VIEWING_CONDUCTED'],
    exitConditions: ['Viewing scheduled'],
    autoProgression: false,
  },
  {
    id: 'viewing-conducted',
    stage: DealStage.VIEWING_CONDUCTED,
    name: 'Viewing Conducted',
    description: 'Property viewing has been conducted with feedback collected',
    requiredAgents: [AgentRole.LEAD_AGENT],
    optionalAgents: [],
    transitions: ['OFFER_SUBMITTED'],
    exitConditions: ['Viewing feedback collected', 'Buyer interest assessed'],
    autoProgression: true,
  },
  {
    id: 'offer-submitted',
    stage: DealStage.OFFER_SUBMITTED,
    name: 'Offer Submitted',
    description: 'Buyer/submit formal offer with price and terms',
    requiredAgents: [AgentRole.BUYING_AGENT, AgentRole.LEAD_AGENT],
    optionalAgents: [],
    transitions: ['OFFER_NEGOTIATING'],
    exitConditions: ['Offer delivered to seller'],
    autoProgression: false,
  },
  {
    id: 'offer-negotiating',
    stage: DealStage.OFFER_NEGOTIATING,
    name: 'Offer Negotiating',
    description: 'Price and terms negotiation between buyer and seller',
    requiredAgents: [AgentRole.LEAD_AGENT, AgentRole.SELLING_AGENT],
    optionalAgents: [AgentRole.BUYING_AGENT],
    transitions: ['OFFER_ACCEPTED', 'OFFER_REJECTED', 'OFFER_COUNTERED'],
    exitConditions: ['Terms agreed', 'Walk-away reached'],
    autoProgression: true,
  },
  {
    id: 'offer-accepted',
    stage: DealStage.OFFER_ACCEPTED,
    name: 'Offer Accepted',
    description: 'Offer accepted by seller, moving to contract draft',
    requiredAgents: [AgentRole.LEAD_AGENT, AgentRole.SELLING_AGENT],
    optionalAgents: [],
    transitions: ['CONTRACT_DRAFT'],
    exitConditions: ['Acceptance communicated', 'Deposit discussed'],
    autoProgression: true,
  },
  {
    id: 'contract-draft',
    stage: DealStage.CONTRACT_DRAFT,
    name: 'Contract Draft',
    description: 'Draft sales contract with terms, conditions, and contingencies',
    requiredAgents: [AgentRole.LEGAL_AGENT, AgentRole.SELLING_AGENT],
    optionalAgents: [AgentRole.VALUATION_AGENT],
    transitions: ['CONTRACT_SIGNED'],
    exitConditions: ['Contract draft completed', 'Parties review initiated'],
    autoProgression: false,
  },
  {
    id: 'contract-signed',
    stage: DealStage.CONTRACT_SIGNED,
    name: 'Contract Signed',
    description: 'Sales contract signed by all parties',
    requiredAgents: [AgentRole.LEAD_AGENT, AgentRole.SELLING_AGENT, AgentRole.LEGAL_AGENT],
    optionalAgents: [],
    transitions: ['DLD_SUBMISSION'],
    exitConditions: ['All signatures obtained', 'Copy distributed'],
    autoProgression: true,
  },
  {
    id: 'dld-submission',
    stage: DealStage.DLD_SUBMISSION,
    name: 'DLD Submission',
    description: 'Submit contract to Dubai Land Department',
    requiredAgents: [AgentRole.LEAD_AGENT, AgentRole.ADMINISTRATION_AGENT],
    optionalAgents: [],
    transitions: ['DLD_APPROVAL'],
    exitConditions: ['DLD application submitted', 'Application reference obtained'],
    autoProgression: true,
  },
  {
    id: 'dld-approval',
    stage: DealStage.DLD_APPROVAL,
    name: 'DLD Approval',
    description: 'DLD review and approval of contract',
    requiredAgents: [AgentRole.LEAD_AGENT, AgentRole.ADMINISTRATION_AGENT],
    optionalAgents: [],
    transitions: ['TITLE_DEED_ISSUED'],
    exitConditions: ['DLD approval obtained', 'Approval reference number'],
    autoProgression: true,
  },
  {
    id: 'title-deed-issued',
    stage: DealStage.TITLE_DEED_ISSUED,
    name: 'Title Deed Issued',
    description: 'Title deed issued by DLD, property officially transferred',
    requiredAgents: [AgentRole.LEAD_AGENT, AgentRole.CLOSING_AGENT],
    optionalAgents: [],
    transitions: ['HANDOVER'],
    exitConditions: ['Title deed received', 'Registration completed'],
    autoProgression: true,
  },
  {
    id: 'handover',
    stage: DealStage.HANDOVER,
    name: 'Handover',
    description: 'Property handover with keys, documentation, and inspection',
    requiredAgents: [AgentRole.CLOSING_AGENT],
    optionalAgents: [AgentRole.BUYING_AGENT],
    transitions: ['DEAL_CLOSED'],
    exitConditions: ['Keys returned', 'Possession transferred', 'Inspection completed'],
    autoProgression: true,
  },
  {
    id: 'deal-closed',
    stage: DealStage.DEAL_CLOSED,
    name: 'Deal Closed',
    description: 'Deal fully closed, all obligations met',
    requiredAgents: [AgentRole.ADMINISTRATION_AGENT],
    optionalAgents: [],
    transitions: ['POST_CLOSURE_FOLLOWUP'],
    exitConditions: ['All payments completed', 'Documents archived', 'Final approvals'],
    autoProgression: true,
  },
  {
    id: 'post-closure-followup',
    stage: DealStage.POST_CLOSURE_FOLLOWUP,
    name: 'Post-Clure Followup',
    description: 'Post-closing followup for satisfaction and future business',
    requiredAgents: [AgentRole.LEAD_AGENT],
    optionalAgents: [],
    transitions: ['RENEWAL_OR_TERMINATION'],
    exitConditions: ['Client satisfaction confirmed', '6-month check-in completed'],
    autoProgression: true,
  },
  {
    id: 'renewal-or-termination',
    stage: DealStage.RENEWAL_OR_TERMINATION,
    name: 'Renewal or Termination',
    description: 'Handle lease renewal or property termination',
    requiredAgents: [AgentRole.ADMINISTRATION_AGENT],
    optionalAgents: [],
    transitions: [],
    exitConditions: ['Lease renewed', 'Property terminated', 'Client notified'],
    autoProgression: false,
  },
]
