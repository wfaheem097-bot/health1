import React from 'react';

export default function TelemetryChart({ rows, baseline, channel, hours, compact = false }) {
  const end = Date.parse(rows.at(-1).timestamp + 'Z');
  const start = end - hours * 3600000;
  const width = compact ? 360 : 780;
  const height = compact ? 122 : 310;
  const left = 44, right = width - 16, top = 15, bottom = height - 27;
  const values = channel.keys.flatMap(key => [baseline[key],
    ...rows.map(row => row.device_status === 'connected' ? row[key] : null)]).filter(value => value != null);
  const min = values.length ? values.reduce((a, b) => Math.min(a, b)) : 0;
  const max = values.length ? values.reduce((a, b) => Math.max(a, b)) : 1;
  const pad = Math.max((max - min) * 0.15, 0.3);
  const low = min - pad, high = max + pad;
  const y = value => bottom - (value - low) / (high - low) * (bottom - top);
  const x = timestamp => left + (Date.parse(timestamp + 'Z') - start) / (end - start) * (right - left);
  const colors = ['var(--blue)', 'var(--violet)'];

  return <>
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`${channel.label} readings over ${hours} hours ending at the latest sample`}>
      {Array.from({ length: 5 }, (_, i) => {
        const level = low + (high - low) * i / 4;
        const position = left + (right - left) * i / 4;
        const label = new Date(start + (end - start) * i / 4).toISOString().slice(11, 16);
        return <g key={i}>
          <path className="gridline" d={`M${left} ${y(level)}H${right} M${position} ${top}V${bottom}`} />
          <text x={left - 6} y={y(level) + 3} textAnchor="end">{Number(level.toFixed(1))}</text>
          <text x={position} y={height - 7} textAnchor={i === 4 ? 'end' : i === 0 ? 'start' : 'middle'}>{label}</text>
        </g>;
      })}
      {channel.keys.map((key, index) => {
        let previous = false;
        const points = rows.flatMap(row => {
          if (row.device_status !== 'connected' || row[key] == null) {
            previous = false;
            return [];
          }
          const point = { x: x(row.timestamp), y: y(row[key]), move: !previous, timestamp: row.timestamp };
          previous = true;
          return [point];
        });
        const color = colors[index];
        return <g key={key}>
          {baseline[key] != null && <line x1={left} x2={right} y1={y(baseline[key])} y2={y(baseline[key])}
            stroke={color} strokeOpacity=".55" strokeDasharray="5 4" />}
          <path fill="none" stroke={color} strokeWidth="1.5" d={points.map(point =>
            `${point.move ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')} />
          {points.map(point => <circle key={point.timestamp} cx={point.x} cy={point.y} r="2.6" fill={color} />)}
        </g>;
      })}
    </svg>
    <div className="chart-legend"><span><i /> Measured {channel.keys.length === 2 ? '· Systolic' : ''}</span>
      {channel.keys.length === 2 && <span><i className="violet" /> Diastolic</span>}
      {channel.keys.some(key => baseline[key] != null) && <span><i className="dashed" /> Personal baseline</span>}
      <span>UTC</span></div>
  </>;
}
