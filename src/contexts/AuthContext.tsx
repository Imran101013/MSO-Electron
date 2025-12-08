import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { ORGANIZATION_CONFIG } from "@/config/organization";

// Helper function to normalize phone numbers
const normalizePhoneNumber = (phone: string): string => {
  const trimmed = phone.trim();
  // If starts with 0 and has 11 digits (0 + 10 digits), convert to +92 format
  if (trimmed.startsWith("0") && trimmed.length === 11) {
    return "+92" + trimmed.substring(1);
  }
  // If already in +92 format and has 13 digits (+92 + 11 digits), return as is
  if (trimmed.startsWith("+92") && trimmed.length === 13) {
    return trimmed;
  }
  // Return as is for other cases
  return trimmed;
};

interface User {
  id: string;
  phone: string;
  password: string;
  role: "admin" | "member";
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (
    phone: string,
    password: string,
    role?: "admin" | "member"
  ) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  changePassword: (newPassword: string) => boolean;
  resetPassword: (phone: string, newPassword: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const sampleUsers: User[] = [];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Initialize sample users only if none exist (avoid wiping stored users)
    if (!localStorage.getItem("users")) {
      localStorage.setItem("users", JSON.stringify(sampleUsers));
    }

    // Check if user is logged in
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (
    phone: string,
    password: string,
    role?: "admin" | "member"
  ): boolean => {
    const trimmedPhone = phone.trim();

    // Normalize phone number for comparison
    const normalizedPhone = normalizePhoneNumber(trimmedPhone);

    // Only admin login is supported. Members cannot login via this flow.
    if (role === "admin" && password === "admin123") {
      const adminUser: User = {
        id: "admin",
        phone: normalizedPhone,
        password: "admin123",
        role: "admin",
        name: "Admin",
      };
      setUser(adminUser);
      localStorage.setItem("currentUser", JSON.stringify(adminUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("currentUser");
  };

  const changePassword = (newPassword: string): boolean => {
    if (!user) return false;
    const users: User[] = JSON.parse(localStorage.getItem("users") || "[]");
    const updatedUsers = users.map((u) =>
      u.id === user.id ? { ...u, password: newPassword } : u
    );
    localStorage.setItem("users", JSON.stringify(updatedUsers));
    const updatedUser = { ...user, password: newPassword };
    setUser(updatedUser);
    localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    return true;
  };

  const resetPassword = (phone: string, newPassword: string): boolean => {
    const trimmedPhone = phone.trim();
    const users: User[] = JSON.parse(localStorage.getItem("users") || "[]");
    const userIndex = users.findIndex((u) => u.phone === trimmedPhone);
    if (userIndex !== -1) {
      users[userIndex].password = newPassword;
      localStorage.setItem("users", JSON.stringify(users));
      return true;
    }
    return false;
  };

  // signup removed — member signup/login flow is disabled

  const value: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isMember: user?.role === "member",
    changePassword,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
