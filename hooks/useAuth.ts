import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { authService } from '../lib/firebase-auth';

/**
 * Custom hook for Firebase authentication state
 * Waits for Firebase to restore auth state from persistence before resolving
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let hasReceivedInitialState = false;

    // Listen to auth state changes
    // Firebase will fire this callback once auth state is restored from persistence
    const unsubscribe = authService.onAuthStateChanged((user) => {
      if (isMounted) {
        setUser(user);
        // Only set loading to false after we've received the initial auth state
        // This ensures we wait for Firebase to restore from persistence
        if (!hasReceivedInitialState) {
          hasReceivedInitialState = true;
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
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

