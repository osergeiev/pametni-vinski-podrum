import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as tb from '@/services/thingsboard'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const DEFAULT_HOST = 'http://161.53.133.253:8080'
const LS_HOST = 'tb-host'
const LS_TOKEN = 'tb-token'
const LS_REFRESH = 'tb-refresh'

export const useThingsboardStore = defineStore('thingsboard', () => {
  const host = ref(localStorage.getItem(LS_HOST) || DEFAULT_HOST)
  const token = ref(localStorage.getItem(LS_TOKEN) || '')
  const refreshToken = ref(localStorage.getItem(LS_REFRESH) || '')
  const devices = ref([])
  const customerId = ref('')
  const connecting = ref(false)
  const error = ref('')

  const connected = computed(() => !!token.value)

  function persist(jwt, rt) {
    token.value = jwt
    refreshToken.value = rt
    localStorage.setItem(LS_TOKEN, jwt)
    localStorage.setItem(LS_REFRESH, rt)
  }

  async function connect(hostArg, username, password) {
    connecting.value = true
    error.value = ''
    try {
      host.value = (hostArg || DEFAULT_HOST).trim()
      const { token: jwt, refreshToken: rt } = await tb.login(host.value, username, password)
      localStorage.setItem(LS_HOST, host.value)
      persist(jwt, rt)
      await ensureCustomer()
      await loadDevices()
      return true
    } catch (err) {
      error.value = err.message
      disconnect()
      return false
    } finally {
      connecting.value = false
    }
  }

  // Renew the access token using the stored refresh token. Returns success.
  async function refresh() {
    if (!refreshToken.value) {
      disconnect()
      return false
    }
    try {
      const { token: jwt, refreshToken: rt } = await tb.refresh(host.value, refreshToken.value)
      persist(jwt, rt)
      return true
    } catch {
      disconnect()
      return false
    }
  }

  // Run a service call with the current token; on expiry, refresh once and retry.
  async function authFetch(fn) {
    try {
      return await fn(token.value)
    } catch (err) {
      if (/expired|jwt|401|403/i.test(err.message) && (await refresh())) {
        return fn(token.value)
      }
      throw err
    }
  }

  async function loadDevices() {
    error.value = ''
    try {
      devices.value = await authFetch((tok) => tb.listDevices(host.value, tok))
    } catch (err) {
      error.value = err.message
    }
  }

  // Ensure this app account maps to exactly one ThingsBoard customer.
  // Reuses the stored mapping if present, otherwise creates the customer
  // (titled by the user's email) and persists the mapping in `profiles`.
  async function ensureCustomer() {
    const auth = useAuthStore()
    if (!auth.user?.id) return ''
    const title = auth.email || `app-${auth.user.id}`
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tb_customer_id')
        .eq('id', auth.user.id)
        .maybeSingle()
      if (profile?.tb_customer_id) {
        customerId.value = profile.tb_customer_id
        return customerId.value
      }
      const id = await authFetch((tok) => tb.ensureCustomer(host.value, tok, title))
      customerId.value = id
      await supabase
        .from('profiles')
        .upsert({ id: auth.user.id, tb_customer_id: id, tb_customer_title: title })
      return id
    } catch (err) {
      error.value = `ThingsBoard customer: ${err.message}`
      return ''
    }
  }

  function disconnect() {
    token.value = ''
    refreshToken.value = ''
    devices.value = []
    customerId.value = ''
    localStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_REFRESH)
  }

  return {
    host,
    token,
    refreshToken,
    devices,
    customerId,
    connecting,
    error,
    connected,
    connect,
    refresh,
    authFetch,
    loadDevices,
    ensureCustomer,
    disconnect,
  }
})
