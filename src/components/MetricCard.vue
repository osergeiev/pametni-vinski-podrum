<template>
  <div class="metric-card" :class="type">
    <div class="metric-accent"></div>
    <i class="ti metric-icon" :class="`ti-${icon}`" aria-hidden="true"></i>
    <div class="metric-label">{{ label }}</div>
    <div class="metric-value">
      {{ displayValue }}<span class="metric-unit">{{ unit }}</span>
    </div>
    <div class="metric-status" :class="`status-${status.color}`">
      ▸ {{ status.label }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: Number,
  unit: String,
  decimals: { type: Number, default: 1 },
  icon: String,
  type: String,       // 'temp' | 'humidity' | 'co2'
  status: Object,     // { label, color: 'ok'|'warn'|'bad' }
})
</script>

<script>
export default {
  computed: {
    displayValue() {
      return this.value?.toFixed(this.decimals) ?? '—'
    }
  }
}
</script>

<style scoped>
.metric-card {
  background: linear-gradient(160deg, #2a1208 0%, #1e0d05 100%);
  border: 1px solid rgba(180, 120, 60, 0.25);
  border-radius: 12px;
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s;
}
.metric-card:hover { border-color: rgba(180, 120, 60, 0.5); }

.metric-accent {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 12px 12px 0 0;
}
.temp .metric-accent    { background: linear-gradient(90deg, #c0392b, #e74c3c); }
.humidity .metric-accent { background: linear-gradient(90deg, #2980b9, #3498db); }
.co2 .metric-accent     { background: linear-gradient(90deg, #27ae60, #2ecc71); }

.metric-icon {
  position: absolute;
  top: 1.25rem; right: 1.25rem;
  font-size: 1.4rem;
  opacity: 0.25;
  color: #d4a96a;
}

.metric-label {
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #8a6840;
  font-family: 'Courier New', monospace;
  margin-bottom: 0.75rem;
}

.metric-value {
  font-size: 2.8rem;
  font-weight: 300;
  color: #f0e6d3;
  line-height: 1;
  font-family: 'Courier New', monospace;
}

.metric-unit {
  font-size: 1rem;
  color: #8a6840;
  margin-left: 4px;
}

.metric-status {
  margin-top: 0.75rem;
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.08em;
}
.status-ok  { color: #27ae60; }
.status-warn { color: #e67e22; }
.status-bad  { color: #c0392b; }
</style>
