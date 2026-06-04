// ThingsBoard REST client.
// Reads devices + telemetry (latest & history) and sends simple actuator commands.
// History comes from ThingsBoard's timeseries API; we copy it into Supabase
// `readings` so the rest of the app renders it uniformly.

// Telemetry key aliases -> our three metrics (English + Croatian variants).
const KEY_ALIASES = {
  temperature: ['temperature', 'temperatura', 'temp', 't'],
  humidity: ['humidity', 'vlaga', 'hum', 'rh', 'h'],
  co2: ['co2', 'co2_ppm', 'c'],
}

function trimHost(host) {
  return (host || '').replace(/\/+$/, '')
}

async function api(host, token, path, opts = {}) {
  const res = await fetch(`${trimHost(host)}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j.message || msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// Log in and return a JWT.
export async function login(host, username, password) {
  const res = await fetch(`${trimHost(host)}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    let msg = 'Prijava na ThingsBoard nije uspjela'
    try {
      const j = await res.json()
      msg = j.message || msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  const data = await res.json()
  return data.token
}

// List all tenant devices.
export async function listDevices(host, token) {
  const data = await api(host, token, '/api/tenant/devices?pageSize=200&page=0')
  return (data?.data || []).map((d) => ({ id: d.id.id, name: d.name, type: d.type }))
}

export async function fetchKeys(host, token, deviceId) {
  return (await api(host, token, `/api/plugins/telemetry/DEVICE/${deviceId}/keys/timeseries`)) || []
}

function metricsFromKeys(keys) {
  const lower = keys.map((k) => k.toLowerCase())
  return Object.keys(KEY_ALIASES).filter((m) =>
    KEY_ALIASES[m].some((alias) => lower.includes(alias)),
  )
}

// Pick the actual TB key name that backs a given metric.
function keyFor(metric, available) {
  const lower = available.map((k) => k.toLowerCase())
  for (const alias of KEY_ALIASES[metric]) {
    const idx = lower.indexOf(alias)
    if (idx >= 0) return available[idx]
  }
  return null
}

// Detect which metrics a device measures (for the import UI).
export async function detect(host, token, deviceId) {
  const keys = await fetchKeys(host, token, deviceId)
  return { keys, metrics: metricsFromKeys(keys) }
}

export async function fetchLatest(host, token, deviceId, metrics, available) {
  const keys = await ensureKeys(host, token, deviceId, available)
  const tbKeys = metrics.map((m) => keyFor(m, keys)).filter(Boolean)
  const out = { temperature: null, humidity: null, co2: null, recordedAt: null }
  if (!tbKeys.length) return out
  const data = await api(
    host,
    token,
    `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${tbKeys.join(',')}`,
  )
  for (const m of metrics) {
    const k = keyFor(m, keys)
    if (!k || !data?.[k]?.length) continue
    out[m] = parseFloat(data[k][0].value)
    const iso = new Date(data[k][0].ts).toISOString()
    if (!out.recordedAt || data[k][0].ts > Date.parse(out.recordedAt)) out.recordedAt = iso
  }
  return out
}

export async function fetchHistory(host, token, deviceId, metrics, available, minutes = 15) {
  const keys = await ensureKeys(host, token, deviceId, available)
  const tbKeys = metrics.map((m) => keyFor(m, keys)).filter(Boolean)
  if (!tbKeys.length) return []
  const end = Date.now()
  const start = end - minutes * 60 * 1000
  const data = await api(
    host,
    token,
    `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${tbKeys.join(',')}` +
      `&startTs=${start}&endTs=${end}&limit=5000&agg=NONE&orderBy=ASC`,
  )
  const byTime = new Map()
  for (const m of metrics) {
    const k = keyFor(m, keys)
    if (!k || !data?.[k]) continue
    for (const p of data[k]) {
      const iso = new Date(p.ts).toISOString()
      if (!byTime.has(iso)) byTime.set(iso, { recorded_at: iso })
      byTime.get(iso)[m] = parseFloat(p.value)
    }
  }
  return [...byTime.values()].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
}

async function ensureKeys(host, token, deviceId, available) {
  return available && available.length ? available : fetchKeys(host, token, deviceId)
}

// Best-effort actuation: write a shared attribute the controller can react to.
export async function sendCommand(host, token, deviceId, on) {
  await api(host, token, `/api/plugins/telemetry/DEVICE/${deviceId}/SHARED_SCOPE`, {
    method: 'POST',
    body: JSON.stringify({ desiredMode: on ? 'HEAT' : 'OFF', enabled: on }),
  })
}
