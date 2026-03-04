'use client';

import React, { useState, useRef } from 'react';

interface InfoTooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

/** Gray personalized tooltip for info icons — shows on hover */
const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, children, className = '' }) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), 200);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  };

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && (
        <span
          className="absolute z-[100] left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 w-64 text-left text-xs font-normal text-neutral-100 bg-neutral-600 dark:bg-neutral-700 rounded-lg shadow-xl pointer-events-none"
          role="tooltip"
        >
          {content}
          <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-neutral-600 dark:border-t-neutral-700" />
        </span>
      )}
    </span>
  );
};

export default InfoTooltip;


