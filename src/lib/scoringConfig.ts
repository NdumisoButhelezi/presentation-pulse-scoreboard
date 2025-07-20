import { ScoringCategory } from '@/types';
import type { JudgeRating } from '@/types';

// Default scoring categories
export const DEFAULT_SCORING_CATEGORIES: ScoringCategory[] = [
  {
    id: 'content',
    name: 'Content Quality',
    description: 'Evaluate the quality, depth, and accuracy of the presentation content',
    weight: 0.4
  },
  {
    id: 'delivery',
    name: 'Delivery',
    description: 'Rate the presenter\'s speaking skills, engagement, and communication',
    weight: 0.3
  },
  {
    id: 'visuals',
    name: 'Visual Materials',
    description: 'Assess the quality and effectiveness of slides and visual aids',
    weight: 0.15
  },
  {
    id: 'relevance',
    name: 'Relevance & Impact',
    description: 'Rate the relevance to the field and potential impact of the research',
    weight: 0.15
  }
];

// Calculate score from 5-star ratings
export function calculateWeightedScore(ratings: JudgeRating[]): number {
  if (!ratings || ratings.length === 0) return 0;
  
  // Get the category for each rating to find its weight
  const weightedScores = ratings.map(rating => {
    const category = DEFAULT_SCORING_CATEGORIES.find(cat => cat.id === rating.categoryId);
    if (!category) return 0;
    
    // Convert 5-point scale to points out of 25
    const weightedValue = (rating.score / 5) * 25 * category.weight;
    return weightedValue;
  });
  
  // Sum all weighted scores
  return Math.round(weightedScores.reduce((sum, score) => sum + score, 0));
}

// Format the score for display with enhanced error handling
export function formatScoreForDisplay(score: number): string {
  return Math.round(score).toString();
}

