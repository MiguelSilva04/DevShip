import { createContext, useContext, useState, ReactNode } from 'react';

export type Role = 'cloud' | 'tech' | 'dev';

export interface User {
  role: Role;
  name: string;
  email: string;
  initials: string;
  roleLabel: string;
}

// ponytail: demo users kept for the mock login buttons in Login.tsx
export const USERS: Record<Role, User> = {
  cloud: { role: 'cloud', name: 'Jane Smith',  email: 'jane.smith@horizonlabs.io',  initials: 'JS', roleLabel: 'Cloud Engineer' },
  tech:  { role: 'tech',  name: 'John Doe',    email: 'john.doe@horizonlabs.io',    initials: 'JD', roleLabel: 'Tech Lead'      },
  dev:   { role: 'dev',   name: 'Bob Johnson', email: 'bob.johnson@horizonlabs.io', initials: 'BJ', roleLabel: 'Developer'      },
};

function roleFromBackend(r: string): Role {
  if (r === 'CLOUD_ENGINEER') return 'cloud';
  if (r === 'TECH_LEAD') return 'tech';
  return 'dev';
}

function initialsFrom(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function roleLabelFrom(role: Role) {
  if (role === 'cloud') return 'Cloud Engineer';
  if (role === 'tech') return 'Tech Lead';
  return 'Developer';
}

export function userFromBackend(name: string, email: string, backendRole: string): User {
  const role = roleFromBackend(backendRole);
  return { role, name, email, initials: initialsFrom(name), roleLabel: roleLabelFrom(role) };
}

interface UserCtx {
  user: User | null;
  token: string | null;
  setUser: (u: User | null) => void;
  saveToken: (t: string) => void;
  logout: () => void;
}

const Ctx = createContext<UserCtx>({
  user: null, token: null,
  setUser: () => {}, saveToken: () => {}, logout: () => {},
});

function userFromStorage(): User | null {
  const raw = localStorage.getItem('devship_user');
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(userFromStorage);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('devship_token'));

  function setUser(u: User | null) {
    setUserState(u);
    if (u) localStorage.setItem('devship_user', JSON.stringify(u));
    else localStorage.removeItem('devship_user');
  }

  function saveToken(t: string) {
    localStorage.setItem('devship_token', t);
    setToken(t);
  }

  function logout() {
    localStorage.removeItem('devship_token');
    localStorage.removeItem('devship_user');
    setToken(null);
    setUserState(null);
  }

  return <Ctx.Provider value={{ user, token, setUser, saveToken, logout }}>{children}</Ctx.Provider>;
}

export function useUser() { return useContext(Ctx); }
