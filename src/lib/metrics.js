// Display metadata + wine-cellar status thresholds for each metric.

export const METRIC_META = {
  temperature: {
    key: 'temperature',
    label: 'Temperatura',
    unit: '°C',
    decimals: 1,
    color: '#e74c3c',
    icon: 'temperature',
    type: 'temp',
  },
  humidity: {
    key: 'humidity',
    label: 'Vlaga zraka',
    unit: '%',
    decimals: 0,
    color: '#3498db',
    icon: 'droplet',
    type: 'humidity',
  },
  co2: {
    key: 'co2',
    label: 'CO₂',
    unit: 'ppm',
    decimals: 0,
    color: '#2ecc71',
    icon: 'wind',
    type: 'co2',
  },
}

export const ALL_METRICS = Object.keys(METRIC_META)

export function statusFor(metric, value) {
  if (value == null) return { label: 'Nema podataka', color: 'warn' }
  switch (metric) {
    case 'temperature':
      if (value < 10) return { label: 'Prehladno', color: 'warn' }
      if (value > 16) return { label: 'Previše toplo', color: 'bad' }
      return { label: 'Optimalno (10–16°C)', color: 'ok' }
    case 'humidity':
      if (value < 50) return { label: 'Presuho — rizik za čepove', color: 'bad' }
      if (value > 80) return { label: 'Previsoka vlaga — plijesan', color: 'warn' }
      return { label: 'Optimalno (60–75%)', color: 'ok' }
    case 'co2':
      if (value < 600) return { label: 'Odličan zrak', color: 'ok' }
      if (value < 1000) return { label: 'Malo povišeno', color: 'warn' }
      return { label: 'Visoko — prozrači podrum', color: 'bad' }
    default:
      return { label: '', color: 'ok' }
  }
}
