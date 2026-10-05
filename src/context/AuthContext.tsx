import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, type User } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  showLoginModal: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginDev: (email?: string, name?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithRescuerId: (rescuerId: string, password: string) => Promise<void>;
  registerUser: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Check existing session on mount — never auto-login
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = api.getToken();
      if (storedToken) {
        try {
          const profile = await api.getMe();
          setUser(profile);
          setToken(storedToken);
        } catch {
          // Token invalid or backend offline — clear so user sees login
          api.setToken(null);
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const openLoginModal = useCallback(() => setShowLoginModal(true), []);
  const closeLoginModal = useCallback(() => setShowLoginModal(false), []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    setIsLoading(true);
    try {
      const res = await api.loginWithGoogle(idToken);
      setUser(res.user);
      setToken(res.access_token);
      setShowLoginModal(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.loginWithEmail(email, password);
      setUser(res.user);
      setToken(res.access_token);
      setShowLoginModal(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithRescuerId = useCallback(async (rescuerId: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.loginWithRescuerId(rescuerId, password);
      setUser(res.user);
      setToken(res.access_token);
      setShowLoginModal(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerUser = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.register(name, email, password);
      setUser(res.user);
      setToken(res.access_token);
      setShowLoginModal(false);
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
      setShowLoginModal(false);
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
        showLoginModal,
        openLoginModal,
        closeLoginModal,
        loginWithGoogle,
        loginWithEmail,
        loginWithRescuerId,
        registerUser,
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
