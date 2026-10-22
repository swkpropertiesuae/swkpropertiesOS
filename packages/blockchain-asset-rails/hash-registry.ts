/**
 * Hash Registry - Phase 4
 * 
 * Append-only hash registry for document versions using blockchain-like immutability.
 * Stores SHA256 hashes of document snapshots with metadata for audit trail.
 */

import { q } from '../db'
import type { Rec } from '../engine'
import { nowLocal } from '../util'
import { v4 as uuidv4 } from 'uuid'

// Document version record
export interface DocumentVersion {
  id: number
  document_id: number // Internal document ID
  version: number
  hash: string // SHA256 hash
  ipfs_cid: string // IPFS content identifier (optional)
  metadata: Record<string, any>
  created_by: number
  created_at: string
  is_current: boolean
}

// Hash registry operations
export class HashRegistry {
  // Calculate SHA256 hash of content
  static async calculateHash(content: string): Promise<string> {
    const crypto = await import('crypto')
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  // Register a new document version
  static async registerVersion(
    documentId: number,
    content: string,
    createdBy: number,
    ipfsCid?: string
  ): Promise<DocumentVersion> {
    const hash = await this.calculateHash(content)
    const version = await this.getCurrentVersion(documentId) + 1
    const id = await this.getNextId()

    const versionRecord: DocumentVersion = {
      id,
      document_id: documentId,
      version,
      hash,
      ipfs_cid: ipfsCid || '',
      metadata: {},
      created_by: createdBy,
      created_at: nowLocal(),
      is_current: true,
    }

    // Insert into hash_registry table
    await q.run(
      `INSERT INTO hash_registry (id, document_id, version, hash, ipfs_cid, metadata, created_by, created_at, is_current) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        versionRecord.id,
        versionRecord.document_id,
        versionRecord.version,
        versionRecord.hash,
        versionRecord.ipfs_cid,
        JSON.stringify(versionRecord.metadata),
        versionRecord.created_by,
        versionRecord.created_at,
        versionRecord.is_current,
      ]
    )

    // Mark previous versions as not current
    await q.run(
      `UPDATE hash_registry SET is_current = FALSE WHERE document_id = ? AND id < ?`,
      [documentId, versionRecord.id]
    )

    return versionRecord
  }

  // Get current version of a document
  static async getCurrentVersion(documentId: number): Promise<number> {
    const row = q.get(
      `SELECT MAX(version) as max_version FROM hash_registry WHERE document_id = ? AND is_current = TRUE`,
      documentId
    )
    return row?.max_version ?? 0
  }

  // Get all versions of a document
  static async getAllVersions(documentId: number): Promise<DocumentVersion[]> {
    const rows = q.all(
      `SELECT * FROM hash_registry WHERE document_id = ? ORDER BY version DESC`,
      documentId
    )
    return rows || []
  }

  // Get a specific version
  static async getVersion(documentId: number, version: number): Promise<DocumentVersion | null> {
    const row = q.get(
      `SELECT * FROM hash_registry WHERE document_id = ? AND version = ?`,
      documentId, version
    )
    return row || null
  }

  // Verify document integrity
  static async verifyIntegrity(documentId: number, content: string): Promise<{
    valid: boolean
    currentHash: string
    storedHash: string
    discrepancies: string[]
  }> {
    const currentVersion = await this.getCurrentVersion(documentId)
    if (currentVersion === 0) {
      return { valid: false, currentHash: '', storedHash: '', discrepancies: ['No versions found'] }
    }

    const version = await this.getVersion(documentId, currentVersion)
    if (!version) {
      return { valid: false, currentHash: '', storedHash: '', discrepancies: ['Version not found'] }
    }

    // Calculate current hash
    const storedHash = version.hash
    const calculatedHash = await this.calculateHash(content)

    const discrepancies: string[] = []
    if (storedHash !== calculatedHash) {
      discrepancies.push(`Hash mismatch: stored=${storedHash}, calculated=${calculatedHash}`)
    }

    return {
      valid: discrepancies.length === 0,
      currentHash: storedHash,
      storedHash: calculatedHash,
      discrepancies,
    }
  }

  // Get hash registry statistics
  static async getStatistics(documentId?: number): Promise<{
    totalVersions: number
    currentVersion: number
    firstVersionDate: string | null
    lastVersionDate: string | null
    totalDocuments: number
  }> {
    let where = ''
    const params: any[] = []

    if (documentId !== undefined) {
      where = 'WHERE document_id = ?'
      params.push(documentId)
    }

    const totalVersionsRow = q.get(
      `SELECT COUNT(*) as total FROM hash_registry ${where}`,
      ...params
    )
    const totalVersions = totalVersionsRow?.total ?? 0

    const currentVersionRow = q.get(
      `SELECT MAX(version) as max_version FROM hash_registry ${where} AND is_current = TRUE`,
      ...params
    )
    const currentVersion = currentVersionRow?.max_version ?? 0

    const dateRows = q.all(
      `SELECT MIN(created_at) as first, MAX(created_at) as last FROM hash_registry ${where}`,
      ...params
    )
    const firstVersionDate = dateRows?.[0]?.first || null
    const lastVersionDate = dateRows?.[0]?.last || null

    const totalDocumentsRow = q.get(
      `SELECT COUNT(DISTINCT document_id) as total FROM hash_registry ${where}`,
      ...params
    )
    const totalDocuments = totalDocumentsRow?.total ?? 0

    return {
      totalVersions,
      currentVersion,
      firstVersionDate,
      lastVersionDate,
      totalDocuments,
    }
  }
}

// Export types
export { DocumentVersion, HashRegistry }
