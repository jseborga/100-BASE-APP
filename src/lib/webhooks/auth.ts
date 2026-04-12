import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton admin client (bypasses RLS)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: SupabaseClient<any> | null = null
export function getAdmin(): SupabaseClient<any> {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

/**
 * Validate webhook API key from Authorization header.
 * Supports two modes:
 *   1. WEBHOOK_API_KEY env var (simple, single key)
 *   2. Future: DB-stored keys in webhook_keys table
 *
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateWebhookAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header. Use: Bearer <api-key>' },
      { status: 401 }
    )
  }

  const token = authHeader.slice(7)
  const validKey = process.env.WEBHOOK_API_KEY

  if (!validKey) {
    return NextResponse.json(
      { error: 'Webhook API key not configured on server. Set WEBHOOK_API_KEY env var.' },
      { status: 503 }
    )
  }

  // Constant-time comparison to prevent timing attacks
  if (token.length !== validKey.length || !timingSafeEqual(token, validKey)) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 403 }
    )
  }

  return null // Valid
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
