import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setDbActor } from "@/lib/db";

interface AuthUser {
  id: string;
  email: string | null;
  role: "admin";
  fullName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'Mso_connect_token';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) { setIsLoading(false); return; }
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      api.verifyToken(token).then((res: any) => {
        if (res.user) {
          setUser({ id: res.user.id, email: res.user.email, role: res.user.role, fullName: res.user.fullName });
          setDbActor(res.user.email ?? res.user.id);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const api = (window as any).electronAPI;
    if (!api) return { error: 'Not running as desktop app. Please launch via Electron.' };
    const res = await api.login(email, password);
    if (res.error) return { error: res.error };
    if (res.user.role !== 'admin') return { error: 'Only admin access is allowed.' };
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    setDbActor(res.user.email ?? res.user.id);
    return { error: null };
  };

  const logout = async () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setDbActor(null);
  };

  return (
    <AuthContext.Provider value={{
      user, session: null, login, logout,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin",
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
