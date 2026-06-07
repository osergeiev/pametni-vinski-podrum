import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as tb from '@/services/thingsboard'

const DEFAULT_HOST = 'http://161.53.133.253:8080'
const LS_HOST = 'tb-host'
const LS_TOKEN = 'tb-token'
const LS_REFRESH = 'tb-refresh'

export const useThingsboardStore = defineStore('thingsboard', () => {
  const host = ref(localStorage.getItem(LS_HOST) || DEFAULT_HOST)
  const token = ref(localStorage.getItem(LS_TOKEN) || '')
  const refreshToken = ref(localStorage.getItem(LS_REFRESH) || '')
  const devices = ref([])
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

  function disconnect() {
    token.value = ''
    refreshToken.value = ''
    devices.value = []
    localStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_REFRESH)
  }

  return {
    host,
    token,
    refreshToken,
    devices,
    connecting,
    error,
    connected,
    connect,
    refresh,
    authFetch,
    loadDevices,
    disconnect,
  }
})
