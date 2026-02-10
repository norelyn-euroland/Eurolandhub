import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { auth } from './firebase.js';

/**
 * Authentication Service
 */
export const authService = {
  /**
   * Sign in with email and password
   * @param email - User email
   * @param password - User password
   * @param rememberMe - If true, persist for 31 days. If false, session only.
   */
  async signIn(email: string, password: string, rememberMe: boolean = false): Promise<User> {
    try {
      // Set persistence based on rememberMe
      if (rememberMe) {
        // Use local persistence (persists across browser sessions)
        await setPersistence(auth, browserLocalPersistence);
        
        // Store expiration timestamp (31 days from now)
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 31);
        if (typeof window !== 'undefined') {
          localStorage.setItem('eurolandhub_auth_expires', expirationDate.toISOString());
          localStorage.setItem('eurolandhub_remember_me', 'true');
        }
      } else {
        // Use session persistence (only for current tab/session)
        await setPersistence(auth, browserSessionPersistence);
        
        // Clear any existing expiration
        if (typeof window !== 'undefined') {
          localStorage.removeItem('eurolandhub_auth_expires');
          localStorage.removeItem('eurolandhub_remember_me');
        }
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      console.error('Error signing in:', error);
      // Preserve the original error with code for better error handling
      const authError: any = new Error(error.message || 'Failed to sign in');
      authError.code = error.code;
      throw authError;
    }
  },

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, displayName?: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update display name if provided
      if (displayName) {
        await updateProfile(user, { displayName });
      }
      
      // Send email verification
      await sendEmailVerification(user);
      
      return user;
    } catch (error: any) {
      console.error('Error signing up:', error);
      throw new Error(error.message || 'Failed to sign up');
    }
  },

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
      // Clear remember me data on sign out
      if (typeof window !== 'undefined') {
        localStorage.removeItem('eurolandhub_auth_expires');
        localStorage.removeItem('eurolandhub_remember_me');
      }
    } catch (error: any) {
      console.error('Error signing out:', error);
      throw new Error(error.message || 'Failed to sign out');
    }
  },

  /**
   * Check if auth session has expired (for remember me)
   * Returns true if expired, false if still valid
   */
  isAuthExpired(): boolean {
    if (typeof window === 'undefined') return false;
    
    const expirationStr = localStorage.getItem('eurolandhub_auth_expires');
    const rememberMe = localStorage.getItem('eurolandhub_remember_me');
    
    // If remember me is not set, session-based auth doesn't expire (until browser closes)
    if (!rememberMe || rememberMe !== 'true') {
      return false;
    }
    
    // If no expiration date, treat as expired
    if (!expirationStr) {
      return true;
    }
    
    const expirationDate = new Date(expirationStr);
    const now = new Date();
    
    // Expired if current time is past expiration
    return now > expirationDate;
  },

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      throw new Error(error.message || 'Failed to send password reset email');
    }
  },

  /**
   * Update user profile
   */
  async updateUserProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user is currently signed in');
      }
      await updateProfile(user, updates);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      throw new Error(error.message || 'Failed to update profile');
    }
  }
};

