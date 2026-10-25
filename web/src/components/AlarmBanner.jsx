import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

// red bar across every page while anything is unacknowledged
export default function AlarmBanner() {
  const [open, setOpen] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = () => api('/alarms?status=OPEN').then((a) => alive && setOpen(a || [])).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (open.length === 0) return null;
  const evac = open.filter((a) => a.severity === 'EVACUATE');
  return (
    <Link to="/alarms" className={`banner ${evac.length ? 'evac' : ''}`}>
      {evac.length
        ? `EVACUATE: ${[...new Set(evac.map((a) => a.level.code))].join(', ')}`
        : `${open.length} unacknowledged alarm${open.length > 1 ? 's' : ''}`}
    </Link>
  );
}
