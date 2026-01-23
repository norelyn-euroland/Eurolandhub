import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { authService } from '../lib/firebase-auth';

/**
 * Custom hook for Firebase authentication state
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set initial user
    setUser(authService.getCurrentUser());
    setLoading(false);

    // Listen to auth state changes
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    signIn: authService.signIn,
    signUp: authService.signUp,
    signOut: authService.signOut,
    resetPassword: authService.resetPassword
  };
};

