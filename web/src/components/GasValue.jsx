// colours a reading against the gas limits
export function classify(value, t) {
  if (value === null || value === undefined || !t) return 'none';
  const past = (limit) => limit !== null && limit !== undefined && (t.direction === 'BELOW' ? value <= limit : value >= limit);
  if (past(t.evacuate)) return 'evac';
  if (past(t.alarm)) return 'alarm';
  if (past(t.warn)) return 'warn';
  return 'ok';
}

export default function GasValue({ gas, value, limits, stale }) {
  const t = limits?.[gas];
  const state = stale ? 'stale' : classify(value, t);
  return (
    <span className={`gas ${state}`} title={t ? `warn ${t.warn} / alarm ${t.alarm}${t.evacuate ? ` / evacuate ${t.evacuate}` : ''}` : ''}>
      <b>{gas}</b> {value ?? '—'}
      {t?.unit && <small>{t.unit}</small>}
    </span>
  );
}
