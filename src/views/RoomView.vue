<template>
  <main class="dashboard">
    <!-- Header -->
    <header class="dash-header">
      <div class="head-left">
        <RouterLink :to="{ name: 'rooms' }" class="back-link">
          <i class="ti ti-arrow-left" aria-hidden="true"></i>
        </RouterLink>
        <div>
          <h1>{{ store.room?.name || 'Prostorija' }}</h1>
          <p class="subtitle">{{ store.room?.location || 'IoT Monitoring' }}</p>
        </div>
      </div>
      <div class="connection-badge">
        <span class="dot" :class="{ connected: store.connected }"></span>
        {{ store.connected ? 'Realtime aktivan' : 'Povezivanje…' }}
      </div>
    </header>

    <div v-if="store.loading" class="loading">Učitavanje…</div>

    <template v-else>
      <!-- Toolbar -->
      <div class="toolbar">
        <button class="btn-primary" @click="openTb">
          <i class="ti ti-plug-connected" aria-hidden="true"></i>
          {{ tb.connected ? 'ThingsBoard uređaji' : 'Poveži ThingsBoard' }}
        </button>
        <button
          v-if="hasLiveSensors"
          class="btn-connect"
          :class="{ stop: store.liveRunning }"
          @click="toggleLive"
        >
          <i class="ti" :class="store.liveRunning ? 'ti-player-stop' : 'ti-player-play'" aria-hidden="true"></i>
          {{ store.liveRunning ? 'Zaustavi praćenje' : 'Prati uživo' }}
        </button>
      </div>

      <!-- Empty state -->
      <section v-if="!store.devices.length" class="empty-room">
        <i class="ti ti-cpu" aria-hidden="true"></i>
        <h2>Prostorija je prazna</h2>
        <p>
          Povežite se na ThingsBoard i uvezite svoje uređaje. Senzori automatski prepoznaju
          što mjere i povlače povijest zadnjih 15 minuta, a aktuatore možete uključiti/isključiti.
        </p>
        <button class="btn-primary" @click="openTb">
          <i class="ti ti-plug-connected" aria-hidden="true"></i> Poveži ThingsBoard
        </button>
      </section>

      <!-- Devices -->
      <template v-else>
        <template v-for="device in store.devices" :key="device.id">
          <SensorDevice
            v-if="device.type === 'sensor'"
            :device="device"
            :readings="store.readingsByDevice[device.id] || []"
            @refresh="store.refreshHistory($event)"
            @remove="remove($event)"
          />
          <ActuatorDevice
            v-else
            :device="device"
            @toggle="store.toggleActuator($event)"
            @remove="remove($event)"
          />
        </template>
      </template>

      <!-- History info -->
      <section class="panel info-panel">
        <div class="panel-title">
          <i class="ti ti-history" aria-hidden="true"></i>
          Odakle dolaze podaci
        </div>
        <p class="src-note">
          Uređaji se uvoze s vašeg <code>ThingsBoard</code> poslužitelja. Povijest se dohvaća iz
          ThingsBoard telemetrije (<code>/values/timeseries</code>) i sprema u Supabase.
          <strong>"Osvježi"</strong> povlači zadnjih 15 min, <strong>"Prati uživo"</strong> dodaje
          nova očitanja svakih 30 s. Aktuatori šalju naredbu natrag na ThingsBoard.
        </p>
      </section>

      <!-- Log -->
      <section class="panel log-panel">
        <div class="panel-title">
          <i class="ti ti-terminal" aria-hidden="true"></i> Sistemski log
        </div>
        <div class="log-list">
          <div
            v-for="entry in store.logs"
            :key="entry.id"
            class="log-entry"
            :class="`log-${entry.type}`"
          >
            <span class="log-time">{{ entry.time }}</span>
            <span class="log-msg">{{ entry.msg }}</span>
          </div>
        </div>
      </section>
    </template>

    <!-- ThingsBoard connect / import modal -->
    <div v-if="showTb" class="modal-backdrop" @click.self="showTb = false">
      <div class="modal wide">
        <h3>ThingsBoard</h3>

        <!-- Login -->
        <form v-if="!tb.connected" @submit.prevent="connectTb">
          <div class="field">
            <label>Host URL</label>
            <input v-model.trim="tbForm.host" placeholder="http://161.53.133.253:8080" />
          </div>
          <div class="field">
            <label>Email</label>
            <input v-model.trim="tbForm.username" type="email" placeholder="ime@fer.hr" autocomplete="username" />
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

        <!-- Device list -->
        <template v-else>
          <div class="tb-bar">
            <span class="tb-host"><i class="ti ti-check" aria-hidden="true"></i> {{ tb.host }}</span>
            <div>
              <button class="btn-inline" @click="tb.loadDevices()">
                <i class="ti ti-refresh" aria-hidden="true"></i> Osvježi
              </button>
              <button class="btn-inline" @click="tb.disconnect()">Odspoji</button>
            </div>
          </div>
          <p v-if="tb.error" class="auth-error">{{ tb.error }}</p>

          <div class="tb-list">
            <div v-for="d in tb.devices" :key="d.id" class="tb-item">
              <div class="tb-item-info">
                <span class="tb-name">{{ d.name }}</span>
                <span class="tb-type">{{ d.type }}</span>
              </div>
              <template v-if="isImported(d.id)">
                <span class="tb-done"><i class="ti ti-check" aria-hidden="true"></i> Uvezeno</span>
              </template>
              <template v-else>
                <select v-model="importKind[d.id]" class="tb-kind">
                  <option value="sensor">Senzor</option>
                  <option value="actuator">Aktuator</option>
                </select>
                <button class="btn-inline" :disabled="importingId === d.id" @click="importTb(d)">
                  {{ importingId === d.id ? '…' : 'Uvezi' }}
                </button>
              </template>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" @click="showTb = false">Zatvori</button>
          </div>
        </template>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useSensorsStore } from '@/stores/sensors'
import { useThingsboardStore } from '@/stores/thingsboard'
import SensorDevice from '@/components/SensorDevice.vue'
import ActuatorDevice from '@/components/ActuatorDevice.vue'

const props = defineProps({ id: { type: String, required: true } })
const store = useSensorsStore()
const tb = useThingsboardStore()

// ThingsBoard modal state
const showTb = ref(false)
const tbForm = reactive({ host: tb.host, username: '', password: '' })
const importKind = reactive({})
const importingId = ref('')

onMounted(() => store.loadRoom(props.id))
onUnmounted(() => store.unload())
watch(() => props.id, (id) => store.loadRoom(id))

const hasLiveSensors = computed(() =>
  store.devices.some((d) => d.type === 'sensor' && d.external_id && d.metrics?.length),
)

function toggleLive() {
  if (store.liveRunning) store.stopLiveFeed()
  else store.startLiveFeed()
}

async function remove(device) {
  if (!confirm(`Ukloniti "${device.name}"?`)) return
  try {
    await store.removeDevice(device.id)
  } catch (err) {
    alert('Greška: ' + err.message)
  }
}

// --- ThingsBoard ---
async function openTb() {
  showTb.value = true
  if (tb.connected) await tb.loadDevices()
}

async function connectTb() {
  const ok = await tb.connect(tbForm.host, tbForm.username, tbForm.password)
  if (ok) tbForm.password = ''
}

function isImported(tbId) {
  return store.devices.some((d) => d.external_id === tbId)
}

function guessKind(d) {
  return /klima|clima|controller|actuator|aktuator/i.test(`${d.type} ${d.name}`)
    ? 'actuator'
    : 'sensor'
}

async function importTb(d) {
  importingId.value = d.id
  try {
    await store.importThingsboardDevice(d, importKind[d.id] || guessKind(d))
  } catch (err) {
    alert('Greška: ' + err.message)
  } finally {
    importingId.value = ''
  }
}

// Pre-fill the per-device import type guess whenever the TB device list changes.
watch(
  () => tb.devices,
  (list) => {
    for (const d of list) if (!importKind[d.id]) importKind[d.id] = guessKind(d)
  },
  { deep: true, immediate: true },
)
</script>

<style scoped>
.dashboard {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.dash-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(180, 120, 60, 0.3);
}
.head-left { display: flex; align-items: center; gap: 1rem; }

.back-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  border: 1px solid rgba(180, 120, 60, 0.3);
  color: #d4a96a;
  text-decoration: none;
  transition: all 0.2s;
}
.back-link:hover { background: rgba(212, 169, 106, 0.15); }

.dash-header h1 {
  font-size: 1.8rem;
  font-weight: 400;
  font-style: italic;
  color: #d4a96a;
  letter-spacing: 0.04em;
}
.subtitle {
  font-size: 0.74rem;
  color: #8a6840;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-family: 'Courier New', monospace;
  margin-top: 4px;
}

.connection-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: #8a6840;
  font-family: 'Courier New', monospace;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c0392b;
  animation: pulse 2s ease-in-out infinite;
}
.dot.connected { background: #27ae60; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.loading {
  text-align: center;
  color: #8a6840;
  font-family: 'Courier New', monospace;
  padding: 3rem;
}

.toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.empty-room {
  text-align: center;
  padding: 3rem 1.5rem;
  border: 1px dashed rgba(180, 120, 60, 0.3);
  border-radius: 14px;
  margin-bottom: 1.25rem;
}
.empty-room > i { font-size: 2.6rem; color: #8a6840; }
.empty-room h2 {
  font-weight: 400;
  font-style: italic;
  color: #d4a96a;
  margin: 0.75rem 0 0.5rem;
}
.empty-room p {
  color: #8a6840;
  font-size: 0.85rem;
  max-width: 460px;
  margin: 0 auto 1.5rem;
  line-height: 1.6;
}

.panel {
  background: #2a1208;
  border: 1px solid rgba(180, 120, 60, 0.2);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
}
.panel-title {
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #8a6840;
  font-family: 'Courier New', monospace;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 1rem;
}
.src-note {
  color: #a08858;
  font-size: 0.8rem;
  line-height: 1.6;
}
.src-note code {
  background: rgba(0, 0, 0, 0.3);
  padding: 1px 6px;
  border-radius: 4px;
  color: #d4a96a;
}

.log-list { max-height: 160px; overflow-y: auto; }
.log-entry {
  display: flex;
  gap: 12px;
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  padding: 4px 0;
  border-bottom: 1px solid rgba(180, 120, 60, 0.07);
}
.log-time { color: #7a5a38; min-width: 70px; }
.log-ok .log-msg { color: #4a8a5a; }
.log-warn .log-msg { color: #a07030; }

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(212, 169, 106, 0.18);
  border: 1px solid rgba(212, 169, 106, 0.45);
  color: #d4a96a;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 0.74rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary:hover:not(:disabled) { background: rgba(212, 169, 106, 0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-connect {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid rgba(212, 169, 106, 0.4);
  color: #d4a96a;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 0.74rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-connect:hover { background: rgba(212, 169, 106, 0.15); }
.btn-connect.stop {
  border-color: rgba(192, 57, 43, 0.4);
  color: #e07a6a;
}

.btn-inline {
  background: transparent;
  border: 1px solid rgba(180, 120, 60, 0.3);
  color: #8a6840;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn-inline:hover:not(:disabled) { color: #d4a96a; border-color: rgba(212, 169, 106, 0.4); }
.btn-inline:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-ghost {
  background: transparent;
  border: 1px solid rgba(180, 120, 60, 0.3);
  color: #8a6840;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-ghost:hover { color: #d4a96a; border-color: rgba(212, 169, 106, 0.4); }

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
  max-width: 420px;
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

.auth-error {
  color: #e06a5a;
  font-size: 0.76rem;
  font-family: 'Courier New', monospace;
  margin-bottom: 0.75rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.modal.wide { max-width: 540px; }

.tb-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.tb-host {
  font-size: 0.74rem;
  font-family: 'Courier New', monospace;
  color: #4a8a5a;
  display: flex;
  align-items: center;
  gap: 5px;
  word-break: break-all;
}
.tb-bar .btn-inline { margin-left: 6px; }

.tb-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 320px;
  overflow-y: auto;
}
.tb-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(180, 120, 60, 0.15);
  border-radius: 8px;
  padding: 10px 12px;
}
.tb-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.tb-name { color: #f0e6d3; font-size: 0.88rem; }
.tb-type {
  color: #7a5a38;
  font-size: 0.66rem;
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.tb-kind {
  background: #1a0a05;
  border: 1px solid rgba(180, 120, 60, 0.3);
  border-radius: 6px;
  padding: 6px 8px;
  color: #f0e6d3;
  font-size: 0.74rem;
  font-family: 'Courier New', monospace;
  outline: none;
}
.tb-done {
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  color: #4a8a5a;
  display: flex;
  align-items: center;
  gap: 4px;
}

@media (max-width: 700px) {
  .dash-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
}
</style>
