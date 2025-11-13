import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Member } from "@/contexts/OrganizationContext";

interface User {
  id: string;
  email: string;
  password: string;
  role: "admin" | "member";
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: "admin" | "member") => boolean;
  signup: (
    email: string,
    password: string,
    role: "admin" | "member",
    name: string,
    members: Member[]
  ) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  changePassword: (newPassword: string) => boolean;
  resetPassword: (email: string, newPassword: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const sampleUsers: User[] = [
  {
    id: "1",
    email: "admin@hilal.com",
    password: "admin123",
    role: "admin",
    name: "Admin",
  },
  {
    id: "2",
    email: "member@hilal.com",
    password: "member123",
    role: "member",
    name: "Member",
  },
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Initialize sample users if not present
    const storedUsers = localStorage.getItem("users");
    if (!storedUsers) {
      localStorage.setItem("users", JSON.stringify(sampleUsers));
    }

    // Check if user is logged in
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (
    email: string,
    password: string,
    role: "admin" | "member"
  ): boolean => {
    const users: User[] = JSON.parse(localStorage.getItem("users") || "[]");
    const foundUser = users.find(
      (u) => u.email === email && u.password === password && u.role === role
    );
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem("currentUser", JSON.stringify(foundUser));
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

  const resetPassword = (email: string, newPassword: string): boolean => {
    const users: User[] = JSON.parse(localStorage.getItem("users") || "[]");
    const userIndex = users.findIndex((u) => u.email === email);
    if (userIndex !== -1) {
      users[userIndex].password = newPassword;
      localStorage.setItem("users", JSON.stringify(users));
      return true;
    }
    return false;
  };

  const signup = (
    email: string,
    password: string,
    role: "admin" | "member",
    name: string,
    members: Member[]
  ): boolean => {
    const users: User[] = JSON.parse(localStorage.getItem("users") || "[]");
    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      return false; // Email already exists
    }

    // Check if email exists in members list
    const memberExists = members.find((m) => m.email === email);
    if (!memberExists) {
      return false; // Email not found in members list
    }

    const newUser: User = {
      id: (users.length + 1).toString(),
      email,
      password,
      role,
      name,
    };
    users.push(newUser);
    localStorage.setItem("users", JSON.stringify(users));
    return true;
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    signup,
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
