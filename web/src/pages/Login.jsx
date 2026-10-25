import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      nav('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>VentOps</h1>
      <p>Corvane Mining · North Shaft ventilation & gas monitoring</p>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <div className="error">{error}</div>}
      <button type="submit">Sign in</button>
    </form>
  );
}
