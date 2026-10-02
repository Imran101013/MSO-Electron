import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setDbActor } from "@/lib/db";

/** The one shared login. `email` holds the username (an email address or not). */
interface AuthUser {
  id: string;
  email: string | null;
  fullName: string | null;
}

export interface AccountUpdate {
  currentPassword: string;
  username: string;
  fullName: string;
  /** Empty keeps the current password. */
  newPassword: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  /** Changes the login details; the session continues with the new ones. */
  updateAccount: (details: AccountUpdate) => Promise<{ error: string | null }>;
  isAuthenticated: boolean;
  /** There are no roles: anyone signed in has full access. Kept for the controls that check it. */
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
    const apiBase = `http://${window.location.hostname}:8082`;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setIsLoading(false); return; }
    const doVerify = api
      ? (t: string) => api.verifyToken(t)
      : (t: string) => fetch(`${apiBase}/api/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) }).then(r => r.json());
    doVerify(token).then((res: any) => {
      if (res.user) {
        setUser({ id: res.user.id, email: res.user.email, fullName: res.user.fullName ?? null });
        setDbActor(res.user.email ?? res.user.id);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const api = (window as any).electronAPI;
    const apiBase = `http://${window.location.hostname}:8082`;
    const doLogin = api
      ? (e: string, p: string) => api.login(e, p)
      : (e: string, p: string) => fetch(`${apiBase}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: p }) }).then(r => r.json());
    const timeoutPromise = new Promise<{ error: string }>((resolve) =>
      setTimeout(() => resolve({ error: 'Connection timed out. Is PostgreSQL running?' }), 10000)
    );
    const res = await Promise.race([doLogin(email, password), timeoutPromise]);
    if (res.error) return { error: res.error };
    startSession((res as any).token, (res as any).user);
    return { error: null };
  };

  const startSession = (token: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser({ id: u.id, email: u.email, fullName: u.fullName ?? null });
    setDbActor(u.email ?? u.id);
  };

  const updateAccount = async (details: AccountUpdate): Promise<{ error: string | null }> => {
    type Bridge = { updateAccount?: (d: AccountUpdate & { userId: string }) => Promise<{ error?: string; token?: string; user?: AuthUser }> };
    const api = (window as unknown as { electronAPI?: Bridge }).electronAPI;
    if (!user) return { error: "Sign in first." };
    if (!api?.updateAccount) return { error: "Login details can be changed in the desktop app." };
    const res = await api.updateAccount({ userId: user.id, ...details });
    if (res?.error || !res?.token || !res.user) return { error: res?.error ?? "The login details could not be saved." };
    startSession(res.token, res.user);
    return { error: null };
  };

  const logout = async () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setDbActor(null);
  };

  return (
    <AuthContext.Provider value={{
      user, session: null, login, logout, updateAccount,
      isAuthenticated: !!user,
      isAdmin: !!user,
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
