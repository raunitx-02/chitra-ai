"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import api from '../lib/api';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  creditsBalance: number;
  planName: string;
  planValidity: string;
  planExpiresAt: string | null;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  creditsBalance: 0,
  planName: 'None',
  planValidity: 'Lifetime',
  planExpiresAt: null,
  logout: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<number>(0);
  const [planName, setPlanName] = useState<string>('None');
  const [planValidity, setPlanValidity] = useState<string>('Lifetime');
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    try {
      // Sync on db
      const syncRes = await api.post('/auth/sync');
      const u = syncRes.data.user;
      setCreditsBalance(u.creditsBalance);
      setPlanName(u.planName || 'None');
      setPlanValidity(u.planValidity || 'Lifetime');
      setPlanExpiresAt(u.planExpiresAt || null);
    } catch (err) {
      console.error('Error syncing profile details:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await refreshProfile();
      } else {
        setCreditsBalance(0);
        setPlanName('None');
        setPlanValidity('Lifetime');
        setPlanExpiresAt(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setCreditsBalance(0);
    setPlanName('None');
    setPlanValidity('Lifetime');
    setPlanExpiresAt(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, creditsBalance, planName, planValidity, planExpiresAt, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
