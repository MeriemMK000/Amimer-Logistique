'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  color?: 'blue' | 'emerald' | 'amber' | 'red';
  size?: 'sm' | 'md';
}

const colorMap = {
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

export default function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  color = 'blue',
  size = 'md',
}: ProgressBarProps) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      {(label || showPercent) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-sm text-gray-600">{label}</span>}
          {showPercent && <span className="text-sm font-medium text-gray-700">{percent}%</span>}
        </div>
      )}
      <div className={cn('w-full bg-gray-100 rounded-full overflow-hidden', size === 'sm' ? 'h-1.5' : 'h-2.5')}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', colorMap[color])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
