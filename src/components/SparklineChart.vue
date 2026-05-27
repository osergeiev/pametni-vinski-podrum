<template>
  <div class="sparkline-wrap">
    <div class="chart-header">
      <span class="chart-title">{{ title }}</span>
      <span class="chart-current">{{ data[data.length - 1]?.toFixed(decimals) }} {{ unit }}</span>
    </div>

    <svg :viewBox="`0 0 ${W} ${H}`" class="chart-svg">
      <defs>
        <linearGradient :id="`grad-${uid}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Y axis grid lines + labels -->
      <g v-for="tick in yTicks" :key="tick.value">
        <line
          :x1="LEFT" :y1="tick.y"
          :x2="W" :y2="tick.y"
          stroke="rgba(180,120,60,0.12)" stroke-width="1"
          stroke-dasharray="3,4"
        />
        <text
          :x="LEFT - 6" :y="tick.y + 4"
          text-anchor="end"
          font-size="9"
          font-family="Courier New, monospace"
          fill="#6a4828"
        >{{ tick.label }}</text>
      </g>

      <!-- X axis labels -->
      <g v-for="tick in xTicks" :key="tick.i">
        <text
          :x="tick.x" :y="H"
          text-anchor="middle"
          font-size="9"
          font-family="Courier New, monospace"
          fill="#6a4828"
        >{{ tick.label }}</text>
      </g>

      <!-- Area fill -->
      <path :d="areaPath" :fill="`url(#grad-${uid})`" />

      <!-- Line -->
      <path
        :d="linePath"
        fill="none"
        :stroke="color"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Current value dot -->
      <circle
        v-if="lastPt"
        :cx="lastPt.x" :cy="lastPt.y"
        r="3"
        :fill="color"
      />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data:     { type: Array,  required: true },
  title:    String,
  unit:     String,
  color:    { type: String, default: '#e74c3c' },
  decimals: { type: Number, default: 1 },
  // How many minutes the history covers (data.length points = this many minutes)
  minutes:  { type: Number, default: 15 },
})

// Unique id so multiple charts don't share gradient ids
const uid = Math.random().toString(36).slice(2, 7)

const W    = 300
const H    = 140
const LEFT = 34   // space for Y axis labels
const BOT  = 16   // space for X axis labels
const TOP  = 6

// Compute nice Y bounds (round to nearest 5 or 10 depending on range)
const dataMin = computed(() => Math.min(...props.data))
const dataMax = computed(() => Math.max(...props.data))

const yMin = computed(() => {
  const range = dataMax.value - dataMin.value
  const step = range < 5 ? 1 : range < 20 ? 5 : 10
  return Math.floor(dataMin.value / step) * step - step
})
const yMax = computed(() => {
  const range = dataMax.value - dataMin.value
  const step = range < 5 ? 1 : range < 20 ? 5 : 10
  return Math.ceil(dataMax.value / step) * step + step
})

// Convert a data value to SVG y coordinate
function toY(v) {
  const range = yMax.value - yMin.value || 1
  return TOP + (1 - (v - yMin.value) / range) * (H - BOT - TOP)
}

// Convert index to SVG x coordinate
function toX(i) {
  const n = props.data.length
  return LEFT + (i / (n - 1)) * (W - LEFT)
}

// Y axis: 4 evenly spaced ticks
const yTicks = computed(() => {
  const count = 4
  const step = (yMax.value - yMin.value) / count
  return Array.from({ length: count + 1 }, (_, i) => {
    const value = yMin.value + i * step
    return {
      value,
      y: toY(value),
      label: value.toFixed(props.decimals === 0 ? 0 : 1),
    }
  })
})

// X axis: show ~4 time labels (e.g. "-15min", "-10min", "-5min", "now")
const xTicks = computed(() => {
  const n = props.data.length
  const positions = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1]
  return positions.map(i => {
    const minsAgo = Math.round(((n - 1 - i) / (n - 1)) * props.minutes)
    return {
      i,
      x: toX(i),
      label: minsAgo === 0 ? 'sad' : `-${minsAgo}m`,
    }
  })
})

// Build SVG path
function buildPath(area) {
  const d = props.data
  if (!d || d.length < 2) return ''
  const pts = d.map((v, i) => ({ x: toX(i), y: toY(v) }))

  let path = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1].x + pts[i].x) / 2
    path += ` C ${mx} ${pts[i - 1].y}, ${mx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`
  }
  if (area) {
    const bottom = H - BOT
    path += ` L ${pts[pts.length - 1].x} ${bottom} L ${pts[0].x} ${bottom} Z`
  }
  return path
}

const linePath = computed(() => buildPath(false))
const areaPath = computed(() => buildPath(true))

const lastPt = computed(() => {
  const d = props.data
  if (!d?.length) return null
  const i = d.length - 1
  return { x: toX(i), y: toY(d[i]) }
})
</script>

<style scoped>
.sparkline-wrap {
  background: #2a1208;
  border: 1px solid rgba(180, 120, 60, 0.2);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.chart-title {
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #8a6840;
  font-family: 'Courier New', monospace;
}

.chart-current {
  font-size: 0.75rem;
  font-family: 'Courier New', monospace;
  color: #d4a96a;
  font-weight: 600;
}

.chart-svg {
  width: 100%;
  height: 140px;
  display: block;
  overflow: visible;
}
</style>