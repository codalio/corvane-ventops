import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Fans() {
  const { can } = useAuth();
  const [data, setData] = useState({ fans: [], recommendations: [] });
  const [edit, setEdit] = useState({});
  const [msg, setMsg] = useState(null);

  const load = () => api('/fans').then(setData);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function apply(fan, hz) {
    setMsg(null);
    try {
      const r = await api(`/fans/${fan.code}/setpoint`, { method: 'POST', body: { hz: Number(hz) } });
      setMsg(r.state === 'QUEUED' ? `${fan.code}: setpoint ${hz} Hz sent to SCADA` : `${fan.code}: SCADA rejected (${r.state})`);
      load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <section>
      <h1>Fans</h1>
      {msg && <div className="note">{msg}</div>}
      <table>
        <thead>
          <tr><th>Fan</th><th>Type</th><th>Level</th><th>Status</th><th>Airflow</th><th>Setpoint</th><th>Updated</th><th /></tr>
        </thead>
        <tbody>
          {data.fans.map((f) => (
            <tr key={f.code}>
              <td>{f.code}</td>
              <td>{f.type.toLowerCase()}</td>
              <td>{f.level?.code ?? 'all'}</td>
              <td className={f.status === 'RUNNING' ? '' : 'bad'}>{f.status}</td>
              <td>{f.airflowM3s ?? '—'} m³/s</td>
              <td>{f.setpointHz} Hz</td>
              <td>{f.lastStatusAt ? dayjs(f.lastStatusAt).format('HH:mm:ss') : '—'}</td>
              <td>
                {can('ENGINEER', 'ADMIN') && f.type !== 'MAIN' && (
                  <>
                    <input size={4} value={edit[f.code] ?? ''} onChange={(e) => setEdit({ ...edit, [f.code]: e.target.value })} />
                    <button onClick={() => apply(f, edit[f.code])}>Set</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.recommendations.length > 0 && (
        <div className="panel">
          <h2>Ventilation on demand</h2>
          <p className="muted">Levels where the diesel and people on the level need more air than the booster fans deliver.</p>
          <table>
            <thead><tr><th>Level</th><th>Fan</th><th>Needs</th><th>Delivering</th><th>Suggested</th><th /></tr></thead>
            <tbody>
              {data.recommendations.map((r) => (
                <tr key={`${r.level}-${r.fan}`}>
                  <td>{r.level}</td>
                  <td>{r.fan}</td>
                  <td>{r.requiredM3s} m³/s</td>
                  <td>{r.deliveringM3s} m³/s</td>
                  <td>{r.suggestedHz} Hz</td>
                  <td>{can('ENGINEER', 'ADMIN') && <button onClick={() => apply({ code: r.fan }, r.suggestedHz)}>Apply</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
