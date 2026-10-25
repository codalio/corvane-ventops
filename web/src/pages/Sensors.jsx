import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../api.js';

export default function Sensors() {
  const [sensors, setSensors] = useState([]);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api('/sensors').then(setSensors);
  }, []);

  const shown = sensors.filter((s) =>
    filter === 'ALL' ? true : filter === 'DUE' ? s.calibrationDue || s.bumpDue : filter === 'STALE' ? s.stale : s.gas === filter
  );

  return (
    <section>
      <div className="page-head">
        <h1>Gas sensors</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">All</option>
          <option value="DUE">Calibration or bump test due</option>
          <option value="STALE">Not reporting</option>
          {['CH4', 'CO', 'NO2', 'O2', 'H2S', 'DPM'].map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>
      <table>
        <thead>
          <tr><th>Sensor</th><th>Level</th><th>Location</th><th>Last value</th><th>Last seen</th><th>Bump test</th><th>Calibrated</th></tr>
        </thead>
        <tbody>
          {shown.map((s) => (
            <tr key={s.id} className={s.active ? '' : 'muted'}>
              <td>{s.code}</td>
              <td>{s.level.code}</td>
              <td>{s.location}</td>
              <td>{s.lastValue ?? '—'}</td>
              <td className={s.stale ? 'bad' : ''}>{s.lastSeenAt ? dayjs(s.lastSeenAt).format('HH:mm:ss') : 'never'}</td>
              <td className={s.bumpDue ? 'bad' : ''}>{s.lastBumpTestAt ? dayjs(s.lastBumpTestAt).format('DD MMM HH:mm') : 'never'}</td>
              <td className={s.calibrationDue ? 'bad' : ''}>{s.lastCalibratedAt ? dayjs(s.lastCalibratedAt).format('DD MMM') : 'never'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
