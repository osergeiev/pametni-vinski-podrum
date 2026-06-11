<template>
  <div class="actuator-panel">
    <div class="act-info">
      <i class="ti ti-air-conditioning" aria-hidden="true"></i>
      <div>
        <div class="act-name">
          {{ device.name }}
          <span class="act-mode">{{ isAuto ? 'automatska' : 'ručna' }}</span>
        </div>
        <div class="act-state" :class="{ on: device.state }">
          {{ device.state ? 'Uključeno' : 'Isključeno' }}
        </div>
      </div>
    </div>

    <div class="act-controls">
      <span v-if="isAuto" class="act-auto-note">
        <i class="ti ti-bolt-filled" aria-hidden="true"></i>
        Upravlja senzor temperature
      </span>
      <button
        v-else
        class="act-toggle"
        :class="{ active: device.state }"
        @click="$emit('toggle', device)"
      >
        <i class="ti" :class="device.state ? 'ti-power' : 'ti-player-play'" aria-hidden="true"></i>
        {{ device.state ? 'Isključi' : 'Uključi' }}
      </button>
      <button class="icon-btn danger" title="Ukloni" @click="$emit('remove', device)">
        <i class="ti ti-trash" aria-hidden="true"></i>
      </button>
    </div>

    <div class="act-bar-wrap">
      <div class="act-bar" :class="{ active: device.state }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  device: { type: Object, required: true },
})
defineEmits(['toggle', 'remove'])

const isAuto = computed(() => props.device.role === 'klima_auto')
</script>

<style scoped>
.actuator-panel {
  background: linear-gradient(160deg, #2a1208 0%, #1e0d05 100%);
  border: 1px solid rgba(180, 120, 60, 0.25);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.act-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.act-info > i {
  font-size: 1.6rem;
  color: #3498db;
}

.act-name {
  font-size: 1.05rem;
  font-style: italic;
  color: #f0e6d3;
}
.act-mode {
  font-size: 0.6rem;
  font-style: normal;
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #8a6840;
  border: 1px solid rgba(180, 120, 60, 0.3);
  border-radius: 4px;
  padding: 1px 6px;
  margin-left: 8px;
  vertical-align: middle;
}
.act-auto-note {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  color: #c8923f;
}
.act-state {
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  color: #7a5a38;
  letter-spacing: 0.08em;
  margin-top: 2px;
}
.act-state.on { color: #3498db; }

.act-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.act-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: 8px;
  border: 1px solid rgba(180, 120, 60, 0.3);
  background: transparent;
  color: #8a6840;
  font-size: 0.78rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.25s;
}
.act-toggle.active {
  border-color: rgba(52, 152, 219, 0.6);
  color: #3498db;
  background: rgba(52, 152, 219, 0.08);
}

.icon-btn {
  background: transparent;
  border: 1px solid rgba(180, 120, 60, 0.3);
  color: #8a6840;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.icon-btn.danger:hover { color: #c0392b; border-color: rgba(192, 57, 43, 0.4); }

.act-bar-wrap {
  height: 3px;
  background: rgba(180, 120, 60, 0.15);
  border-radius: 2px;
  overflow: hidden;
}
.act-bar {
  height: 100%;
  width: 0%;
  background: rgba(180, 120, 60, 0.3);
  transition: width 0.5s, background 0.5s;
}
.act-bar.active {
  width: 100%;
  background: linear-gradient(90deg, #2980b9, #3498db);
}
</style>
