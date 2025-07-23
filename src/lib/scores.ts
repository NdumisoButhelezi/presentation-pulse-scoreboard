/**
 * Scoring utilities for the Presentation Pulse application
 */
import { SpectatorVote, SpectatorRating } from '@/types';

/**
 * Calculate spectator rating total from spectator votes
 */
export function calculateSpectatorTotal(spectatorVotes: SpectatorVote[] = []): number {
  if (!Array.isArray(spectatorVotes) || spectatorVotes.length === 0) return 0;
  
  try {
    const total = spectatorVotes.reduce((sum, vote) => {
      if (vote.totalScore && typeof vote.totalScore === 'number' && !isNaN(vote.totalScore)) {
        return sum + vote.totalScore;
      }
      // Fallback: calculate from ratings if totalScore is missing
      if (vote.ratings && Array.isArray(vote.ratings)) {
        const voteTotal = vote.ratings.reduce((voteSum, rating) => 
          voteSum + (typeof rating.score === 'number' ? rating.score : 0), 0);
        return sum + voteTotal;
      }
      return sum;
    }, 0);
    
    return total;
  } catch (error) {
    console.error('Error calculating spectator total:', error);
    return 0;
  }
}

/**
 * Get average spectator rating per question
 */
export function getSpectatorAverageByQuestion(spectatorVotes: SpectatorVote[] = []): Record<string, number> {
  if (!Array.isArray(spectatorVotes) || spectatorVotes.length === 0) return {};
  
  const questionTotals: Record<string, { sum: number; count: number }> = {};
  
  spectatorVotes.forEach(vote => {
    if (vote.ratings && Array.isArray(vote.ratings)) {
      vote.ratings.forEach(rating => {
        if (!questionTotals[rating.questionId]) {
          questionTotals[rating.questionId] = { sum: 0, count: 0 };
        }
        questionTotals[rating.questionId].sum += rating.score;
        questionTotals[rating.questionId].count += 1;
      });
    }
  });
  
  const averages: Record<string, number> = {};
  Object.keys(questionTotals).forEach(questionId => {
    const { sum, count } = questionTotals[questionId];
    averages[questionId] = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
  });
  
  return averages;
}

/**
 * Calculate the final score for a presentation
 * Using simple scoring (no weighted categories)
 */
export function calculateFinalScore(presentation: any): number {
  // Calculate judge total (sum of all scores)
  const judgeTotalScore = presentation.judgeTotal || (
    presentation.judgeScores?.length 
      ? presentation.judgeScores.reduce((sum: number, score: number) => sum + score, 0)
      : 0
  );
  
  // Final score is just the judge total
  return judgeTotalScore;
}

/**
 * Get total judge score (not average)
 * Supports both legacy (array of numbers) and new (array of objects) formats
 */
export function getJudgeTotal(presentation: any): number {
  if (typeof presentation.judgeTotal === 'number') {
    return presentation.judgeTotal;
  }
  if (!presentation.judgeScores || !Array.isArray(presentation.judgeScores) || presentation.judgeScores.length === 0) {
    return 0;
  }
  // If array of numbers (legacy)
  if (typeof presentation.judgeScores[0] === 'number') {
    return presentation.judgeScores.reduce((sum: number, score: number) => sum + score, 0);
  }
  // If array of objects (new)
  return presentation.judgeScores.reduce((sum: number, rating: any) => {
    // If this is a JudgeVote object with totalScore
    if (typeof rating.totalScore === 'number') return sum + rating.totalScore;
    // If this is a JudgeRating[] (array of category ratings)
    if (Array.isArray(rating.ratings)) {
      return sum + rating.ratings.reduce((catSum: number, cat: any) => catSum + (cat.score || 0), 0);
    }
    // If this is a single JudgeRating object
    if (typeof rating.score === 'number') return sum + rating.score;
    return sum;
  }, 0);
}

/**
 * Sort presentations by final score in descending order
 */
export function sortPresentationsByScore(presentations: any[]): any[] {
  return [...presentations].sort((a, b) => {
    const scoreA = calculateFinalScore(a);
    const scoreB = calculateFinalScore(b);
    return scoreB - scoreA;
  });
}

/**
 * Calculate total score from ratings array
 * This handles the format shown in the database sample
 * Using pure addition without any multiplication
 */
export function calculateTotalFromRatings(ratings: any[] = []): number {
  if (!Array.isArray(ratings) || ratings.length === 0) return 0;
  
  let total = 0;
  try {
    // Sum all category scores - pure addition only
    total = ratings.reduce((sum, rating) => {
      const score = typeof rating.score === 'number' ? rating.score : 0;
      return sum + score;
    }, 0);
    
    // Return raw sum without any multiplication
    return total;
  } catch (error) {
    console.error('Error calculating total from ratings:', error);
    return 0;
  }
}

/**
 * Safe version of final score calculation that prevents NaN values
 */
export function getSafeScore(presentation: any): number {
  if (!presentation) return 0;
  
  // First try to get the judgeTotal directly
  if (typeof presentation.judgeTotal === 'number' && !isNaN(presentation.judgeTotal)) {
    return presentation.judgeTotal;
  }
  
  // Next try to calculate from judgeScores array
  if (Array.isArray(presentation.judgeScores) && presentation.judgeScores.length > 0) {
    const total = presentation.judgeScores.reduce((sum: number, score: number) => {
      return sum + (typeof score === 'number' && !isNaN(score) ? score : 0);
    }, 0);
    return total;
  }
  
  // If we have a totalScore, use that
  if (typeof presentation.totalScore === 'number' && !isNaN(presentation.totalScore)) {
    return presentation.totalScore;
  }
  
  // Last resort: return 0 instead of NaN
  return 0;
}

/**
 * Process a presentation to ensure it has valid score properties
 * Use this before displaying presentations to prevent NaN values
 */
export function ensureValidScores(presentation: any): any {
  if (!presentation) return {};
  
  const safeScore = getSafeScore(presentation);
  
  return {
    ...presentation,
    judgeTotal: safeScore,
    finalScore: safeScore,
    // Make sure judgeScores is always an array
    judgeScores: Array.isArray(presentation.judgeScores) ? presentation.judgeScores : []
  };
}

/**
 * Process an array of presentations to ensure they all have valid scores
 */
export function processPresenterData(presentations: any[] = []): any[] {
  if (!Array.isArray(presentations)) return [];
  
  return presentations.map(presentation => ensureValidScores(presentation));
}

/**
 * Sort presentations by judge total score in descending order
 * Uses spectator likes as a tiebreaker only
 */
export function sortByJudgeTotal(presentations: any[]): any[] {
  return [...presentations].sort((a, b) => {
    // Get safe judge totals
    const totalA = getJudgeTotal(a);
    const totalB = getJudgeTotal(b);
    
    // Primary sort by judge total
    if (totalB !== totalA) {
      return totalB - totalA;
    }
    
    // Use spectator likes as a tiebreaker only
    const likesA = a.spectatorLikes || 0;
    const likesB = b.spectatorLikes || 0;
    return likesB - likesA;
  });
}

/**
 * Format a score for display, avoiding NaN and undefined values
 */
export function formatScoreDisplay(score: number | undefined | null): string {
  if (score === undefined || score === null || isNaN(score)) {
    return '-';
  }
  
  // Return the score as is, preserving the original value
  return Math.floor(score).toString();
}

/**
 * Safe data processor for table cells to prevent NaN values
 * Use this in table rendering components
 */
export function safeScoreForDisplay(value: any): string {
  // If it's already a string, just return it
  if (typeof value === 'string') return value;
  
  // If it's a number but NaN, return dash
  if (typeof value === 'number' && isNaN(value)) return '-';
  
  // If it's a valid number, format it without rounding to preserve value
  if (typeof value === 'number') return Math.floor(value).toString();
  
  // For anything else return a dash
  return '-';
}

/**
 * Process an entire row of presentation data to ensure no NaN values appear in tables
 * Use this before rendering any table rows
 */
export function safePresentationTableData(presentation: any): any {
  if (!presentation) return {};
  
  // Process the presentation to ensure all number fields are valid
  const result = { ...presentation };
  
  // Ensure judge scores exist and are valid
  if (!Array.isArray(result.judgeScores)) {
    result.judgeScores = [];
  }
  
  // Process judgeTotal
  if (typeof result.judgeTotal !== 'number' || isNaN(result.judgeTotal)) {
    result.judgeTotal = getJudgeTotal(result);
  }
  
  // Format display values
  result.displayJudgeTotal = formatScoreDisplay(result.judgeTotal);
  result.displayFinalScore = formatScoreDisplay(result.judgeTotal); // Final score equals judgeTotal
  
  // Ensure spectator likes is a number
  result.spectatorLikes = typeof result.spectatorLikes === 'number' ? result.spectatorLikes : 0;
  
  return result;
}

/**
 * Process table data for admin views
 * This is specific to address the NaN issue in table cells
 */
export function processTableData(data: any[]): any[] {
  return data.map(item => {
    const processed = { ...item };
    
    // Process all number properties to prevent NaN
    Object.keys(processed).forEach(key => {
      if (typeof processed[key] === 'number' && isNaN(processed[key])) {
        processed[key] = 0;
      }
    });
    
    // Add formatted display properties
    if ('judgeTotal' in processed) {
      processed.displayJudgeTotal = formatScoreDisplay(processed.judgeTotal);
    }
    
    if ('finalScore' in processed) {
      processed.displayFinalScore = formatScoreDisplay(processed.finalScore);
    }
    
    return processed;
  });
}

/**
 * Explains how judge total scores are calculated
 */
export function explainScoreCalculation(presentation: any): string {
  if (!presentation) return "No presentation data available.";
  
  // Get raw judgeScores array
  const judgeScores = presentation.judgeScores || [];
  const judgeCount = judgeScores.length;
  
  // Calculate total
  const total = getJudgeTotal(presentation);
  
  // Build explanation string
  let explanation = `Final score calculation for "${presentation.title}":\n\n`;
  explanation += `- ${judgeCount} judge(s) have scored this presentation\n`;
  
  // If we have judge scores, show the detailed calculation
  if (judgeScores.length > 0) {
    explanation += `\nDetailed calculation:\n`;
    explanation += `- Individual judge scores: ${judgeScores.join(' + ')}\n`;
    explanation += `- Sum of all judge scores: ${total}\n\n`;
    
    // Updated explanation with pure addition
    explanation += `Note: Each judge's score is the raw sum of their category ratings:\n`;
    explanation += `1. Judges rate presentations in categories (content, delivery, etc.)\n`;
    explanation += `2. These category ratings are simply added together\n`;
    explanation += `3. For example, if a judge gives ratings of 3+4+3+3=13, the score is 13 points\n`;
    explanation += `4. All judge scores are then summed for the final presentation score\n`;
  }
  
  return explanation;
}

/**
 * Calculates a breakdown of how a specific score was achieved
 */
export function calculateScoreBreakdown(presentation: any): any {
  if (!presentation) return null;
  
  const judgeScores = presentation.judgeScores || [];
  const total = getJudgeTotal(presentation);
  
  // Fetch original vote data if available in the presentation
  const voteData = presentation.voteDetails || [];
  
  // Try to reconstruct how individual votes were calculated - pure addition only
  const voteAnalysis = voteData.map((vote: any) => {
    if (vote.totalScore !== undefined) {
      return {
        userId: vote.userId,
        storedTotalScore: vote.totalScore,
        calculatedScore: vote.totalScore
      };
    } else if (vote.ratings && Array.isArray(vote.ratings)) {
      const categorySum = vote.ratings.reduce((sum: number, rating: any) => 
        sum + (typeof rating.score === 'number' ? rating.score : 0), 0);
      
      return {
        userId: vote.userId,
        rawCategorySum: categorySum,
        calculatedScore: categorySum, // Direct sum, no multiplication
        categories: vote.ratings.map((r: any) => ({
          category: r.categoryId,
          score: r.score
        }))
      };
    }
    return { userId: vote.userId, score: vote.score || vote.totalScore };
  });
  
  return {
    presentationId: presentation.id,
    presentationTitle: presentation.title,
    numberOfJudges: judgeScores.length,
    individualScores: judgeScores,
    judgeTotal: total,
    finalScore: total,
    voteCalculation: voteAnalysis,
    scoreExplanation: `The total score of ${total} comes from summing all judge scores. Judges rate presentations in categories (typically 0-5 points each) and these ratings are simply added together without any multiplication. With 5 categories, each judge can give a maximum of 25 points.`
  };
}

/**
 * Debug function to analyze a specific vote object
 */
export function analyzeVoteObject(vote: any): string {
  if (!vote) return "No vote data provided";
  
  let analysis = "Vote Analysis:\n";
  
  if (vote.ratings && Array.isArray(vote.ratings)) {
    analysis += "\nRating Details:\n";
    
    let totalRating = 0;
    vote.ratings.forEach((rating: any, index: number) => {
      const score = typeof rating.score === 'number' ? rating.score : 0;
      totalRating += score;
      analysis += `Category ${rating.categoryId}: ${score} points\n`;
    });
    
    analysis += `\nRaw Sum: ${totalRating}\n`;
    analysis += `Final Vote Score: ${totalRating}\n`; // Just the raw sum
    
    if (vote.totalScore) {
      analysis += `\nStored totalScore: ${vote.totalScore}\n`;
      // Check for discrepancy with the new calculation method
      if (Math.abs(vote.totalScore - totalRating) > 1) {
        analysis += `⚠️ Discrepancy detected between calculated and stored scores! This may be due to a change in the scoring algorithm.\n`;
      }
    }
  } else if (typeof vote.score === 'number') {
    analysis += `\nDirect Score: ${vote.score}\n`;
  } else if (typeof vote.totalScore === 'number') {
    analysis += `\nTotal Score: ${vote.totalScore}\n`;
  } else {
    analysis += "\nNo recognizable scoring data in this vote.";
  }
  
  return analysis;
}
