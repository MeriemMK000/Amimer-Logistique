'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';
import { authApi } from './api';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('fleet_user');
    const token = localStorage.getItem('fleet_token');
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('fleet_user');
        localStorage.removeItem('fleet_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      const { token, user: userData } = response.data;
      localStorage.setItem('fleet_token', token);
      localStorage.setItem('fleet_user', JSON.stringify(userData));
      setUser(userData);
      toast.success('Connexion reussie');
      router.push('/');
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Erreur de connexion');
      throw error;
    }
  }, [router]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    try {
      const response = await authApi.register({ email, password, name });
      const { token, user: userData } = response.data;
      localStorage.setItem('fleet_token', token);
      localStorage.setItem('fleet_user', JSON.stringify(userData));
      setUser(userData);
      toast.success('Compte cree avec succes');
      router.push('/');
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || "Erreur lors de l'inscription");
      throw error;
    }
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('fleet_token');
    localStorage.removeItem('fleet_user');
    setUser(null);
    router.push('/login');
    toast.success('Deconnexion reussie');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
