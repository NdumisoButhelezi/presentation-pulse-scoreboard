import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoomBadge } from '@/components/ui/room-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Presentation } from '@/types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trophy, ThumbsUp, RefreshCw, Medal, Filter, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  getJudgeTotal, 
  getSafeScore, 
  ensureValidScores, 
  processPresenterData,
  sortByJudgeTotal,
  formatScoreDisplay
} from '@/lib/scores';
import { ScoreDisplay } from '@/components/ui/score-display';

export function LeaderboardPage() {
  const { toast } = useToast();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'standard' | 'detailed'>('standard');

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'presentations'));
      const presentationData = snapshot.docs.map(doc => {
        // Get the raw data
        const data = doc.data();
        
        // Process the presentation to ensure valid scores
        const processedPresentation = ensureValidScores({
          id: doc.id,
          ...data
        });
        
        // Add extra debugging for the specific presentation
        if (data.title === "Performance Analysis of Deep Learning Techniques in Brain Tumor Segmentation") {
          console.log("Found target presentation:", {
            id: doc.id,
            title: data.title,
            rawScores: data.judgeScores,
            processedScores: processedPresentation.judgeScores,
            judgeTotal: processedPresentation.judgeTotal,
            spectatorLikes: processedPresentation.spectatorLikes
          });
        }
        
        return processedPresentation;
      }) as Presentation[];
      
      setPresentations(presentationData);
    } catch (error) {
      console.error('Error loading presentations:', error);
      toast({
        title: "Error",
        description: "Failed to load leaderboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate and sort presentations with scores using judge total
  const rankedPresentations = useMemo(() => {
    // Process presentations to ensure they have valid scores
    const processedPresentations = presentations
      .map(presentation => {
        // Get judge total - pure addition only
        const totalJudgeScore = getJudgeTotal(presentation);
        
        // Add detailed debugging for ALL presentations
        console.log(`Leaderboard processing: ${presentation.title}`, {
          id: presentation.id,
          judgeScores: presentation.judgeScores || [],
          individualScoresBreakdown: `${presentation.judgeScores?.join(" + ")}`,
          calculatedTotal: totalJudgeScore,
          spectatorLikes: presentation.spectatorLikes || 0
        });
        
        // Final score is the judge total score (pure sum)
        const finalScore = totalJudgeScore;
        
        // Format scores with clearer indications for no scores
        const displayJudgeScore = formatScoreDisplay(totalJudgeScore);
        const displayFinalScore = formatScoreDisplay(finalScore);
        const judgeCount = (presentation.judgeScores || []).filter(score => score > 0).length;
        const maxPossibleScore = judgeCount * 25;

        return {
          ...presentation,
          totalJudgeScore,
          spectatorLikes: presentation.spectatorLikes || 0,
          finalScore,
          judgeCount,
          maxPossibleScore,
          displayJudgeScore,
          displayFinalScore,
          hasScores: totalJudgeScore > 0
        };
      })
      .filter(p => {
        if (filter === 'all') return true;
        return p.room === filter;
      });
    
    // Sort presentations by judge total with attendee ratings as tiebreaker
    return sortByJudgeTotal(processedPresentations);
  }, [presentations, filter]);
  
  // Get a list of unique rooms
  const rooms = useMemo(() => {
    const uniqueRooms = new Set<string>();
    presentations.forEach(p => {
      if (p.room) uniqueRooms.add(p.room);
    });
    return Array.from(uniqueRooms).sort();
  }, [presentations]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5 pb-8">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Trophy className="h-8 w-8 text-amber-500" />
              <div>
                <h1 className="text-2xl font-bold">Conference Leaderboard</h1>
                <p className="text-sm text-muted-foreground">ICTAS 2025 Presentation Rankings</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex gap-2">
                <Button 
                  variant={viewMode === 'standard' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setViewMode('standard')}
                >
                  Standard View
                </Button>
                <Button 
                  variant={viewMode === 'detailed' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setViewMode('detailed')}
                >
                  Detailed View
                </Button>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadPresentations}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Trophy className="h-5 w-5 mr-2 text-primary" />
                Complete Leaderboard
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by room" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rooms</SelectItem>
                    {rooms.map(room => (
                      <SelectItem key={room} value={room}>{room}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-secondary/40 text-left">
                    <th className="p-3 whitespace-nowrap">Rank</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Authors</th>
                    <th className="p-3 whitespace-nowrap">Room</th>
                    <th className="p-3 whitespace-nowrap text-center">Judge Total</th>
                    <th className="p-3 whitespace-nowrap text-center">Attendee Ratings</th>
                    <th className="p-3 whitespace-nowrap text-center">Final Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rankedPresentations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        No presentations available
                      </td>
                    </tr>
                  ) : (
                    rankedPresentations.map((presentation, index) => (
                      <tr 
                        key={presentation.id} 
                        className={`
                          hover:bg-muted/40 transition-colors
                          ${index < 3 ? 'bg-amber-50/50' : ''}
                        `}
                      >
                        <td className="p-3 font-medium whitespace-nowrap">
                          <div className="flex items-center">
                            {index === 0 && <Medal className="h-5 w-5 text-yellow-500 mr-1" />}
                            {index === 1 && <Medal className="h-5 w-5 text-slate-400 mr-1" />}
                            {index === 2 && <Medal className="h-5 w-5 text-amber-700 mr-1" />}
                            #{index + 1}
                          </div>
                        </td>
                        <td className="p-3 font-medium">
                          {presentation.title}
                          {viewMode === 'detailed' && presentation.abstract && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {presentation.abstract}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          {presentation.authors.join(', ')}
                        </td>
                        <td className="p-3">
                          <RoomBadge room={presentation.room} />
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center">
                            <div className="font-medium">
                              {presentation.hasScores 
                                ? <ScoreDisplay 
                                    value={presentation.totalJudgeScore} 
                                    maxValue={presentation.maxPossibleScore}
                                    showMax={true} 
                                  />
                                : "-"}
                            </div>
                            {viewMode === 'detailed' && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {presentation.judgeCount > 0 
                                  ? `(${presentation.judgeCount} ${presentation.judgeCount === 1 ? 'judge' : 'judges'})`
                                  : "(No judges yet)"}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center">
                            <ThumbsUp className="h-3 w-3 mr-1 text-accent" />
                            <span className="font-medium">{presentation.spectatorLikes}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary" className="font-bold">
                            <ScoreDisplay 
                              value={presentation.finalScore} 
                              maxValue={presentation.maxPossibleScore}
                              showMax={true} 
                            />
                          </Badge>
                        </td>
                      </tr>
                    ))
                    )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        {/* Legend */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-sm font-medium flex items-center">
                  <Trophy className="h-4 w-4 mr-1 text-primary" />
                  Judge Total
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Sum of all judge scores. Each judge can give up to 25 points total 
                  across all categories. These raw scores are added together for the final score.
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium flex items-center">
                  <ThumbsUp className="h-4 w-4 mr-1 text-accent" />
                  Attendee Ratings
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Total number of ratings from attendees. These do not affect the final score or ranking.
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium flex items-center">
                  <Medal className="h-4 w-4 mr-1 text-amber-500" />
                  Final Score
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Equal to the total judge score - the direct sum of all judge scores without any multiplication or weighting. 
                  Presentations are ranked by this value, with attendee ratings used only as a tiebreaker.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}