import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSensorsStore = defineStore('sensors', () => {
  // --- State ---
  const temperature = ref(13.2)
  const humidity = ref(68)
  const co2 = ref(420)
  const acOn = ref(false)

  const tempHistory = ref(
    Array.from({ length: 20 }, (_, i) => 12.5 + Math.sin(i * 0.5) * 1.2 + Math.random() * 0.3)
  )
  const humidHistory = ref(
    Array.from({ length: 20 }, (_, i) => 67 + Math.sin(i * 0.3) * 3 + Math.random())
  )
  const co2History = ref(
    Array.from({ length: 20 }, (_, i) => 400 + Math.sin(i * 0.4) * 60 + Math.random() * 20)
  )

  const lastUpdated = ref(null)
  const isConnected = ref(false)
  const logs = ref([
    { id: 1, time: timeNow(), msg: 'Sustav pokrenut — demo način rada.', type: 'warn' },
    { id: 2, time: timeNow(), msg: 'Senzori inicijalizirani.', type: 'ok' },
  ])

  const tbConfig = ref({
    host: '',
    token: '',
    protocol: 'HTTP',
  })

  // --- Computed ---
  const tempStatus = computed(() => {
    const t = temperature.value
    if (t < 10) return { label: 'Prehladno', color: 'warn' }
    if (t > 16) return { label: 'Previše toplo — provjeri klimu', color: 'bad' }
    return { label: 'Optimalno (10–16°C)', color: 'ok' }
  })

  const humidStatus = computed(() => {
    const h = humidity.value
    if (h < 50) return { label: 'Presuho — rizik za čepove', color: 'bad' }
    if (h > 80) return { label: 'Previsoka vlaga — plijesan', color: 'warn' }
    return { label: 'Optimalno (60–75%)', color: 'ok' }
  })

  const co2Status = computed(() => {
    const c = co2.value
    if (c < 600) return { label: 'Odličan zrak', color: 'ok' }
    if (c < 1000) return { label: 'Malo povišeno', color: 'warn' }
    return { label: 'Visoko — prozrači podrum', color: 'bad' }
  })

  // Dew point calculated from temp + humidity (Magnus formula)
  const dewPoint = computed(() => {
    const T = temperature.value
    const RH = humidity.value
    const a = 17.27, b = 237.7
    const alpha = ((a * T) / (b + T)) + Math.log(RH / 100)
    return parseFloat(((b * alpha) / (a - alpha)).toFixed(1))
  })

  // AC auto-logic: turn on if temp > 15.5 or humidity > 78
  const acStatus = computed(() => {
    const shouldRun = temperature.value > 15.5 || humidity.value > 78
    return {
      active: acOn.value || shouldRun,
      reason: temperature.value > 15.5
        ? 'Temperatura visoka'
        : humidity.value > 78
          ? 'Vlaga visoka'
          : acOn.value
            ? 'Ručno uključeno'
            : 'Standby',
    }
  })

  // --- Actions ---
  function timeNow() {
    return new Date().toTimeString().slice(0, 8)
  }

  function addLog(msg, type = 'ok') {
    logs.value.unshift({ id: Date.now(), time: timeNow(), msg, type })
    if (logs.value.length > 50) logs.value.pop()
  }

  function toggleAc() {
    acOn.value = !acOn.value
    addLog(`Klima ${acOn.value ? 'uključena ručno' : 'isključena ručno'}.`, acOn.value ? 'ok' : 'warn')
  }

  function pushHistory(temp, humid, c) {
    tempHistory.value.push(temp)
    humidHistory.value.push(humid)
    co2History.value.push(c)
    if (tempHistory.value.length > 20) tempHistory.value.shift()
    if (humidHistory.value.length > 20) humidHistory.value.shift()
    if (co2History.value.length > 20) co2History.value.shift()
  }

  function mockTick() {
    temperature.value = parseFloat((12 + Math.random() * 4).toFixed(1))
    humidity.value = parseFloat((58 + Math.random() * 22).toFixed(0))
    co2.value = parseFloat((360 + Math.random() * 280).toFixed(0))
    lastUpdated.value = timeNow()
    pushHistory(temperature.value, humidity.value, co2.value)
    addLog(`Novi očitci — T: ${temperature.value}°C, RH: ${humidity.value}%, CO₂: ${co2.value} ppm`)
  }

  async function fetchFromThingsboard() {
    const { host, token } = tbConfig.value
    if (!host || !token) {
      addLog('ThingsBoard nije konfiguriran.', 'warn')
      return
    }
    try {
      const url = `${host}/api/v1/${token}/attributes`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      if (data.temperature !== undefined) temperature.value = data.temperature
      if (data.humidity !== undefined) humidity.value = data.humidity
      if (data.co2 !== undefined) co2.value = data.co2
      if (data.ac !== undefined) acOn.value = data.ac

      lastUpdated.value = timeNow()
      isConnected.value = true
      pushHistory(temperature.value, humidity.value, co2.value)
      addLog('Podaci dohvaćeni s ThingsBoard-a.')
    } catch (err) {
      isConnected.value = false
      addLog(`Greška pri dohvatu: ${err.message}`, 'warn')
    }
  }

  return {
    temperature, humidity, co2, acOn,
    tempHistory, humidHistory, co2History,
    lastUpdated, isConnected, logs, tbConfig,
    tempStatus, humidStatus, co2Status,
    dewPoint, acStatus,
    mockTick, fetchFromThingsboard, addLog, toggleAc,
  }
})