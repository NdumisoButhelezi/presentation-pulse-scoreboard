import { Card, CardContent } from '@/components/ui/card';
import { Rating } from '@/components/ui/rating';
import { ScoringCategory } from '@/types';

interface MobileJudgeRatingCardProps {
  category: ScoringCategory;
  currentRating: number;
  onChange: (value: number) => void;
  presentingAuthor?: string;
}

// Update the mobile component to show consistent styling of X/5 ratings
export function MobileJudgeRatingCard({ 
  category, 
  currentRating, 
  onChange, 
  presentingAuthor
}: MobileJudgeRatingCardProps) {
  return (
    <div className="rounded-lg border mb-3 p-4">
      {presentingAuthor && (
        <div className="mb-2 text-sm font-bold text-red-600">Presenting Author: {presentingAuthor}</div>
      )}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">
          {category.name}{' '}
          <span className="text-muted-foreground">
            {(category.weight * 100).toFixed(0)}%
          </span>
        </h3>
        <span className="text-sm font-medium bg-secondary px-2 py-1 rounded">
          {currentRating}/5
        </span>
      </div>
      
      <div className="flex flex-col items-center pt-2 space-y-2">
        <Rating 
          value={currentRating} 
          onChange={onChange}
          size="lg"
          className="justify-center"
        />
      </div>
    </div>
  );
}
 
   