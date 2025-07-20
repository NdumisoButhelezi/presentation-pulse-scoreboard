import React from 'react';

interface ScoreDisplayProps {
  value: number;
  maxValue?: number;
  showMax?: boolean;
}

export function ScoreDisplay({ value, maxValue, showMax = true }: ScoreDisplayProps) {
  // Handle undefined or zero values
  if (value === undefined || value === null) return <span>-</span>;
  
  // Round the value to nearest integer
  const displayValue = Math.round(value);
  
  // If a max value is provided and we should show it, display as X/Y format
  if (showMax && maxValue) {
    return (
      <span className="font-medium">
        {displayValue}/{maxValue}
      </span>
    );
  }
  
  // Otherwise just show the value
  return <span className="font-medium">{displayValue}</span>;
}

/**
 * A component specifically for table cells that need to display scores
 */
interface ScoreTableCellProps {
  value: number;
  className?: string;
}

export function ScoreTableCell({ value, className = 'text-right font-medium' }: ScoreTableCellProps) {
  return (
    <td className={className}>
      <ScoreDisplay value={value} />
    </td>
  );
}

/**
 * Component to display judge total score
 */
export function JudgeTotalDisplay({ presentation }: { presentation: any }) {
  const judgeTotal = presentation?.judgeTotal;
  const hasScores = Array.isArray(presentation?.judgeScores) && presentation.judgeScores.length > 0;
  
  return (
    <div className="flex flex-col items-center">
      <div className="font-medium">
        {hasScores ? <ScoreDisplay value={judgeTotal} /> : "-"}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {hasScores 
          ? `(${presentation.judgeScores.length} ${presentation.judgeScores.length === 1 ? 'judge' : 'judges'})`
          : "(No judges yet)"}
      </div>
    </div>
  );
}

/**
 * Component to display detailed score breakdown
 */
export function DetailedScoreDisplay({ presentation }: { presentation: any }) {
  if (!presentation?.judgeScores?.length) {
    return <span className="text-muted-foreground">No scores yet</span>;
  }
  
  return (
    <div className="text-xs text-muted-foreground">
      <div>Individual judge scores: {presentation.judgeScores.join(' + ')}</div>
      <div className="font-medium">Total: {presentation.judgeTotal || 0}</div>
    </div>
  );
}
/**
 * Component to display a simple score with optional max value
 */
export function SimpleScoreDisplay({ value, maxValue }: { value: number; maxValue?: number }) {
  return (
    <span className="font-medium">
      {value}{maxValue !== undefined ? `/${maxValue}` : null}
    </span>
  );
}
