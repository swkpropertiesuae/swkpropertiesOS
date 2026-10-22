/**
 * ForestSwarm Cowork Copilot - Phase 3
 * 
 * AI assistant for real estate agents providing:
 - Deal stage recommendations
 - Task prioritization
 - Automated workflow generation
 - Market insights and alerts
 - Document assistance
 */

// Copilot response types
export interface CopilotResponse {
  type: 'recommendation' | 'task' | 'alert' | 'insight' | 'documentation'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  message: string
  actionable: boolean
  action: {
    label: string
    handler: string
    data?: any
  }[]
  metadata?: Record<string, any>
}

// Agent context for copilot recommendations
export interface AgentContext {
  agentId: number
  currentStage: DealStage
  pendingTasks: number
  recentDeals: number
  avgDealValue: number
  availability: 'Available' | 'Busy' | 'Unavailable'
  specialty: 'Sales' | 'Leasing' | 'Property Management' | 'Valuation' | 'Admin'
}

// Deal context for copilot recommendations
export interface DealContext {
  dealId: number
  stage: DealStage
  progress: number // 0-100
  daysInStage: number
  nextMilestones: string[]
  blockers: string[]
  participants: Array<{
    role: AgentRole
    name: string
    status: 'Pending' | 'Active' | 'Completed'
  }
}

// Generate copilot recommendation for agent
export function generateCopilotRecommendation(
  agentContext: AgentContext,
  dealContext?: DealContext
): CopilotResponse[] {
  const recommendations: CopilotResponse[] = []
  
  // Recommendation 1: Stage progression check
  if (dealContext) {
    const daysInStage = dealContext.daysInStage
    const stage = dealContext.stage
    
    // If deal stuck in stage too long, recommend progression
    const stageTimeouts: Record<DealStage, number> = {
      [DealStage.OFFER_NEGOTIATING]: 7, // 7 days max
      [DealStage.CONTRACT_DRAFT]: 3, // 3 days max
      [DealStage.DLD_SUBMISSION]: 14, // 14 days max
      [DealStage.VIEWING_CONDUCTED]: 3, // 3 days max
    }
    
    const timeout = stageTimeouts[stage]
    if (timeout && daysInStage > timeout) {
      recommendations.push({
        type: 'recommendation',
        priority: 'high',
        message: `Deal has been in ${stage} stage for ${daysInStage} days. Consider progression.`,
        actionable: true,
        action: [
          {
            label: 'Proceed to next stage',
            handler: 'proceed_stage',
            data: { dealId: dealContext.dealId, fromStage: stage }
          },
          {
            label: 'Review blockers',
            handler: 'review_blockers',
            data: { dealId: dealContext.dealId }
          }
        ]
      })
    }
    
    // If deal moving smoothly, offer positive reinforcement
    if (daysInStage < (timeout || 3) && dealContext.progress > 80) {
      recommendations.push({
        type: 'insight',
        priority: 'low',
        message: `Excellent progress! Deal at ${stage} stage at ${dealContext.progress}% completion.`,
        actionable: false,
        metadata: {
          progress: dealContext.progress,
          daysInStage,
          stage
        }
      })
    }
  }
  
  // Recommendation 2: Priority task generation
  if (agentContext) {
    const pendingTasks = agentContext.pendingTasks
    
    if (pendingTasks > 5) {
      recommendations.push({
        type: 'task',
        priority: 'urgent',
        message: `You have ${pendingTasks} pending tasks. Prioritize accordingly.`,
        actionable: true,
        action: [
          {
            label: 'View priority tasks',
            handler: 'view_tasks',
            data: { filter: 'high_priority' }
          },
          {
            label: 'Quick complete',
            handler: 'quick_complete',
            data: { maxTasks: 3 }
          }
        ]
      })
    }
    
    if (agentContext.availability === 'Available' && pendingTasks < 3) {
      recommendations.push({
        type: 'recommendation',
        priority: 'medium',
        message: 'You are available. Would you like to take on a new lead?',
        actionable: true,
        action: [
          {
            label: 'Take new lead',
            handler: 'take_lead',
            data: {}
          },
          {
            label: 'Review pipeline',
            handler: 'review_pipeline',
            data: {}
          }
        ]
      })
    }
  }
  
  // Recommendation 3: Market alert
  recommendations.push({
    type: 'alert',
    priority: 'medium',
    message: 'Check for new off-plan launch in Dubai Marina',
    actionable: true,
    action: [
      {
        label: 'View details',
        handler: 'view_launch',
        data: { area: 'Dubai Marina' }
      },
      {
        label: 'Ignore',
            handler: 'dismiss_alert',
            data: { alertId: 'marina_launch' }
          }
        ]
      })
    
    // Recommendation 4: Document assistance
    if (dealContext) {
      const stage = dealContext.stage
      
      // Based on current stage, suggest relevant documents
      const documentSuggestions: Record<DealStage, string[]> = {
        [DealStage.CONTRACT_DRAFT]: ['Sales purchase agreement template', 'Contingency clauses'],
        [DealStage.DLD_SUBMISSION]: ['DLD application form', 'Required documents checklist'],
        [DealStage.HANDOVER]: ['Handover checklist', 'Key inventory list'],
        [DealStage.CONTRACT_SIGNED]: ['Signed contract copies', 'Distribution list'],
      }
      
      const suggestions = documentSuggestions[stage] || []
      if (suggestions.length > 0) {
        recommendations.push({
          type: 'documentation',
          priority: 'medium',
          message: `Suggested documents for ${stage} stage`,
          actionable: true,
          action: [
            {
              label: 'View documents',
              handler: 'view_documents',
              data: { suggestions }
            }
          ]
        })
      }
    }
  }
  
  return recommendations
}

// Generate "Morning Read" for agent
export function generateMorningRead(agentId: number, agentRole: AgentRole): CopilotResponse {
  const now = new Date()
  const dayOfWeek = now.toLocaleString('en-US', { weekday: 'long' })
  
  const baseMessages: Record<AgentRole, string> = {
    [AgentRole.LEAD_AGENT]: `Good morning! ${new Date().getDate()} ${dayOfWeek}. ${Math.floor(Math.random() * 5 + 3)} new leads today.`,
    [AgentRole.SELLING_AGENT]: `Good morning! Ready for showings today. Check your pipeline for deals in negotiation.`,
    [AgentRole.BUYING_AGENT]: `Good morning! ${Math.floor(Math.random() * 3 + 2)} new properties matched your criteria.`,
    [AgentRole.VALUATION_AGENT]: `Good morning! Ready for valuation assignments. ${Math.floor(Math.random() * 5 + 1)} properties queued.`,
    [AgentRole.ADMINISTRATION_AGENT]: `Good morning! Daily admin tasks queue ready. ${Math.floor(Math.random() * 5)} approvals pending.`,
  }
  
  return {
    type: 'task',
    priority: 'high',
    message: baseMessages[agentRole] || 'Good morning!',
    actionable: true,
    action: [
      {
        label: 'View pipeline',
        handler: 'view_pipeline',
        data: {}
      },
      {
        label: 'Check tasks',
        handler: 'view_tasks',
        data: { filter: 'all' }
      }
    ]
  }
}

// Generate "What Needs You Now" priority queue
export function generateWhatNeedsYouNow(agentId: number, agentRole: AgentRole, pendingTasks: number): CopilotResponse[] {
  const priorities: CopilotResponse[] = []
  
  // Always include critical pending items
  for (let i = 0; i < Math.min(pendingTasks, 5); i++) {
    const priorityLevel = i === 0 ? 'urgent' : i === 1 ? 'high' : 'medium'
    
    priorities.push({
      type: 'task',
      priority: priorityLevel as any,
      message: `Task ${i + 1}: Property follow-up and deal progression`,
      actionable: true,
      action: [
        {
          label: 'View task details',
          handler: 'view_task_detail',
          data: { taskId: i }
        },
        {
          label: 'Complete task',
          handler: 'complete_task',
          data: { taskId: i }
        }
      ]
    })
  }
  
  // Add stage progression reminders
  const stageReminders: Record<AgentRole, string[]> = {
    [AgentRole.LEAD_AGENT]: [
      'Follow up on leads older than 7 days',
      'New lead follow-up call within 24 hours',
    ],
    [AgentRole.SELLING_AGENT]: [
      'Deals in negotiation > 7 days need progression',
      'Offer follow-ups for pending offers',
    ],
    [AgentRole.VALUATION_AGENT]: [
      'Valuation assignments due this week',
      'ML model retraining check',
    ],
    [AgentRole.ADMINISTRATION_AGENT]: [
      'Approval requests pending > 3 days',
      'DLD submission reminders',
    ],
  }
  
  const reminders = stageReminders[agentRole] || []
  for (const reminder of reminders) {
    priorities.push({
      type: 'reminder',
      priority: 'medium' as any,
      message: reminder,
      actionable: true,
      action: [
        {
          label: 'Address',
          handler: 'address_reminder',
          data: { reminder }
        }
      ]
    })
  }
  
  return priorities
}

// Export types
export type { CopilotResponse, AgentContext, DealContext }
