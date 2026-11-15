import React, { useState } from 'react';
import { predictLocal } from './api';

const models = {
  blood_pressure: ['Blood pressure · tilt test', 'Enter a JSON object with Minutes, CO, TPR, SV, Position, and Test_Phase.'],
  mitbih_ecg: ['MIT-BIH ECG', 'Enter an array of 256 preprocessed ECG samples.'],
  ptbxl_ecg: ['PTB-XL ECG', 'Enter an array of preprocessed ECG samples.'],
  bidmc_ppg: ['BIDMC PPG', 'Enter a preprocessed 10-second PPG window as an array.'],
  ptt_ppg: ['PTT PPG', 'Enter an array containing the preprocessed PPG window.'],
  ppg_anomaly: ['PPG anomaly detector', 'Enter the ten engineered features in their original training order.'],
};

export default function LocalModels({ automatic = [], timestamp }) {
  const [model, setModel] = useState('blood_pressure');
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await predictLocal(model, JSON.parse(input)));
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <div className="section-head"><h2>Local Model Inference</h2><span className="tag">Research</span></div>
    <p className="muted">Use model-ready inputs. Smoke-test values check execution only. Predictions are separate from crew telemetry and are for research use.</p>
    {automatic.length > 0 && <div className="well">
      <strong>Latest CSV model results</strong> <time>{timestamp}</time>
      {automatic.map(item => <p key={item.model}><b>{models[item.model][0]}</b>{' · '}
        {item.error ?? Object.entries(item.outputs).map(([key, value]) =>
          key + ' ' + Number(value.toFixed(3))).join(' · ')}
      </p>)}
    </div>}
    <form onSubmit={run}>
      <p><label>Model <select value={model} disabled={busy} onChange={event => {
        setModel(event.target.value); setInput(''); setResult(null); setError('');
      }}>{Object.entries(models).map(([id, [label]]) => <option key={id} value={id}>{label}</option>)}</select></label></p>
      <p><label htmlFor="model-values">{models[model][1]}</label></p>
      <textarea id="model-values" rows="4" required value={input} disabled={busy} onChange={event => {
        setInput(event.target.value); setResult(null); setError('');
      }} />
      <button type="button" disabled={busy} onClick={() => {
        setInput(JSON.stringify(model === 'blood_pressure'
          ? { Minutes: 5, CO: 5, TPR: 18, SV: 70, Position: 'Supine', Test_Phase: 'POST_TEST' }
          : Array.from({ length: model === 'ppg_anomaly' ? 10 : model === 'bidmc_ppg' ? 1250 : 256 },
          (_, index) => Math.sin(index / 8))));
        setResult(null); setError('');
      }}>Load smoke-test input</button>
      <button className="primary" disabled={busy}>{busy ? 'Running…' : 'Run local model'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {result && <dl className="context-grid" aria-live="polite">{Object.entries(result.outputs).map(([key, value]) =>
      <div key={key}><dt>{key}</dt><dd className="mono">{Number(value.toFixed(5))}</dd></div>)}</dl>}
  </section>;
}
