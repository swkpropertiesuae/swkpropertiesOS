import { db } from '../db'
import type { Context } from '../types'

// Tenant isolation policy for all agent operations
export const tenantRLSPolicy = (tenantId: number) => ({
  // Properties - isolate by owner/developer
  properties: `
    CREATE OR REPLACE POLICY properties_tenant_isolation ON properties
    USING (
      owner_id = ${tenantId} OR 
      EXISTS (SELECT 1 FROM developers WHERE id = properties.developer_id AND owner_id = ${tenantId})
    )
    WITH CHECK (
      owner_id = ${tenantId} OR 
      EXISTS (SELECT 1 FROM developers WHERE id = properties.developer_id AND owner_id = ${tenantId})
    )
  `,

  // Leases - isolate by landlord/tenant
  leases: `
    CREATE OR REPLACE POLICY leases_tenant_isolation ON leases
    USING (
      landlord_id = ${tenantId} OR tenant_id = ${tenantId}
    )
    WITH CHECK (
      landlord_id = ${tenantId} OR tenant_id = ${tenantId}
    )
  `,

  // Mandates - isolate by agent/owner
  mandates: `
    CREATE OR REPLACE POLICY mandates_tenant_isolation ON mandates
    USING (
      agent_id = ${tenantId} OR owner_id = ${tenantId}
    )
    WITH CHECK (
      agent_id = ${tenantId} OR owner_id = ${tenantId}
    )
  `,

  // Escrow accounts - isolate by bank/parties
  escrow_accounts: `
    CREATE OR REPLACE POLICY escrow_tenant_isolation ON escrow_accounts
    USING (
      bank_id = ${tenantId} OR
      EXISTS (SELECT 1 FROM sales_contracts sc WHERE sc.id = escrow_accounts.sales_contract_id AND sc.seller_id = ${tenantId})
    )
    WITH CHECK (
      bank_id = ${tenantId} OR
      EXISTS (SELECT 1 FROM sales_contracts sc WHERE sc.id = escrow_accounts.sales_contract_id AND sc.seller_id = ${tenantId})
    )
  `,

  // General: all entities have tenant_id for isolation
  generic: `
    ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
    ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
    ALTER TABLE mandates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE escrow_accounts ENABLE ROW LEVEL SECURITY;
  `
}

// Middleware to inject tenant ID into context
export const withTenantContext = (req: any, res: any, next: any) => {
  const tenantId = req.user?.tenant_id || req.query?.tenant_id
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant ID required' })
  }
  // Inject into request context for downstream use
  req.tenant_id = parseInt(tenantId, 10)
  next()
}

// RLS policy application function
export const applyRLSPolicies = async (client: any) => {
  const policies = tenantRLSPolicy(db.getTenantId())
  
  for (const [entity, policy] of Object.entries(policies)) {
    if (entity === 'generic') continue
    
    // Drop existing policies if reapplying
    await client.query(`DROP POLICY IF EXISTS ${entity}_tenant_isolation ON ${entity}`)
    await client.query(policy)
  }
  
  // Apply generic policies
  await client.query(policies.generic)
  
  console.log('RLS policies applied successfully')
}
