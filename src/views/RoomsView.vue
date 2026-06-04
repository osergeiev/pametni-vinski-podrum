<template>
  <main class="rooms-page">
    <header class="rooms-header">
      <div>
        <h1>Pametni Vinski Podrum</h1>
        <p class="subtitle">Moje vinske prostorije</p>
      </div>
      <div class="user-box">
        <span class="user-email">{{ auth.email }}</span>
        <button class="btn-ghost" @click="logout">
          <i class="ti ti-logout" aria-hidden="true"></i> Odjava
        </button>
      </div>
    </header>

    <section class="rooms-grid">
      <!-- Existing rooms -->
      <RouterLink
        v-for="room in store.rooms"
        :key="room.id"
        :to="{ name: 'room', params: { id: room.id } }"
        class="room-card"
      >
        <button class="room-delete" title="Obriši" @click.prevent.stop="remove(room)">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
        <i class="ti ti-building-warehouse room-icon" aria-hidden="true"></i>
        <h2>{{ room.name }}</h2>
        <p class="room-location">
          <i class="ti ti-map-pin" aria-hidden="true"></i>
          {{ room.location || 'Bez lokacije' }}
        </p>
        <span class="room-ac">
          <i class="ti ti-cpu" aria-hidden="true"></i>
          {{ deviceCount(room) }} {{ deviceCount(room) === 1 ? 'uređaj' : 'uređaja' }}
        </span>
      </RouterLink>

      <!-- Add new room -->
      <button class="room-card add-card" @click="showForm = true">
        <i class="ti ti-plus" aria-hidden="true"></i>
        <span>Dodaj prostoriju</span>
      </button>
    </section>

    <p v-if="store.loading" class="hint">Učitavanje…</p>
    <p v-else-if="!store.rooms.length" class="hint">
      Još nemate niti jednu prostoriju. Dodajte prvu da počnete pratiti senzore.
    </p>

    <!-- Add room modal -->
    <div v-if="showForm" class="modal-backdrop" @click.self="closeForm">
      <div class="modal">
        <h3>Nova vinska prostorija</h3>
        <form @submit.prevent="create">
          <div class="field">
            <label>Naziv</label>
            <input v-model.trim="form.name" required placeholder="npr. Glavni podrum" />
          </div>
          <div class="field">
            <label>Lokacija (opcionalno)</label>
            <input v-model.trim="form.location" placeholder="npr. Podrum, sjever" />
          </div>
          <p v-if="formError" class="auth-error">{{ formError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" @click="closeForm">Odustani</button>
            <button type="submit" class="btn-primary" :disabled="busy">
              {{ busy ? 'Spremam…' : 'Spremi' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '@/stores/rooms'
import { useAuthStore } from '@/stores/auth'

const store = useRoomsStore()
const auth = useAuthStore()
const router = useRouter()

const showForm = ref(false)
const busy = ref(false)
const formError = ref('')
const form = ref({ name: '', location: '' })

onMounted(() => store.fetchRooms())

function deviceCount(room) {
  return room.devices?.[0]?.count ?? 0
}

function closeForm() {
  showForm.value = false
  form.value = { name: '', location: '' }
  formError.value = ''
}

async function create() {
  busy.value = true
  formError.value = ''
  try {
    await store.createRoom({ name: form.value.name, location: form.value.location })
    closeForm()
  } catch (err) {
    formError.value = err.message
  } finally {
    busy.value = false
  }
}

async function remove(room) {
  if (!confirm(`Obrisati prostoriju "${room.name}" i sve njene podatke?`)) return
  try {
    await store.deleteRoom(room.id)
  } catch (err) {
    alert('Greška pri brisanju: ' + err.message)
  }
}

async function logout() {
  await auth.signOut()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.rooms-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.rooms-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(180, 120, 60, 0.3);
}

.rooms-header h1 {
  font-size: 2rem;
  font-weight: 400;
  font-style: italic;
  color: #d4a96a;
  letter-spacing: 0.04em;
}

.subtitle {
  font-size: 0.78rem;
  color: #8a6840;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-family: 'Courier New', monospace;
  margin-top: 4px;
}

.user-box {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.user-email {
  font-size: 0.75rem;
  color: #8a6840;
  font-family: 'Courier New', monospace;
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.25rem;
}

.room-card {
  position: relative;
  background: linear-gradient(160deg, #2a1208 0%, #1e0d05 100%);
  border: 1px solid rgba(180, 120, 60, 0.25);
  border-radius: 12px;
  padding: 1.5rem;
  text-decoration: none;
  color: #f0e6d3;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 170px;
  transition: border-color 0.2s, transform 0.2s;
}
.room-card:hover { border-color: rgba(212, 169, 106, 0.5); transform: translateY(-2px); }

.room-icon { font-size: 1.8rem; color: #d4a96a; opacity: 0.85; }

.room-card h2 {
  font-size: 1.15rem;
  font-weight: 400;
  font-style: italic;
  color: #f0e6d3;
}

.room-location {
  font-size: 0.75rem;
  color: #8a6840;
  font-family: 'Courier New', monospace;
  display: flex;
  align-items: center;
  gap: 5px;
}

.room-ac {
  margin-top: auto;
  font-size: 0.7rem;
  font-family: 'Courier New', monospace;
  color: #7a5a38;
  display: flex;
  align-items: center;
  gap: 6px;
}
.room-ac.on { color: #3498db; }

.room-delete {
  position: absolute;
  top: 10px; right: 10px;
  background: transparent;
  border: none;
  color: #7a5a38;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0;
  transition: opacity 0.2s, color 0.2s;
}
.room-card:hover .room-delete { opacity: 1; }
.room-delete:hover { color: #c0392b; }

.add-card {
  align-items: center;
  justify-content: center;
  border-style: dashed;
  color: #8a6840;
  cursor: pointer;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  background: transparent;
}
.add-card i { font-size: 2rem; }
.add-card:hover { color: #d4a96a; }

.hint {
  margin-top: 2rem;
  text-align: center;
  color: #7a5a38;
  font-size: 0.85rem;
  font-family: 'Courier New', monospace;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1.5rem;
}
.modal {
  background: #2a1208;
  border: 1px solid rgba(180, 120, 60, 0.3);
  border-radius: 14px;
  padding: 1.75rem;
  width: 100%;
  max-width: 380px;
}
.modal h3 {
  color: #d4a96a;
  font-weight: 400;
  font-style: italic;
  margin-bottom: 1.25rem;
}
.field { margin-bottom: 1rem; }
.field label {
  display: block;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8a6840;
  font-family: 'Courier New', monospace;
  margin-bottom: 6px;
}
.field input {
  width: 100%;
  background: #1a0a05;
  border: 1px solid rgba(180, 120, 60, 0.3);
  border-radius: 8px;
  padding: 10px 12px;
  color: #f0e6d3;
  font-size: 0.85rem;
  font-family: 'Courier New', monospace;
  outline: none;
}
.field input:focus { border-color: rgba(212, 169, 106, 0.6); }

.auth-error { color: #e06a5a; font-size: 0.78rem; font-family: 'Courier New', monospace; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.btn-ghost {
  background: transparent;
  border: 1px solid rgba(180, 120, 60, 0.3);
  color: #8a6840;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-ghost:hover { color: #d4a96a; border-color: rgba(212, 169, 106, 0.4); }

.btn-primary {
  background: rgba(212, 169, 106, 0.18);
  border: 1px solid rgba(212, 169, 106, 0.45);
  color: #d4a96a;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary:hover:not(:disabled) { background: rgba(212, 169, 106, 0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 700px) {
  .rooms-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
}
</style>
