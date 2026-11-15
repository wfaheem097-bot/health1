export const channels = [
  { label: 'Heart Rate', unit: 'bpm', keys: ['heart_rate_bpm'] },
  { label: 'Blood Pressure', unit: 'mmHg', keys: ['systolic_mmhg', 'diastolic_mmhg'] },
  { label: 'Oxygen Saturation', unit: '%', keys: ['spo2_percent'] },
  { label: 'Core Temperature', unit: '°C', keys: ['temperature_c'] },
  { label: 'Sleep', unit: 'h', keys: ['sleep_hours'] },
  { label: 'Activity', unit: 'min', keys: ['activity_minutes'] },
];

export const stamp = timestamp => timestamp ? timestamp.replace('T', ' ') + ' UTC' : '—';

export function metric(row, channel) {
  const values = channel.keys.map(key => row.device_status === 'disconnected' ? null : row[key]);
  return values.every(value => value == null) ? '—' : values.map(value => value ?? '—').join('/') + ' ' + channel.unit;
}

export function delta(row, baseline, channel) {
  const values = channel.keys.map(key => {
    if (row.device_status === 'disconnected' || row[key] == null || baseline[key] == null) return '—';
    const change = Number((row[key] - baseline[key]).toFixed(2));
    return change > 0 ? '+' + change : String(change);
  });
  return values.join('/');
}
