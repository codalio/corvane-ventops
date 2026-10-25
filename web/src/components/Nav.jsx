import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// menu items each role sees
const ITEMS = [
  { to: '/', label: 'Control room', roles: ['OPERATOR', 'SUPERVISOR', 'ENGINEER', 'ADMIN'] },
  { to: '/alarms', label: 'Alarms', roles: ['OPERATOR', 'SUPERVISOR', 'ENGINEER', 'ADMIN'] },
  { to: '/sensors', label: 'Gas sensors', roles: ['OPERATOR', 'SUPERVISOR', 'ENGINEER', 'ADMIN'] },
  { to: '/fans', label: 'Fans', roles: ['OPERATOR', 'SUPERVISOR', 'ENGINEER', 'ADMIN'] },
  { to: '/shift-log', label: 'Shift log', roles: ['OPERATOR', 'SUPERVISOR', 'ENGINEER', 'ADMIN'] },
  { to: '/calibrations', label: 'Calibrations', roles: ['SUPERVISOR', 'ENGINEER', 'ADMIN'] },
  { to: '/thresholds', label: 'Gas limits', roles: ['ENGINEER', 'ADMIN'] },
  { to: '/reports', label: 'Reports', roles: ['SUPERVISOR', 'ENGINEER', 'ADMIN'] },
  { to: '/users', label: 'Users', roles: ['SUPERVISOR', 'ADMIN'] },
];

export default function Nav() {
  const { user, logout } = useAuth();
  return (
    <nav className="nav">
      <div className="brand">
        VentOps<span>Corvane Mining · North Shaft</span>
      </div>
      {ITEMS.filter((i) => i.roles.includes(user.role)).map((i) => (
        <NavLink key={i.to} to={i.to} end={i.to === '/'}>
          {i.label}
        </NavLink>
      ))}
      <div className="who">
        {user.name} · {user.role.toLowerCase()}
        <button onClick={logout}>Sign out</button>
      </div>
    </nav>
  );
}
