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
  judgeScores?: number[];
  spectatorLikes?: number;
  finalScore?: number;
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