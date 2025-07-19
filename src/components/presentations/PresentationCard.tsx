import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoomBadge } from '@/components/ui/room-badge';
import { VoteModal } from './VoteModal';
import { Presentation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, Users, ThumbsUp, Trophy, Star } from 'lucide-react';

interface PresentationCardProps {
  presentation: Presentation;
  userVote?: number;
  hasVoted?: boolean;
}

export function PresentationCard({ presentation, userVote, hasVoted }: PresentationCardProps) {
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const { currentUser } = useAuth();

  const avgJudgeScore = presentation.judgeScores?.length 
    ? presentation.judgeScores.reduce((sum, score) => sum + score, 0) / presentation.judgeScores.length
    : 0;

  const spectatorLikes = presentation.spectatorLikes || 0;

  return (
    <Card className="hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] animate-fade-in">
      <CardHeader className="pb-3">
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
              <span className="font-medium">{avgJudgeScore.toFixed(1)}</span>
              <span className="text-muted-foreground ml-1">
                ({presentation.judgeScores?.length || 0} judges)
              </span>
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
                  <Star className="h-4 w-4 mr-1 fill-current" />
                  Voted {userVote && currentUser.role === 'judge' ? `(${userVote})` : ''}
                </div>
              )}
              <Button
                variant={hasVoted ? "outline" : "vote"}
                size="sm"
                onClick={() => setIsVoteModalOpen(true)}
                className="shadow-sm"
              >
                {hasVoted ? "Update Vote" : "Vote Now"}
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