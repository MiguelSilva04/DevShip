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
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // Only treat 401 as session expiry when we actually had a token (i.e. an authenticated call).
    // On /auth/* routes there's no token — 401 means wrong credentials, not expired session.
    if (response.status === 401 && token) {
      localStorage.removeItem('devship_token');
      window.location.href = '/login';
      throw new Error('Sessão expirada. Por favor entra novamente.');
    }
    throw new Error(body.detail || `HTTP ${response.status}`);
  }
  return response.json();
}
