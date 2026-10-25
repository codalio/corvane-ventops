import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api, downloadUrl } from '../api.js';

export default function Reports() {
  const [date, setDate] = useState(dayjs().subtract(1, 'day').format('YYYY-MM-DD'));
  const [rows, setRows] = useState([]);
  const [alarms, setAlarms] = useState([]);

  useEffect(() => {
    api(`/reports/gas-daily?date=${date}`).then((r) => setRows(r.rows));
  }, [date]);

  useEffect(() => {
    api('/reports/alarms').then(setAlarms);
  }, []);

  async function downloadCsv() {
    // the API needs the bearer token, so fetch and save instead of linking
    const res = await fetch(downloadUrl(`/reports/gas-daily?date=${date}&format=csv`), {
      headers: { Authorization: `Bearer ${localStorage.getItem('ventops_token')}` },
    });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gas-daily-${date}.csv`;
    a.click();
  }

  return (
    <section>
      <div className="page-head">
        <h1>Reports</h1>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button onClick={downloadCsv}>Download CSV</button>
      </div>
      <div className="panel">
        <h2>Daily gas summary</h2>
        <table>
          <thead><tr><th>Level</th><th>Sensor</th><th>Min</th><th>Max</th><th>Avg</th><th>Min above warn</th><th>Min above alarm</th><th>Uncalibrated</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sensor}>
                <td>{r.level}</td><td>{r.sensor}</td><td>{r.min}</td><td>{r.max}</td><td>{r.avg}</td>
                <td className={r.minutesAboveWarn ? 'warn' : ''}>{r.minutesAboveWarn}</td>
                <td className={r.minutesAboveAlarm ? 'bad' : ''}>{r.minutesAboveAlarm}</td>
                <td>{r.uncalibratedReadings || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2>Alarms, last 7 days</h2>
        <table>
          <thead><tr><th>Opened</th><th>Level</th><th>Type</th><th>Severity</th><th>Peak</th><th>Min to ack</th><th>Cleared by</th><th>Comment</th></tr></thead>
          <tbody>
            {alarms.map((a) => (
              <tr key={a.id}>
                <td>{dayjs(a.openedAt).format('DD MMM HH:mm')}</td><td>{a.level}</td><td>{a.type}</td><td>{a.severity}</td>
                <td>{a.peak ?? ''}</td><td>{a.minutesToAck ?? ''}</td><td>{a.clearedBy ?? ''}</td><td>{a.clearComment ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
