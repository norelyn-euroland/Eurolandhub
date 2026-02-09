'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkTruncation = () => {
      if (containerRef.current) {
        // Find the actual text element that might be truncated
        // Check for elements with truncate class or any child element
        const element = containerRef.current.querySelector('.truncate') as HTMLElement || 
                       containerRef.current.firstElementChild as HTMLElement;
        if (element) {
          const isOverflowing = 
            element.scrollWidth > element.clientWidth || 
            element.scrollHeight > element.clientHeight;
          setIsTruncated(isOverflowing);
        } else {
          // If no child element, check the container itself
          const container = containerRef.current;
          setIsTruncated(
            container.scrollWidth > container.clientWidth || 
            container.scrollHeight > container.clientHeight
          );
        }
      }
    };

    // Use setTimeout and requestAnimationFrame to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      requestAnimationFrame(checkTruncation);
    }, 100);
    
    window.addEventListener('resize', checkTruncation);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkTruncation);
    };
  }, [content]);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <div 
      ref={containerRef}
      className="relative inline-block w-full"
      onMouseEnter={() => {
        if (isTruncated) {
          setShowTooltip(true);
        }
      }}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && isTruncated && (
        <div className="absolute z-50 px-3 py-2 bg-neutral-900 dark:bg-neutral-600 text-white text-xs font-medium rounded-none shadow-xl whitespace-nowrap pointer-events-none bottom-full left-1/2 transform -translate-x-1/2 mb-2">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-neutral-900 dark:border-t-neutral-600"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;

