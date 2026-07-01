'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
}

const sizeMap = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
};

export function StarRating({
  value,
  onChange,
  maxStars = 5,
  size = 'md',
  readonly = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number>(0);

  const displayValue = hoverValue || value;

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Star rating">
      {Array.from({ length: maxStars }, (_, i) => {
        const starIndex = i + 1;
        const isFilled = starIndex <= displayValue;

        return (
          <motion.button
            key={starIndex}
            type="button"
            disabled={readonly}
            className={cn(
              'relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-sm',
              readonly ? 'cursor-default' : 'cursor-pointer'
            )}
            whileHover={!readonly ? { scale: 1.2 } : undefined}
            whileTap={!readonly ? { scale: 0.9 } : undefined}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onMouseEnter={() => !readonly && setHoverValue(starIndex)}
            onMouseLeave={() => !readonly && setHoverValue(0)}
            onClick={() => !readonly && onChange(starIndex === value ? 0 : starIndex)}
            aria-label={`${starIndex} star${starIndex > 1 ? 's' : ''}`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isFilled ? 'filled' : 'empty'}
                initial={{ opacity: 0, rotate: -30 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 30 }}
                transition={{ duration: 0.15 }}
              >
                <Star
                  className={cn(
                    sizeMap[size],
                    'transition-colors duration-150',
                    isFilled
                      ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                      : 'fill-transparent text-gray-300 hover:text-amber-300'
                  )}
                />
              </motion.div>
            </AnimatePresence>
          </motion.button>
        );
      })}
      {value > 0 && (
        <motion.span
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          className="ml-2 text-sm font-medium text-muted-foreground tabular-nums"
        >
          {value}/{maxStars}
        </motion.span>
      )}
    </div>
  );
}
