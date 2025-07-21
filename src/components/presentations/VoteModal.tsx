import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RoomBadge } from '@/components/ui/room-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Presentation, JudgeRating, ScoringCategory } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirebaseError, checkExistingVote, processVotes } from '@/lib/firebase';
import { Trophy, ThumbsUp, Star, AlertCircle } from 'lucide-react';
import { DEFAULT_SCORING_CATEGORIES, calculateWeightedScore, formatScoreForDisplay } from '@/lib/scoringConfig';
import { MobileJudgeRatingCard } from './MobileJudgeRatingCard';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Rating } from '@/components/ui/rating';

interface VoteModalProps {
  presentation: Presentation;
  isOpen: boolean;
  onClose: () => void;
  currentVote?: number;
}

export function VoteModal({ presentation, isOpen, onClose, currentVote }: VoteModalProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  // For spectators
  const [score, setScore] = useState(currentVote || 1);
  
  // For judges with multiple criteria - now using 5-point scale directly
  const [judgeRatings, setJudgeRatings] = useState<JudgeRating[]>(
    DEFAULT_SCORING_CATEGORIES.map(category => ({
      categoryId: category.id,
      score: 3 // Default mid-range score (3 out of 5)
    }))
  );
  
  const [loading, setLoading] = useState(false);
  
  // Calculate the total judge score based on category ratings
  const totalJudgeScore = useMemo(() => {
    return calculateWeightedScore(judgeRatings);
  }, [judgeRatings]);

  // Format score for display
  const displayScore = useMemo(() => {
    return formatScoreForDisplay(totalJudgeScore);
  }, [totalJudgeScore]);

  const handleRatingChange = (categoryId: string, value: number) => {
    setJudgeRatings(prev => 
      prev.map(rating => 
        rating.categoryId === categoryId ? { ...rating, score: value } : rating
      )
    );
  };

  // Update the handleSubmitVote function:
  const handleSubmitVote = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Calculate the total score from the ratings
      const totalScore = calculateWeightedScore(judgeRatings);
      console.log(`Calculated total score: ${totalScore} for ratings:`, judgeRatings);

      // Check for existing vote
      const existingVoteDoc = await checkExistingVote(currentUser.id, presentation.id);

      let voteData;
      
      if (currentUser.role === 'judge') {
        // Ensure the score is at least 10 to make it visible
        const minScore = 10;
        const finalScore = Math.max(minScore, totalScore);
        
        voteData = {
          userId: currentUser.id,
          presentationId: presentation.id,
          ratings: judgeRatings,
          totalScore: finalScore, // Store the calculated total score
          role: currentUser.role,
          timestamp: new Date()
        };
        
        console.log('Submitting judge vote with data:', voteData);
      } else {
        voteData = {
          userId: currentUser.id,
          presentationId: presentation.id,
          score: 1, // Spectator like
          role: currentUser.role,
          timestamp: new Date()
        };
        
        console.log('Submitting spectator vote with data:', voteData);
      }

      // Create or update vote in Firebase
      if (!existingVoteDoc) {
        const docRef = await addDoc(collection(db, 'votes'), voteData);
        console.log('Created new vote with ID:', docRef.id);
        
        toast({
          title: currentUser.role === 'judge' ? "Scores Submitted!" : "Liked!",
          description: currentUser.role === 'judge' 
            ? `Your ratings have been recorded with an overall score of ${displayScore}/25.`
            : "Thank you for liking this presentation!",
        });
      } else {
        await updateDoc(doc(db, 'votes', existingVoteDoc.id), voteData);
        console.log('Updated existing vote with ID:', existingVoteDoc.id);
        
        toast({
          title: currentUser.role === 'judge' ? "Scores Updated!" : "Like Updated!",
          description: currentUser.role === 'judge'
            ? `Your ratings have been updated with an overall score of ${displayScore}/25.`
            : "Your like has been updated.",
        });
      }

      // Process votes AFTER creating/updating - ensure we pass presentation.id, not presentation directly
      console.log(`Processing votes for presentation: ${presentation.id} (${presentation.title})`);
      await processVotes(presentation.id);

      // Use a longer delay to ensure Firebase operations complete
      toast({
        title: "Score Updated",
        description: "Updating score display...",
      });
      
      setTimeout(() => {
        window.location.reload();
      }, 3000);

      onClose();
    } catch (error) {
      console.error('Error submitting vote:', error);
      const errorMessage = handleFirebaseError(error, 'vote submission');
      if (errorMessage) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const isMobile = useMediaQuery('(max-width: 640px)');

  // Desktop rating component
  const DesktopRatingControl = ({ category }: { category: ScoringCategory }) => {
    const rating = judgeRatings.find(r => r.categoryId === category.id)?.score || 3;
    
    const handleDesktopRatingChange = (value: number) => {
      handleRatingChange(category.id, value);
    };
    
    return (
      <div className="space-y-2 w-full">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">
            {category.name} <span className="text-muted-foreground">{(category.weight * 100).toFixed(0)}%</span>
          </Label>
          <span className="text-sm font-medium bg-secondary px-2 py-1 rounded">
            {rating}/5
          </span>
        </div>
        
        <div className="py-2">
          <Rating 
            value={rating}
            onChange={handleDesktopRatingChange}
            className="justify-center"
          />
        </div>
        
        <p className="text-xs text-muted-foreground">{category.description}</p>
      </div>
    );
  };

  const renderJudgeVotingInterface = () => (
    <div className="space-y-6">
      {isMobile ? (
        // Mobile-optimized UI
        <div>
          {DEFAULT_SCORING_CATEGORIES.map(category => (
            <MobileJudgeRatingCard
              key={category.id}
              category={category}
              currentRating={judgeRatings.find(r => r.categoryId === category.id)?.score || 5}
              onChange={(value) => handleRatingChange(category.id, value)}
            />
          ))}
        </div>
      ) : (
        // Desktop UI with new rating controls
        <div className="space-y-6">
          {DEFAULT_SCORING_CATEGORIES.map(category => (
            <div key={category.id} className="space-y-3 border-b pb-4 last:border-b-0">
              <DesktopRatingControl category={category} />
            </div>
          ))}
        </div>
      )}
      
      {/* Total score display - works for both mobile and desktop */}
      <div className="rounded-lg bg-secondary p-4 text-center">
        <p className="text-sm font-medium mb-2">Overall Score</p>
        <div className="flex items-center justify-center">
          <Star className="h-5 w-5 text-primary fill-current mr-2" />
          <span className="text-3xl font-bold">{displayScore}</span>
          <span className="text-lg ml-1">/25</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Based on your ratings across all weighted criteria
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${currentUser?.role === 'judge' ? 'sm:max-w-lg' : 'sm:max-w-md'} max-h-[90vh] overflow-y-auto bg-white/90 backdrop-blur-xl shadow-2xl border-2 border-primary/10 transition-all duration-300`}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {currentUser?.role === 'judge' ? (
              <Trophy className="h-5 w-5 text-primary" />
            ) : (
              <ThumbsUp className="h-5 w-5 text-accent" />
            )}
            <span>
              {currentUser?.role === 'judge' ? 'Score Presentation' : 'Like Presentation'}
            </span>
          </DialogTitle>
          <DialogDescription>
            {currentUser?.role === 'judge' 
              ? 'Rate this presentation across multiple criteria. Your ratings will be combined into a final score.'
              : 'Show your appreciation for this presentation. Spectator likes are displayed separately and not included in the final score.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Show alert if user is updating their vote */}
          {currentVote && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Updating existing {currentUser?.role === 'judge' ? 'vote' : 'like'}:</strong> You have already {currentUser?.role === 'judge' ? `scored this presentation (${currentVote}/25)` : 'liked this presentation'}. 
                {currentUser?.role === 'judge' ? ' Your score will be updated.' : ''}
              </AlertDescription>
            </Alert>
          )}

          {/* Presentation Info */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{presentation.title}</h3>
              <RoomBadge room={presentation.room} />
            </div>
            <p className="text-sm text-muted-foreground">
              {presentation.authors.join(', ')}
            </p>
          </div>

          {/* Voting Interface */}
          <div className="space-y-4">
            {currentUser?.role === 'judge' 
              ? renderJudgeVotingInterface()
              : (
                <div className="text-center space-y-4">
                  {/* Spectator like UI */}
                  <div className="flex items-center justify-center space-x-2 p-6 bg-accent/10 rounded-lg">
                    <ThumbsUp className="h-8 w-8 text-accent" />
                    <span className="text-lg font-medium">Like this presentation</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Spectator likes are shown separately from judge scores
                  </p>
                </div>
              )
            }
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitVote} 
              disabled={loading}
              className="flex-1"
              variant={currentUser?.role === 'judge' ? "gradient" : "secondary"}
            >
              {loading ? "Submitting..." : (currentUser?.role === 'judge' ? "Submit Ratings" : "Like")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}