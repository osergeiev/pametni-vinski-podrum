import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import * as tbsvc from '@/services/thingsboard'
import { useThingsboardStore } from '@/stores/thingsboard'

const WINDOW_MIN = 15 // visible window in minutes
const LIVE_POLL_MS = 30000 // how often we poll the real source

export const useSensorsStore = defineStore('sensors', () => {
  // --- State (scoped to the currently open room) ---
  const room = ref(null)
  const devices = ref([])
  const readingsByDevice = ref({}) // { [deviceId]: [readings asc, last WINDOW_MIN min] }
  const actuations = ref([])
  const logs = ref([])
  const loading = ref(false)
  const connected = ref(false)
  const liveRunning = ref(false)

  let channel = null
  let liveTimer = null
  const lastAtByDevice = {} // deviceId -> ISO string of last stored reading

  // --- Helpers ---
  function timeNow() {
    return new Date().toTimeString().slice(0, 8)
  }

  function addLog(msg, type = 'ok') {
    logs.value.unshift({ id: Date.now() + Math.random(), time: timeNow(), msg, type })
    if (logs.value.length > 50) logs.value.pop()
  }

  function sensorDevices() {
    return devices.value.filter((d) => d.type === 'sensor')
  }

  function pruneWindow(deviceId) {
    const cutoff = Date.now() - WINDOW_MIN * 60 * 1000
    const arr = readingsByDevice.value[deviceId]
    if (arr) {
      readingsByDevice.value[deviceId] = arr.filter(
        (r) => new Date(r.recorded_at).getTime() >= cutoff,
      )
    }
  }

  // --- Loading a room ---
  async function loadRoom(roomId) {
    loading.value = true
    await unload()
    await Promise.all([fetchRoom(roomId), fetchDevices(roomId), fetchActuations(roomId)])
    await fetchAllReadings(roomId)
    subscribeRealtime(roomId)
    loading.value = false
    addLog(`Prostorija "${room.value?.name ?? ''}" učitana.`)
  }

  async function fetchRoom(roomId) {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, location, created_at')
      .eq('id', roomId)
      .single()
    if (error) {
      addLog(`Greška: ${error.message}`, 'warn')
      return
    }
    room.value = data
  }

  async function fetchDevices(roomId) {
    const { data } = await supabase
      .from('devices')
      .select('id, name, type, external_id, metrics, state, source, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
    devices.value = data ?? []
  }

  async function fetchReadings(deviceId) {
    const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('readings')
      .select('id, temperature, humidity, co2, recorded_at')
      .eq('device_id', deviceId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
    if (error) {
      addLog(`Greška pri dohvatu očitanja: ${error.message}`, 'warn')
      return
    }
    readingsByDevice.value[deviceId] = data ?? []
    const last = data?.[data.length - 1]
    if (last) lastAtByDevice[deviceId] = last.recorded_at
  }

  async function fetchAllReadings() {
    await Promise.all(sensorDevices().map((d) => fetchReadings(d.id)))
  }

  async function fetchActuations(roomId) {
    const { data } = await supabase
      .from('actuations')
      .select('id, device_id, command, state, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(30)
    actuations.value = data ?? []
  }

  // --- Realtime ---
  function subscribeRealtime(roomId) {
    channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const r = payload.new
          const arr = readingsByDevice.value[r.device_id]
          if (!arr) return
          if (arr.some((x) => x.id === r.id)) return
          arr.push(r)
          arr.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
          pruneWindow(r.device_id)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices', filter: `room_id=eq.${roomId}` },
        () => fetchDevices(roomId),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'actuations', filter: `room_id=eq.${roomId}` },
        (payload) => actuations.value.unshift(payload.new),
      )
      .subscribe((status) => {
        connected.value = status === 'SUBSCRIBED'
      })
  }

  async function unload() {
    stopLiveFeed()
    if (channel) {
      await supabase.removeChannel(channel)
      channel = null
    }
    connected.value = false
    room.value = null
    devices.value = []
    readingsByDevice.value = {}
    actuations.value = []
    for (const k of Object.keys(lastAtByDevice)) delete lastAtByDevice[k]
  }

  // --- Devices ---
  async function addSensorDevice({ name, external_id, metrics, source = 'thingsboard' }) {
    const { data, error } = await supabase
      .from('devices')
      .insert({
        room_id: room.value.id,
        name,
        type: 'sensor',
        external_id: external_id || null,
        metrics: metrics || [],
        source,
      })
      .select()
      .single()
    if (error) throw error
    devices.value.push(data)
    readingsByDevice.value[data.id] = []
    addLog(`Senzor "${name}" dodan.`)
    // Pull initial real history for this device from its source.
    if (external_id && metrics?.length) {
      await refreshHistory(data)
    }
    return data
  }

  async function addActuator({ name, external_id = null, source = 'thingsboard' }) {
    const { data, error } = await supabase
      .from('devices')
      .insert({ room_id: room.value.id, name, type: 'actuator', state: false, external_id, source })
      .select()
      .single()
    if (error) throw error
    devices.value.push(data)
    addLog(`Aktuator "${name}" dodan.`)
    return data
  }

  // Import a device discovered on ThingsBoard into the current room.
  async function importThingsboardDevice(tbDevice, kind) {
    const exists = devices.value.find((d) => d.external_id === tbDevice.id)
    if (exists) {
      addLog(`"${tbDevice.name}" je već uvezen.`, 'warn')
      return exists
    }
    if (kind === 'actuator') {
      return addActuator({ name: tbDevice.name, external_id: tbDevice.id, source: 'thingsboard' })
    }
    const tb = useThingsboardStore()
    let metrics = []
    try {
      const info = await tbsvc.detect(tb.host, tb.token, tbDevice.id)
      metrics = info.metrics
    } catch (err) {
      addLog(`Ne mogu pročitati veličine za "${tbDevice.name}": ${err.message}`, 'warn')
    }
    return addSensorDevice({
      name: tbDevice.name,
      external_id: tbDevice.id,
      metrics,
      source: 'thingsboard',
    })
  }

  async function removeDevice(id) {
    const { error } = await supabase.from('devices').delete().eq('id', id)
    if (error) throw error
    devices.value = devices.value.filter((d) => d.id !== id)
    delete readingsByDevice.value[id]
    addLog('Uređaj uklonjen.', 'warn')
  }

  // --- Actuation (per-device on/off) ---
  async function toggleActuator(device) {
    const next = !device.state
    // If this actuator lives on ThingsBoard, send the command to the platform too.
    if (device.source === 'thingsboard' && device.external_id) {
      try {
        const tb = useThingsboardStore()
        await tbsvc.sendCommand(tb.host, tb.token, device.external_id, next)
      } catch (err) {
        addLog(`ThingsBoard naredba nije prošla: ${err.message}`, 'warn')
      }
    }
    const { error } = await supabase.from('devices').update({ state: next }).eq('id', device.id)
    if (error) {
      addLog(`Greška pri aktuaciji: ${error.message}`, 'warn')
      return
    }
    device.state = next
    await supabase.from('actuations').insert({
      room_id: room.value.id,
      device_id: device.id,
      command: next ? 'on' : 'off',
      state: next,
    })
    addLog(`"${device.name}" ${next ? 'uključen' : 'isključen'}.`, next ? 'ok' : 'warn')
  }

  // --- Real data (ThingsBoard) ---
  function mapRows(device, rows) {
    return rows.map((r) => {
      const row = {
        room_id: room.value.id,
        device_id: device.id,
        temperature: null,
        humidity: null,
        co2: null,
        recorded_at: r.recorded_at,
      }
      for (const m of device.metrics) row[m] = r[m] ?? null
      return row
    })
  }

  async function insertReadings(device, rows) {
    if (!rows.length) return 0
    const arr = readingsByDevice.value[device.id] || []
    const known = new Set(arr.map((r) => new Date(r.recorded_at).getTime()))
    const fresh = mapRows(device, rows).filter(
      (r) => !known.has(new Date(r.recorded_at).getTime()),
    )
    if (!fresh.length) return 0
    const { error } = await supabase.from('readings').insert(fresh)
    if (error) {
      addLog(`Greška pri upisu: ${error.message}`, 'warn')
      return 0
    }
    return fresh.length
  }

  // Fetch from the user's ThingsBoard platform.
  async function sourceHistory(device) {
    const tb = useThingsboardStore()
    return tbsvc.fetchHistory(tb.host, tb.token, device.external_id, device.metrics, null, WINDOW_MIN)
  }

  async function sourceLatest(device) {
    const tb = useThingsboardStore()
    return tbsvc.fetchLatest(tb.host, tb.token, device.external_id, device.metrics, null)
  }

  // Backfill historical data for a single sensor device from its source.
  async function refreshHistory(device) {
    if (!device.external_id || !device.metrics?.length) {
      addLog(`"${device.name}" nema token ili odabrane veličine.`, 'warn')
      return
    }
    try {
      const rows = await sourceHistory(device)
      if (!rows.length) {
        addLog(`Nema podataka za "${device.name}" u zadnjih ${WINDOW_MIN} min.`, 'warn')
        return
      }
      const n = await insertReadings(device, rows)
      await fetchReadings(device.id)
      addLog(`"${device.name}": učitano ${n} stvarnih očitanja.`)
    } catch (err) {
      addLog(`Greška (${device.name}): ${err.message}`, 'warn')
    }
  }

  // Poll the latest measurement for every sensor device and store new points.
  async function pollOnce() {
    for (const device of sensorDevices()) {
      if (!device.external_id || !device.metrics?.length) continue
      try {
        const sample = await sourceLatest(device)
        if (!sample.recordedAt) continue
        const last = lastAtByDevice[device.id]
        if (last && new Date(sample.recordedAt) <= new Date(last)) continue
        await insertReadings(device, [
          {
            recorded_at: sample.recordedAt,
            temperature: sample.temperature,
            humidity: sample.humidity,
            co2: sample.co2,
          },
        ])
        lastAtByDevice[device.id] = sample.recordedAt
      } catch (err) {
        addLog(`Greška (${device.name}): ${err.message}`, 'warn')
      }
    }
  }

  function startLiveFeed() {
    if (liveTimer) return
    if (!sensorDevices().some((d) => d.external_id)) {
      addLog('Nema senzora s tokenom za praćenje.', 'warn')
      return
    }
    liveRunning.value = true
    addLog('Praćenje uživo pokrenuto.')
    pollOnce()
    liveTimer = setInterval(pollOnce, LIVE_POLL_MS)
  }

  function stopLiveFeed() {
    if (liveTimer) {
      clearInterval(liveTimer)
      liveTimer = null
    }
    if (liveRunning.value) {
      liveRunning.value = false
      addLog('Praćenje uživo zaustavljeno.', 'warn')
    }
  }

  return {
    // state
    room,
    devices,
    readingsByDevice,
    actuations,
    logs,
    loading,
    connected,
    liveRunning,
    // actions
    loadRoom,
    unload,
    addSensorDevice,
    addActuator,
    importThingsboardDevice,
    removeDevice,
    toggleActuator,
    refreshHistory,
    startLiveFeed,
    stopLiveFeed,
    addLog,
  }
})
