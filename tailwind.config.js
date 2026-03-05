
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          dark: '#4338CA',
          light: '#6366F1',
          extralight: '#EEF2FF',
        },
        neutral: {
          50: '#f9f9f9',
          100: '#f2f2f2',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        share: {
          line: '#c73630',
          positive: '#d2ff79',
          bg: '#181210',
          grid: '#b9c0bd',
        },
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'ambient-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'glow-breathe': {
          '0%, 100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        'rain-shimmer': {
          '0%': { transform: 'translateY(-2px)', opacity: '0.3' },
          '50%': { transform: 'translateY(2px)', opacity: '0.6' },
          '100%': { transform: 'translateY(-2px)', opacity: '0.3' },
        },
        'segment-fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // ── Atmospheric widget animations ──
        'sun-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'celestial-glow': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.5' },
          '50%': { transform: 'scale(1.15)', opacity: '0.8' },
        },
        'cloud-drift': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(18px)' },
        },
        'cloud-drift-reverse': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(-14px)' },
        },
        'star-twinkle': {
          '0%, 100%': { opacity: '0.15', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.4)' },
        },
        'moon-float': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-5px) rotate(2deg)' },
        },
      },
      animation: {
        sweep: 'sweep 3s ease-in-out infinite',
        'sweep-once': 'sweep 2.5s ease-in-out forwards',
        'ambient-pulse': 'ambient-pulse 6s ease-in-out infinite',
        'glow-breathe': 'glow-breathe 5s ease-in-out infinite',
        'rain-shimmer': 'rain-shimmer 4s ease-in-out infinite',
        'segment-fade-in': 'segment-fade-in 0.8s ease-out forwards',
        'sun-spin': 'sun-spin 90s linear infinite',
        'celestial-glow': 'celestial-glow 6s ease-in-out infinite',
        'cloud-drift': 'cloud-drift 28s ease-in-out infinite',
        'cloud-drift-reverse': 'cloud-drift-reverse 35s ease-in-out infinite',
        'star-twinkle': 'star-twinkle 4s ease-in-out infinite',
        'moon-float': 'moon-float 20s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
