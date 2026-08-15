import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'client';
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  // Returns the account's real role on success (as verified from Supabase
  // user metadata), or null on failure. `requiredRole`, if given, makes login
  // fail (and signs the session back out) when the account's real role does
  // not match — used by the dedicated admin/client login screens so a client
  // account can never be treated as admin just by hitting the admin screen.
  login: (email: string, password: string, requiredRole?: 'admin' | 'client') => Promise<'admin' | 'client' | null>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// The account's role is trusted ONLY from Supabase-verified user metadata
// (set server-side at account creation). It must never be taken from
// client-supplied input (e.g. a login-form dropdown) - that would let
// anyone grant themselves admin in the UI without a real admin account.
const mapSupabaseUser = (supabaseUser: SupabaseUser | null): User | null => {
  if (!supabaseUser) return null;
  const metadata = supabaseUser.user_metadata as Record<string, any> | undefined;
  const role: 'admin' | 'client' = metadata?.role === 'admin' ? 'admin' : 'client';
  const username = metadata?.username || supabaseUser.email || supabaseUser.id;
  const name =
    metadata?.name ||
    metadata?.full_name ||
    supabaseUser.email ||
    supabaseUser.id ||
    'Naviz User';

  return {
    id: supabaseUser.id,
    username,
    name,
    email: supabaseUser.email || '',
    role
  };
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser(mapSupabaseUser(session?.user ?? null));
      } catch (error) {
        console.error('Unable to sync Supabase session:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapSupabaseUser(session?.user ?? null));
    });

    initializeSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (
    email: string,
    password: string,
    requiredRole?: 'admin' | 'client'
  ): Promise<'admin' | 'client' | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data.session) {
        console.error('Supabase login failed:', error?.message || 'No session');
        return null;
      }

      const mapped = mapSupabaseUser(data.user);
      if (requiredRole && mapped?.role !== requiredRole) {
        // Credentials were valid but this account isn't the role this screen
        // requires (e.g. a client account used on the admin login page).
        // Sign back out rather than leaving a mismatched session active.
        await supabase.auth.signOut();
        setUser(null);
        return null;
      }

      setUser(mapped);
      return mapped?.role ?? null;
    } catch (error) {
      console.error('Login failure:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = { user, login, logout, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
