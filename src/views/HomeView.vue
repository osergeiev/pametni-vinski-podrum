<template>
  <main class="dashboard">

    <!-- Header -->
    <header class="dash-header">
      <div>
        <h1>Pametni Vinski Podrum</h1>
        <p class="subtitle">IoT Monitoring Dashboard · Projekt 2026</p>
      </div>
      <div class="connection-badge">
        <span class="dot" :class="{ connected: store.isConnected }"></span>
        {{ store.isConnected ? 'ThingsBoard Online' : 'Demo Mode' }}
        <span v-if="store.lastUpdated" class="last-updated">· {{ store.lastUpdated }}</span>
      </div>
    </header>

    <!-- Metric cards -->
    <section class="metrics-grid">
      <MetricCard
        label="Temperatura"
        :value="store.temperature"
        unit="°C"
        :decimals="1"
        icon="temperature"
        type="temp"
        :status="store.tempStatus"
      />
      <MetricCard
        label="Vlaga Zraka"
        :value="store.humidity"
        unit="%"
        :decimals="0"
        icon="droplet"
        type="humidity"
        :status="store.humidStatus"
      />
      <MetricCard
        label="CO₂"
        :value="store.co2"
        unit="ppm"
        :decimals="0"
        icon="wind"
        type="co2"
        :status="store.co2Status"
      />
    </section>

    <!-- Charts: temp + humidity -->
    <section class="charts-grid">
      <SparklineChart
        :data="store.tempHistory"
        title="Povijest temperature (15 min)"
        unit="°C"
        color="#e74c3c"
        :decimals="1"
      />
      <SparklineChart
        :data="store.humidHistory"
        title="Povijest vlage (15 min)"
        unit="%"
        color="#3498db"
        :decimals="0"
      />
    </section>

    <!-- CO2 chart + AC status side by side -->
    <section class="charts-grid">
      <SparklineChart
        :data="store.co2History"
        title="Povijest CO₂ (15 min)"
        unit="ppm"
        color="#2ecc71"
        :decimals="0"
      />
      <AcStatus
        :status="store.acStatus"
        :dew-point="store.dewPoint"
        :temperature="store.temperature"
        @toggle="store.toggleAc()"
      />
    </section>

    <!-- ThingsBoard config -->
    <section class="panel config-panel">
      <div class="panel-title">
        <i class="ti ti-settings" aria-hidden="true"></i>
        ThingsBoard konfiguracija
        <button class="btn-simulate" @click="store.mockTick()">▶ Simuliraj podatke</button>
      </div>
      <div class="config-grid">
        <div class="field">
          <label>Host / URL</label>
          <input v-model="store.tbConfig.host" placeholder="https://demo.thingsboard.io" />
        </div>
        <div class="field">
          <label>Device Token</label>
          <input v-model="store.tbConfig.token" placeholder="A1B2C3..." type="password" />
        </div>
        <div class="field">
          <label>Protokol</label>
          <input v-model="store.tbConfig.protocol" placeholder="HTTP / MQTT" />
        </div>
      </div>
      <button class="btn-connect" @click="store.fetchFromThingsboard()">
        <i class="ti ti-plug" aria-hidden="true"></i> Spoji se na ThingsBoard
      </button>
    </section>

    <!-- Log -->
    <section class="panel log-panel">
      <div class="panel-title">
        <i class="ti ti-terminal" aria-hidden="true"></i>
        Sistemski log
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

  </main>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useSensorsStore } from '@/stores/sensors'
import MetricCard from '@/components/MetricCard.vue'
import SparklineChart from '@/components/SparklineChart.vue'
import AcStatus from '@/components/AcStatus.vue'

const store = useSensorsStore()

let interval
onMounted(() => {
  interval = setInterval(() => store.mockTick(), 5000)
})
onUnmounted(() => clearInterval(interval))
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
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(180, 120, 60, 0.3);
}

.dash-header h1 {
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

.connection-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: #8a6840;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.08em;
}

.dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #c0392b;
  animation: pulse 2s ease-in-out infinite;
}
.dot.connected { background: #27ae60; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.last-updated { color: #5a4030; }

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
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

.btn-simulate {
  margin-left: auto;
  background: transparent;
  border: 1px solid rgba(180, 120, 60, 0.3);
  color: #8a6840;
  padding: 4px 14px;
  border-radius: 6px;
  font-size: 0.68rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-simulate:hover { color: #d4a96a; border-color: rgba(212, 169, 106, 0.4); }

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

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
  border-radius: 6px;
  padding: 8px 10px;
  color: #f0e6d3;
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
  outline: none;
  transition: border-color 0.2s;
}
.field input:focus { border-color: rgba(212, 169, 106, 0.6); }

.btn-connect {
  background: rgba(212, 169, 106, 0.15);
  border: 1px solid rgba(212, 169, 106, 0.4);
  color: #d4a96a;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-connect:hover { background: rgba(212, 169, 106, 0.25); }

.log-list {
  max-height: 160px;
  overflow-y: auto;
}

.log-entry {
  display: flex;
  gap: 12px;
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  padding: 4px 0;
  border-bottom: 1px solid rgba(180, 120, 60, 0.07);
}
.log-time { color: #7a5a38; min-width: 70px; }
.log-ok .log-msg   { color: #4a8a5a; }
.log-warn .log-msg { color: #a07030; }

@media (max-width: 700px) {
  .metrics-grid, .charts-grid, .config-grid { grid-template-columns: 1fr; }
  .dash-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
}
</style>