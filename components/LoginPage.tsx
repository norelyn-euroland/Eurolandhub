'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailShake, setEmailShake] = useState(false);
  const [passwordShake, setPasswordShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  // Clear errors when user starts typing
  useEffect(() => {
    if (email) {
      setEmailError('');
      setEmailShake(false);
    }
  }, [email]);

  useEffect(() => {
    if (password) {
      setPasswordError('');
      setPasswordShake(false);
    }
  }, [password]);

  const triggerShake = (field: 'email' | 'password') => {
    if (field === 'email') {
      setEmailShake(true);
      setTimeout(() => setEmailShake(false), 500);
    } else {
      setPasswordShake(true);
      setTimeout(() => setPasswordShake(false), 500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');
    setLoading(true);

    try {
      await signIn(email, password, rememberMe);
    } catch (err: any) {
      const errorCode = err.code || '';
      const errorMessage = err.message || '';
      
      // Determine if it's an email or password error based on Firebase error codes
      if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        // Wrong password - show error on password field
        setPasswordError('Wrong password');
        triggerShake('password');
      } else if (
        errorCode === 'auth/user-not-found' ||
        errorCode === 'auth/invalid-email' ||
        errorCode === 'auth/user-disabled'
      ) {
        // Email-related errors
        setEmailError('Wrong email');
        triggerShake('email');
      } else {
        // Generic error or unknown error code
        // For invalid-credential, it could be either, but we'll default to password
        if (errorCode === 'auth/invalid-credential' || errorMessage.toLowerCase().includes('password')) {
          setPasswordError('Wrong password');
          triggerShake('password');
        } else if (errorMessage.toLowerCase().includes('email') || errorMessage.toLowerCase().includes('user')) {
          setEmailError('Wrong email');
          triggerShake('email');
        } else {
          // Show on both if we can't determine
          setEmailError('Wrong email');
          setPasswordError('Wrong password');
          triggerShake('email');
          triggerShake('password');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-900">
      {/* EurolandHUB Title */}
      <h1
        className="text-neutral-900 dark:text-neutral-100 text-6xl mb-10 select-none"
        style={{
          fontFamily: "'Archivo Black', sans-serif",
          fontWeight: 400,
          letterSpacing: '-0.02em',
        }}
      >
        EurolandHUB
      </h1>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white dark:bg-neutral-800 rounded-2xl px-10 py-10 shadow-xl border border-neutral-200 dark:border-neutral-700">
        {/* Welcome Back */}
        <div className="text-center mb-8">
          <h2
            className="text-3xl text-neutral-900 dark:text-neutral-100 mb-1 uppercase"
            style={{
              fontFamily: "'Cinzel', serif",
              fontWeight: 400,
              letterSpacing: '0.04em',
            }}
          >
            Welcome Back
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">IR Team</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-bold mb-2 text-neutral-700 dark:text-neutral-200">
              Email
            </label>
            <div className="relative">
              {/* User Icon */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-full outline-none text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 transition-all ${
                  emailError 
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500' 
                    : 'focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-[#082b4a] dark:focus:border-[#00adf0]'
                } ${emailShake ? 'animate-shake' : ''}`}
                placeholder="Enter your email"
              />
            </div>
            {emailError && (
              <p className="mt-1 text-sm text-red-400">{emailError}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-bold mb-2 text-neutral-700 dark:text-neutral-200">
              Password
            </label>
            <div className="relative">
              {/* Lock Icon */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full pl-12 pr-12 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-full outline-none text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 transition-all ${
                  passwordError 
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500' 
                    : 'focus:ring-2 focus:ring-[#082b4a] dark:focus:ring-[#00adf0] focus:border-[#082b4a] dark:focus:border-[#00adf0]'
                } ${passwordShake ? 'animate-shake' : ''}`}
                placeholder="Enter your password"
              />
              {/* Eye Toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1 text-sm text-red-400">{passwordError}</p>
            )}
          </div>

          {/* Log In Button and Remember Me on same row */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="px-10 py-3 text-white font-bold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm bg-[#082b4a] dark:bg-[#00adf0] hover:bg-[#061d33] dark:hover:bg-[#0099d6]"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
            {/* Remember Me - aligned to the right */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span
                className="text-sm text-neutral-600 dark:text-neutral-300"
                onClick={() => setRememberMe(!rememberMe)}
              >
                Remember me
              </span>
              <div
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                  rememberMe ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
                onClick={() => setRememberMe(!rememberMe)}
              >
                {rememberMe && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </label>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
