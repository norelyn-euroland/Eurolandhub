'use client';

import React from 'react';
import { BreadcrumbItem } from '../lib/types';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isClickable = item.onClick && !isLast;

        return (
          <React.Fragment key={index}>
            {isClickable ? (
              <button
                onClick={item.onClick}
                className="text-neutral-400 hover:text-neutral-900 transition-colors font-medium"
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'text-neutral-900 font-medium' : 'text-neutral-400 font-medium'}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <span className="text-neutral-400 mx-1">/</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;


