import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface RatingProps {
  value: number;
  max?: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Rating({
  value,
  max = 5,
  onChange,
  readOnly = false,
  size = 'md',
  className
}: RatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  
  const handleMouseEnter = (index: number) => {
    if (readOnly) return;
    setHoverValue(index);
  };
  
  const handleMouseLeave = () => {
    if (readOnly) return;
    setHoverValue(null);
  };
  
  const handleClick = (index: number) => {
    if (readOnly || !onChange) return;
    onChange(index);
  };
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };
  
  return (
    <div 
      className={cn("flex gap-1", className)}
      onMouseLeave={handleMouseLeave}
    >
      {Array.from({ length: max }).map((_, i) => {
        const starValue = i + 1;
        const filled = hoverValue !== null 
          ? starValue <= hoverValue
          : starValue <= value;
          
        return (
          <button
            key={i}
            type="button"
            className={cn(
              "rounded-md p-1 transition-colors",
              readOnly ? "cursor-default" : "cursor-pointer hover:bg-secondary",
              filled ? "text-yellow-500" : "text-gray-300"
            )}
            onMouseEnter={() => handleMouseEnter(starValue)}
            onClick={() => handleClick(starValue)}
            disabled={readOnly}
            aria-label={`Rate ${starValue} out of ${max}`}
          >
            <Star 
              className={cn(
                sizeClasses[size], 
                filled ? "fill-current" : ""
              )} 
            />
          </button>
        );
      })}
    </div>
  );
}
