import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Alarms() {
  const { can } = useAuth();
  const [alarms, setAlarms] = useState([]);
  const [showCleared, setShowCleared] = useState(false);
  const [clearing, setClearing] = useState(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);

  const load = () =>
    api(`/alarms?status=${showCleared ? 'OPEN,ACKNOWLEDGED,CLEARED' : 'OPEN,ACKNOWLEDGED'}`).then(setAlarms);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [showCleared]);

  async function ack(a) {
    await api(`/alarms/${a.id}/acknowledge`, { method: 'POST' });
    load();
  }

  async function clear() {
    setError(null);
    try {
      await api(`/alarms/${clearing.id}/clear`, { method: 'POST', body: { comment } });
      setClearing(null);
      setComment('');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      <div className="page-head">
        <h1>Alarms</h1>
        <label><input type="checkbox" checked={showCleared} onChange={(e) => setShowCleared(e.target.checked)} /> show cleared</label>
      </div>
      <table className="alarms">
        <thead>
          <tr><th>Opened</th><th>Level</th><th>Type</th><th>Severity</th><th>Detail</th><th>Peak</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {alarms.map((a) => (
            <tr key={a.id} className={`sev-${a.severity.toLowerCase()}`}>
              <td>{dayjs(a.openedAt).format('DD MMM HH:mm')}</td>
              <td>{a.level.code}</td>
              <td>{a.type.replace('_', ' ')}</td>
              <td>{a.severity}</td>
              <td>{a.message}</td>
              <td>{a.peakValue ?? ''}</td>
              <td>
                {a.status}
                {a.ackBy && <small> · ack {a.ackBy.name}</small>}
                {a.clearedBy && <small> · cleared {a.clearedBy.name}</small>}
              </td>
              <td>
                {a.status === 'OPEN' && <button onClick={() => ack(a)}>Acknowledge</button>}
                {a.status !== 'CLEARED' && can('SUPERVISOR', 'ADMIN') && (
                  <button className="primary" onClick={() => setClearing(a)}>Clear</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {clearing && (
        <div className="modal">
          <div className="panel">
            <h2>Clear alarm #{clearing.id}</h2>
            <p>{clearing.message}</p>
            <p className="muted">The sensor has to be back under its warning limit. Say what was found and done.</p>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
            {error && <div className="error">{error}</div>}
            <button onClick={() => setClearing(null)}>Cancel</button>
            <button className="primary" onClick={clear}>Clear alarm</button>
          </div>
        </div>
      )}
    </section>
  );
}
