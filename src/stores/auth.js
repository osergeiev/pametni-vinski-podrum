import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const session = ref(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!session.value)
  const email = computed(() => user.value?.email ?? '')

  // Restore an existing session and listen for auth changes.
  async function init() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    loading.value = false

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
    })
  }

  async function signUp(emailArg, password) {
    const { data, error } = await supabase.auth.signUp({
      email: emailArg,
      password,
    })
    if (error) throw error
    // If email confirmation is disabled the session is returned immediately.
    session.value = data.session
    user.value = data.user
    return data
  }

  async function signIn(emailArg, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailArg,
      password,
    })
    if (error) throw error
    session.value = data.session
    user.value = data.user
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
  }

  return {
    user,
    session,
    loading,
    isAuthenticated,
    email,
    init,
    signUp,
    signIn,
    signOut,
  }
})
