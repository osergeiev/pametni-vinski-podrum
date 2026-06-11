import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useThingsboardStore } from '@/stores/thingsboard'
import * as tbsvc from '@/services/thingsboard'

export const useRoomsStore = defineStore('rooms', () => {
  const rooms = ref([])
  const tbAssets = ref([]) // existing TB assets not yet linked to a room
  const loading = ref(false)
  const error = ref('')

  async function fetchRooms() {
    loading.value = true
    error.value = ''
    const { data, error: err } = await supabase
      .from('rooms')
      .select('id, name, location, created_at, tb_asset_id, target_temperature, control_band, devices(count)')
      .order('created_at', { ascending: true })
    if (err) error.value = err.message
    else rooms.value = data ?? []
    loading.value = false
    syncAssets()
  }

  // Re-create the Contains (asset->device) and Manages (temp sensor->auto klima)
  // relations for a room's devices on a (re)linked asset.
  async function rewireRoomRelations(tb, assetId, roomId) {
    const { data: devs } = await supabase
      .from('devices')
      .select('external_id, type, metrics, role')
      .eq('room_id', roomId)
    const withId = (devs || []).filter((d) => d.external_id)
    for (const d of withId) {
      for (const relType of tbsvc.containsTypes(d)) {
        await tb.authFetch((tok) =>
          tbsvc.createRelation(
            tb.host,
            tok,
            { entityType: 'ASSET', id: assetId },
            { entityType: 'DEVICE', id: d.external_id },
            relType,
          ),
        )
      }
    }
    const temp = withId.find((d) => d.type === 'sensor' && (d.metrics || []).includes('temperature'))
    const auto = withId.find((d) => d.role === 'klima_auto')
    if (temp && auto) {
      await tb.authFetch((tok) =>
        tbsvc.createRelation(
          tb.host,
          tok,
          { entityType: 'DEVICE', id: temp.external_id },
          { entityType: 'DEVICE', id: auto.external_id },
          'Manages',
        ),
      )
    }
  }

  // Reflect ThingsBoard deletions: if a room's asset no longer exists there,
  // unlink it locally and flag it so the UI can offer to re-create it.
  async function syncAssets() {
    const tb = useThingsboardStore()
    if (!tb.connected) return
    for (const room of rooms.value) {
      if (!room.tb_asset_id) continue
      try {
        const exists = await tb.authFetch((tok) =>
          tbsvc.assetExists(tb.host, tok, room.tb_asset_id),
        )
        if (!exists) {
          await supabase.from('rooms').update({ tb_asset_id: null }).eq('id', room.id)
          room.tb_asset_id = null
          room.assetMissing = true
        } else {
          room.assetMissing = false
        }
      } catch {
        // transient (network / auth) — leave the room as-is
      }
    }
  }

  // Re-create a ThingsBoard asset for a room whose asset was deleted.
  async function recreateAsset(roomId) {
    const tb = useThingsboardStore()
    if (!tb.connected) throw new Error('Niste spojeni na ThingsBoard.')
    const room = rooms.value.find((r) => r.id === roomId)
    if (!room) return
    const customerId = await tb.ensureCustomer()
    const assetId = await tb.authFetch((tok) => tbsvc.createAsset(tb.host, tok, room.name))
    if (customerId) {
      await tb.authFetch((tok) => tbsvc.assignAssetToCustomer(tb.host, tok, customerId, assetId))
    }
    await tb.authFetch((tok) =>
      tbsvc.saveServerAttributes(tb.host, tok, 'ASSET', assetId, {
        targetTemperature: room.target_temperature,
        controlBand: room.control_band,
      }),
    )
    await rewireRoomRelations(tb, assetId, roomId)
    await supabase.from('rooms').update({ tb_asset_id: assetId }).eq('id', roomId)
    room.tb_asset_id = assetId
    room.assetMissing = false
  }

  // List ThingsBoard assets (whole tenant) that aren't linked to a room yet.
  async function fetchTbAssets() {
    const tb = useThingsboardStore()
    tbAssets.value = []
    if (!tb.connected) return
    try {
      const list = await tb.authFetch((tok) => tbsvc.listTenantAssets(tb.host, tok))
      const linked = new Set(rooms.value.map((r) => r.tb_asset_id).filter(Boolean))
      tbAssets.value = list.filter((a) => !linked.has(a.id))
    } catch (err) {
      error.value = `ThingsBoard asseti: ${err.message}`
    }
  }

  // Create a room from an existing ThingsBoard asset (reads its attributes).
  async function linkExistingAsset(asset) {
    const auth = useAuthStore()
    const tb = useThingsboardStore()
    let target = 13
    let band = 1
    try {
      const attrs = await tb.authFetch((tok) =>
        tbsvc.getServerAttributes(tb.host, tok, 'ASSET', asset.id, [
          'targetTemperature',
          'controlBand',
        ]),
      )
      if (attrs.targetTemperature != null) target = Number(attrs.targetTemperature)
      if (attrs.controlBand != null) band = Number(attrs.controlBand)
      const customerId = await tb.ensureCustomer()
      if (customerId) {
        await tb.authFetch((tok) =>
          tbsvc.assignAssetToCustomer(tb.host, tok, customerId, asset.id),
        )
      }
    } catch {
      // fall back to defaults / skip assignment
    }
    const { data, error: err } = await supabase
      .from('rooms')
      .insert({
        name: asset.name,
        location: null,
        owner: auth.user?.id,
        tb_asset_id: asset.id,
        target_temperature: target,
        control_band: band,
      })
      .select()
      .single()
    if (err) throw err
    rooms.value.push(data)
    tbAssets.value = tbAssets.value.filter((a) => a.id !== asset.id)
    return data
  }

  // Create the room and, if ThingsBoard is connected, provision a matching
  // asset: assign it to the account's customer and set the control attributes.
  async function createRoom({ name, location, targetTemperature = 13, controlBand = 1 }) {
    const auth = useAuthStore()
    const tb = useThingsboardStore()

    let tbAssetId = null
    if (tb.connected) {
      const customerId = await tb.ensureCustomer()
      tbAssetId = await tb.authFetch((tok) => tbsvc.createAsset(tb.host, tok, name))
      try {
        if (customerId) {
          await tb.authFetch((tok) =>
            tbsvc.assignAssetToCustomer(tb.host, tok, customerId, tbAssetId),
          )
        }
        await tb.authFetch((tok) =>
          tbsvc.saveServerAttributes(tb.host, tok, 'ASSET', tbAssetId, {
            targetTemperature,
            controlBand,
          }),
        )
      } catch (err) {
        error.value = `ThingsBoard asset: ${err.message}`
      }
    }

    const { data, error: err } = await supabase
      .from('rooms')
      .insert({
        name,
        location,
        owner: auth.user?.id,
        tb_asset_id: tbAssetId,
        target_temperature: targetTemperature,
        control_band: controlBand,
      })
      .select()
      .single()
    if (err) throw err
    rooms.value.push(data)
    return data
  }

  async function deleteRoom(id) {
    const tb = useThingsboardStore()
    const room = rooms.value.find((r) => r.id === id)
    if (room?.tb_asset_id && tb.connected) {
      try {
        await tb.authFetch((tok) => tbsvc.deleteAsset(tb.host, tok, room.tb_asset_id))
      } catch (err) {
        error.value = `ThingsBoard asset: ${err.message}`
      }
    }
    const { error: err } = await supabase.from('rooms').delete().eq('id', id)
    if (err) throw err
    rooms.value = rooms.value.filter((r) => r.id !== id)
  }

  return {
    rooms,
    tbAssets,
    loading,
    error,
    fetchRooms,
    createRoom,
    deleteRoom,
    syncAssets,
    recreateAsset,
    fetchTbAssets,
    linkExistingAsset,
  }
})
