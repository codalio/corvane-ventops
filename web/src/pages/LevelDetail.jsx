import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import GasValue from '../components/GasValue.jsx';

export default function LevelDetail() {
  const { code } = useParams();
  const { can } = useAuth();
  const [level, setLevel] = useState(null);
  const [limits, setLimits] = useState(null);
  const [selected, setSelected] = useState(null);
  const [series, setSeries] = useState([]);
  const [reentry, setReentry] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api('/thresholds').then(setLimits);
    const load = () => api(`/levels/${code}`).then(setLevel);
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [code]);

  useEffect(() => {
    if (!selected) return;
    api(`/readings?sensor=${selected.code}`).then((rows) =>
      setSeries(rows.map((r) => ({ t: dayjs(r.ts).format('HH:mm'), v: r.value })))
    );
  }, [selected]);

  async function checkReentry() {
    setReentry(await api(`/levels/${code}/reentry-check`));
  }

  async function confirmReentry() {
    try {
      await api(`/levels/${code}/reentry`, { method: 'POST' });
      setMsg('Re-entry confirmed.');
      setReentry(null);
    } catch (e) {
      setMsg(e.message);
    }
  }

  if (!level) return null;
  const t = selected && limits?.[selected.gas];

  return (
    <section>
      <div className="page-head">
        <h1>{level.name}</h1>
        <span className={`status status-${level.status.toLowerCase()}`}>{level.status.replace('_', ' ')}</span>
      </div>

      {level.status === 'REENTRY_PENDING' && can('SUPERVISOR', 'ADMIN') && (
        <div className="panel reentry">
          <p>Gas is back under limits. Check the level before people go back in.</p>
          <button onClick={checkReentry}>Run re-entry check</button>
          {reentry && (
            reentry.ok
              ? <button className="primary" onClick={confirmReentry}>Confirm re-entry</button>
              : <ul>{reentry.problems.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
          {msg && <div className="note">{msg}</div>}
        </div>
      )}

      <div className="grid-2">
        <div className="panel">
          <h2>Sensors</h2>
          <table>
            <tbody>
              {level.sensors.map((s) => (
                <tr key={s.id} onClick={() => setSelected(s)} className={selected?.id === s.id ? 'sel' : ''}>
                  <td>{s.code}</td>
                  <td>{s.location}</td>
                  <td><GasValue gas={s.gas} value={s.lastValue} limits={limits} /></td>
                  <td>{s.lastSeenAt ? dayjs(s.lastSeenAt).format('HH:mm:ss') : 'never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h2>On the level now</h2>
          <ul className="people">
            {level.personnel.map((p) => (
              <li key={p.tagId}>{p.name} <small>{p.crew} · since {dayjs(p.since).format('HH:mm')}</small></li>
            ))}
            {level.personnel.length === 0 && <li className="muted">Nobody tagged in</li>}
          </ul>
          <h2>Equipment</h2>
          <ul>
            {level.equipment.map((e) => <li key={e.unitId}>{e.unitId} <small>{e.kind} · {e.dieselKw} kW</small></li>)}
          </ul>
        </div>
      </div>

      {selected && (
        <div className="panel">
          <h2>{selected.code} - last 6 hours</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series}>
              <XAxis dataKey="t" />
              <YAxis />
              <Tooltip />
              {t && <ReferenceLine y={t.warn} stroke="#e0a800" label="warn" />}
              {t && <ReferenceLine y={t.alarm} stroke="#d9534f" label="alarm" />}
              <Line type="monotone" dataKey="v" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
