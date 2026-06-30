import { apiFetch } from './client';

export function register(name: string, email: string, password: string) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function login(email: string, password: string): Promise<{ access_token: string }> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
