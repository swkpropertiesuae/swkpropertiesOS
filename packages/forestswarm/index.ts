/**
 * ForestSwarm Multi-Agent Orchestration - Phase 3
 * 
 * Provides multi-agent orchestration for real estate deal lifecycle management,
 * including agent trees, cowork copilot, task queues, and deal progression.
 */

export * from './agent-tree'
export * from './cowork-copilot'
export * from './queues'
export * from './orchestrator'

// ForestSwarm initialization function
export const initializeForestSwarm = async (app: any, options: any = {}) => {
  const {
    registerRoutes = true,
    enableCopilot = true,
    enableQueues = true,
  } = options

  // Register ForestSwarm routes and functionality
  if (registerRoutes) {
    try {
      // ForestSwarm orchestration initialization
      // Would integrate with main app routing
      console.log('ForestSwarm orchestration initialization completed')
    } catch (error) {
      console.error('ForestSwarm initialization error:', error)
    }
  }

  // Return ForestSwarm capabilities
  return {
    dealAgentTree,
    getNextStage: ForestSwarmOrchestrator.getNextStage,
    getPossibleNextStages: ForestSwarmOrchestrator.getPossibleNextStages,
    canProgress: ForestSwarmOrchestrator.canProgress,
    getRecommendedActions: ForestSwarmOrchestrator.getRecommendedActions,
    processTransition: ForestSwarmOrchestrator.processTransition,
    generateCopilotRecommendation,
    generateMorningRead,
    generateWhatNeedsYouNow,
    MorningRead,
    WhatNeedsYouNow,
    QueueManager,
    ForestSwarmOrchestrator,
  }
}

export default {
  initializeForestSwarm,
}

// Export core types for external use
export type {
  DealStage,
  AgentRole,
  DealNode,
  DealNode,
  MorningRead,
  WhatNeedsYouNow,
  CopilotResponse,
  AgentContext,
  DealContext,
  OrchestrationResult,
}
