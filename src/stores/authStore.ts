import { create } from 'zustand'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface Profile {
  id: string
  email: string
  full_name: string | null
  goal_rvu_per_day: number
}

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>
  fetchProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        set({ user: session.user, session })
        await get().fetchProfile()
      }
      
      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({ user: session?.user ?? null, session })
        
        if (session?.user) {
          await get().fetchProfile()
        } else {
          set({ profile: null })
        }
      })
    } finally {
      set({ initialized: true })
    }
  },

  fetchProfile: async () => {
    const { user } = get()
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      set({ profile: data as Profile })
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error: error as Error | null }
    } finally {
      set({ loading: false })
    }
  },

  signUp: async (email: string, password: string, fullName: string) => {
    set({ loading: true })
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })
      return { error: error as Error | null }
    } finally {
      set({ loading: false })
    }
  },

  signOut: async () => {
    set({ loading: true })
    try {
      await supabase.auth.signOut()
      set({ user: null, session: null, profile: null })
    } finally {
      set({ loading: false })
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const { user } = get()
    if (!user) return { error: new Error('No user logged in') }

    set({ loading: true })
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (!error) {
        await get().fetchProfile()
      }
      return { error: error as Error | null }
    } finally {
      set({ loading: false })
    }
  },
}))

