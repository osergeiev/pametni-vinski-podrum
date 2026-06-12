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

// Log in and return both the access JWT and the refresh token.
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
  return { token: data.token, refreshToken: data.refreshToken }
}

// Exchange a refresh token for a fresh access JWT (no password needed).
export async function refresh(host, refreshToken) {
  const res = await fetch(`${trimHost(host)}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) throw new Error('ThingsBoard sesija je istekla')
  const data = await res.json()
  return { token: data.token, refreshToken: data.refreshToken }
}

// List the devices ThingsBoard has assigned to this customer. The tenant admin
// manages assignments in ThingsBoard; the app only reads them.
export async function listCustomerDevices(host, token, customerId) {
  const data = await api(host, token, `/api/customer/${customerId}/devices?pageSize=200&page=0`)
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

// ---------------------------------------------------------------------------
// Provisioning (requires a tenant-administrator token)
// ---------------------------------------------------------------------------

// Find a customer by exact title, or create it. Returns its id (string).
export async function ensureCustomer(host, token, title) {
  const found = await api(
    host,
    token,
    `/api/customers?pageSize=100&page=0&textSearch=${encodeURIComponent(title)}`,
  )
  const match = (found?.data || []).find((c) => c.title === title)
  if (match) return match.id.id
  const created = await api(host, token, '/api/customer', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
  return created.id.id
}

// Create an asset under the "wine-cellar-zone" asset profile. In ThingsBoard
// the asset `type` equals the asset-profile name, so this links to the
// existing profile (and its predefined attributes). Returns its id.
export async function createAsset(host, token, name, type = 'wine-cellar-zone') {
  const created = await api(host, token, '/api/asset', {
    method: 'POST',
    body: JSON.stringify({ name, type }),
  })
  return created.id.id
}

export async function deleteAsset(host, token, assetId) {
  await api(host, token, `/api/asset/${assetId}`, { method: 'DELETE' })
}

export async function assignAssetToCustomer(host, token, customerId, assetId) {
  await api(host, token, `/api/customer/${customerId}/asset/${assetId}`, { method: 'POST' })
}

// Write SERVER_SCOPE attributes on any entity (e.g. an asset).
export async function saveServerAttributes(host, token, entityType, entityId, attrs) {
  await api(host, token, `/api/plugins/telemetry/${entityType}/${entityId}/attributes/SERVER_SCOPE`, {
    method: 'POST',
    body: JSON.stringify(attrs),
  })
}

// Map a device to its ThingsBoard "Contains_*" relation type(s).
// Sensors get one relation per measured metric; actuators by klima role.
const METRIC_RELATION = {
  temperature: 'Contains_temp',
  humidity: 'Contains_humidity',
  co2: 'Contains_CO2',
}
export function containsTypes(device) {
  if (device.type === 'sensor') {
    return (device.metrics || []).map((m) => METRIC_RELATION[m]).filter(Boolean)
  }
  if (device.role === 'klima_auto') return ['Contains_auto_AC']
  if (device.role === 'klima_manual') return ['Contains_manual_AC']
  return ['Contains']
}

// Create a relation (COMMON type group). `from`/`to` are { entityType, id }.
export async function createRelation(host, token, from, to, relationType) {
  await api(host, token, '/api/relation', {
    method: 'POST',
    body: JSON.stringify({
      from: { entityType: from.entityType, id: from.id },
      to: { entityType: to.entityType, id: to.id },
      type: relationType,
      typeGroup: 'COMMON',
    }),
  })
}

export async function deleteRelation(host, token, from, to, relationType) {
  const q =
    `?fromId=${from.id}&fromType=${from.entityType}` +
    `&relationType=${encodeURIComponent(relationType)}&relationTypeGroup=COMMON` +
    `&toId=${to.id}&toType=${to.entityType}`
  await api(host, token, `/api/relation${q}`, { method: 'DELETE' })
}

// True if the asset still exists; false on 404. Other HTTP errors throw
// (so an expired token can be refreshed/retried by the caller).
export async function assetExists(host, token, assetId) {
  const res = await fetch(`${trimHost(host)}/api/asset/${assetId}`, {
    headers: { 'X-Authorization': `Bearer ${token}` },
  })
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return true
}

// List assets currently assigned to a customer.
export async function listCustomerAssets(host, token, customerId) {
  const data = await api(host, token, `/api/customer/${customerId}/assets?pageSize=200&page=0`)
  return (data?.data || []).map((a) => ({ id: a.id.id, name: a.name, type: a.type }))
}
// Read SERVER_SCOPE attributes; returns a { key: value } map.
export async function getServerAttributes(host, token, entityType, entityId, keys) {
  const data = await api(
    host,
    token,
    `/api/plugins/telemetry/${entityType}/${entityId}/values/attributes/SERVER_SCOPE?keys=${keys.join(',')}`,
  )
  const out = {}
  for (const a of data || []) out[a.key] = a.value
  return out
}
