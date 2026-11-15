const API = '/api';

async function request(path, options) {
  const response = await fetch(API + path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'Cannot reach the telemetry service.');
  }
  return response.json();
}

export async function loadDashboard(previous) {
  if (previous) return { ...previous, ...await request(previous.path + '/telemetry', { cache: 'no-store' }) };
  const [astronaut] = await request('/astronauts');
  const path = '/astronauts/' + encodeURIComponent(astronaut.id);
  const [baseline, telemetry] = await Promise.all([
    request(path + '/baseline'),
    request(path + '/telemetry', { cache: 'no-store' }),
  ]);
  return { astronaut, baseline, path, ...telemetry };
}

export function uploadCsv(file) {
  const body = new FormData();
  body.append('file', file);
  return request('/readings/upload', { method: 'POST', body });
}

export function explainAlert(path) {
  return request(path + '/explain', { method: 'POST' });
}

export function replayDataset() {
  return request('/readings/replay', { method: 'POST' });
}

export function predictLocal(id, values) {
  return request('/models/' + encodeURIComponent(id) + '/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
}
