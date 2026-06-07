import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthUser {
  id: string;
  email: string | null;
  role: "admin" | "member" | null;
  fullName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: null;
  login: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'hilal_connect_token';

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
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    const api = (window as any).electronAPI;
    if (!api) return { error: 'Not running as desktop app. Please launch via Electron.' };
    const res = await api.login(identifier, password);
    if (res.error) return { error: res.error };
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return { error: null };
  };

  const signup = async (email: string, password: string, fullName: string): Promise<{ error: string | null }> => {
    const api = (window as any).electronAPI;
    if (!api) return { error: 'Not running as desktop app. Please launch via Electron.' };
    const res = await api.signup(email, password, fullName);
    if (res.error) return { error: res.error };
    return { error: null };
  };

  const logout = async () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, session: null, login, signup, logout,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin",
      isMember: user?.role === "member",
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
