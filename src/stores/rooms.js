import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

export const useRoomsStore = defineStore('rooms', () => {
  const rooms = ref([])
  const loading = ref(false)
  const error = ref('')

  async function fetchRooms() {
    loading.value = true
    error.value = ''
    const { data, error: err } = await supabase
      .from('rooms')
      .select('id, name, location, created_at, devices(count)')
      .order('created_at', { ascending: true })
    if (err) error.value = err.message
    else rooms.value = data ?? []
    loading.value = false
  }

  async function createRoom({ name, location }) {
    const auth = useAuthStore()
    const { data, error: err } = await supabase
      .from('rooms')
      .insert({ name, location, owner: auth.user?.id })
      .select()
      .single()
    if (err) throw err
    rooms.value.push(data)
    return data
  }

  async function deleteRoom(id) {
    const { error: err } = await supabase.from('rooms').delete().eq('id', id)
    if (err) throw err
    rooms.value = rooms.value.filter((r) => r.id !== id)
  }

  return { rooms, loading, error, fetchRooms, createRoom, deleteRoom }
})
