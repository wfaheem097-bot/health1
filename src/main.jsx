import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { explainAlert, loadDashboard, replayDataset, uploadCsv } from './api';
import LocalModels from './LocalModels';
import CheckIn from './CheckIn';
import TelemetryChart from './TelemetryChart';
import { channels, delta, metric, stamp } from './telemetry';
import './console.css';

const pages = [
  ['overview', 'Overview', './'],
  ['trends', 'Health Trends', './heart-rate.html'],
  ['check-in', 'Daily Check-in', './daily-check-in.html'],
];
const page = location.pathname.endsWith('/heart-rate.html') ? 'trends'
  : location.pathname.endsWith('/daily-check-in.html') ? 'check-in' : 'overview';
const tones = { Normal: 'normal', Watch: 'watch', Attention: 'attention', 'Insufficient Data': 'missing' };
const displayText = message => message.replace(/\bsimulated\s+/gi, '');
const POLL_MS = 2000;
const exportUrl = data => '/api' + data.path + '/export';
const recent = (rows, hours) => {
  const start = Date.parse(rows.at(-1).timestamp + 'Z') - hours * 3600000;
  return rows.filter(row => Date.parse(row.timestamp + 'Z') >= start);
};

function Badge({ status }) {
  return <span className={`badge ${tones[status]}`}>{status}</span>;
}

function Header({ data }) {
  const connected = data?.latest.reading.device_status === 'connected';
  const sync = data?.readings.findLast(row => row.device_status === 'connected');
  return <header className="topbar">
    <a href="./" className="brand"><strong>ASTRAHEALTH AI <span className="tag">FLIGHT OPS</span></strong><small>Spaceflight Human Research</small></a>
    <nav aria-label="Console views">{pages.map(([id, label, href]) =>
      <a key={id} href={href} aria-current={id === page ? 'page' : undefined}>{label}</a>)}</nav>
    {data && <div className="header-info">
      <div className="identity"><strong>{data.astronaut.name} · {data.astronaut.id}</strong><small>Crew member</small></div>
      <span className="tag">Mission Day {data.astronaut.mission_day}</span>
      <div><strong><i className={`dot ${connected ? 'online' : ''}`} />Wearable {connected ? 'Connected' : 'Disconnected'}</strong>
        <small>Wearable telemetry</small></div>
      <div><span className="mono">{stamp(sync?.timestamp)}</span><small>Last synchronized</small></div>
    </div>}
  </header>;
}

function AlertPanel({ data, history = false }) {
  const [expanded, setExpanded] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { analysis, reading } = data.latest;
  const affected = channels.filter(channel => channel.keys.some(key => analysis.affected_metrics.includes(key)));

  async function explain() {
    setPending(true);
    setError('');
    try {
      const result = await explainAlert(data.path);
      if (result.timestamp === reading.timestamp) setExplanation(result);
      else setError('A newer reading is available. Refresh data to see its explanation.');
    } catch {
      setError('The explanation service is unavailable. The latest analysis is shown below.');
    } finally {
      setPending(false);
    }
  }

  return <section className="panel alert-panel">
    <div className="section-head"><h2>{history ? 'Telemetry Assessment' : 'Trend Assessment'}</h2><Badge status={analysis.status} /></div>
    <div className="well"><small>Assessment</small><p>{displayText(explanation?.timestamp === reading.timestamp ? explanation.reason : analysis.reason)}</p></div>
    {affected.length > 0 && <div className="affected"><small>Affected metrics</small>
      <div>{affected.map(channel => <span className="tag" key={channel.label}>{channel.label}</span>)}</div></div>}
    <div className={`next-action ${tones[analysis.status]}`}><small>Recommended next action</small><p>{displayText(analysis.recommended_action)}</p></div>
    {error && <p role="alert">{error}</p>}
    <div className="actions">
      {history && data.alerts.length > 0 && <button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Hide' : 'View'} alert history ({data.alerts.length})</button>}
      {['Watch', 'Attention'].includes(analysis.status) && <button className="primary" disabled={pending} onClick={explain}>
        {pending ? 'Explaining…' : 'Explain Alert'}</button>}
    </div>
    {expanded && <ul className="alert-log">{data.alerts.map(alert => <li key={alert.timestamp}>
      <div className="section-head"><Badge status={alert.status} /><time>{stamp(alert.timestamp)}</time></div>
      <p>{displayText(alert.reason)}</p><p className="muted">{displayText(alert.recommended_action)}</p>
    </li>)}</ul>}
  </section>;
}

function Overview({ data }) {
  const [view, setView] = useState('overview');
  const { astronaut, baseline, latest, readings } = data;
  const { reading, analysis } = latest;
  return <>
    <div className="overview-heading">
      <h1>Mission Health Overview</h1>
      <div className="segments" role="group" aria-label="Overview view">
        <button aria-pressed={view === 'overview'} onClick={() => setView('overview')}>Summary</button>
        <button aria-pressed={view === 'details'} onClick={() => setView('details')}>Details</button>
      </div>
    </div>
    {view === 'overview' ? <>
      <section className={`panel crew-summary ${tones[analysis.status]}`}>
        <div><small>Crew status</small><h2>{analysis.status}</h2></div>
        <div><p>{displayText(analysis.reason)}</p>
          {analysis.status !== 'Normal' && <p className="muted"><strong>Next action</strong> · {displayText(analysis.recommended_action)}</p>}
        </div>
      </section>
      <section className="essential-vitals" aria-label="Current vitals">
        {channels.slice(0, 4).map(channel => <div className="panel" key={channel.label}>
          <small>{channel.label}</small><strong>{metric(reading, channel)}</strong>
        </div>)}
      </section>
    </> : <>
    <div className="console-grid">
      <section className="panel span-8">
        <div className="section-head"><h2>Crew Physiological Telemetry</h2><span className="tag">Latest sample</span></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Metric parameter</th><th>Latest reading</th><th>Personal baseline</th><th>Deviation</th><th>Alert flag</th></tr></thead>
          <tbody>{channels.map(channel => {
            const flagged = channel.keys.some(key => analysis.affected_metrics.includes(key));
            const current = metric(reading, channel);
            return <tr key={channel.label}><th scope="row">{channel.label}</th>
              <td className="value">{current}</td><td>{metric(baseline, channel)}</td><td>{delta(reading, baseline, channel)}</td>
              <td>{current === '—' ? <Badge status="Insufficient Data" /> : flagged ? <Badge status={analysis.status} /> : '—'}</td></tr>;
          })}</tbody>
        </table></div>
        <p className="table-note">Baseline comparisons use the astronaut’s personal reference values. Activity is tracked as context.</p>
      </section>
      <aside className="stack span-4">
        <section className="panel"><div className="section-head"><h2>Cardiovascular Downlink</h2><a href="./heart-rate.html">Health Trends ↗</a></div>
          <TelemetryChart rows={recent(readings, 12)} baseline={baseline} channel={channels[0]} hours={12} compact /></section>
        <section className="panel mission-panel">
          <div className="section-head"><h2>Mission Context</h2></div>
          <div className="orbit-field">
            <div className="orbit-diagram" aria-hidden="true"><i /><b /></div>
            <div><small>Mission day</small><strong>{String(astronaut.mission_day).padStart(2, '0')}</strong></div>
          </div>
          <div className="context-grid">
            <div><small>Downlinked readings</small><strong>{readings.length}</strong></div>
            <div><small>Telemetry alerts</small><strong>{data.alerts.length}</strong></div>
          </div>
        </section>
      </aside>
    </div>
    <AlertPanel data={data} history />
    <LocalModels automatic={data.model_results} timestamp={stamp(reading.timestamp)} />
    </>}
  </>;
}

function Trends({ data }) {
  const [channel, setChannel] = useState(channels[0]);
  const [hours, setHours] = useState(24);
  const [pageIndex, setPageIndex] = useState(0);
  const readings = recent(data.readings, hours);
  const alertStatus = new Map(data.alerts.map(alert => [alert.timestamp, alert.status]));
  const pageSize = 7;
  const pages = Math.ceil(readings.length / pageSize);
  const activePage = Math.min(pageIndex, pages - 1);
  const offset = activePage * pageSize;
  const visible = readings.slice().reverse().slice(offset, offset + pageSize);
  return <>
    <section className="panel trend-controls">
      <div className="segments" aria-label="Biometric channel"><small>Biometric channel</small>
        {channels.map(item => <button key={item.label} aria-pressed={item === channel} onClick={() => setChannel(item)}>{item.label}</button>)}</div>
      <div className="segments" aria-label="Time window"><small>Window</small>
        {[6, 24, 168].map(window => <button key={window} aria-pressed={hours === window} onClick={() => {
          setHours(window); setPageIndex(0);
        }}>{window === 168 ? '7D' : window + 'H'}</button>)}</div>
    </section>
    <div className="console-grid">
      <section className="panel span-8"><div className="section-head chart-head"><div>
        <h2>{channel.label} vs Personal Baseline</h2><p className="muted">Crew wearable downlink · {channel.unit}</p></div>
        <div className="chart-summary"><div><small>Current level</small><strong>{metric(data.latest.reading, channel)}</strong></div>
          <div><small>Baseline delta</small><strong>{delta(data.latest.reading, data.baseline, channel)}</strong></div></div>
      </div><TelemetryChart rows={readings} baseline={data.baseline} channel={channel} hours={hours} /></section>
      <aside className="span-4"><AlertPanel data={data} /></aside>
    </div>
    <section className="panel history">
      <div className="section-head"><h2>Telemetry Reading History</h2><div className="actions"><span className="tag">{readings.length} readings</span>
        <a className="button" href={exportUrl(data)}>Export CSV</a></div></div>
      <div className="table-scroll"><table>
        <thead><tr><th>Timestamp (UTC)</th><th>Value</th><th>Baseline delta</th><th>Reading status</th><th>Wearable</th></tr></thead>
        <tbody>{visible.map(row => {
          const status = alertStatus.get(row.timestamp) ?? 'Normal';
          return <tr key={row.timestamp} className={tones[status]}><td>{stamp(row.timestamp)}</td><td className="value">{metric(row, channel)}</td>
            <td>{delta(row, data.baseline, channel)}</td><td><Badge status={status} /></td><td className="capitalize">{row.device_status}</td></tr>;
        })}</tbody>
      </table></div>
      <div className="pagination"><button disabled={activePage === 0} onClick={() => setPageIndex(activePage - 1)}>Previous</button>
        <span className="mono">Page {activePage + 1} of {pages}</span>
        <button disabled={activePage + 1 === pages} onClick={() => setPageIndex(activePage + 1)}>Next</button></div>
    </section>
  </>;
}

function App() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState(null);
  const [pollError, setPollError] = useState(false);
  const currentData = useRef(null);
  const refreshing = useRef(null);
  const fileInput = useRef(null);

  async function refresh(file, background = false, replay = false) {
    if (background && refreshing.current) return;
    while (refreshing.current) await refreshing.current;
    let release;
    refreshing.current = new Promise(resolve => { release = resolve; });
    if (!background) {
      setBusy(true);
      setNotice(null);
    }
    try {
      if (replay) await replayDataset();
      const uploaded = file && await uploadCsv(file);
      const next = await loadDashboard(currentData.current);
      currentData.current = next;
      setData(next);
      setPollError(false);
      if (uploaded) setNotice({ text: `Processed ${uploaded.rows_processed} CSV rows. ${uploaded.total_readings} readings available.` });
    } catch (error) {
      if (background) setPollError(true);
      else setNotice({ error: true, text: error.message });
    } finally {
      refreshing.current = null;
      release();
      if (!background) setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(undefined, true), POLL_MS);
    return () => clearInterval(timer);
  }, []);

  return <>
    <Header data={data} />
    <div className="utility-strip"><div><small>Crew Telemetry / UTC</small>{data && <>{page !== 'overview' && <Badge status={data.latest.analysis.status} />}<span className="tag">{data.feed_complete ? "Dataset complete" : "Feed updating"}</span></>}</div>
      <div className="actions">
        {page !== 'check-in' && data?.feed_complete && <button disabled={busy} onClick={() => refresh(undefined, false, true)}>Replay dataset</button>}
        {page !== 'check-in' && <details className="telemetry-tools">
          <summary>Data tools</summary>
          <div className="actions panel">
            {page === 'overview' && <>
              <a className="button" href="/api/readings/sample">Sample CSV</a>
              {data && <a className="button" href={exportUrl(data)}>Export CSV</a>}
              <button onClick={() => fileInput.current.click()} disabled={busy}>Upload CSV</button>
            </>}
            <button disabled={busy} onClick={() => refresh()}>{busy ? 'Loading…' : 'Refresh data'}</button>
          </div>
        </details>}
      </div></div>
    <main>
      <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={event => {
        const file = event.target.files[0];
        event.target.value = '';
        if (file) refresh(file);
      }} />
      {notice && <p className={notice.error ? 'notice attention' : 'notice normal'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      {pollError && <p className="notice watch" role="status">Telemetry refresh unavailable. Retrying automatically.</p>}
      {!data && busy && <p role="status">Loading telemetry…</p>}
      {!data && !busy && page === 'check-in' && <button onClick={() => refresh()}>Retry loading telemetry</button>}
      {data && (page === 'trends' ? <Trends data={data} /> :
        page === 'check-in' ? <CheckIn data={data} /> : <Overview data={data} />)}
    </main>
    <footer><span>ASTRAHEALTH AI · Spaceflight Human Research</span><span>Prototype · Not for clinical use</span></footer>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
