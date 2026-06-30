// ponytail: relative paths — vite proxy handles /auth, /users, /teams, /projects in dev
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('devship_token');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    localStorage.removeItem('devship_token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${response.status}`);
  }
  return response.json();
}
