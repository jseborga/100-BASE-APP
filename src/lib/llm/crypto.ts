import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // bytes for AES-256
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.LLM_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('LLM_ENCRYPTION_KEY (or SUPABASE_SERVICE_ROLE_KEY as fallback) not set')
  }
  // Accept hex string (64 chars) directly as key
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex')
  }
  // For longer keys (e.g. JWT service role key), derive a 32-byte key via SHA-256
  if (key.length >= KEY_LENGTH) {
    return crypto.createHash('sha256').update(key).digest()
  }
  throw new Error('LLM_ENCRYPTION_KEY must be at least 32 bytes')
}

export function encryptApiKey(plaintext: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()

  // Store encrypted data + authTag together
  const combined = Buffer.concat([
    Buffer.from(encrypted, 'base64'),
    authTag,
  ])

  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64'),
  }
}

export function decryptApiKey(encryptedBase64: string, ivBase64: string): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(ivBase64, 'base64')
  const combined = Buffer.from(encryptedBase64, 'base64')

  // Split encrypted data and authTag
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const encryptedData = combined.subarray(0, combined.length - AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedData)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

/** Mask an API key for display: sk-abc...xyz */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return key.slice(0, 6) + '...' + key.slice(-4)
}
