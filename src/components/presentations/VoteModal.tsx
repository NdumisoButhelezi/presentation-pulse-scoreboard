import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RoomBadge } from '@/components/ui/room-badge';
import { Presentation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trophy, ThumbsUp, Star } from 'lucide-react';

interface VoteModalProps {
  presentation: Presentation;
  isOpen: boolean;
  onClose: () => void;
  currentVote?: number;
}

export function VoteModal({ presentation, isOpen, onClose, currentVote }: VoteModalProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [score, setScore] = useState(currentVote || (currentUser?.role === 'judge' ? 5 : 1));
  const [loading, setLoading] = useState(false);

  const handleSubmitVote = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Check if user already voted
      const votesQuery = query(
        collection(db, 'votes'),
        where('userId', '==', currentUser.id),
        where('presentationId', '==', presentation.id)
      );
      const existingVotes = await getDocs(votesQuery);

      const voteData = {
        userId: currentUser.id,
        presentationId: presentation.id,
        score: score,
        role: currentUser.role,
        timestamp: new Date()
      };

      if (existingVotes.empty) {
        // Create new vote
        await addDoc(collection(db, 'votes'), voteData);
        toast({
          title: "Vote Submitted!",
          description: `Your ${currentUser.role === 'judge' ? `score of ${score}` : 'like'} has been recorded.`,
        });
      } else {
        // Update existing vote
        const voteDoc = existingVotes.docs[0];
        await updateDoc(doc(db, 'votes', voteDoc.id), {
          score: score,
          timestamp: new Date()
        });
        toast({
          title: "Vote Updated!",
          description: `Your ${currentUser.role === 'judge' ? `score has been updated to ${score}` : 'like has been updated'}.`,
        });
      }

      onClose();
    } catch (error) {
      console.error('Error submitting vote:', error);
      toast({
        title: "Error",
        description: "Failed to submit vote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
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
              ? 'Rate this presentation from 1 to 10' 
              : 'Show your appreciation for this presentation'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            {currentUser?.role === 'judge' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Score: {score}/10</Label>
                  <Slider
                    value={[score]}
                    onValueChange={(value) => setScore(value[0])}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Poor (1)</span>
                  <span>Excellent (10)</span>
                </div>
                <div className="flex items-center justify-center space-x-2 p-3 bg-secondary rounded-lg">
                  <Star className="h-5 w-5 text-primary fill-current" />
                  <span className="font-medium text-lg">{score}/10</span>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center space-x-2 p-6 bg-accent/10 rounded-lg">
                  <ThumbsUp className="h-8 w-8 text-accent" />
                  <span className="text-lg font-medium">Like this presentation</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your like counts as 1 point towards the final score
                </p>
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitVote} 
              disabled={loading}
              className="flex-1"
              variant="gradient"
            >
              {loading ? "Submitting..." : "Submit Vote"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}