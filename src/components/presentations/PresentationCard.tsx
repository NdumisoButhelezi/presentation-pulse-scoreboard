import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoomBadge } from '@/components/ui/room-badge';
import { VoteModal } from './VoteModal';
import { Presentation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, Users, ThumbsUp, Trophy, Star, Bookmark, BookmarkCheck } from 'lucide-react';
import { getJudgeTotal } from '@/lib/scores';
import { ScoreDisplay } from '@/components/ui/score-display';

interface PresentationCardProps {
  presentation: Presentation;
  userVote?: number;
  hasVoted?: boolean;
  reserved?: boolean;
  onReserve?: () => void;
}

export function PresentationCard({ presentation, userVote, hasVoted, reserved, onReserve }: PresentationCardProps) {
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const { currentUser } = useAuth();

  // Check if this presentation ishjyjh currently happening
  const isCurrentEvent = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    if (presentation.sessionDate !== today) {
      return false;
    }
    
    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.replace('h', ':').split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const startTime = parseTime(presentation.startTime);
    const endTime = parseTime(presentation.endTime);
    
    return currentTime >= startTime && currentTime <= endTime;
  };

  // Replace the manual calculation with the standard utility function
  const totalJudgeScore = useMemo(() => {
    return getJudgeTotal(presentation);
  }, [presentation]);
    
  // Get number of judges (non-zero for display)
  const judgeCount = useMemo(() => {
    if (!presentation.judgeScores || !Array.isArray(presentation.judgeScores)) return 0;
    return presentation.judgeScores.filter(score => 
      score !== undefined && score !== null && !isNaN(Number(score)) && Number(score) > 0
    ).length;
  }, [presentation.judgeScores]);

  const maxPossibleScore = useMemo(() => {
    return judgeCount * 25;
  }, [judgeCount]);

  // Count spectator likes
  const spectatorLikes = presentation.spectatorLikes || 0;

  // Animated vote counter
  const [displayedLikes, setDisplayedLikes] = useState(spectatorLikes);
  useEffect(() => {
    if (displayedLikes !== spectatorLikes) {
      const diff = spectatorLikes - displayedLikes;
      const step = diff > 0 ? 1 : -1;
      const timeout = setTimeout(() => setDisplayedLikes(displayedLikes + step), 30);
      return () => clearTimeout(timeout);
    }
  }, [spectatorLikes, displayedLikes]);

  // Animated progress bar for judge voting
  const progress = judgeCount > 0 ? Math.min(100, Math.round((totalJudgeScore / Math.max(maxPossibleScore, 1)) * 100)) : 0;

  return (
    <Card
      className={`group transition-all duration-300 transform bg-gradient-to-br from-white via-blue-50 to-primary/5 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1.5 border-2 border-transparent hover:border-primary/20 focus-within:shadow-xl animate-fade-in ${
        isCurrentEvent() ? 'border-green-500 bg-green-50/50 shadow-green-100' : ''
      }`}
      tabIndex={0}
      aria-label={`Presentation: ${presentation.title}`}
    >
      <CardHeader className="pb-3">
        {isCurrentEvent() && (
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <Badge variant="default" className="bg-green-500 text-white">
              <Clock className="h-3 w-3 mr-1" />
              Happening Now
            </Badge>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-lg leading-tight mb-2">{presentation.title}</CardTitle>
            <RoomBadge room={presentation.room} className="mb-2" />
          </div>
          <div className="text-right">
            <div className="flex items-center text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4 mr-1" />
              {presentation.startTime} - {presentation.endTime}
            </div>
            <Badge variant="outline" className="text-xs">
              {presentation.sessionDate}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="h-4 w-4 mr-1" />
            <span className="font-semibold">Authors:</span>
          </div>
          <p className="text-base font-medium text-primary/90">{presentation.authors.join(', ')}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-semibold">Abstract:</p>
          <p className="text-sm leading-relaxed line-clamp-3">{presentation.abstract}</p>
        </div>
        {/* Animated progress bar for judge voting */}
        <div className="w-full h-2 bg-primary/10 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-gradient-to-r from-primary via-blue-400 to-accent rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
        {/* Scoring Summary */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <Trophy className="h-4 w-4 text-primary mr-1" />
              {judgeCount > 0 ? (
                <>
                  <Badge variant="secondary" className="font-bold">
                    <ScoreDisplay 
                      value={totalJudgeScore} 
                      maxValue={maxPossibleScore}
                      showMax={true} 
                    />
                  </Badge>
                  <span className="text-muted-foreground ml-1">
                    ({judgeCount} {judgeCount === 1 ? 'judge' : 'judges'})
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">(No votes yet)</span>
              )}
            </div>
            <div className="flex items-center">
              <ThumbsUp className="h-4 w-4 text-accent mr-1" />
              <span className="font-bold text-lg transition-all duration-300">
                {displayedLikes}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasVoted && (
              <div className="flex items-center text-sm text-success">
                {currentUser.role === 'judge' ? (
                  <>
                    <Star className="h-4 w-4 mr-1 fill-current" />
                    Voted ({userVote ? `${userVote}/25` : '-'})
                  </>
                ) : (
                  <>
                    <ThumbsUp className="h-4 w-4 mr-1 fill-current" />
                    Liked
                  </>
                )}
              </div>
            )}
            <Button
              variant={hasVoted ? "outline" : "vote"}
              size="sm"
              onClick={() => setIsVoteModalOpen(true)}
              className="shadow-sm"
            >
              {hasVoted 
                ? (currentUser.role === 'judge' ? "Update Vote" : "Update Like") 
                : (currentUser.role === 'judge' ? "Vote Now" : "Like")}
            </Button>
          </div>
        </div>
      </CardContent>
      {/* Reserve button footer */}
      {typeof reserved !== 'undefined' && typeof onReserve === 'function' && (
        <div className="flex items-center justify-end pt-4 px-4 pb-3 border-t mt-3">
          <Button
            variant={reserved ? "default" : "outline"}
            size="sm"
            onClick={onReserve}
            aria-label={reserved ? "Unreserve Seat" : "Reserve Seat"}
            className="w-full sm:w-auto"
          >
            {reserved ? (
              <BookmarkCheck className="h-4 w-4 text-green-600 mr-1" />
            ) : (
              <Bookmark className="h-4 w-4 mr-1" />
            )}
            <span className="text-xs">
              {reserved ? "Reserved" : "Reserve"}
            </span>
          </Button>
        </div>
      )}
      <VoteModal
        presentation={presentation}
        isOpen={isVoteModalOpen}
        onClose={() => setIsVoteModalOpen(false)}
        currentVote={userVote}
      />
    </Card>
  );
}