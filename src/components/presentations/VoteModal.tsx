import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RoomBadge } from '@/components/ui/room-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Presentation, JudgeRating, ScoringCategory, SpectatorQuestion, SpectatorRating } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db, handleFirebaseError, checkExistingVote, processVotes, getActiveSpectatorQuestions } from '@/lib/firebase';
import { Trophy, ThumbsUp, Star, AlertCircle, Users } from 'lucide-react';
import { DEFAULT_SCORING_CATEGORIES, calculateWeightedScore, formatScoreForDisplay } from '@/lib/scoringConfig';
import { MobileJudgeRatingCard } from './MobileJudgeRatingCard';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Rating } from '@/components/ui/rating';
import { SignatureDisplay } from '@/components/ui/signature-display';

interface VoteModalProps {
  presentation: Presentation;
  isOpen: boolean;
  onClose: () => void;
  currentVote?: number;
  onVoteSubmitted?: () => void; // Add callback for when vote is submitted
}

export function VoteModal({ presentation, isOpen, onClose, currentVote, onVoteSubmitted }: VoteModalProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  // For spectators - now using questions
  const [spectatorQuestions, setSpectatorQuestions] = useState<SpectatorQuestion[]>([]);
  const [spectatorRatings, setSpectatorRatings] = useState<SpectatorRating[]>([]);
  
  // For judges with multiple criteria - now using 5-point scale directly
  const [judgeRatings, setJudgeRatings] = useState<JudgeRating[]>(
    DEFAULT_SCORING_CATEGORIES.map(category => ({
      categoryId: category.id,
      score: 3 // Default mid-range score (3 out of 5)
    }))
  );
  
  // Absent functionality
  const [isAbsent, setIsAbsent] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Load spectator questions when modal opens for spectators
  useEffect(() => {
    if (isOpen && currentUser?.role === 'spectator') {
      loadSpectatorQuestions();
    }
  }, [isOpen, currentUser?.role]);

  const loadSpectatorQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const questions = await getActiveSpectatorQuestions();
      setSpectatorQuestions(questions);
      
      // Initialize ratings for each question
      setSpectatorRatings(questions.map(question => ({
        questionId: question.id,
        score: 3, // Default mid-range score
        userId: currentUser?.id || ''
      })));
    } catch (error) {
      console.error('Error loading spectator questions:', error);
      toast({
        title: "Error",
        description: "Failed to load rating questions",
        variant: "destructive",
      });
    } finally {
      setLoadingQuestions(false);
    }
  };
  
  // Calculate the total judge score based on category ratings
  const totalJudgeScore = useMemo(() => {
    return calculateWeightedScore(judgeRatings);
  }, [judgeRatings]);

  // Calculate total spectator score
  const totalSpectatorScore = useMemo(() => {
    if (spectatorRatings.length === 0) return 0;
    const sum = spectatorRatings.reduce((total, rating) => total + rating.score, 0);
    return Math.round(sum); // Simple sum, no weighting for spectators
  }, [spectatorRatings]);

  // Format score for display
  const displayScore = useMemo(() => {
    if (currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') {
      return formatScoreForDisplay(totalJudgeScore);
    }
    return totalSpectatorScore.toString();
  }, [totalJudgeScore, totalSpectatorScore, currentUser?.role]);

  const handleJudgeRatingChange = (categoryId: string, value: number) => {
    setJudgeRatings(prev => 
      prev.map(rating => 
        rating.categoryId === categoryId ? { ...rating, score: value } : rating
      )
    );
  };

  const handleSpectatorRatingChange = (questionId: string, value: number) => {
    setSpectatorRatings(prev =>
      prev.map(rating =>
        rating.questionId === questionId ? { ...rating, score: value } : rating
      )
    );
  };

  const handleAbsentToggle = () => {
    setIsAbsent(!isAbsent);
    
    // If marking as absent, set all ratings to 0
    if (!isAbsent) {
      if (currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') {
        setJudgeRatings(prev =>
          prev.map(rating => ({ ...rating, score: 0 }))
        );
      } else {
        setSpectatorRatings(prev =>
          prev.map(rating => ({ ...rating, score: 0 }))
        );
      }
    } else {
      // If unmarking absent, restore ratings to default 3
      if (currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') {
        setJudgeRatings(prev =>
          prev.map(rating => ({ ...rating, score: 3 }))
        );
      } else {
        setSpectatorRatings(prev =>
          prev.map(rating => ({ ...rating, score: 3 }))
        );
      }
    }
  };

  // Update the handleSubmitVote function:
  const handleSubmitVote = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Check for existing vote
      const existingVoteDoc = await checkExistingVote(currentUser.id, presentation.id);

      let voteData;
      
      if (currentUser.role === 'judge' || currentUser.role === 'conference-chair') {
        // Calculate the total score from the ratings
        const totalScore = isAbsent ? 0 : calculateWeightedScore(judgeRatings);

        // For absent presentations, use 0. Otherwise ensure minimum visibility score
        const finalScore = isAbsent ? 0 : Math.max(10, totalScore);
        
        voteData = {
          userId: currentUser.id,
          presentationId: presentation.id,
          role: currentUser.role === 'conference-chair' ? 'judge' : currentUser.role, // Store conference-chair as judge votes
          totalScore: finalScore,
          isAbsent: isAbsent,
          ...(isAbsent && { absentReason: 'Presenter did not show up' }),
          ratings: judgeRatings,
          timestamp: new Date(),
        };
        
      } else {
        // Spectator vote with ratings
        const finalSpectatorScore = isAbsent ? 0 : totalSpectatorScore;
        
        voteData = {
          userId: currentUser.id,
          presentationId: presentation.id,
          ratings: spectatorRatings,
          totalScore: finalSpectatorScore,
          role: currentUser.role,
          timestamp: new Date(),
          isAbsent: isAbsent,
          ...(isAbsent && { absentReason: 'Presenter did not show up' })
        };
        
      }

      // Create or update vote in Firebase
      if (!existingVoteDoc) {
        // For new votes, create initial history entry
        const voteDataWithHistory = {
          ...voteData,
          history: [{
            timestamp: new Date(),
            action: 'created',
            totalScore: voteData.totalScore,
            ratings: voteData.ratings,
            userId: currentUser.id,
            isAbsent: isAbsent,
            ...(isAbsent && { absentReason: 'Presenter did not show up' })
          }]
        };
        
        const docRef = await addDoc(collection(db, 'votes'), voteDataWithHistory);
        
        toast({
          title: (currentUser.role === 'judge' || currentUser.role === 'conference-chair') ? "Scores Submitted!" : "Ratings Submitted!",
          description: isAbsent
            ? "Presentation marked as absent with zero score."
            : (currentUser.role === 'judge' || currentUser.role === 'conference-chair')
              ? "Your scores have been recorded and will be included in the final rankings."
              : "Thank you for your feedback! Your ratings help improve future presentations.",
        });
      } else {
        // For updates, append to history array and update main fields
        const existingData = await getDoc(doc(db, 'votes', existingVoteDoc.id));
        const currentHistory = existingData.data()?.history || [];
        
        const updateData = {
          ...voteData,
          updatedAt: new Date(),
          history: [
            ...currentHistory,
            {
              timestamp: new Date(),
              action: 'updated',
              totalScore: voteData.totalScore,
              ratings: voteData.ratings,
              userId: currentUser.id,
              previousScore: existingData.data()?.totalScore || existingData.data()?.score || 0,
              isAbsent: isAbsent,
              ...(isAbsent && { absentReason: 'Presenter did not show up' })
            }
          ]
        };
        
        await updateDoc(doc(db, 'votes', existingVoteDoc.id), updateData);
        
        toast({
          title: (currentUser.role === 'judge' || currentUser.role === 'conference-chair') ? "Scores Updated!" : "Ratings Updated!",
          description: isAbsent
            ? "Presentation marked as absent with zero score."
            : (currentUser.role === 'judge' || currentUser.role === 'conference-chair')
              ? "Your updated scores have been recorded."
              : "Your updated ratings have been recorded.",
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
      
      onVoteSubmitted?.(); // Notify parent component
      onClose(); // Close the modal

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

  // Desktop rating component for judges
  const DesktopJudgeRatingControl = ({ category }: { category: ScoringCategory }) => {
    const rating = judgeRatings.find(r => r.categoryId === category.id)?.score || 3;
    
    const handleDesktopRatingChange = (value: number) => {
      handleJudgeRatingChange(category.id, value);
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
        {/* Move description above the stars */}
        <p className="text-xs text-muted-foreground mb-1">{category.description}</p>
        <div className="py-2">
          <Rating 
            value={rating}
            onChange={handleDesktopRatingChange}
            className="justify-center"
          />
        </div>
      </div>
    );
  };

  // Desktop rating component for spectators
  const DesktopSpectatorRatingControl = ({ question }: { question: SpectatorQuestion }) => {
    const rating = spectatorRatings.find(r => r.questionId === question.id)?.score || 3;
    
    const handleDesktopRatingChange = (value: number) => {
      handleSpectatorRatingChange(question.id, value);
    };
    
    return (
      <div className="space-y-2 w-full">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">
            {question.question}
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
        
        {question.description && (
          <p className="text-xs text-muted-foreground">{question.description}</p>
        )}
      </div>
    );
  };

  const renderJudgeVotingInterface = () => {
    return (
      <div className="space-y-6">
        {/* Absent Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-red-50 border-red-200">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">Presenter Absent</p>
              <p className="text-sm text-red-700">Click if the presenter did not show up</p>
            </div>
          </div>
          <Button
            variant={isAbsent ? "destructive" : "outline"}
            size="sm"
            onClick={handleAbsentToggle}
          >
            {isAbsent ? "Mark Present" : "Mark Absent"}
          </Button>
        </div>

      {/* Rating Interface - disabled when absent */}
      <div className={isAbsent ? "opacity-50 pointer-events-none" : ""}>
        {isMobile ? (
          // Mobile-optimized UI
          <div>
            {DEFAULT_SCORING_CATEGORIES.map(category => (
              <MobileJudgeRatingCard
                key={category.id}
                category={category}
                currentRating={judgeRatings.find(r => r.categoryId === category.id)?.score || 5}
                onChange={(value) => handleJudgeRatingChange(category.id, value)}
              />
            ))}
          </div>
        ) : (
          // Desktop UI with new rating controls
          <div className="space-y-6">
            {DEFAULT_SCORING_CATEGORIES.map(category => (
              <div key={category.id} className="space-y-3 border-b pb-4 last:border-b-0">
                <DesktopJudgeRatingControl category={category} />
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Total score display - works for both mobile and desktop */}
      <div className={`rounded-lg p-4 text-center ${isAbsent ? 'bg-red-100 border border-red-200' : 'bg-secondary'}`}>
        <p className="text-sm font-medium mb-2">Overall Score</p>
        <div className="flex items-center justify-center">
          <Star className={`h-5 w-5 mr-2 ${isAbsent ? 'text-red-600' : 'text-primary fill-current'}`} />
          <span className={`text-3xl font-bold ${isAbsent ? 'text-red-900' : ''}`}>{displayScore}</span>
          <span className="text-lg ml-1">/25</span>
        </div>
        {isAbsent ? (
          <p className="text-xs text-red-700 mt-1">
            Presenter marked as absent - automatic zero score
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            Based on your ratings across all weighted criteria
          </p>
        )}
      </div>
    </div>
  );
  };

  const renderSpectatorVotingInterface = () => {
    if (loadingQuestions) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading rating questions...</p>
        </div>
      );
    }

    if (spectatorQuestions.length === 0) {
      return (
        <div className="text-center p-8">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Rating Questions Available</h3>
          <p className="text-gray-600 mb-4">
            The administrator hasn't set up attendee rating questions yet.
          </p>
          <p className="text-sm text-gray-500">
            Please check back later or contact the event organizers.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="space-y-6">
          {spectatorQuestions.map((question, index) => (
            <div key={question.id} className="space-y-3 border-b pb-4 last:border-b-0">
              <DesktopSpectatorRatingControl question={question} />
            </div>
          ))}
        </div>
        
        {/* Total score display */}
        <div className="rounded-lg bg-secondary p-4 text-center">
          <p className="text-sm font-medium mb-2">Total Rating</p>
          <div className="flex items-center justify-center">
            <ThumbsUp className="h-5 w-5 text-accent fill-current mr-2" />
            <span className="text-3xl font-bold">{displayScore}</span>
            <span className="text-lg ml-1">/{spectatorQuestions.length * 5}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Your overall rating across all questions
          </p>
        </div>
      </div>
    );
  };

  const maxSpectatorScore = spectatorQuestions.length * 5;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${(currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') ? 'sm:max-w-lg' : 'sm:max-w-lg'} max-h-[90vh] overflow-y-auto bg-white/90 backdrop-blur-xl shadow-2xl border-2 border-primary/10 transition-all duration-300`}>
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold text-center flex items-center justify-center">
            {(currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') ? (
              <Trophy className="h-5 w-5 mr-2 text-amber-500" />
            ) : (
              <ThumbsUp className="h-5 w-5 mr-2 text-blue-500" />
            )}
            <span>
              {(currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') ? 'Score Presentation' : 'Rate Presentation'}
            </span>
          </DialogTitle>
          <DialogDescription>
            {(currentUser?.role === 'judge' || currentUser?.role === 'conference-chair')
              ? 'Rate this presentation across multiple criteria. Your ratings will be combined into a final score.'
              : 'Rate this presentation on various aspects. Your feedback helps improve future presentations.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Show alert if user is updating their vote */}
          {currentVote && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Updating existing {(currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') ? 'vote' : 'rating'}:</strong> You have already {(currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') ? `scored this presentation (${currentVote}/25)` : 'rated this presentation'}. 
                Your {(currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') ? 'score' : 'rating'} will be updated.
              </AlertDescription>
            </Alert>
          )}

          {/* Presentation Info */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{presentation.title}</h3>
              <RoomBadge room={presentation.room as "AZANIA" | "ALOE" | "CYCAD" | "KHANYA"} />
            </div>
            <p className="text-sm text-muted-foreground">
              {presentation.authors.join(', ')}
            </p>
          </div>

          {/* Voting Interface */}
          <div className="space-y-4">
            {(currentUser?.role === 'judge' || currentUser?.role === 'conference-chair')
              ? renderJudgeVotingInterface()
              : renderSpectatorVotingInterface()
            }
          </div>

          {/* Judge Signature Display */}
          {currentUser && (currentUser.role === 'judge' || currentUser.role === 'conference-chair') && currentUser.signature && (
            <div className="rounded-lg border p-4 bg-muted/20">
              <SignatureDisplay user={currentUser} size="sm" showLabel={true} />
              <p className="text-xs text-muted-foreground mt-1">
                Digital signature will be attached to your rating
              </p>
            </div>
          )}

          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitVote} 
              disabled={loading || (currentUser?.role === 'spectator' && spectatorQuestions.length === 0)}
              className="flex-1"
              variant={(currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') ? "gradient" : "secondary"}
            >
              {loading ? "Submitting..." : ((currentUser?.role === 'judge' || currentUser?.role === 'conference-chair') ? "Submit Ratings" : "Submit Ratings")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}