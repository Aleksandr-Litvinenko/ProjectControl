import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { CurrentUser } from './types';

interface AuthState {
  user: CurrentUser | null;
  isLoading: boolean;
  refetch: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  refetch: () => undefined,
  logout: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const { data } = await api.get<CurrentUser>('/auth/me');
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const logout = async () => {
    await api.post('/auth/logout');
    qc.clear();
    await refetch();
  };

  return (
    <AuthContext.Provider value={{ user: data ?? null, isLoading, refetch, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
