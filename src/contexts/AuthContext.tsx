import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface AuthUser {
  id: string;
  email: string | null;
  role: "admin" | "member" | null;
  fullName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string): Promise<"admin" | "member" | null> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.role as "admin" | "member";
  };

  const fetchUserProfile = async (userId: string): Promise<{ fullName: string | null }> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return { fullName: null };
    }

    return { fullName: data.full_name };
  };

  const buildAuthUser = async (authUser: User): Promise<AuthUser | null> => {
    // Check if user is approved as a member FIRST
    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("is_approved")
      .eq("user_id", authUser.id)
      .maybeSingle();

    // If member record doesn't exist or user is not approved, return null
    if (memberError || !memberData || !memberData.is_approved) {
      return null;
    }

    const [role, profile] = await Promise.all([
      fetchUserRole(authUser.id),
      fetchUserProfile(authUser.id),
    ]);

    return {
      id: authUser.id,
      email: authUser.email || null,
      role,
      fullName: profile.fullName,
    };
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);

        if (session?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase client
          setTimeout(async () => {
            const authUser = await buildAuthUser(session.user);
            if (authUser) {
              setUser(authUser);
            } else {
              // User exists in auth but is not approved, sign them out
              setUser(null);
              await supabase.auth.signOut();
            }
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);

      if (session?.user) {
        const authUser = await buildAuthUser(session.user);
        if (authUser) {
          setUser(authUser);
        } else {
          setUser(null);
          await supabase.auth.signOut();
        }
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    // Check if member is approved
    if (data.user) {
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("is_approved")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (memberError) {
        await supabase.auth.signOut();
        return { error: "Failed to verify account status" };
      }

      if (memberData && !memberData.is_approved) {
        await supabase.auth.signOut();
        return { error: "Your account is pending approval. Please wait for an admin to approve your account." };
      }
    }

    return { error: null };
  };

  const signup = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    // Sign out the user immediately after signup so they don't get auto-logged in
    // User will need to wait for admin approval and then login manually
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);

    return { error: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const value: AuthContextType = {
    user,
    session,
    login,
    signup,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isMember: user?.role === "member",
    isLoading,
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
