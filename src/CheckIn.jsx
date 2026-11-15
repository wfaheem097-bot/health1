import React, { useState } from 'react';
import { metric, channels, stamp } from './telemetry';

const empty = { fatigue: '', mood: '', symptoms: [], notes: '' };
const moods = ['Alert & focused', 'Neutral / steady', 'Mild brain fog', 'Fatigued', 'Disoriented / stressed'];
const symptoms = ['Muscle soreness', 'Headache', 'Thermal discomfort', 'Dizziness', 'Eye strain', 'Other discomfort'];

export default function CheckIn({ data }) {
  const key = 'astra-check-in:' + data.astronaut.id + ':' + data.astronaut.mission_day;
  const [form, setForm] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? empty; } catch { return empty; }
  });
  const [notice, setNotice] = useState('');
  const update = change => { setForm(previous => ({ ...previous, ...change })); setNotice(''); };
  const { reading } = data.latest;

  function save(event) {
    event.preventDefault();
    try {
      localStorage.setItem(key, JSON.stringify(form));
      setNotice('Draft saved on this browser.');
    } catch {
      setNotice('Browser storage is unavailable.');
    }
  }

  return <>
    <div className="page-head"><div><h1>Crew Daily Check-in</h1><p>Log subjective crew observations alongside the wearable downlink.</p></div>
      <span className="tag">Local draft</span></div>
    <div className="console-grid">
      <form className="panel span-8 check-form" onSubmit={save}>
        <fieldset><legend>1. Fatigue Level</legend>
          <div className="fatigue-grid">{Array.from({ length: 10 }, (_, index) => {
            const score = index + 1;
            return <label className="option" key={score}>
              <input type="radio" name="fatigue" checked={form.fatigue === score} onChange={() => update({ fatigue: score })} />
              <span>{score}</span>
            </label>;
          })}</div><p className="muted">1 · Rested <span className="float-right">10 · Exhausted</span></p>
        </fieldset>
        <fieldset><legend>2. Mood &amp; Cognitive State</legend>
          <div className="mood-grid">{moods.map(mood => <label className="option" key={mood}>
            <input type="radio" name="mood" checked={form.mood === mood} onChange={() => update({ mood })} /><span>{mood}</span>
          </label>)}</div>
        </fieldset>
        <fieldset><legend>3. Physical Symptoms</legend>
          <div className="symptom-grid">{symptoms.map(symptom => <label className="check-option" key={symptom}>
            <input type="checkbox" checked={form.symptoms.includes(symptom)} onChange={event => update({
              symptoms: event.target.checked ? [...form.symptoms, symptom] : form.symptoms.filter(value => value !== symptom),
            })} />{symptom}</label>)}</div>
        </fieldset>
        <fieldset><legend><label htmlFor="notes">4. Additional Observations</label></legend>
          <textarea id="notes" rows="4" maxLength={500} value={form.notes} onChange={event => update({ notes: event.target.value })} />
          <p className="muted mono">{form.notes.length} / 500 characters</p>
        </fieldset>
        <div className="actions"><button type="button" onClick={() => { setForm(empty); setNotice(''); }}>Reset form</button>
          <button className="primary" type="submit">Save draft</button></div>
        <p className="muted">Drafts are stored in this browser.</p>
        {notice && <p role="status">{notice}</p>}
      </form>
      <aside className="stack span-4">
        <section className="panel"><h2>Wearable Downlink</h2><div className="context-grid">
          {[channels[0], channels[2], channels[3], channels[4]].map(channel => <div key={channel.label}>
            <small>{channel.label}</small><strong>{metric(reading, channel)}</strong>
          </div>)}</div><p className="mono muted">{stamp(reading.timestamp)}</p></section>
        <section className="panel"><h2>Check-in Subject</h2><p>{data.astronaut.name} · {data.astronaut.id}</p>
          <p className="mono muted">Mission day {data.astronaut.mission_day}</p></section>
      </aside>
    </div>
  </>;
}
