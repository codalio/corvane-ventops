const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('ventops_token');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    localStorage.removeItem('ventops_token');
    window.location.href = '/login';
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data;
}

export const downloadUrl = (path) => `${BASE}${path}`;
