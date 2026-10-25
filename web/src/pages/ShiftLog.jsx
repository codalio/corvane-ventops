import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../api.js';

const CATEGORIES = ['GENERAL', 'VENTILATION', 'GAS', 'EQUIPMENT', 'SAFETY'];

export default function ShiftLog() {
  const [log, setLog] = useState(null);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [levelCode, setLevelCode] = useState('');

  const load = () => api('/shift-log').then(setLog);
  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    await api('/shift-log', { method: 'POST', body: { text, category, levelCode: levelCode || undefined } });
    setText('');
    load();
  }

  if (!log) return null;
  return (
    <section>
      <div className="page-head">
        <h1>Shift log</h1>
        <span>{log.shift === 'DAY' ? 'Day' : 'Night'} shift · {dayjs(log.date).format('ddd D MMM')}</span>
      </div>
      <form className="panel inline" onSubmit={add}>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input placeholder="Level (optional)" value={levelCode} onChange={(e) => setLevelCode(e.target.value)} />
        <input className="grow" placeholder="What happened" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary">Add</button>
      </form>
      <ul className="log">
        {log.entries.map((e) => (
          <li key={e.id}>
            <time>{dayjs(e.createdAt).format('HH:mm')}</time>
            <span className={`tag ${e.category.toLowerCase()}`}>{e.category}</span>
            {e.level && <span className="tag">{e.level.code}</span>}
            {e.text}
            <small> · {e.author.name}</small>
          </li>
        ))}
        {log.entries.length === 0 && <li className="muted">Nothing logged this shift yet.</li>}
      </ul>
    </section>
  );
}
