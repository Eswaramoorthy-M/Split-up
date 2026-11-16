import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // True until the saved session (kept in localStorage) has been read, so the
  // app never flashes the login page for someone who is already logged in.
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile((data as Profile | null) ?? null)
  }

  useEffect(() => {
    // Restore the saved login from localStorage.
    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session)
        setUser(data.session?.user ?? null)
        if (data.session?.user) loadProfile(data.session.user.id)
      })
      .finally(() => setLoading(false))

    // Stay in sync: sign-in, sign-out, token refresh, other browser tabs.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession?.user) {
        // Deferred: calling Supabase inside this callback can deadlock.
        const id = newSession.user.id
        setTimeout(() => { loadProfile(id) }, 0)
      } else {
        setProfile(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signUp: AuthState['signUp'] = async (email, password, name) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
    return { error: error?.message ?? null }
  }

  const signIn: AuthState['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword: AuthState['resetPassword'] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { error: error?.message ?? null }
  }

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
