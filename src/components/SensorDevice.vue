<template>
  <div class="device-panel">
    <div class="device-head">
      <div class="device-head-info">
        <i class="ti ti-device-analytics" aria-hidden="true"></i>
        <div>
          <div class="device-name">{{ device.name }}</div>
          <div class="device-token">
            <i class="ti ti-key" aria-hidden="true"></i>
            {{ device.external_id || 'bez tokena' }}
          </div>
        </div>
      </div>
      <div class="device-actions">
        <button class="icon-btn" title="Osvježi povijest" @click="$emit('refresh', device)">
          <i class="ti ti-refresh" aria-hidden="true"></i>
        </button>
        <button class="icon-btn danger" title="Ukloni" @click="$emit('remove', device)">
          <i class="ti ti-trash" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <p v-if="!metrics.length" class="device-empty">
      Nije odabrana niti jedna mjerna veličina za ovaj senzor.
    </p>

    <template v-else>
      <div class="metric-row">
        <MetricCard
          v-for="m in metrics"
          :key="`card-${m.key}`"
          :label="m.label"
          :value="current(m.key)"
          :unit="m.unit"
          :decimals="m.decimals"
          :icon="m.icon"
          :type="m.type"
          :status="statusFor(m.key, current(m.key))"
        />
      </div>

      <div class="chart-row">
        <template v-for="m in metrics" :key="`chart-${m.key}`">
          <SparklineChart
            v-if="history(m.key).length > 1"
            :data="history(m.key)"
            :title="`${m.label} (15 min)`"
            :unit="m.unit"
            :color="m.color"
            :decimals="m.decimals"
          />
          <div v-else class="chart-empty">
            <span class="chart-empty-title">{{ m.label }} (15 min)</span>
            <span class="chart-empty-msg">
              <i class="ti ti-clock-pause" aria-hidden="true"></i>
              Nema dovoljno podataka u zadnjih 15 min
            </span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MetricCard from '@/components/MetricCard.vue'
import SparklineChart from '@/components/SparklineChart.vue'
import { METRIC_META, statusFor } from '@/lib/metrics'

const props = defineProps({
  device: { type: Object, required: true },
  readings: { type: Array, default: () => [] },
})

defineEmits(['refresh', 'remove'])

const metrics = computed(() =>
  (props.device.metrics || []).map((k) => METRIC_META[k]).filter(Boolean),
)

function history(key) {
  return props.readings.filter((r) => r[key] != null).map((r) => r[key])
}

function current(key) {
  const h = history(key)
  return h.length ? h[h.length - 1] : null
}
</script>

<style scoped>
.device-panel {
  background: #2a1208;
  border: 1px solid rgba(180, 120, 60, 0.2);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
}

.device-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 1rem;
}

.device-head-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.device-head-info > i {
  font-size: 1.5rem;
  color: #d4a96a;
}

.device-name {
  font-size: 1.05rem;
  font-style: italic;
  color: #f0e6d3;
}

.device-token {
  font-size: 0.68rem;
  font-family: 'Courier New', monospace;
  color: #7a5a38;
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-actions {
  display: flex;
  gap: 6px;
}
.icon-btn {
  background: transparent;
  border: 1px solid rgba(180, 120, 60, 0.3);
  color: #8a6840;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.icon-btn:hover { color: #d4a96a; border-color: rgba(212, 169, 106, 0.4); }
.icon-btn.danger:hover { color: #c0392b; border-color: rgba(192, 57, 43, 0.4); }

.device-empty {
  color: #7a5a38;
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.chart-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.chart-empty {
  background: #2a1208;
  border: 1px dashed rgba(180, 120, 60, 0.25);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
  min-height: 140px;
}
.chart-empty-title {
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #8a6840;
  font-family: 'Courier New', monospace;
}
.chart-empty-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #7a5a38;
  font-size: 0.78rem;
  font-family: 'Courier New', monospace;
}
</style>
