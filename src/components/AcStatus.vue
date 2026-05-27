<template>
  <div class="ac-card">
    <div class="ac-top">
      <div>
        <div class="ac-label">Pametni klima uređaj</div>
        <div class="ac-reason">{{ status.reason }}</div>
      </div>

      <!-- Toggle button -->
      <button class="ac-toggle" :class="{ active: status.active }" @click="$emit('toggle')">
        <i class="ti ti-snowflake" aria-hidden="true"></i>
        {{ status.active ? 'Uključen' : 'Standby' }}
      </button>
    </div>

    <!-- Dew point row -->
    <div class="dew-row">
      <i class="ti ti-droplet-half-2" aria-hidden="true"></i>
      <span class="dew-label">Točka rosišta</span>
      <span class="dew-value">{{ dewPoint }}°C</span>
      <span class="dew-status" :class="dewRisk.cls">{{ dewRisk.label }}</span>
    </div>

    <!-- Visual indicator bar -->
    <div class="ac-bar-wrap">
      <div class="ac-bar" :class="{ active: status.active }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status:   { type: Object, required: true },  // { active, reason }
  dewPoint: { type: Number, required: true },
  temperature: { type: Number, required: true },
})

defineEmits(['toggle'])

const dewRisk = computed(() => {
  const margin = props.temperature - props.dewPoint
  if (margin < 2) return { cls: 'risk-bad',  label: 'Rizik kondenzacije' }
  if (margin < 5) return { cls: 'risk-warn', label: 'Oprez' }
  return { cls: 'risk-ok', label: 'Bez rizika' }
})
</script>

<style scoped>
.ac-card {
  background: linear-gradient(160deg, #2a1208 0%, #1e0d05 100%);
  border: 1px solid rgba(180, 120, 60, 0.25);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ac-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.ac-label {
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #8a6840;
  font-family: 'Courier New', monospace;
  margin-bottom: 4px;
}

.ac-reason {
  font-size: 0.8rem;
  color: #c0a060;
  font-family: 'Courier New', monospace;
}

.ac-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid rgba(180, 120, 60, 0.3);
  background: transparent;
  color: #8a6840;
  font-size: 0.78rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.25s;
  white-space: nowrap;
}

.ac-toggle i { font-size: 1.1rem; }

.ac-toggle.active {
  border-color: rgba(52, 152, 219, 0.6);
  color: #3498db;
  background: rgba(52, 152, 219, 0.08);
  animation: ac-pulse 3s ease-in-out infinite;
}

@keyframes ac-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0); }
  50%       { box-shadow: 0 0 0 4px rgba(52, 152, 219, 0.15); }
}

.dew-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  font-family: 'Courier New', monospace;
}

.dew-row i { color: #3498db; font-size: 1rem; }

.dew-label {
  font-size: 0.72rem;
  color: #8a6840;
  letter-spacing: 0.08em;
  flex: 1;
}

.dew-value {
  font-size: 0.9rem;
  color: #f0e6d3;
}

.dew-status {
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 4px;
}
.risk-ok   { color: #27ae60; background: rgba(39,174,96,0.1); }
.risk-warn { color: #e67e22; background: rgba(230,126,34,0.1); }
.risk-bad  { color: #c0392b; background: rgba(192,57,43,0.1); }

.ac-bar-wrap {
  height: 3px;
  background: rgba(180, 120, 60, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.ac-bar {
  height: 100%;
  width: 0%;
  background: rgba(180, 120, 60, 0.3);
  border-radius: 2px;
  transition: width 0.5s, background 0.5s;
}

.ac-bar.active {
  width: 100%;
  background: linear-gradient(90deg, #2980b9, #3498db);
  animation: ac-flow 2s linear infinite;
}

@keyframes ac-flow {
  0%   { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}
</style>
