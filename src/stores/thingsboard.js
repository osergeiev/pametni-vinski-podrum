import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as tb from '@/services/thingsboard'

const DEFAULT_HOST = 'http://161.53.133.253:8080'
const LS_HOST = 'tb-host'
const LS_TOKEN = 'tb-token'

export const useThingsboardStore = defineStore('thingsboard', () => {
  const host = ref(localStorage.getItem(LS_HOST) || DEFAULT_HOST)
  const token = ref(localStorage.getItem(LS_TOKEN) || '')
  const devices = ref([])
  const connecting = ref(false)
  const error = ref('')

  const connected = computed(() => !!token.value)

  async function connect(hostArg, username, password) {
    connecting.value = true
    error.value = ''
    try {
      host.value = (hostArg || DEFAULT_HOST).trim()
      const jwt = await tb.login(host.value, username, password)
      token.value = jwt
      localStorage.setItem(LS_HOST, host.value)
      localStorage.setItem(LS_TOKEN, jwt)
      await loadDevices()
      return true
    } catch (err) {
      error.value = err.message
      token.value = ''
      localStorage.removeItem(LS_TOKEN)
      return false
    } finally {
      connecting.value = false
    }
  }

  async function loadDevices() {
    error.value = ''
    try {
      devices.value = await tb.listDevices(host.value, token.value)
    } catch (err) {
      // Token likely expired — force re-login.
      if (/401|403/.test(err.message)) disconnect()
      error.value = err.message
    }
  }

  function disconnect() {
    token.value = ''
    devices.value = []
    localStorage.removeItem(LS_TOKEN)
  }

  return { host, token, devices, connecting, error, connected, connect, loadDevices, disconnect }
})
