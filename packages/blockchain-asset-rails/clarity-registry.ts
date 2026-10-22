/**
 * Clarity Real Estate Registry - Phase 4
 * 
 * Pattern for real estate asset registry on blockchain (XRPL/Stacks).
 * Provides the framework for on-chain property records and smart contracts.
 */

/**
 * Property record structure for blockchain
 */
export interface BlockchainPropertyRecord {
  propertyId: number
  // On-chain identifiers
  xrplId: string // XRPL account or token ID
  stacksId: string // Stacks token ID
  // Property details
  titleDeedNumber: string
  propertyType: 'Apartment' | 'Villa' | 'Townhouse' | 'Commercial' | 'Land'
  areaSqFt: number
  areaSqM: number
  location: string // Emirate/area
  // Ownership
  ownerId: string // DLD BRN or company ID
  previousOwnerId?: string
  // Financial
  purchasePrice: number
  purchaseDate: string
  // Status
  status: 'Active' | 'Transferred' | 'Encumbered' | 'Closed'
  // Timestamps
  createdAt: string
  updatedAt: string
}

/**
 * Escrow record structure for blockchain
 */
export interface BlockchainEscrowRecord {
  escrowId: number
  propertyId: number
  // On-chain identifiers
  xrplEscrowId: string
  stacksEscrowId: string
  // Parties
  sellerId: string
  buyerId: string
  agentId?: string
  // Financial
  totalAmount: number
  amountReleased: number
  releaseConditions: string // Hash of conditions
  releaseStatus: 'Pending' | 'PartiallyReleased' | 'FullyReleased' | 'Returned'
  // Timestamps
  createdAt: string
  lastUpdated: string
}

/**
 * Transaction record for blockchain
 */
export interface BlockchainTransactionRecord {
  txId: string
  hash: string
  type: 'Payment' | 'Release' | 'Transfer' | 'Mint' | 'Burn'
  fromId: string
  toId: string
  amount?: number
  propertyId?: number
  status: 'Success' | 'Failed' | 'Pending' | 'Reversed'
  timestamp: string
  metadata?: Record<string, any>
}

/**
 * Registry operations
 */
export class ClarityRegistry {
  // Register property on blockchain
  static async registerProperty(
    propertyId: number,
    titleDeedNumber: string,
    propertyType: 'Apartment' | 'Villa' | 'Townhouse' | 'Commercial' | 'Land',
    areaSqFt: number,
    areaSqM: number,
    location: string,
    ownerId: string
  ): Promise<BlockchainPropertyRecord> {
    const record: BlockchainPropertyRecord = {
      propertyId,
      xrplId: `xrpl-${propertyId}-${Date.now()}`,
      stacksId: `stacks-${propertyId}-${Date.now()}`,
      titleDeedNumber,
      propertyType,
      areaSqFt,
      areaSqM: Math.round(areaSqFt * 0.092903), // Convert sqft to sqm
      location,
      ownerId,
      purchasePrice: 0,
      purchaseDate: new Date().toISOString(),
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // In production: write to XRPL/Stacks smart contract
    // For now: store in database with blockchain markers
    await q.run(
      `INSERT INTO blockchain_properties (property_id, xrpl_id, stacks_id, title_deed_number, property_type, area_sqft, area_sqm, location, owner_id, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.propertyId,
        record.xrplId,
        record.stacksId,
        record.titleDeedNumber,
        record.propertyType,
        record.areaSqFt,
        record.areaSqM,
        record.location,
        record.ownerId,
        record.status,
        record.createdAt,
        record.updatedAt,
      ]
    )

    return record
  }

  // Update property ownership
  static async updateOwnership(
    propertyId: number,
    newOwnerId: string,
    previousOwnerId: string
  ): Promise<BlockchainPropertyRecord | null> {
    // Update in database
    await q.run(
      `UPDATE blockchain_properties SET owner_id = ?, previous_owner_id = ?, updated_at = ? WHERE property_id = ?`,
      [newOwnerId, previousOwnerId, new Date().toISOString(), propertyId]
    )

    // Return updated record
    const row = q.get(
      `SELECT * FROM blockchain_properties WHERE property_id = ?`,
      propertyId
    )

    return row || null
  }

  // Register escrow on blockchain
  static async registerEscrow(
    escrowId: number,
    propertyId: number,
    sellerId: string,
    buyerId: string,
    agentId?: string,
    totalAmount: number
  ): Promise<BlockchainEscrowRecord> {
    const record: BlockchainEscrowRecord = {
      escrowId,
      propertyId,
      xrplEscrowId: `xrpl-escrow-${escrowId}-${Date.now()}`,
      stacksEscrowId: `stacks-escrow-${escrowId}-${Date.now()}`,
      sellerId,
      buyerId,
      agentId: agentId || '',
      totalAmount,
      amountReleased: 0,
      releaseConditions: '',
      releaseStatus: 'Pending',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    }

    // In production: create XRPL/Stacks escrow smart contract
    // For now: store in database
    await q.run(
      `INSERT INTO blockchain_escrows (escrow_id, property_id, xrpl_escrow_id, stacks_escrow_id, seller_id, buyer_id, agent_id, total_amount, amount_released, release_status, created_at, last_updated) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.escrowId,
        record.propertyId,
        record.xrplEscrowId,
        record.stacksEscrowId,
        record.sellerId,
        record.buyerId,
        record.agentId,
        record.totalAmount,
        record.amountReleased,
        record.releaseStatus,
        record.createdAt,
        record.lastUpdated,
      ]
    )

    return record
  }

  // Update escrow release status
  static async updateEscrowRelease(
    escrowId: number,
    amountReleased: number,
    releaseStatus: 'Pending' | 'PartiallyReleased' | 'FullyReleased' | 'Returned',
    releaseConditionsHash: string
  ): Promise<BlockchainEscrowRecord | null> {
    await q.run(
      `UPDATE blockchain_escrows SET amount_released = ?, release_status = ?, last_updated = ?, release_conditions_hash = ? WHERE escrow_id = ?`,
      [amountReleased, releaseStatus, new Date().toISOString(), releaseConditionsHash, escrowId]
    )

    const row = q.get(
      `SELECT * FROM blockchain_escrows WHERE escrow_id = ?`,
      escrowId
    )

    return row || null
  }

  // Record blockchain transaction
  static async recordTransaction(
    txHash: string,
    txType: 'Payment' | 'Release' | 'Transfer' | 'Mint' | 'Burn',
    fromId: string,
    toId: string,
    amount?: number,
    propertyId?: number
  ): Promise<BlockchainTransactionRecord> {
    const record: BlockchainTransactionRecord = {
      txId: uuidv4().toString().replace(/-/g, '').substring(0, 24),
      hash: txHash,
      type: txType,
      fromId,
      toId,
      amount,
      propertyId,
      status: 'Success',
      timestamp: new Date().toISOString(),
    }

    // In production: write to XRPL/Stacks ledger
    // For now: store in database
    await q.run(
      `INSERT INTO blockchain_transactions (tx_id, hash, type, from_id, to_id, amount, property_id, status, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.txId,
        record.hash,
        record.type,
        record.fromId,
        record.toId,
        record.amount,
        record.propertyId,
        record.status,
        record.timestamp,
      ]
    )

    return record
  }

  // Get property record
  static async getProperty(propertyId: number): Promise<BlockchainPropertyRecord | null> {
    const row = q.get(
      `SELECT * FROM blockchain_properties WHERE property_id = ?`,
      propertyId
    )
    return row || null
  }

  // Get escrow record
  static async getEscrow(escrowId: number): Promise<BlockchainEscrowRecord | null> {
    const row = q.get(
      `SELECT * FROM blockchain_escrows WHERE escrow_id = ?`,
      escrowId
    )
    return row || null
  }

  // Get transaction record
  static async getTransaction(txId: string): Promise<BlockchainTransactionRecord | null> {
    const row = q.get(
      `SELECT * FROM blockchain_transactions WHERE tx_id = ?`,
      txId
    )
    return row || null
  }

  // Get properties by owner
  static async getPropertiesByOwner(ownerId: string): Promise<BlockchainPropertyRecord[]> {
    const rows = q.all(
      `SELECT * FROM blockchain_properties WHERE owner_id = ? ORDER BY created_at DESC`,
      ownerId
    )
    return rows || []
  }

  // Get escrows by property
  static async getEscrowsByProperty(propertyId: number): Promise<BlockchainEscrowRecord[]> {
    const rows = q.all(
      `SELECT * FROM blockchain_escrows WHERE property_id = ? ORDER BY created_at DESC`,
      propertyId
    )
    return rows || []
  }
}

// Export types
export type { BlockchainPropertyRecord, BlockchainEscrowRecord, BlockchainTransactionRecord }
