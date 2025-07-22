import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoomBadge } from '@/components/ui/room-badge';
import { VoteModal } from './VoteModal';
import { Presentation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, Users, ThumbsUp, Trophy, Star, Bookmark, BookmarkCheck, CheckCircle2, Circle, QrCode, Download } from 'lucide-react';
import { getJudgeTotal } from '@/lib/scores';
import { ScoreDisplay } from '@/components/ui/score-display';
import { ensurePresentationHasQRCode } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getPresentationRatingUrl } from '@/lib/qrcode';

interface PresentationCardProps {
  presentation: Presentation;
  userVote?: number;
  hasVoted?: boolean;
  reserved?: boolean;
  onReserve?: () => void;
  onVoteSubmitted?: () => void; // Add callback for vote submission
}

export function PresentationCard({ presentation, userVote, hasVoted, reserved, onReserve, onVoteSubmitted }: PresentationCardProps) {
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeLoading, setQrCodeLoading] = useState(false);
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
      const increment = diff > 0 ? Math.ceil(diff / 10) : Math.floor(diff / 10);
      const timer = setInterval(() => {
        setDisplayedLikes(prev => {
          const next = prev + increment;
          return diff > 0 ? Math.min(next, spectatorLikes) : Math.max(next, spectatorLikes);
        });
      }, 50);
      return () => clearInterval(timer);
    }
  }, [spectatorLikes, displayedLikes]);

  // Ensure QR code exists for this presentation
  useEffect(() => {
    if (!presentation.qrCode && !qrCodeLoading) {
      const generateQRCode = async () => {
        try {
          setQrCodeLoading(true);
          await ensurePresentationHasQRCode(presentation.id);
        } catch (error) {
          console.error('Failed to generate QR code:', error);
        } finally {
          setQrCodeLoading(false);
        }
      };
      generateQRCode();
    }
  }, [presentation.id, presentation.qrCode, qrCodeLoading]);

  const handleShowQRCode = () => {
    setShowQRCode(true);
  };

  const handleDownloadQRCode = () => {
    if (presentation.qrCode) {
      const link = document.createElement('a');
      link.href = presentation.qrCode;
      link.download = `qr-code-${presentation.title.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

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
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg leading-tight">{presentation.title}</CardTitle>
              {/* Judge Status Indicator */}
              {currentUser?.role === 'judge' && (
                <div className="flex items-center">
                  {hasVoted ? (
                    <div title="Already Judged">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                  ) : (
                    <div title="Not Yet Judged">
                      <Circle className="h-5 w-5 text-orange-500" />
                    </div>
                  )}
                </div>
              )}
            </div>
            <RoomBadge room={presentation.room as "AZANIA" | "ALOE" | "CYCAD" | "KHANYA"} className="mb-2" />
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
                    <Star className="h-4 w-4 mr-1 fill-current" />
                    Rated
                  </>
                )}
              </div>
            )}
            {/* Judge Status Badge */}
            {currentUser?.role === 'judge' && (
              <Badge 
                variant={hasVoted ? "default" : "destructive"} 
                className={`text-xs ${hasVoted ? "bg-green-100 text-green-800 border-green-300" : "bg-orange-100 text-orange-800 border-orange-300"}`}
              >
                {hasVoted ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Judged
                  </>
                ) : (
                  <>
                    <Circle className="h-3 w-3 mr-1" />
                    Pending
                  </>
                )}
              </Badge>
            )}
            <Button
              variant={hasVoted ? "outline" : "vote"}
              size="sm"
              onClick={() => setIsVoteModalOpen(true)}
              className="shadow-sm"
            >
              {hasVoted 
                ? (currentUser.role === 'judge' ? "Update Vote" : "Update Rating") 
                : (currentUser.role === 'judge' ? "Vote Now" : "Rate")}
            </Button>
            
            {/* QR Code Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShowQRCode}
              className="text-muted-foreground hover:text-foreground"
              disabled={qrCodeLoading}
            >
              <QrCode className="h-4 w-4" />
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
      
      {/* QR Code Modal */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <QrCode className="h-5 w-5 mr-2" />
              Rate via QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <h4 className="font-medium mb-2">{presentation.title}</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Scan this QR code with your phone to rate this presentation
              </p>
              
              {presentation.qrCode ? (
                <div className="bg-white p-4 rounded-lg border inline-block">
                  <img 
                    src={presentation.qrCode} 
                    alt={`QR Code for ${presentation.title}`}
                    className="w-48 h-48 mx-auto"
                  />
                </div>
              ) : (
                <div className="bg-gray-100 p-8 rounded-lg border">
                  <QrCode className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    {qrCodeLoading ? "Generating QR code..." : "QR code not available"}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadQRCode}
                disabled={!presentation.qrCode}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="default"
                onClick={() => setShowQRCode(false)}
                className="flex-1"
              >
                Close
              </Button>
            </div>
            
            {presentation.qrCodeUrl && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">Direct link:</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">
                  {getPresentationRatingUrl(presentation.id)}
                </code>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <VoteModal
        presentation={presentation}
        isOpen={isVoteModalOpen}
        onClose={() => setIsVoteModalOpen(false)}
        currentVote={userVote}
        onVoteSubmitted={onVoteSubmitted}
      />
    </Card>
  );
}