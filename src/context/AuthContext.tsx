import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, type User } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginDev: (email?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = api.getToken();
      if (storedToken) {
        try {
          const profile = await api.getMe();
          setUser(profile);
          setToken(storedToken);
        } catch {
          // Token invalid or backend offline, clear
          api.setToken(null);
          setToken(null);
          setUser(null);
        }
      } else {
        // Auto-authenticate with local default analyst account so app is immediately usable
        try {
          const res = await api.devLogin('analyst@aeromesh.ai', 'Keshav');
          setUser(res.user);
          setToken(res.access_token);
        } catch {
          // Backend might not be running yet; fallback gracefully
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    setIsLoading(true);
    try {
      const res = await api.loginWithGoogle(idToken);
      setUser(res.user);
      setToken(res.access_token);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginDev = useCallback(async (email?: string, name?: string) => {
    setIsLoading(true);
    try {
      const res = await api.devLogin(email, name);
      setUser(res.user);
      setToken(res.access_token);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        loginWithGoogle,
        loginDev,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
