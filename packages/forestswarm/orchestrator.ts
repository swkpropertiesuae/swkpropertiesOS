/**
 * ForestSwarm Orchestrator - Phase 3
 * 
 * Core orchestration logic for agent coordination,
 * deal progression, and workflow management.
 */

import { dealAgentTree, DealStage, DealNode, AgentRole } from './agent-tree'
import { generateCopilotRecommendation, CopilotResponse, AgentContext, DealContext } from './cowork-copilot'
import { MorningRead, WhatNeedsYouNow, QueueManager } from './queues'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { bad, todayStr } from '../util'

export interface OrchestrationResult {
  recommendations: CopilotResponse[]
  morningRead: MorningRead
  whatNeedsYouNow: WhatNeedsYouNow
  nextActions: Array<{
    stage: DealStage
    action: string
    agentRole: AgentRole
  }>
  dealProgress: number // 0-100
  blockers: string[]
}

export class ForestSwarmOrchestrator {
  // Get the next stage in the deal lifecycle
  static getNextStage(currentStage: DealStage): DealStage | null {
    const currentNode = dealAgentTree.find(node => node.stage === currentStage)
    if (!currentNode) return null
    
    const possibleTransitions = currentNode.transitions
    if (possibleTransitions.length === 0) return null
    
    // Return the first possible transition (or could be more sophisticated)
    const nextStageName = possibleTransitions[0]
    return DealStage[DealStage[DealStage['DLD_SUBMISSION'] + 1] as keyof typeof DealStage] || null
    
    // Simplified: return null for now, would need proper mapping
    return null
  }

  // Get possible next stages from current stage
  static getPossibleNextStages(currentStage: DealStage): DealStage[] {
    const currentNode = dealAgentTree.find(node => node.stage === currentStage)
    if (!currentNode) return []
    
    return currentNode.transitions
      .map((transition: string) => DealStage[DealStage['DLD_SUBMISSION'] + 1 as keyof typeof DealStage] || DealStage.DEAL_CLOSED)
      .filter((stage): stage is DealStage => stage !== undefined)
  }

  // Check if a deal can progress to the next stage
  static canProgress(currentStage: DealStage, progress: number, daysInStage: number): boolean {
    const possibleNext = this.getPossibleNextStages(currentStage)
    if (possibleNext.length === 0) return false
    
    // Check exit conditions based on stage
    const currentNode = dealAgentTree.find(node => node.stage === currentStage)
    if (!currentNode) return false
    
    // Check if enough progress
    if (progress < 70) return false
    
    // Check if not stuck too long
    const maxDays: Record<DealStage, number> = {
      [DealStage.OFFER_NEGOTIATING]: 7,
      [DealStage.CONTRACT_DRAFT]: 3,
      [DealStage.DLD_SUBMISSION]: 14,
      [DealStage.VIEWING_CONDUCTED]: 3,
    }
    
    const maxDaysInStage = maxDays[currentStage]
    if (maxDaysInStage && daysInStage > maxDaysInStage) return false
    
    return true
  }

  // Get recommended actions for an agent
  static getRecommendedActions(
    agentId: number,
    agentRole: AgentRole,
    currentStage: DealStage,
    pendingTasks: number,
    dealContext?: DealContext
  ): OrchestrationResult {
    // Generate copilot recommendations
    const recommendations = generateCopilotRecommendation(
      { agentId, currentStage, pendingTasks, availability: 'Available' },
      dealContext
    )
    
    // Generate Morning Read
    const morningRead = QueueManager.generateMorningRead(
      agentId,
      agentRole,
      {
        newLeads: Math.floor(Math.random() * 5) + 1,
        pendingTasks,
        dealsInProgress: Math.floor(Math.random() * 8),
        highPriorityDeals: QueueManager.getHighPriorityDeals(agentRole),
        marketAlerts: QueueManager.getMarketAlerts(),
        valuationAssignments: Math.floor(Math.random() * 3),
      }
    )
    
    // Generate What Needs You Now
    const whatNeedsYouNow = QueueManager.generateWhatNeedsYouNow(
      agentId,
      'high',
      pendingTasks
    )
    
    // Determine next actions
    const possibleNextStages = this.getPossibleNextStages(currentStage)
    const nextActions: Array<{
      stage: DealStage
      action: string
      agentRole: AgentRole
    }> = []
    
    possibleNextStages.forEach(stage => {
      nextActions.push({
        stage,
        action: `Proceed to ${stage}`,
        agentRole,
      })
    })
    
    // Calculate deal progress (mock)
    const dealProgress = Math.floor(Math.random() * 100)
    
    // Identify blockers (mock)
    const blockers: string[] = []
    if (Math.random() > 0.7) blockers.push('Waiting on client response')
    if (Math.random() > 0.6) blockers.push('Awaiting DLD approval')
    if (Math.random() > 0.6) blockers.push('Price negotiation pending')
    
    return {
      recommendations,
      morningRead,
      whatNeedsYouNow,
      nextActions,
      dealProgress,
      blockers,
    }
  }

  // Process deal stage transition
  static async processTransition(
    dealId: number,
    fromStage: DealStage,
    toStage: DealStage,
    triggeredBy: AgentRole
  ): Promise<{
    success: boolean
    newStage: DealStage
    message: string
    auditEvent: any
  }> {
    // Validate transition is allowed
    const currentNode = dealAgentTree.find(node => node.stage === fromStage)
    if (!currentNode) {
      return { success: false, newStage: fromStage, message: 'Invalid current stage', auditEvent: null }
    }
    
    if (!currentNode.transitions.includes(toStage)) {
      return { success: false, newStage: fromStage, message: `Transition from ${fromStage} to ${toStage} not allowed`, auditEvent: null }
    }
    
    // In production: update deal in database, create audit event, notify parties
    // For now: return success with mock data
    
    const auditEvent = {
      id: Math.floor(Math.random() * 9000000) + 1000000,
      entity: 'deals',
      record_id: dealId,
      action: 'STAGE_TRANSITION',
      user_id: 0, // Would be agent ID
      tenant_id: 0, // Would be tenant ID
      previous_state: fromStage,
      new_state: toStage,
      timestamp: todayStr(),
      metadata: {
        triggered_by: triggeredBy,
        deal_id: dealId,
      }
    }
    
    return {
      success: true,
      newStage: toStage,
      message: `Deal transitioned from ${fromStage} to ${toStage} successfully`,
      auditEvent,
    }
  }
}

// Export types
export type { OrchestrationResult }
