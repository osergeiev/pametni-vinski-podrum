// Telemetry "inbox" for the Smart Wine Cellar app.
//
// Any data source (ThingsBoard rule chain, a device, or a test curl) POSTs a
// reading here. We look up the device by its token (devices.external_id), then
// insert a row into `readings`. The web app reads `readings` over realtime, so
// new data shows up instantly — no coupling to any specific IoT platform.
//
// Auth: send header  x-ingest-key: <INGEST_KEY>
// Body (single or array):
//   { "token": "<device external_id>", "temperature": 13.4, "humidity": 68, "co2": 520, "ts": 1717533600000 }
//
// Field aliases accepted: temp/t, hum/rh/h, co2_ppm/c. `ts` may be epoch ms or ISO string.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const INGEST_KEY = Deno.env.get('INGEST_KEY') ?? 'vk_vino_a7f3c9e21b6d480f'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-ingest-key, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function pick(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function toIso(ts: unknown): string {
  if (ts == null) return new Date().toISOString()
  const ms = typeof ts === 'number' ? ts : Date.parse(String(ts))
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  if (req.headers.get('x-ingest-key') !== INGEST_KEY) {
    return json({ error: 'Unauthorized — missing or wrong x-ingest-key' }, 401)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const items = Array.isArray(body) ? body : [body]
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let inserted = 0
  const errors: string[] = []

  for (const raw of items) {
    const it = (raw ?? {}) as Record<string, unknown>
    const token = it.token ?? it.external_id ?? it.device ?? it.deviceToken
    if (!token) {
      errors.push('missing token')
      continue
    }

    const { data: devices, error: devErr } = await supabase
      .from('devices')
      .select('id, room_id')
      .eq('external_id', token)
      .limit(1)

    if (devErr) {
      errors.push(devErr.message)
      continue
    }
    const device = devices?.[0]
    if (!device) {
      errors.push(`unknown token: ${token}`)
      continue
    }

    const row = {
      room_id: device.room_id,
      device_id: device.id,
      temperature: pick(it, ['temperature', 'temp', 't']),
      humidity: pick(it, ['humidity', 'hum', 'rh', 'h']),
      co2: pick(it, ['co2', 'co2_ppm', 'c']),
      recorded_at: toIso(it.ts ?? it.timestamp),
    }

    const { error: insErr } = await supabase.from('readings').insert(row)
    if (insErr) errors.push(insErr.message)
    else inserted++
  }

  return json({ inserted, errors })
})
