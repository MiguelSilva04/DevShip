// ponytail: relative paths — vite proxy handles /auth, /users, /teams, /projects in dev
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('devship_token');
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Não foi possível contactar o servidor. Verifica a tua ligação ou tenta mais tarde.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && token) {
      localStorage.removeItem('devship_token');
      localStorage.removeItem('devship_user');
      window.location.href = '/login';
      throw new Error('Sessão expirada. Por favor entra novamente.');
    }
    if (response.status >= 500) {
      throw new Error(body.detail || 'Erro interno do servidor. Tenta novamente mais tarde.');
    }
    throw new Error(body.detail || `Erro ${response.status}`);
  }
  return response.json();
}
