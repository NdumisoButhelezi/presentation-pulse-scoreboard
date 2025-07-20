import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoomBadge } from '@/components/ui/room-badge';
import { VoteModal } from './VoteModal';
import { Presentation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, Users, ThumbsUp, Trophy, Star } from 'lucide-react';
import { getJudgeTotal } from '@/lib/scores';
import { ScoreDisplay } from '@/components/ui/score-display';

interface PresentationCardProps {
  presentation: Presentation;
  userVote?: number;
  hasVoted?: boolean;
}

export function PresentationCard({ presentation, userVote, hasVoted }: PresentationCardProps) {
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const { currentUser } = useAuth();

  // Check if this presentation is currently happening
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

  return (
    <Card className={`hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] animate-fade-in ${
      isCurrentEvent() ? 'border-green-500 bg-green-50/50 shadow-green-100' : ''
    }`}>
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
            <span className="font-medium">Authors:</span>
          </div>
          <p className="text-sm">{presentation.authors.join(', ')}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Abstract:</p>
          <p className="text-sm leading-relaxed line-clamp-3">{presentation.abstract}</p>
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
              <span className="font-medium">{spectatorLikes}</span>
            </div>
          </div>

          {currentUser && (
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
          )}
        </div>
      </CardContent>

      <VoteModal
        presentation={presentation}
        isOpen={isVoteModalOpen}
        onClose={() => setIsVoteModalOpen(false)}
        currentVote={userVote}
      />
    </Card>
  );
}