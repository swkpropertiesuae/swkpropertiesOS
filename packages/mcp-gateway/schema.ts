/**
 * MCP Gateway API Schemas and Types
 * Following ElvoraLogisticsOS patterns with zod validation
 */

import { z } from 'zod'

// MCP-Dubai request/response types
export const mcpDubaiAddressSchema = z.object({
  street: z.string().min(1),
  building: z.string().optional(),
  street_number: z.string().optional(),
  floor: z.string().optional(),
  apartment: z.string().optional(),
  emirate: z.enum(['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Fujairah', 'Ras Al Khaimah']),
  post_code: z.string().optional(),
})

export const mcpDubaiAddressResponseSchema = mcpDubaiAddressSchema.extend({
  validated: z.boolean().default(false),
  validated_at: z.string().datetime().optional(),
  validator_id: z.number().int().optional(),
})

export const emiratesIDSchema = z.object({
  id_number: z.string().regex(/^\d{15}$/, 'Emirates ID must be 15 digits'),
  full_name: z.string().min(1),
  expiry_date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Invalid date format'),
  nationality: z.string().min(1),
})

export const brokerLicenseSchema = z.object({
  brn: z.string().regex(/^\d{15}$/, 'BRN must be 15 digits'),
  company_name: z.string().min(1),
  status: z.enum(['Active', 'Inactive', 'Suspended', 'Pending']),
  issue_date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Invalid date format'),
  expiration_date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Invalid date format'),
})

// dld-mcp request/response types
export const ejariNoSchema = z.object({
  ejari_number: z.string().regex(/^EJ-[0-9]{7}$/, 'Invalid Ejari number format'),
  status: z.enum(['Active', 'Expired', 'Cancelled', 'Under Review']),
  property_type: z.enum(['Residential', 'Commercial', 'Off-plan', 'Vacant Land']),
  registration_date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Invalid date format'),
})

export const salesContractSchema = z.object({
  contract_no: z.string().min(1),
  property_id: z.number().int().min(1),
  seller_id: z.number().int().min(1),
  buyer_id: z.number().int().min(1),
  sale_price: z.number().positive(),
  status: z.enum(['Draft', 'Signed', 'DLD Submitted', 'DLD Approved', 'Title Deed Issued', 'Completed', 'Cancelled']),
  dld_application_no: z.string().optional(),
  dld_submission_date: z.string().datetime().optional(),
  title_deed_no: z.string().optional(),
  title_deed_date: z.string().datetime().optional(),
})

// Native DLD API types
export const dldMarketDataSchema = z.object({
  date: z.string().datetime(),
  property_type: z.string(),
  area_range: z.string(),
  price_range: z.string(),
  average_price_per_sqft: z.number(),
  total_transactions: z.number(),
})

export const brokerActivitySchema = z.object({
  broker_brn: z.string().regex(/^\d{15}$/, 'BRN must be 15 digits'),
  active_listings: z.number().int().min(0),
  closed_deals: z.number().int().min(0),
  average_deal_value: z.number().positive(),
  last_activity: z.string().datetime(),
})

// Unified response types
export const mcpResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  metadata: z.object({
    source: z.string(),
    retrieved_at: z.string().datetime(),
    request_id: z.string(),
    ttl_seconds: z.number().int().min(1),
  }).default({}),
})

export type MCPResponse<T> = z.infer<typeof mcpResponseSchema> & {
  data: T
}

// Error types
export class MCPError extends Error {
  code: string
  status: number
  retryable: boolean

  constructor(code: string, message: string, status = 500, retryable = false) {
    super(message)
    this.name = 'MCPError'
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

// Error codes
export const MCPErrorCodes = {
  VALIDATION: 'MCP_VALIDATION_ERROR',
  NOT_FOUND: 'MCP_NOT_FOUND',
  RATE_LIMIT: 'MCP_RATE_LIMIT',
  SERVICE_UNAVAILABLE: 'MCP_SERVICE_UNAVAILABLE',
  AUTHENTICATION: 'MCP_AUTHENTICATION',
  PERMISSION_DENIED: 'MCP_PERMISSION_DENIED',
  TIMEOUT: 'MCP_TIMEOUT',
} as const
