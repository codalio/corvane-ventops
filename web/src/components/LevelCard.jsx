import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import GasValue from './GasValue.jsx';

export default function LevelCard({ level, limits }) {
  return (
    <Link to={`/levels/${level.code}`} className={`level-card status-${level.status.toLowerCase()}`}>
      <header>
        <h3>{level.name}</h3>
        <span className="status">{level.status.replace('_', ' ')}</span>
      </header>
      <div className="meta">
        {level.depthM} m · {level.people ?? '?'} people · {level._count.alarms} open alarms
      </div>
      <div className="readings">
        {level.sensors.map((s) => (
          <GasValue
            key={s.id}
            gas={s.gas}
            value={s.lastValue}
            limits={limits}
            stale={!s.lastSeenAt || dayjs().diff(s.lastSeenAt, 'second') > 120}
          />
        ))}
      </div>
      <div className="fans">
        {level.fans.map((f) => (
          <span key={f.code} className={`fan ${f.status.toLowerCase()}`}>
            {f.code} {f.airflowM3s ? `${f.airflowM3s} m³/s` : ''}
          </span>
        ))}
      </div>
    </Link>
  );
}
