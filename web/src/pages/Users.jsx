import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const ROLES = ['OPERATOR', 'SUPERVISOR', 'ENGINEER', 'ADMIN'];

export default function Users() {
  const { can } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', role: 'OPERATOR', phone: '', password: '' });

  const load = () => api('/users').then(setUsers);
  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    await api('/users', { method: 'POST', body: form });
    setForm({ name: '', email: '', role: 'OPERATOR', phone: '', password: '' });
    load();
  }

  async function update(u, patch) {
    await api(`/users/${u.id}`, { method: 'PATCH', body: patch });
    load();
  }

  return (
    <section>
      <h1>Users</h1>
      {can('ADMIN') && (
        <form className="panel inline" onSubmit={add}>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <input placeholder="Mobile (for alarms)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Temporary password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button className="primary">Add user</button>
        </form>
      )}
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Mobile</th><th>Active</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={u.active ? '' : 'muted'}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                {can('ADMIN')
                  ? <select value={u.role} onChange={(e) => update(u, { role: e.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                  : u.role}
              </td>
              <td>{u.phone ?? ''}</td>
              <td>{can('ADMIN') ? <input type="checkbox" checked={u.active} onChange={(e) => update(u, { active: e.target.checked })} /> : u.active ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
