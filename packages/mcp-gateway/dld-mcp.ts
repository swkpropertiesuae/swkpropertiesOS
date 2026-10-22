import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { mcpResponseSchema, MCPError, MCPErrorCodes } from './schema'
import { salesContractSchema, ejariNoSchema } from './schema'

export default async function (app: FastifyInstance) {
  // Validate Ejari number
  app.post('/api/dld/ejari/validate', async (req) => {
    const b = ejariNoSchema.parse(req.body)

    // In production: validate against RERA Ejari system
    // For now: format validation and mock check
    const validFormat = /^EJ-[0-9]{7}$/.test(b.ejari_number)

    const mockStatuses: any[] = ['Active', 'Expired', 'Cancelled', 'Under Review']
    const mockStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)]

    return mcpResponseSchema.parse({
      success: validFormat,
      data: {
        ejari_number: b.ejari_number,
        status: mockStatus,
        property_type: 'Residential', // Would be queried from RERA
        registration_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        method: 'dld-mcp Ejari Validation',
        validated_at: new Date().toISOString(),
      },
      error: validFormat ? undefined : 'Invalid Ejari number format. Expected format: EJ-XXXXXXX',
    })
  })

  // Submit sales contract to DLD
  app.post('/api/dld/contract/submit', async (req) => {
    const b = salesContractSchema.parse(req.body)

    // In production: submit to DLD via their API
    // For now: create approval request through Harnis harness
    const mockApplicationNo = `DLD-${Date.now().toString().slice(-8)}-${Math.random()
      .toString(36)
      .slice(2, 8).toUpperCase()}

    return mcpResponseSchema.parse({
      success: true,
      data: {
        contract_no: b.contract_no,
        dld_application_no: mockApplicationNo,
        dld_submission_date: new Date().toISOString(),
        status: 'DLD Submitted',
        message: 'Contract submitted to DLD successfully. Awaiting approval.',
      },
      error: undefined,
    })
  })

  // Check DLD contract status
  app.get('/api/dld/contract/status/:appNo', async (req) => {
    const appNo = req.params.appNo

    // In production: query DLD API
    // For now: return mock status
    const mockStatuses = ['Draft', 'Signed', 'DLD Submitted', 'DLD Approved', 'Title Deed Issued', 'Completed']
    const mockStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)]
    const mockProgress = Math.random()

    return mcpResponseSchema.parse({
      success: true,
      data: {
        dld_application_no: appNo,
        status: mockStatus,
        progress_percentage: Math.round(progress * 100),
        last_update: new Date().toISOString(),
        expected_next_step:
          mockStatus === 'DLD Approved'
            ? 'Title deed issuance'
            : mockStatus === 'Title Deed Issued'
              ? 'Contract completion'
              : 'DLD review',
      },
      error: undefined,
    })
  })

  // Verify escrow account
  app.post('/api/dld/escrow/verify', async (req) => {
    const b = z.object({
      escrow_no: z.string().min(1),
      expected_amount: z.number().positive(),
    }).parse(req.body)

    // In production: verify with DLD escrow system
    // For now: mock verification
    const mockReceived = Math.random() > 0.3 ? b.expected_amount * 0.8 : b.expected_amount * 0.3 // 80% or 30% received

    return mcpResponseSchema.parse({
      success: true,
      data: {
        escrow_no: b.escrow_no,
        expected_amount: b.expected_amount,
        received_amount: mockReceived,
        verification_status: mockReceived >= b.expected_amount * 0.8 ? 'Verified' : 'Pending',
        verification_date: new Date().toISOString(),
        method: 'dld-mcp Escrow Verification',
      },
      error: undefined,
    })
  })

  // Get title deed status
  app.get('/api/dld/title-deed/status/:propertyId', async (req) => {
    const propertyId = Number(req.params.propertyId)

    // In production: query DLD title deed registry
    // For now: return mock data
    const mockStatuses = ['Not Requested', 'Requested', 'In Processing', 'Issued', 'Registered']
    const mockStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)]
    const mockDeedNo = mockStatus === 'Issued' ? `TD-${Math.floor(Math.random() * 9000000) + 1000000}` : null

    return mcpResponseSchema.parse({
      success: true,
      data: {
        property_id: propertyId,
        title_deed_status: mockStatus,
        title_deed_no: mockDeedNo,
        issue_date: mockStatus === 'Issued'
          ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
          : null,
        registry_reference: `REG-${Math.floor(Math.random() * 900000) + 100000}`,
        method: 'Native DLD Title Deed API',
      },
      error: undefined,
    })
  })

  // Get DLD market overview
  app.get('/api/dld/market/overview', async (req) => {
    const propertyType = req.query.property_type as string || 'all'

    // In production: query DLD market database
    // For now: return mock data
    const mockData = {
      property_type: propertyType || 'all',
      total_transactions: Math.floor(Math.random() * 5000) + 1000,
      average_price_per_sqft: Math.random() * 10000 + 5000,
      price_trend: Math.random() > 0.5 ? 'increasing' : 'stable',
      areas: {
        'Dubai Marina': { transactions: 120, avg_price: 8500 },
        'Palm Jumeirah': { transactions: 85, avg_price: 15000 },
        'Downtown Dubai': { transactions: 200, avg_price: 12000 },
        'Dubai Hills': { transactions: 95, avg_price: 6500 },
      },
      retrieved_at: new Date().toISOString(),
    }

    return mcpResponseSchema.parse({
      success: true,
      data: mockData,
      error: undefined,
    })
  })
}
