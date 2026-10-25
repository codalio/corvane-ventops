import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Nav from './components/Nav.jsx';
import AlarmBanner from './components/AlarmBanner.jsx';
import Login from './pages/Login.jsx';
import ControlRoom from './pages/ControlRoom.jsx';
import LevelDetail from './pages/LevelDetail.jsx';
import Alarms from './pages/Alarms.jsx';
import Sensors from './pages/Sensors.jsx';
import Calibrations from './pages/Calibrations.jsx';
import Fans from './pages/Fans.jsx';
import Thresholds from './pages/Thresholds.jsx';
import ShiftLog from './pages/ShiftLog.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';

function Guard({ roles, children }) {
  const { user, can } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !can(...roles)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <div className="app">
      {user && <Nav />}
      <main>
        {user && <AlarmBanner />}
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Guard><ControlRoom /></Guard>} />
          <Route path="/levels/:code" element={<Guard><LevelDetail /></Guard>} />
          <Route path="/alarms" element={<Guard><Alarms /></Guard>} />
          <Route path="/sensors" element={<Guard><Sensors /></Guard>} />
          <Route path="/calibrations" element={<Guard roles={['ENGINEER', 'SUPERVISOR', 'ADMIN']}><Calibrations /></Guard>} />
          <Route path="/fans" element={<Guard><Fans /></Guard>} />
          <Route path="/thresholds" element={<Guard roles={['ENGINEER', 'ADMIN']}><Thresholds /></Guard>} />
          <Route path="/shift-log" element={<Guard><ShiftLog /></Guard>} />
          <Route path="/reports" element={<Guard roles={['SUPERVISOR', 'ENGINEER', 'ADMIN']}><Reports /></Guard>} />
          <Route path="/users" element={<Guard roles={['ADMIN', 'SUPERVISOR']}><Users /></Guard>} />
        </Routes>
      </main>
    </div>
  );
}
