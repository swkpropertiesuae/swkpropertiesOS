/**
 * Verifiable Credentials - Phase 4
 * 
 * W3C Verifiable Credentials for real estate documents:
 * - Property title deeds
 * - Sales contracts
 * - Escrow agreements
 * - RERA registrations
 * - Agent certifications
 */

import crypto from 'crypto'

// W3C Verifiable Credential types
export enum CredentialType {
  PROPERTY_TITLE_DEED = 'PropertyTitleDeed',
  SALES_CONTRACT = 'SalesContract',
  ESCROW_AGREEMENT = 'EscrowAgreement',
  RERA_REGISTRATION = 'RERA Registration',
  AGENT_CERTIFICATION = 'AgentCertification',
  PROPERTY_INSPECTION = 'PropertyInspection',
}

// Verifiable credential interface
export interface VerifiableCredential {
  '@context': string[]
  id: string
  type: CredentialType[]
  issuer: {
    id: string
    name: string
  }
  issuanceDate: string
  expirationDate?: string
  credentialSubject: {
    id: string
    type: string
    propertyId?: number
    // Credential-specific fields
    [key: string]: any
  }
  proof?: {
    type: string
    created: string
    jws: string
  }
}

// Issuer types
export interface Issuer {
  id: string
  name: string
  organization: string
  role: 'DLD' | 'RERA' | 'Company' | 'Agent' | 'Notary'
  contact: string
}

// Holder types
export interface Holder {
  id: string
  name: string
  organization: string
  role: 'Buyer' | 'Seller' | 'Agent' | 'Lawyer' | 'Authority'
}

// Create a verifiable credential
export function createCredential(
  type: CredentialType[],
  issuer: Issuer,
  holder: Holder,
  credentialSubject: Record<string, any>,
  options: {
    expirationDate?: string
    additionalContext?: string[]
  } = {}
): VerifiableCredential {
  const contexts = [
    'https://www.w3.org/2018/credentials/v1',
    ...(options.additionalContext || []),
  ]

  const credential: VerifiableCredential = {
    '@context': contexts,
    id: `urn:uuid:${uuidv4()}`,
    type,
    issuer,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: holder.id,
      type: holder.role,
      ...credentialSubject,
    },
  }

  // Add expiration if specified
  if (options.expirationDate) {
    credential.expirationDate = options.expirationDate
  }

  // Add proof (simplified - would use JWS in production)
  credential.proof = {
    type: 'JsonWebSignature2020',
    created: new Date().toISOString(),
    jws: '', // Would be actual JWS signature
  }

  return credential
}

// Verify a verifiable credential
export function verifyCredential(credential: VerifiableCredential): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check required fields
  if (!credential['@context']) errors.push('Missing @context')
  if (!credential.id) errors.push('Missing id')
  if (!credential.type || credential.type.length === 0) errors.push('Missing type')
  if (!credential.issuer || !credential.issuer.id) errors.push('Missing issuer id')
  if (!credential.issuanceDate) errors.push('Missing issuanceDate')
  if (!credential.credentialSubject || !credential.credentialSubject.id) errors.push('Missing credentialSubject id')

  // Check types
  if (!Array.isArray(credential.type)) errors.push('Type must be an array')

  // Basic validity check
  const valid = errors.length === 0

  return { valid, errors }
}

// Credential registry using hash registry
export class CredentialRegistry {
  // Store credential hash in hash registry
  static async registerCredential(credential: VerifiableCredential): Promise<string> {
    const content = JSON.stringify(credential)
    const hash = crypto.createHash('sha256').update(content).digest('hex')

    // Insert into credentials table
    const result = await q.run(
      `INSERT INTO verifiable_credentials (credential_id, credential_type, holder_id, holder_organization, issuer_id, issuer_organization, content_hash, issued_at, is_revoked) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [
        credential.id,
        credential.type.join(','),
        credential.credentialSubject.id,
        credential.credentialSubject.type,
        credential.issuer.id,
        credential.issuer.organization,
        hash,
        credential.issuanceDate,
      ]
    )

    return result.lastID ? result.lastID.toString() : ''
  }

  // Get a credential by ID
  static async getCredential(credentialId: string): Promise<VerifiableCredential | null> {
    const row = q.get(
      `SELECT * FROM verifiable_credentials WHERE credential_id = ?`,
      credentialId
    )

    if (!row) return null

    // Reconstruct credential (simplified)
    const credential: VerifiableCredential = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: row.credential_id,
      type: row.credential_type?.split(',') || [],
      issuer: {
        id: row.issuer_id,
        name: 'Organization', // Would need to fetch
        organization: row.issuer_organization,
        role: 'Company', // Would need to fetch
      },
      issuanceDate: row.issued_at,
      credentialSubject: {
        id: row.holder_id,
        type: row.holder_organization,
      },
    }

    return credential
  }

  // Check if credential is revoked
  static async isRevoked(credentialId: string): Promise<boolean> {
    const row = q.get(
      `SELECT is_revoked FROM verifiable_credentials WHERE credential_id = ?`,
      credentialId
    )
    return row?.is_revoked === 1
  }

  // Revoke a credential
  static async revokeCredential(credentialId: string): Promise<boolean> {
    const result = await q.run(
      `UPDATE verifiable_credentials SET is_revoked = TRUE WHERE credential_id = ?`,
      credentialId
    )
    return result.changes > 0
  }
}

// Export types
export type { VerifiableCredential, Issuer, Holder, CredentialType }
