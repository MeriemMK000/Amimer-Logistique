'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullPage?: boolean;
}

const sizeMap = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export default function LoadingSpinner({
  size = 'md',
  className,
  fullPage = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn('relative', sizeMap[size], className)}>
      <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
      <div className="absolute inset-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        {spinner}
      </div>
    );
  }

  return spinner;
}
