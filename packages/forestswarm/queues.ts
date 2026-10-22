/**
 * ForestSwarm Task Queues - Phase 3
 * 
 * Defines the "Morning Read" and "What Needs You Now" queues
 * for agent task prioritization and daily briefing.
 */

// Morning Read structure - daily agent briefing
export interface MorningRead {
  agentId: number
  agentRole: AgentRole
  date: string
  newLeads: number
  pendingTasks: number
  dealsInProgress: number
  highPriorityDeals: Array<{
    dealId: number
    stage: DealStage
    daysInStage: number
    progress: number
  }>
  marketAlerts: Array<{
    type: string
    message: string
    action: string
  }>
  valuationAssignments: number
  generatedAt: string
}

// What Needs You Now - priority task queue
export interface WhatNeedsYouNow {
  agentId: number
  priorityLevel: 'urgent' | 'high' | 'medium' | 'low'
  tasks: Array<{
    taskId: number
    title: string
    description: string
    relatedDealId?: number
    relatedStage: DealStage
    deadline?: string
    estimatedDuration: number // minutes
    createdAt: string
    status: 'pending' | 'in_progress' | 'completed'
  }>
  generatedAt: string
}

// Queue manager
export class QueueManager {
  // Generate Morning Read for an agent
  static generateMorningRead(
    agentId: number,
    agentRole: AgentRole,
    options: {
      newLeads?: number
      pendingTasks?: number
      dealsInProgress?: number
      highPriorityDeals?: Array<{
        dealId: number
        stage: DealStage
        daysInStage: number
        progress: number
      }>
      marketAlerts?: Array<{
        type: string
        message: string
        action: string
      }>
      valuationAssignments?: number
    } = {}
  ): MorningRead {
    const date = new Date().toISOString().split('T')[0]
    
    return {
      agentId,
      agentRole,
      date,
      newLeads: options.newLeads ?? Math.floor(Math.random() * 5) + 1,
      pendingTasks: options.pendingTasks ?? Math.floor(Math.random() * 10),
      dealsInProgress: options.dealsInProgress ?? Math.floor(Math.random() * 8),
      highPriorityDeals: options.highPriorityDeals ?? this.getHighPriorityDeals(agentRole),
      marketAlerts: options.marketAlerts ?? this.getMarketAlerts(),
      valuationAssignments: options.valuationAssignments ?? Math.floor(Math.random() * 3),
      generatedAt: new Date().toISOString(),
    }
  }
  
  // Get high priority deals based on agent role
  static getHighPriorityDeals(agentRole: AgentRole): Array<{
    dealId: number
    stage: DealStage
    daysInStage: number
    progress: number
  }> {
    const mockDeals: Array<{
      dealId: number
      stage: DealStage
      daysInStage: number
      progress: number
    }> = []
    
    const count = Math.floor(Math.random() * 5) + 1 // 1-5 deals
    
    for (let i = 0; i < count; i++) {
      const stageOptions: DealStage[] = [
        DealStage.OFFER_NEGOTIATING,
        DealStage.CONTRACT_DRAFT,
        DealStage.DLD_SUBMISSION,
      ]
      const stage = stageOptions[Math.floor(Math.random() * stageOptions.length)]
      const daysInStage = Math.floor(Math.random() * 15) // 0-15 days
      const progress = Math.floor(Math.random() * 100) // 0-100%
      
      mockDeals.push({
        dealId: Math.floor(Math.random() * 9000000) + 1000000,
        stage,
        daysInStage,
        progress,
      })
    }
    
    return mockDeals
  }
  
  // Get market alerts
  static getMarketAlerts(): Array<{
    type: string
    message: string
    action: string
  }> {
    const alerts: Array<{
      type: string
      message: string
      action: string
    }> = []
    
    const alertCount = Math.floor(Math.random() * 3) + 1 // 1-3 alerts
    
    const alertTemplates: Array<{
      type: string
      message: string
      action: string
    }> = [
      {
        type: 'new_launch',
        message: 'New off-plan launch in Dubai Marina',
        action: 'View details',
      },
      {
        type: 'price_reduction',
        message: 'Price reduction on property in Palm Jumeirah',
        action: 'View property',
      },
      {
        type: 'regulatory_update',
        message: 'Updated RERA broker requirements',
        action: 'Check requirements',
      },
    ]
    
    for (let i = 0; i < alertCount; i++) {
      const template = alertTemplates[Math.floor(Math.random() * alertTemplates.length)]
      alerts.push({
        type: template.type,
        message: template.message,
        action: template.action,
      })
    }
    
    return alerts
  }
  
  // Generate "What Needs You Now" priority queue
  static generateWhatNeedsYouNow(
    agentId: number,
    priorityLevel: 'urgent' | 'high' | 'medium' | 'low',
    options: {
      tasks?: Array<{
        taskId: number
        title: string
        description: string
        relatedDealId?: number
        relatedStage: DealStage
        deadline?: string
        estimatedDuration: number
        status?: 'pending' | 'in_progress' | 'completed'
      }>
    } = {}
  ): WhatNeedsYouNow {
    const tasks = options.tasks ?? this.getMockTasks(priorityLevel)
    
    return {
      agentId,
      priorityLevel,
      tasks,
      generatedAt: new Date().toISOString(),
    }
  }
  
  // Get mock tasks based on priority level
  static getMockTasks(priorityLevel: 'urgent' | 'high' | 'medium' | 'low'): Array<{
    taskId: number
    title: string
    description: string
    relatedDealId?: number
    relatedStage: DealStage
    deadline?: string
    estimatedDuration: number
    status: 'pending' | 'in_progress' | 'completed'
  }> {
    const count = priorityLevel === 'urgent' ? 5 : priorityLevel === 'high' ? 8 : priorityLevel === 'medium' ? 12 : 20
    
    const taskTitles: string[] = [
      'Follow up on lead',
      'Schedule property viewing',
      'Submit offer',
      'Follow up on offer',
      'Prepare contract',
      'DLD submission',
      'Handover coordination',
      'Client follow-up',
      'Email response',
      'Document review',
      'Market research',
      'Price adjustment',
    ]
    
    const stages: DealStage[] = [
      DealStage.LEAD_CAPTURE,
      DealStage.MANDATE_CREATION,
      DealStage.VIEWING_SCHEDULE,
      DealStage.VIEWING_CONDUCTED,
      DealStage.OFFER_SUBMITTED,
      DealStage.OFFER_NEGOTIATING,
      DealStage.OFFER_ACCEPTED,
      DealStage.CONTRACT_DRAFT,
      DealStage.CONTRACT_SIGNED,
      DealStage.DLD_SUBMISSION,
      DealStage.HANDOVER,
      DealStage.DEAL_CLOSED,
    ]
    
    const tasks: Array<{
      taskId: number
      title: string
      description: string
      relatedDealId?: number
      relatedStage: DealStage
      deadline?: string
      estimatedDuration: number
      status: 'pending' | 'in_progress' | 'completed'
    }> = []
    
    const now = new Date()
    const baseDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Tomorrow
    
    for (let i = 0; i < count; i++) {
      const isUrgent = priorityLevel === 'urgent' || (priorityLevel === 'high' && i < 3)
      const taskIdx = i % taskTitles.length
      const stageIdx = i % stages.length
      
      const estimatedDuration = Math.floor(Math.random() * 60) + 15 // 15-75 minutes
      const daysOffset = Math.floor(Math.random() * 7) // 0-6 days
      const deadline = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000)
      
      tasks.push({
        taskId: i,
        title: taskTitles[taskIdx],
        description: `Follow up and deal progression task ${i + 1}`,
        relatedDealId: Math.floor(Math.random() * 9000000) + 1000000,
        relatedStage: stages[stageIdx],
        deadline: deadline.toISOString(),
        estimatedDuration,
        status: isUrgent && i < 2 ? 'pending' : Math.random() > 0.5 ? 'pending' : 'completed',
      })
    }
    
    // Sort by deadline (earliest first) and priority
    tasks.sort((a, b) => {
      const aDate = new Date(a.deadline || 0).getTime()
      const bDate = new Date(b.deadline || 0).getTime()
      return aDate - bDate || a.priorityLevel.localeCompare(b.priorityLevel)
    })
    
    return tasks
  }
}

// Export types
export type { MorningRead, WhatNeedsYouNow, QueueManager }
export { DealStage, AgentRole }
