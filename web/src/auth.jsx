import { createContext, useContext, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

function decode(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const t = localStorage.getItem('ventops_token');
    return t ? decode(t) : null;
  });

  async function login(email, password) {
    const { token } = await api('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('ventops_token', token);
    setUser(decode(token));
  }

  function logout() {
    localStorage.removeItem('ventops_token');
    setUser(null);
  }

  const can = (...roles) => !!user && roles.includes(user.role);

  return <AuthContext.Provider value={{ user, login, logout, can }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
