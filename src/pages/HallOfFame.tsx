import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Star, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Presentation, Vote, ROOMS } from '@/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getJudgeTotal, getSafeScore, ensureValidScores, processPresenterData } from '@/lib/scores';
import { ScoreDisplay } from '@/components/ui/score-display';

interface LeaderboardEntry {
  presentation: Presentation;
  judgeTotal: number; // Changed from avgJudgeScore
  spectatorLikes: number;
  finalScore: number;
  rank: number;
}

export function HallOfFame() {
  const navigate = useNavigate();
  // Fix the type to match what we're storing - an array of entries per room
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [overallLeaderboard, setOverallLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboards();
  }, []);

  const loadLeaderboards = async () => {
    try {
      const presentationsSnapshot = await getDocs(collection(db, 'presentations'));
      const presentations = presentationsSnapshot.docs.map(doc => {
        // Use our utility function to ensure valid scores
        return ensureValidScores({
          id: doc.id,
          ...doc.data()
        });
      }) as Presentation[];

      // Calculate scores for each presentation
      const leaderboardEntries: LeaderboardEntry[] = presentations.map(presentation => {
        // Get judge total using our utility function
        const judgeTotal = getJudgeTotal(presentation);
        
        // Spectator likes is simple
        const spectatorLikes = presentation.spectatorLikes || 0;
        
        // Final score is equal to the judge total (sum of judge scores)
        const finalScore = judgeTotal;

        return {
          presentation,
          judgeTotal,
          spectatorLikes,
          finalScore,
          rank: 0 // Will be set after sorting
        };
      });

      // Sort by final score (judge total) and assign ranks
      const sortedEntries = leaderboardEntries
        .sort((a, b) => {
          // Primary sort by judge total
          if (b.finalScore !== a.finalScore) {
            return b.finalScore - a.finalScore;
          }
          // Use spectator likes as a tiebreaker only
          return b.spectatorLikes - a.spectatorLikes;
        });
      
      sortedEntries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      setOverallLeaderboard(sortedEntries);

      // Create room-specific leaderboards
      const roomLeaderboards: Record<string, LeaderboardEntry[]> = {};
      ROOMS.forEach(room => {
        const roomEntries = sortedEntries.filter(entry => entry.presentation.room === room);
        roomEntries.forEach((entry, index) => {
          entry.rank = index + 1;
        });
        roomLeaderboards[room] = roomEntries;
      });

      setLeaderboards(roomLeaderboards);
    } catch (error) {
      console.error('Error loading leaderboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <Star className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getRankBadgeVariant = (rank: number) => {
    switch (rank) {
      case 1:
        return "default";
      case 2:
        return "secondary";
      case 3:
        return "outline";
      default:
        return "outline";
    }
  };

  const LeaderboardTable = ({ entries }: { entries: LeaderboardEntry[] }) => (
    <div className="space-y-3">
      {entries.slice(0, 10).map((entry) => (
        <Card key={entry.presentation.id} className={`transition-all duration-200 ${
          entry.rank <= 3 ? 'border-primary/30 bg-primary/5' : ''
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {getRankIcon(entry.rank)}
                  <Badge variant={getRankBadgeVariant(entry.rank)}>
                    #{entry.rank}
                  </Badge>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{entry.presentation.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {entry.presentation.authors.join(', ')}
                  </p>
                  <div className="flex items-center space-x-4 mt-2">
                    <Badge variant="outline">{entry.presentation.room}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {entry.presentation.sessionDate} • {entry.presentation.startTime}-{entry.presentation.endTime}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-2xl font-bold text-primary">
                  <ScoreDisplay 
                    value={entry.finalScore} 
                    maxValue={entry.presentation.judgeScores?.filter(score => score > 0).length * 25 || 0}
                    showMax={true}
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Judge Total: <ScoreDisplay 
                    value={entry.judgeTotal} 
                    maxValue={entry.presentation.judgeScores?.filter(score => score > 0).length * 25 || 0}
                    showMax={true}
                  /></div>
                  <div className="flex items-center">
                    <Users className="h-3 w-3 mr-1" />
                    {entry.spectatorLikes} likes
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Trophy className="h-12 w-12 animate-pulse text-primary mx-auto" />
          <p className="text-muted-foreground">Loading Hall of Fame...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Trophy className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Hall of Fame</h1>
                <p className="text-sm text-muted-foreground">ICTAS 2025 Top Presentations</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Top 3 Overall */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="h-6 w-6 mr-2 text-yellow-500" />
              Top 3 Overall Winners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {overallLeaderboard.slice(0, 3).map((entry, index) => (
                <Card key={entry.presentation.id} className={`${
                  index === 0 ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' :
                  index === 1 ? 'border-gray-400 bg-gray-50 dark:bg-gray-950/20' :
                  'border-amber-600 bg-amber-50 dark:bg-amber-950/20'
                }`}>
                  <CardContent className="p-4 text-center">
                    <div className="mb-3">
                      {getRankIcon(entry.rank)}
                    </div>
                    <h3 className="font-semibold mb-2">{entry.presentation.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {entry.presentation.authors.join(', ')}
                    </p>
                    <div className="text-2xl font-bold text-primary mb-2">
                      <ScoreDisplay 
                        value={entry.finalScore} 
                        maxValue={entry.presentation.judgeScores?.filter(score => score > 0).length * 25 || 0}
                        showMax={true}
                      />
                    </div>
                    <Badge variant="outline">{entry.presentation.room}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overall" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overall">Overall</TabsTrigger>
            {ROOMS.map(room => (
              <TabsTrigger key={room} value={room}>{room}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overall" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Overall Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <LeaderboardTable entries={overallLeaderboard} />
              </CardContent>
            </Card>
          </TabsContent>

          {ROOMS.map(room => (
            <TabsContent key={room} value={room} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{room} Room Leaderboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <LeaderboardTable entries={leaderboards[room] ?? []} />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}