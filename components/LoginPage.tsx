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
      await signIn(email, password);
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      {/* EurolandHUB Title */}
      <h1
        className="text-neutral-800 text-6xl mb-10 select-none"
        style={{
          fontFamily: "'Archivo Black', sans-serif",
          fontWeight: 400,
          letterSpacing: '-0.02em',
        }}
      >
        EurolandHUB
      </h1>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl px-10 py-10 shadow-xl">
        {/* Welcome Back */}
        <div className="text-center mb-8">
          <h2
            className="text-3xl text-neutral-800 mb-1 uppercase"
            style={{
              fontFamily: "'Cinzel', serif",
              fontWeight: 400,
              letterSpacing: '0.04em',
            }}
          >
            Welcome Back
          </h2>
          <p className="text-sm text-neutral-500">IR Team</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: '#082b4a' }}>
              Email
            </label>
            <div className="relative">
              {/* User Icon */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full pl-12 pr-4 py-3 bg-neutral-200 rounded-full outline-none text-sm text-neutral-800 placeholder-neutral-400 transition-all ${
                  emailError 
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500' 
                    : 'focus:ring-2 focus:ring-[#082b4a]'
                } ${emailShake ? 'animate-shake' : ''}`}
                placeholder="Enter your email"
              />
            </div>
            {emailError && (
              <p className="mt-1 text-sm text-red-600">{emailError}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: '#082b4a' }}>
              Password
            </label>
            <div className="relative">
              {/* Lock Icon */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full pl-12 pr-12 py-3 bg-neutral-200 rounded-full outline-none text-sm text-neutral-800 placeholder-neutral-400 transition-all ${
                  passwordError 
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500' 
                    : 'focus:ring-2 focus:ring-[#082b4a]'
                } ${passwordShake ? 'animate-shake' : ''}`}
                placeholder="Enter your password"
              />
              {/* Eye Toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 transition-colors"
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
              {/* Remember Me - positioned at right edge, same y-axis as input */}
              <label className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 cursor-pointer select-none" style={{ left: '231px', top: '96px' }}>
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                    rememberMe ? 'bg-green-500' : 'bg-neutral-300'
                  }`}
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  {rememberMe && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span
                  className="text-sm text-neutral-600 whitespace-nowrap"
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  Remember me
                </span>
              </label>
            </div>
            {passwordError && (
              <p className="mt-1 text-sm text-red-600">{passwordError}</p>
            )}
          </div>

          {/* Log In Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-10 py-3 text-white font-bold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              style={{ 
                backgroundColor: '#082b4a',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#061d33')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#082b4a')}
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
