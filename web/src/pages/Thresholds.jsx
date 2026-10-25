import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Thresholds() {
  const [limits, setLimits] = useState({});
  const [draft, setDraft] = useState({});
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api('/thresholds').then((l) => {
      setLimits(l);
      setDraft(l);
    });
  }, []);

  async function save(gas) {
    setMsg(null);
    const d = draft[gas];
    try {
      await api(`/thresholds/${gas}`, {
        method: 'PUT',
        body: { warn: Number(d.warn), alarm: Number(d.alarm), evacuate: d.evacuate === '' || d.evacuate === null ? null : Number(d.evacuate) },
      });
      setMsg(`${gas} limits saved`);
    } catch (e) {
      setMsg(e.message);
    }
  }

  const set = (gas, key, value) => setDraft({ ...draft, [gas]: { ...draft[gas], [key]: value } });

  return (
    <section>
      <h1>Gas limits</h1>
      <p className="muted">Changes apply to every sensor of that gas within 30 seconds and are recorded in the audit log.</p>
      {msg && <div className="note">{msg}</div>}
      <table>
        <thead><tr><th>Gas</th><th>Unit</th><th>Direction</th><th>Warn</th><th>Alarm</th><th>Evacuate</th><th /></tr></thead>
        <tbody>
          {Object.keys(limits).map((gas) => (
            <tr key={gas}>
              <td>{gas}</td>
              <td>{limits[gas].unit}</td>
              <td>{limits[gas].direction === 'BELOW' ? 'low is bad' : 'high is bad'}</td>
              <td><input size={6} value={draft[gas]?.warn ?? ''} onChange={(e) => set(gas, 'warn', e.target.value)} /></td>
              <td><input size={6} value={draft[gas]?.alarm ?? ''} onChange={(e) => set(gas, 'alarm', e.target.value)} /></td>
              <td><input size={6} value={draft[gas]?.evacuate ?? ''} onChange={(e) => set(gas, 'evacuate', e.target.value)} /></td>
              <td><button onClick={() => save(gas)}>Save</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
