import { createContext, useContext, useState, ReactNode } from 'react';

export type Role = 'cloud' | 'tech' | 'dev';

export interface User {
  role: Role;
  name: string;
  email: string;
  initials: string;
  roleLabel: string;
}

export const USERS: Record<Role, User> = {
  cloud: { role: 'cloud', name: 'Jane Smith',   email: 'jane.smith@horizonlabs.io',  initials: 'JS', roleLabel: 'Cloud Engineer' },
  tech:  { role: 'tech',  name: 'John Doe',     email: 'john.doe@horizonlabs.io',    initials: 'JD', roleLabel: 'Tech Lead'      },
  dev:   { role: 'dev',   name: 'Bob Johnson',  email: 'bob.johnson@horizonlabs.io', initials: 'BJ', roleLabel: 'Developer'      },
};

interface UserCtx { user: User | null; setUser: (u: User | null) => void; }

const Ctx = createContext<UserCtx>({ user: null, setUser: () => {} });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  return <Ctx.Provider value={{ user, setUser }}>{children}</Ctx.Provider>;
}

export function useUser() { return useContext(Ctx); }
