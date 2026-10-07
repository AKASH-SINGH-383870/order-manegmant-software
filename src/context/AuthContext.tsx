import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('petroflow_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('petroflow_token');
    const explicitLogout = localStorage.getItem('petroflow_explicit_logout');

    if (!storedToken) {
      if (!explicitLogout) {
        // Auto-login to Super Admin so users immediately land inside the fully populated ERP
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'superadmin@lubricantdemo.com', password: 'Admin@123' })
          });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem('petroflow_token', data.token);
            setToken(data.token);
            setUser(data.user);
            setIsLoading(false);
            return;
          }
        } catch {
          // ignore network failure
        }
      }
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('petroflow_token');
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.error('Failed to verify token:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, pass: string) => {
    localStorage.removeItem('petroflow_explicit_logout');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('petroflow_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    localStorage.removeItem('petroflow_token');
    localStorage.setItem('petroflow_explicit_logout', 'true');
    setToken(null);
    setUser(null);
  };

  const hasPermission = (code: string): boolean => {
    if (!user) return false;
    if (user.role_slug === 'super_admin') return true;
    const perms = user.permissions || [];
    const colonCode = code.replace(/\./g, ':');
    const dotCode = code.replace(/:/g, '.');
    return perms.includes(code) || perms.includes(colonCode) || perms.includes(dotCode);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
