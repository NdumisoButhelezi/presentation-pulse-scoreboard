export interface User {
  id: string;
  name: string;
  email: string;
  role: 'judge' | 'spectator' | 'admin';
}

export interface Presentation {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  room: 'AZANIA' | 'ALOE' | 'CYCAD' | 'KHANYA';
  sessionDate: string;
  startTime: string;
  endTime: string;
  paperId?: string; // Unique identifier for conference papers to prevent duplicates
  judgeScores?: number[];
  spectatorLikes?: number;
  categoryScores?: {[categoryId: string]: number[]}; // Store scores by category
}

export interface Vote {
  userId: string;
  presentationId: string;
  score: number; // 1-10 for judges, 1 for spectators
  role: 'judge' | 'spectator';
  timestamp: Date;
}

export interface LeaderboardEntry {
  presentation: Presentation;
  avgJudgeScore: number;
  spectatorLikes: number;
  finalScore: number;
  rank: number;
}

export const ROOMS = ['AZANIA', 'ALOE', 'CYCAD', 'KHANYA'] as const;
export type Room = typeof ROOMS[number];

export interface JudgeRating {
  categoryId: string;
  score: number;
}

export interface JudgeVote {
  userId: string;
  presentationId: string;
  ratings: JudgeRating[];
  totalScore: number; // Pre-calculated total for efficiency
  timestamp: Date;
}

export interface ScoringCategory {
  id: string;
  name: string;
  description: string;
  weight: number; // For weighted scoring
}