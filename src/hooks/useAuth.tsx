import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  role: 'doctor' | 'patient';
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  status: 'active' | 'inactive' | 'suspended';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);

    const ensureProfile = async (uid: string) => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', uid)
          .single();
        if (data) return data as any;
      } catch {}
      // Attempt to create minimal profile if missing (trigger may have failed)
      try {
        await supabase.from('profiles').upsert({
          user_id: uid,
          role: 'patient',
          first_name: '',
          last_name: '',
          status: 'active'
        }, { onConflict: 'user_id' });
        const { data: created } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', uid)
          .single();
        return created as any;
      } catch {
        return null;
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const p = await ensureProfile(session.user.id);
          if (!cancelled) setProfile(p ?? null);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (cancelled) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
          const p = await ensureProfile(session.user.id);
          if (!cancelled) setProfile(p ?? null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, userData: any) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: userData
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in with email:', email);
      
      // Test Supabase connection first
      try {
        const { data: healthCheck } = await supabase.from('profiles').select('count').limit(1);
        console.log('Supabase connection test:', healthCheck);
      } catch (connectionErr) {
        console.error('Supabase connection test failed:', connectionErr);
        return { error: new Error('Unable to connect to authentication service. Please check your internet connection.') };
      }
      
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sign in request timed out')), 10000); // 10 second timeout
      });

      const signInPromise = supabase.auth.signInWithPassword({
        email,
        password
      });

      const result = await Promise.race([signInPromise, timeoutPromise]) as any;
      console.log('Sign in result:', result);
      
      return { error: result.error };
    } catch (err) {
      console.error('Sign in error:', err);
      return { error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user logged in' };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }

    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};