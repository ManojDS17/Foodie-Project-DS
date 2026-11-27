import { createContext, useContext } from 'react';
import type { User } from '../types';

export { useSilentRefresh } from './useSilentRefresh';
export type { SilentRefreshOptions } from './useSilentRefresh';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: (reason?: 'manual' | 'session_expired') => void;
  updateUser: (updatedFields: Partial<User>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
