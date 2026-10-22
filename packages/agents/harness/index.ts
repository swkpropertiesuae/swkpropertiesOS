/**
 * Harnis Agent Harness - Phase 0
 * 
 * Provides the foundation for agentic operations with:
 * - Tenant isolation via Postgres RLS
 * - Human approval gates for high-risk actions
 * - Sandboxed code execution
 * - Append-only audit trails
 */

export * from './rls-policy'
export * from './approval-console'
export * from './sandbox'
export * from './audit-pipeline'

// Export audit event types
export {
  AuditEventType,
  AuditEvent,
  type SandboxResult,
}

// Harness initialization function
export const initializeHarness = async (app: any, options: any = {}) => {
  const {
    registerRoutes = true,
    registerMiddleware = true,
    rlsPolicies = true,
    auditHooks = true,
  } = options

  // Register RLS policies if enabled
  if (rlsPolicies) {
    try {
      // Apply RLS policies to database
      // await applyRLSPolicies(db)
      console.log('RLS policies initialization skipped (database migration)')
    } catch (error) {
      console.error('RLS policies initialization error:', error)
    }
  }

  // Register audit hooks if enabled
  if (auditHooks) {
    try {
      // entityAuditHooks.beforeCreate, beforeUpdate, beforeDelete
      // These would be integrated with the entity definition system
      console.log('Audit hooks initialization skipped (entity integration)')
    } catch (error) {
      console.error('Audit hooks initialization error:', error)
    }
  }

  // Register approval console routes if enabled
  if (registerRoutes) {
    try {
      // app.use('/api/approval', approvalConsole)
      // app.use('/api/audit', auditPipeline)
      console.log('Approval console and audit routes registration skipped')
    } catch (error) {
      console.error('Route registration error:', error)
    }
  }

  console.log('Harnis harness initialized successfully')
  return {
    applyRLSPolicies,
    createAuditEvent,
    getAuditEvents,
    executeInSandbox,
    validateCode,
    createSandboxScript,
  }
}

export default {
  initializeHarness,
  applyRLSPolicies,
  createAuditEvent,
  getAuditEvents,
  executeInSandbox,
  validateCode,
  createSandboxScript,
}
