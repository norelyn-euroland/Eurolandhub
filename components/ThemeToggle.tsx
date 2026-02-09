'use client';

import React from 'react';
import { Theme } from '../lib/types';

interface ThemeToggleProps {
  theme: Theme;
  toggleTheme: () => void;
}

const styles = `
.theme-toggle-btn {
  --size: 40px;
  --transition-duration: 0.5s;
  
  --container-light-bg: #3d7eae;
  --container-night-bg: #1d1f2c;
  --sun-bg: #ecca2f;
  --moon-bg: #c4c9d1;
  --spot-color: #959db1;
  --clouds-color: #f3fdff;
  --back-clouds-color: #aacadf;
  --stars-color: #fff;
}

.theme-toggle-btn {
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  border: none;
  background: var(--container-light-bg);
  background-image: linear-gradient(to bottom, var(--container-light-bg) 0%, #5490c0 100%);
  position: relative;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  /* Ensure the button is always clickable even with lots of animated layers */
  z-index: 1;
  pointer-events: auto;
  touch-action: manipulation;
  box-shadow: 
    inset 0 0 4px rgba(0,0,0,0.2),
    0 2px 4px rgba(0,0,0,0.1);
  transition: all var(--transition-duration) cubic-bezier(0, -0.02, 0.4, 1.25);
}

/* Decorative layers should never intercept clicks */
.theme-toggle-btn * {
  pointer-events: none;
}

.theme-toggle-btn.dark {
  background: var(--container-night-bg);
  background-image: linear-gradient(to bottom, var(--container-night-bg) 0%, #2d3142 100%);
  box-shadow: 
    inset 0 0 10px rgba(0,0,0,0.5),
    0 2px 4px rgba(0,0,0,0.3);
}

.sun-moon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--sun-bg);
  box-shadow: 
    inset 0.062em 0.062em 0.062em rgba(254, 255, 239, 0.61),
    inset 0em -0.062em 0.062em #a1872a;
  transition: all var(--transition-duration) cubic-bezier(0.68, -0.55, 0.27, 1.55);
  overflow: hidden;
  z-index: 2;
}

.theme-toggle-btn.dark .sun-moon {
  background: var(--moon-bg);
  box-shadow: 
    inset 0.062em 0.062em 0.062em rgba(254, 255, 239, 0.61),
    inset 0em -0.062em 0.062em #969696;
  transform: translate(-50%, -50%) rotate(-15deg);
}

.theme-toggle-btn:hover .sun-moon {
  transform: translate(-50%, -50%) scale(1.1);
}
.theme-toggle-btn.dark:hover .sun-moon {
  transform: translate(-50%, -50%) rotate(-15deg) scale(1.1);
}

.spot {
  position: absolute;
  background-color: var(--spot-color);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s;
  box-shadow: inset 0em 0.0312em 0.062em rgba(0, 0, 0, 0.25);
}

.spot-1 { width: 6px; height: 6px; top: 30%; left: 15%; }
.spot-2 { width: 4px; height: 4px; top: 60%; left: 45%; }
.spot-3 { width: 3px; height: 3px; top: 25%; left: 60%; }

.theme-toggle-btn.dark .spot {
  opacity: 1;
  transition: opacity 0.4s 0.2s;
}

.clouds-container {
  position: absolute;
  bottom: -10%;
  left: 0;
  width: 100%;
  height: 50%;
  transition: transform var(--transition-duration) ease-out;
  z-index: 3;
}

.cloud {
  position: absolute;
  background: var(--clouds-color);
  border-radius: 10px;
}

.cloud-1 {
  width: 25px;
  height: 25px;
  bottom: -15px;
  left: 5px;
  border-radius: 50%;
  box-shadow: 
    8px -5px 0 2px var(--clouds-color),
    18px 0px 0 2px var(--clouds-color);
}

.theme-toggle-btn.dark .clouds-container {
  transform: translateY(200%);
}

.stars-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity var(--transition-duration);
}

.theme-toggle-btn.dark .stars-container {
  opacity: 1;
}

.star {
  position: absolute;
  background: var(--stars-color);
  border-radius: 50%;
  width: 2px;
  height: 2px;
  animation: twinkle 2s infinite ease-in-out;
}

.star-1 { top: 20%; left: 20%; animation-delay: 0s; }
.star-2 { top: 30%; left: 80%; animation-delay: 0.5s; }
.star-3 { top: 70%; left: 20%; animation-delay: 1s; width: 1px; height: 1px; }
.star-4 { top: 15%; left: 50%; animation-delay: 0.2s; width: 1px; height: 1px; }

@keyframes twinkle {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}

.shooting-star {
  position: absolute;
  top: 10%;
  left: 10%;
  width: 20px;
  height: 1px;
  background: linear-gradient(to right, #fff, rgba(255,255,255,0));
  transform: rotate(-45deg) translateX(0);
  opacity: 0;
  z-index: 1;
}

.theme-toggle-btn.dark .shooting-star {
  animation: shoot 2.5s ease-in-out infinite;
  animation-delay: 1s;
}

@keyframes shoot {
  0% { transform: rotate(-45deg) translateX(0); opacity: 0; }
  20% { opacity: 1; }
  40% { transform: rotate(-45deg) translateX(-40px); opacity: 0; }
  100% { transform: rotate(-45deg) translateX(-40px); opacity: 0; }
}
`;

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => {
  const isDark = theme === Theme.DARK;

  return (
    <>
      <style>{styles}</style>
      <button
        type="button"
        className={`theme-toggle-btn ${isDark ? "dark" : ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleTheme();
        }}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        title={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        <div className="stars-container">
          <div className="star star-1"></div>
          <div className="star star-2"></div>
          <div className="star star-3"></div>
          <div className="star star-4"></div>
          <div className="shooting-star"></div>
        </div>

        <div className="sun-moon">
          <div className="spot spot-1"></div>
          <div className="spot spot-2"></div>
          <div className="spot spot-3"></div>
        </div>

        <div className="clouds-container">
          <div className="cloud cloud-1"></div>
        </div>
      </button>
    </>
  );
};

export default ThemeToggle;

