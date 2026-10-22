import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { q, tx } from '../db'
import { predictValuation, ValuationFeatures, ValuationResult } from './model'
import { analyzeMispricing, MispricingType, MispricingAnalysis } from './mispricing'
import { getComparableSales } from './comparables'
import { bad } from '../util'

export default async function (app: FastifyInstance) {
  // Predict property valuation
  app.post('/api/valuation/predict', async (req) => {
    const b = z.object({
      property_type: z.enum(['Apartment', 'Villa', 'Townhouse', 'Commercial', 'Land']),
      bedrooms: z.number().int().min(0),
      bathrooms: z.number().int().min(0),
      area_sqft: z.number().positive(),
      area_sqm: z.number().positive().optional(),
      floor: z.number().int().optional(),
      total_floors: z.number().int().optional(),
      tenure: z.enum(['Freehold', 'Leasehold', 'Usufruct']),
      age_years: z.number().int().min(0),
      location_score: z.number().int().min(0).max(100),
      proximity_marina: z.number().int().min(0).max(10),
      proximity_mall: z.number().int().min(0).max(10),
      proximity_school: z.number().int().min(0).max(10),
      view_score: z.number().int().min(0).max(10),
      furnishing: z.enum(['Unfurnished', 'Semi-Furnished', 'Fully Furnished']),
      building_age: z.number().int().optional(),
      floor_level: z.enum(['Ground', 'Middle', 'Top', 'Penthouse']),
      has_balcony: z.boolean(),
      has_parking: z.boolean(),
      has_storage: z.boolean(),
      renovation_status: z.enum(['None', 'Cosmetic', 'Renovated', 'Luxury Renovation']),
    }).parse(req.body)

    const features: ValuationFeatures = {
      property_type: b.property_type,
      bedrooms: b.bedrooms,
      bathrooms: b.bathrooms,
      area_sqft: b.area_sqft,
      area_sqm: b.area_sqm || Math.round(b.area_sqft / 10.764),
      floor: b.floor,
      total_floors: b.total_floors,
      tenure: b.tenure,
      age_years: b.age_years || (b.building_age || 0),
      location_score: b.location_score,
      proximity_marina: b.proximity_marina,
      proximity_mall: b.proximity_mall,
      proximity_school: b.proximity_school,
      view_score: b.view_score,
      furnishing: b.furnishing,
      building_age: b.building_age,
      floor_level: b.floor_level,
      has_balcony: b.has_balcony,
      has_parking: b.has_parking,
      has_storage: b.has_storage,
      renovation_status: b.renovation_status,
    }

    const result = await predictValuation(features)
    
    // Set property_id from features if available
    result.property_id = req.body.property_id || 0

    return result
  })

  // Analyze property mispricing
  app.post('/api/valuation/mispricing', async (req) => {
    const b = z.object({
      listed_price: z.number().positive(),
      property_id: z.number().int().optional(),
      property_features: z.object({
        property_type: z.enum(['Apartment', 'Villa', 'Townhouse', 'Commercial', 'Land']),
        bedrooms: z.number().int().min(0),
        bathrooms: z.number().int().min(0),
        area_sqft: z.number().positive(),
        // ... other features would be included here
      }).optional(),
    }).parse(req.body)

    // Build minimal features from body if provided
    const features: any = b.property_features 
      ? { ...b.property_features, area_sqft: b.property_features?.area_sqft }
      : {
          property_type: b.property_type || 'Apartment',
          bedrooms: b.bedrooms || 2,
          bathrooms: b.bathrooms || 2,
          area_sqft: b.area_sqft || 1000,
          location_score: 50,
          furnishing: 'Semi-Furnished',
          floor_level: 'Middle',
          has_balcony: false,
          has_parking: false,
          has_storage: false,
          renovation_status: 'None',
        }

    const mispricing = analyzeMispricing(b.listed_price, features)
    
    // Set property_id
    mispricing.propertyId = b.property_id || 0

    return mispricing
  })

  // Get comparable sales for a property
  app.post('/api/valuation/comparables', async (req) => {
    const b = z.object({
      property_id: z.number().int().optional(),
      radius_km: z.number().default(5),
    }).parse(req.body)

    // Build features from property (mock - would query DB)
    const features: ValuationFeatures = {
      property_type: 'Apartment',
      bedrooms: 2,
      bathrooms: 2,
      area_sqft: 1000,
      location_score: 50,
      furnishing: 'Semi-Furnished',
      floor_level: 'Middle',
      has_balcony: false,
      has_parking: false,
      has_storage: false,
      renovation_status: 'None',
      age_years: 5,
      proximity_marina: 5,
      proximity_mall: 5,
      proximity_school: 5,
      view_score: 5,
    }

    const comparables = getComparableSales(features, b.property_id, b.radius_km)

    return { comparables }
  })

  // Get mispricing analysis from database
  app.get('/api/valuation/mispricing/:propertyId', async (req) => {
    const propertyId = Number(req.params.propertyId)
    
    const analysis = await getMispricingAnalysis(propertyId)
    
    if (!analysis) {
      return bad('Mispricing analysis not found for this property. Run valuation first.')
    }

    return analysis
  })

  // Get valuation history for a property
  app.get('/api/valuation/history/:propertyId', async (req) => {
    const propertyId = Number(req.params.propertyId)
    
    // In production: query valuation history from database
    // For now: return mock history
    const mockHistory = [
      {
        valuation_date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months ago
        estimated_price: Math.floor(2000000 + Math.random() * 5000000),
        price_per_sqft: Math.floor(2000 + Math.random() * 500),
        market_condition: 'Stable',
      },
      {
        valuation_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
        estimated_price: Math.floor(1800000 + Math.random() * 4000000),
        price_per_sqft: Math.floor(1800 + Math.random() * 450),
        market_condition: 'Increasing',
      },
      {
        valuation_date: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(), // 2 years ago
        estimated_price: Math.floor(1600000 + Math.random() * 3000000),
        price_per_sqft: Math.floor(1600 + Math.random() * 400),
        market_condition: 'Stable',
      },
    ]

    return { history: mockHistory }
  })

  // Global mispricing overview for a area
  app.get('/api/valuation/overview', async (req) => {
    const area = req.query.area as string || 'Dubai'
    const propertyType = req.query.property_type as string || 'all'

    // In production: aggregate mispricing data from all properties in area
    // For now: return mock overview
    const mockOverview = {
      area,
      property_type: propertyType,
      total_properties: Math.floor(Math.random() * 500) + 100,
      under_valued: Math.floor(Math.random() * 50),
      over_valued: Math.floor(Math.random() * 30),
      fairly_priced: Math.floor(Math.random() * 200),
      average_discount_pct: Math.random() * 10,
      average_premium_pct: Math.random() * 15,
      generated_at: new Date().toISOString(),
    }

    return mockOverview
  })
}
