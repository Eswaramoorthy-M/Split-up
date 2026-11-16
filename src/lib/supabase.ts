import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Never use the service-role key here. Only the public anon key belongs in
// frontend code; Row Level Security policies do the real authorization.
// Placeholder values keep the module importable so main.tsx can show a
// friendly "setup needed" message instead of a blank page.
export const supabase = createClient<Database>(
  url || 'http://localhost:54321',
  anonKey || 'missing-key',
  { auth: { persistSession: true, autoRefreshToken: true } }
)
