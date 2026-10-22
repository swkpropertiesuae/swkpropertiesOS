import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { mcpResponseSchema, MCPError, MCPErrorCodes } from './schema'

export default async function (app: FastifyInstance) {
  // Real-time market data from DLD
  app.get('/api/dld/market/realtime', async (req) => {
    const propertyType = req.query.property_type as string || 'all'
    const area = req.query.area as string || 'all'

    // In production: real-time feed from DLD APIs
    // For now: simulated real-time data
    const mockData = {
      property_type: propertyType,
      area,
      timestamp: new Date().toISOString(),
      transactions: Math.floor(Math.random() * 100) + 10,
      new_listings: Math.floor(Math.random() * 50) + 5,
      price_changes: Math.floor(Math.random() * 20),
      price_per_sqft_range: {
        min: Math.random() * 5000,
        max: Math.random() * 5000 + 10000,
      },
      volume_weighted_avg: Math.random() * 8000 + 3000,
    }

    return mcpResponseSchema.parse({
      success: true,
      data: mockData,
      error: undefined,
    })
  })

  // Broker activity feed
  app.get('/api/dld/broker/activity/:brn', async (req) => {
    const brn = req.params.brn

    // Validate BRN format
    if (!/^\d{15}$/.test(brn)) {
      return mcpResponseSchema.parse({
        success: false,
        error: 'Invalid BRN format. Must be 15 digits.',
      })
    }

    // In production: real-time broker activity from DLD
    // For now: mock data
    const mockActivity = {
      broker_brn: brn,
      active_listings: Math.floor(Math.random() * 50),
      closed_deals_today: Math.floor(Math.random() * 5),
      average_deal_value: Math.random() * 5000000,
      last_activity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
    }

    return mcpResponseSchema.parse({
      success: true,
      data: mockActivity,
      error: undefined,
    })
  })

  // Regulatory updates and circulars
  app.get('/api/dld/regulatory/updates', async (req) => {
    const type = req.query.type as string || 'all'

    // In production: DLD regulatory circulars feed
    // For now: mock updates
    const mockUpdates = [
      {
        id: Math.random().toString(36).substr(2, 9),
        title: 'Updated Escrow Regulations 2024',
        type: 'finance' as const,
        summary: 'New requirements for escrow account verification thresholds',
        issued_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        effective_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        url: '/regulatory/escrow-2024',
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        title: 'Broker License Renewal Guidelines',
        type: 'compliance' as const,
        summary: 'Updated renewal documentation and fees',
        issued_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        effective_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        url: '/regulatory/broker-renewal',
      },
    ]

    return mcpResponseSchema.parse({
      success: true,
      data: { updates: mockUpdates, total: mockUpdates.length },
      error: undefined,
    })
  })

  // Property search with DLD filters
  app.post('/api/dld/property/search', async (req) => {
    const b = z.object({
      property_type: z.string().optional(),
      min_price: z.number().optional(),
      max_price: z.number().optional(),
      min_area: z.number().optional(),
      max_area: z.number().optional(),
      area: z.string().optional(),
    }).parse(req.body)

    // In production: search DLD property database
    // For now: mock search results
    const mockResults = Array.from({ length: Math.floor(Math.random() * 10) + 1 }).map(
      (_, i) => ({
        property_id: Math.floor(Math.random() * 9000000) + 1000000,
        reference_no: `Prop-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        property_type: mockData.property_type || 'Residential',
        area_sqft: Math.floor(Math.random() * 2000) + 500,
        price: Math.floor(Math.random() * 5000000) + 1000000,
        price_per_sqft: Math.floor(Math.random() * 8000) + 3000,
        status: ['Available', 'Under Offer', 'Sold'][Math.floor(Math.random() * 3)],
        area: mockData.area || 'Dubai',
        address: `${Math.floor(Math.random() * 100) + 1} Street, ${mockData.area || 'Dubai'}`,
      })
    )

    return mcpResponseSchema.parse({
      success: true,
      data: {
        results: mockResults,
        total: mockResults.length,
        search_criteria: mockData,
        retrieved_at: new Date().toISOString(),
      },
      error: undefined,
    })
  })
}
