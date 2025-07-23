import { ScoringCategory } from '@/types';
import type { JudgeRating } from '@/types';

// Default scoring categories
export const DEFAULT_SCORING_CATEGORIES: ScoringCategory[] = [
  {
    id: 'technical',
    name: 'Technical Quality',
    description: 'Evaluate the quality, depth, and significant contribution to the field',
    weight: 0.3
  },
  {
    id: 'delivery',
    name: 'Delivery',
    description: 'Rate the ability of the researcher to present the research study to the audience',
    weight: 0.3
  },
  {
    id: 'visuals',
    name: 'Visual Materials',
    description: 'Assess the quality and effectiveness of slides and visual aids.',
    weight: 0.1
  },
  {
    id: 'relevance',
    name: 'Relevance & Impact',
    description: 'Rate the relevance to the field and potential impact of the research.',
    weight: 0.1
  },
  {
    id: 'experience',
    name: 'Researcher Experience Level',
    description: 'Professor - 1 Star, Dr- 2 Star, PhD Student- 3 star, Masters- 4 Star, Undergraduate -5 Star',
    weight: 0.2
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

