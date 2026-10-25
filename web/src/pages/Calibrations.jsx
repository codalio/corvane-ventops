import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Calibrations() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ sensorCode: '', type: 'BUMP', testGasValue: '', readValue: '', notes: '' });
  const [error, setError] = useState(null);

  const load = () => api('/calibrations').then(setRows);
  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api('/calibrations', {
        method: 'POST',
        body: { ...form, testGasValue: Number(form.testGasValue) || null, readValue: Number(form.readValue) },
      });
      setForm({ ...form, sensorCode: '', testGasValue: '', readValue: '', notes: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <h1>Calibrations & bump tests</h1>
      <form className="panel inline" onSubmit={submit}>
        <input placeholder="Sensor code" value={form.sensorCode} onChange={(e) => setForm({ ...form, sensorCode: e.target.value })} />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="BUMP">Bump test</option>
          {can('ENGINEER', 'ADMIN') && <option value="FULL">Full calibration</option>}
        </select>
        <input placeholder="Test gas" value={form.testGasValue} onChange={(e) => setForm({ ...form, testGasValue: e.target.value })} />
        <input placeholder="Sensor read" value={form.readValue} onChange={(e) => setForm({ ...form, readValue: e.target.value })} />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="primary">Record</button>
        {error && <div className="error">{error}</div>}
      </form>
      <table>
        <thead>
          <tr><th>When</th><th>Sensor</th><th>Type</th><th>Test gas</th><th>Read</th><th>Result</th><th>By</th></tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{dayjs(c.performedAt).format('DD MMM HH:mm')}</td>
              <td>{c.sensor.code}</td>
              <td>{c.type}</td>
              <td>{c.testGasValue ?? ''}</td>
              <td>{c.readValue ?? ''}</td>
              <td className={c.passed ? '' : 'bad'}>{c.passed ? 'pass' : 'FAIL'}</td>
              <td>{c.performedBy.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
