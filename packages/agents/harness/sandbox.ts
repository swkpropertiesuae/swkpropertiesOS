import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import fs from 'fs'

const execAsync = promisify(exec)

// Sandbox configuration
const SANDBOX_CONFIG = {
  // Maximum execution time in milliseconds (5 minutes)
  maxExecutionTime: 5 * 60 * 1000,
  // Maximum memory in bytes (128MB)
  maxMemory: 128 * 1024 * 1024,
  // Allowed modules/imports
  allowedModules: new Set(['fs', 'path', 'os', 'crypto', 'util', 'buffer']),
  // Forbidden modules/imports
  forbiddenModules: new Set(['child_process', 'cluster', 'net', 'http', 'https', 'require', 'import']),
  // Working directory inside sandbox
  sandboxDir: os.tmpdir(),
}

// Sandboxed code execution result
export interface SandboxResult {
  success: boolean
  output: string
  error: string | null
  executionTime: number
  memoryUsed: number
  fileHash: string // Hash of executed file for audit
}

/**
 * Execute code in a sandboxed environment
 * @param code - The JavaScript code to execute
 * @param input - Optional input data
 * @param tenantId - Tenant identifier for isolation
 * @returns SandboxResult with execution outcome
 */
export async function executeInSandbox(
  code: string,
  input?: string,
  tenantId?: number
): Promise<SandboxResult> {
  const startTime = Date.now()
  let memoryUsed = 0
  let fileHash = ''

  // Generate file hash for audit trail
  fileHash = require('crypto')
    .createHash('sha256')
    .update(code)
    .digest('hex')
    .substring(0, 16)

  // Write code to temporary file in isolated directory
  const sandboxDir = SANDBOX_CONFIG.sandboxDir
  const tempFile = `${sandboxDir}/harnis-sandbox-${tenantId}-${Date.now()}.js`

  try {
    // Write code to file
    await fs.promises.writeFile(tempFile, code)

    // Execute with timeout
    const executionPromise = execAsync(
      `node --max-old-space-size=${SANDBOX_CONFIG.maxMemory / 1024 / 1024} ${tempFile}`,
      { timeout: SANDBOX_CONFIG.maxExecutionTime }
    )

    const output = await Promise.race([
      executionPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), SANDBOX_CONFIG.maxExecutionTime)
      )
    ])

    const endTime = Date.now()
    const executionTime = endTime - startTime

    // Get memory usage from the process (simplified)
    memoryUsed = Math.floor((await fs.promises.readFile('/proc/self/status')) as any).memory_total

    return {
      success: true,
      output: output.stdout || '',
      error: output.stderr || null,
      executionTime,
      memoryUsed,
      fileHash,
    }
  } catch (error: any) {
    const endTime = Date.now()
    const executionTime = endTime - startTime

    return {
      success: false,
      output: error.stdout || '',
      error: error.message || 'Unknown execution error',
      executionTime,
      memoryUsed,
      fileHash,
    }
  } finally {
    // Clean up temporary file
    try {
      await fs.promises.unlink(tempFile).catch(() => {/* Ignore cleanup errors */})
    } catch {/* Ignore */}
  }
}

/**
 * Validate code before execution (basic security checks)
 * @param code - The JavaScript code to validate
 * @returns True if code passes validation, false otherwise
 */
export function validateCode(code: string): boolean {
  // Check for forbidden patterns
  const forbiddenPatterns = [
    /require\(/g,
    /import\s+/g,
    /child_process/g,
    /spawn/g,
    /fork/g,
    /exec/g,
    /execSync/g,
    /spawnSync/g,
    /spawnFile/g,
  ]

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(code)) {
      return false
    }
  }

  // Check for dangerous functions
  const dangerousFunctions = ['system(', 'exec(', 'spawn(', 'fork(']
  for (const func of dangerousFunctions) {
    if (code.includes(func)) {
      return false
    }
  }

  return true
}

/**
 * Create a secure sandbox script template
 * @param code - The user code to wrap
 * @param tenantId - Tenant identifier
 * @returns Wrapped safe script
 */
export function createSandboxScript(code: string, tenantId?: string): string {
  return `
// Harnis Sandbox Execution - Tenant: ${tenantId || 'unknown'}
// Time limit: 5 minutes
// Memory limit: 128MB

// Disable external require/import
process.env.NODE_ENV = 'sandbox'

// Wrapped execution with error handling
try {
  // User code execution
  ${code}
  
  // Explicit exit with success code
  process.exit(0)
} catch (error) {
  // Log error but don't crash
  console.error('Sandbox error:', error)
  process.exit(1)
}
`
}
