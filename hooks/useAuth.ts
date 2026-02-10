import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { authService } from '../lib/firebase-auth';

/**
 * Custom hook for Firebase authentication state
 * Waits for Firebase to restore auth state from persistence before resolving
 * Checks for 31-day expiration when remember me is enabled
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let hasReceivedInitialState = false;

    // Check if auth has expired (for remember me - 31 days)
    if (authService.isAuthExpired()) {
      // Session expired, sign out
      authService.signOut().catch(console.error);
      if (isMounted) {
        setUser(null);
        setLoading(false);
      }
      return;
    }

    // Listen to auth state changes
    // Firebase will fire this callback once auth state is restored from persistence
    const unsubscribe = authService.onAuthStateChanged((user) => {
      if (isMounted) {
        // Double-check expiration when user state changes
        if (user && authService.isAuthExpired()) {
          // Session expired, sign out
          authService.signOut().catch(console.error);
          setUser(null);
          setLoading(false);
          return;
        }
        
        setUser(user);
        // Only set loading to false after we've received the initial auth state
        // This ensures we wait for Firebase to restore from persistence
        if (!hasReceivedInitialState) {
          hasReceivedInitialState = true;
          setLoading(false);
        }
      }
    });

    // Periodic check for expiration (every hour) - in case user is actively using the app
    const expirationCheckInterval = setInterval(() => {
      if (isMounted && authService.isAuthExpired()) {
        // Session expired, sign out
        authService.signOut().catch(console.error);
        setUser(null);
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(expirationCheckInterval);
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

