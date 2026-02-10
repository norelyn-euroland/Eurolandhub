'use client';

import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
  variant?: 'success' | 'warning' | 'error' | 'info';
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose, duration = 5000, variant = 'success' }) => {
  const [progress, setProgress] = useState(100);

  const theme = (() => {
    switch (variant) {
      case 'warning':
        return {
          container: 'bg-amber-500 border-amber-600 text-white',
          barBg: 'bg-amber-600',
          barFill: 'bg-white/80',
          icon: (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.518 11.59C19.01 16.03 18.06 17.5 16.518 17.5H3.482c-1.542 0-2.492-1.47-1.742-2.811L8.257 3.1zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V8a1 1 0 112 0v3a1 1 0 01-1 1z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'error':
        return {
          container: 'bg-red-600 border-red-700 text-white',
          barBg: 'bg-red-700',
          barFill: 'bg-white/80',
          icon: (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm2.707-10.707a1 1 0 00-1.414-1.414L10 7.586 8.707 6.293a1 1 0 00-1.414 1.414L8.586 9l-1.293 1.293a1 1 0 101.414 1.414L10 10.414l1.293 1.293a1 1 0 001.414-1.414L11.414 9l1.293-1.293z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'info':
        return {
          container: 'bg-blue-600 border-blue-700 text-white',
          barBg: 'bg-blue-700',
          barFill: 'bg-white/80',
          icon: (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 9a1 1 0 112 0v5a1 1 0 11-2 0V9zm1-4a1.25 1.25 0 100 2.5A1.25 1.25 0 0010 5z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'success':
      default:
        return {
          container: 'bg-green-600 border-green-700 text-white',
          barBg: 'bg-green-700',
          barFill: 'bg-white/80',
          icon: (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ),
        };
    }
  })();

  useEffect(() => {
    if (isVisible) {
      setProgress(100);
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - (100 / (duration / 50));
          if (newProgress <= 0) {
            clearInterval(interval);
            onClose();
            return 0;
          }
          return newProgress;
        });
      }, 50);

      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    } else {
      setProgress(100);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className={`relative px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 min-w-[320px] max-w-[500px] overflow-hidden ${theme.container}`}>
        {/* Progress bar */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 ${theme.barBg}`}>
          <div 
            className={`h-full transition-all duration-50 ease-linear ${theme.barFill}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Icon */}
        <div className="relative z-10 flex-shrink-0">
          {theme.icon}
        </div>
        
        <p className="text-sm font-medium flex-1 relative z-10">{message}</p>
        
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white transition-colors flex-shrink-0 relative z-10"
          aria-label="Close notification"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast;






