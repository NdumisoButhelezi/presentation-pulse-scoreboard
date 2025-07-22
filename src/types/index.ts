export interface User {
  id: string;
  name: string;
  email: string;
  role: 'judge' | 'spectator' | 'admin' | 'conference-chair' | 'technical-chair';
  createdAt?: any;
  updatedAt?: any;
  isActive?: boolean;
  lastLogin?: any;
  signatureOnboardingComplete?: boolean; // Track if judge has completed signature setup
  signature?: {
    data: string; // Base64 encoded signature
    createdAt: any;
    updatedAt?: any;
  };
}

export interface Presentation {
  id: string;
  title: string;
  authors?: string[];
  abstract?: string;
  room: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  category?: string;
  judgeScores?: JudgeRating[];
  judgeTotal?: number;
  spectatorLikes?: number;
  spectatorRatings?: SpectatorRating[]; // Updated to support structured ratings
  qrCode?: string; // Base64 encoded QR code image
  qrCodeUrl?: string; // URL that QR code points to
  createdAt?: any;
  updatedAt?: any;
}

export interface Vote {
  id?: string;
  userId: string;
  presentationId: string;
  score: number; // 1-10 for judges, 1 for spectators
  role: 'judge' | 'spectator';
  timestamp?: any;
  ratings?: any[];
  totalScore?: number;
  isAbsent?: boolean; // Whether presenter was marked as absent
  absentReason?: string; // Reason for absence
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

export interface SpectatorQuestion {
  id: string;
  question: string;
  description?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Admin user ID
}

export interface SpectatorRating {
  questionId: string;
  score: number; // 1-5 scale like judges
  userId: string;
}

export interface SpectatorVote {
  id?: string;
  userId: string;
  presentationId: string;
  ratings: SpectatorRating[];
  totalScore: number;
  role: 'spectator';
  timestamp: Date;
  attended?: boolean; // Whether they actually attended the presentation
}