<template>
  <main class="rooms-page">
    <header class="rooms-header">
      <div>
        <h1>Pametni Vinski Podrum</h1>
        <p class="subtitle">Moje vinske prostorije</p>
      </div>
      <div class="user-box">
        <button class="btn-ghost tb-toggle" :class="{ on: tb.connected }" @click="openTb">
          <span class="dot" :class="{ connected: tb.connected }"></span>
          {{ tb.connected ? 'ThingsBoard spojen' : 'Poveži ThingsBoard' }}
        </button>
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
        <button
          v-if="room.assetMissing && tb.connected"
          class="asset-warn"
          title="Asset je obrisan na ThingsBoardu"
          @click.prevent.stop="recreate(room)"
        >
          <i class="ti ti-alert-triangle" aria-hidden="true"></i>
          {{ recreatingId === room.id ? 'Kreiram…' : 'Asset obrisan — ponovo kreiraj' }}
        </button>
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
          <div class="field-row">
            <div class="field">
              <label>Ciljana temperatura (°C)</label>
              <input v-model.number="form.targetTemperature" type="number" step="0.5" />
            </div>
            <div class="field">
              <label>Dozvoljeno odstupanje (±°C)</label>
              <input v-model.number="form.controlBand" type="number" step="0.5" min="0" />
            </div>
          </div>
          <p class="form-hint">
            <i class="ti" :class="tb.connected ? 'ti-plug-connected' : 'ti-plug-off'" aria-hidden="true"></i>
            {{
              tb.connected
                ? 'Kreirat će se asset u ThingsBoardu (controlBand, targetTemperature) i dodijeliti vašem customeru.'
                : 'Niste spojeni na ThingsBoard — prostorija će biti spremljena bez asseta.'
            }}
          </p>
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

    <!-- ThingsBoard connect modal -->
    <div v-if="showTb" class="modal-backdrop" @click.self="showTb = false">
      <div class="modal">
        <h3>ThingsBoard</h3>
        <form v-if="!tb.connected" @submit.prevent="connectTb">
          <div class="field">
            <label>Host URL</label>
            <input v-model.trim="tbForm.host" placeholder="http://161.53.133.253:8080" />
          </div>
          <div class="field">
            <label>Email</label>
            <input v-model.trim="tbForm.username" type="email" autocomplete="username" />
          </div>
          <div class="field">
            <label>Lozinka</label>
            <input v-model="tbForm.password" type="password" autocomplete="current-password" />
          </div>
          <p v-if="tb.error" class="auth-error">{{ tb.error }}</p>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" @click="showTb = false">Zatvori</button>
            <button type="submit" class="btn-primary" :disabled="tb.connecting">
              {{ tb.connecting ? 'Spajam…' : 'Spoji se' }}
            </button>
          </div>
        </form>
        <template v-else>
          <p class="form-hint">
            <span class="dot connected"></span> Spojeni ste na {{ tb.host }}
          </p>

          <div class="asset-block">
            <div class="asset-block-title">
              Postojeći asseti na ThingsBoardu
              <button class="btn-inline" @click="store.fetchTbAssets()">
                <i class="ti ti-refresh" aria-hidden="true"></i>
              </button>
            </div>
            <p v-if="!store.tbAssets.length" class="form-hint">
              Nema dodatnih asseta koji već nisu povezani s prostorijom.
            </p>
            <div v-else class="asset-list">
              <div v-for="a in store.tbAssets" :key="a.id" class="asset-item">
                <span class="asset-name">{{ a.name }}</span>
                <button class="btn-inline" :disabled="linkingId === a.id" @click="link(a)">
                  {{ linkingId === a.id ? '…' : 'Poveži kao prostoriju' }}
                </button>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-ghost" @click="tb.disconnect()">Odspoji</button>
            <button type="button" class="btn-primary" @click="showTb = false">Zatvori</button>
          </div>
        </template>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomsStore } from '@/stores/rooms'
import { useAuthStore } from '@/stores/auth'
import { useThingsboardStore } from '@/stores/thingsboard'

const store = useRoomsStore()
const auth = useAuthStore()
const tb = useThingsboardStore()
const router = useRouter()

const showForm = ref(false)
const busy = ref(false)
const formError = ref('')
const form = ref({ name: '', location: '', targetTemperature: 13, controlBand: 1 })

const showTb = ref(false)
const tbForm = reactive({ host: tb.host, username: '', password: '' })
const recreatingId = ref('')
const linkingId = ref('')

onMounted(() => store.fetchRooms())

// When ThingsBoard becomes connected, reconcile assets and load existing ones.
watch(
  () => tb.connected,
  (connected) => {
    if (connected) {
      store.syncAssets()
      store.fetchTbAssets()
    }
  },
  { immediate: true },
)

function deviceCount(room) {
  return room.devices?.[0]?.count ?? 0
}

async function openTb() {
  showTb.value = true
  if (tb.connected) await store.fetchTbAssets()
}

async function connectTb() {
  const ok = await tb.connect(tbForm.host, tbForm.username, tbForm.password)
  if (ok) {
    tbForm.password = ''
    await store.syncAssets()
    await store.fetchTbAssets()
  }
}

async function recreate(room) {
  recreatingId.value = room.id
  try {
    await store.recreateAsset(room.id)
  } catch (err) {
    alert('Greška: ' + err.message)
  } finally {
    recreatingId.value = ''
  }
}

async function link(asset) {
  linkingId.value = asset.id
  try {
    await store.linkExistingAsset(asset)
  } catch (err) {
    alert('Greška: ' + err.message)
  } finally {
    linkingId.value = ''
  }
}

function closeForm() {
  showForm.value = false
  form.value = { name: '', location: '', targetTemperature: 13, controlBand: 1 }
  formError.value = ''
}

async function create() {
  busy.value = true
  formError.value = ''
  try {
    await store.createRoom({
      name: form.value.name,
      location: form.value.location,
      targetTemperature: form.value.targetTemperature,
      controlBand: form.value.controlBand,
    })
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

.field-row { display: flex; gap: 0.75rem; }
.field-row .field { flex: 1; }

.form-hint {
  font-size: 0.72rem;
  color: #8a6840;
  font-family: 'Courier New', monospace;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.tb-toggle { gap: 8px; }
.tb-toggle.on { color: #d4a96a; border-color: rgba(212, 169, 106, 0.4); }
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7a5a38;
  display: inline-block;
}
.dot.connected { background: #4a8a5a; }

.asset-warn {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(192, 57, 43, 0.12);
  border: 1px solid rgba(192, 57, 43, 0.4);
  color: #e08a7a;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 0.62rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.asset-warn:hover { background: rgba(192, 57, 43, 0.2); }

.asset-block {
  margin-top: 1rem;
  border-top: 1px solid rgba(180, 120, 60, 0.2);
  padding-top: 1rem;
}
.asset-block-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8a6840;
  font-family: 'Courier New', monospace;
  margin-bottom: 0.5rem;
}
.asset-list { display: flex; flex-direction: column; gap: 0.5rem; }
.asset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: #1a0a05;
  border: 1px solid rgba(180, 120, 60, 0.25);
  border-radius: 8px;
  padding: 8px 12px;
}
.asset-name { font-size: 0.85rem; color: #f0e6d3; }

.btn-inline {
  background: transparent;
  border: 1px solid rgba(212, 169, 106, 0.4);
  color: #d4a96a;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.68rem;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-inline:hover:not(:disabled) { background: rgba(212, 169, 106, 0.15); }
.btn-inline:disabled { opacity: 0.5; cursor: not-allowed; }

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
