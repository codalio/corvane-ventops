import { useEffect, useState } from 'react';
import { api } from '../api.js';
import LevelCard from '../components/LevelCard.jsx';

export default function ControlRoom() {
  const [levels, setLevels] = useState([]);
  const [limits, setLimits] = useState(null);

  useEffect(() => {
    api('/thresholds').then(setLimits);
    const load = () => api('/levels').then(setLevels).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const underground = levels.reduce((n, l) => n + (l.people || 0), 0);

  return (
    <section>
      <div className="page-head">
        <h1>Control room</h1>
        <span>{underground} people underground</span>
      </div>
      <div className="levels">
        {levels.map((l) => (
          <LevelCard key={l.id} level={l} limits={limits} />
        ))}
      </div>
    </section>
  );
}
