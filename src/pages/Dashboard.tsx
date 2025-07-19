import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PresentationCard } from '@/components/presentations/PresentationCard';
import { useAuth } from '@/contexts/AuthContext';
import { Presentation, ROOMS, Vote } from '@/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, Filter, Trophy, Users, LogOut, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function Dashboard() {
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');

  useEffect(() => {
    loadPresentations();
    if (currentUser) {
      loadUserVotes();
    }
  }, [currentUser]);

  const loadPresentations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'presentations'));
      const presentationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Presentation[];

      // Load vote data for each presentation
      const presentationsWithVotes = await Promise.all(
        presentationData.map(async (presentation) => {
          const votesSnapshot = await getDocs(
            query(collection(db, 'votes'), where('presentationId', '==', presentation.id))
          );
          
          const votes = votesSnapshot.docs.map(doc => doc.data() as Vote);
          const judgeScores = votes.filter(v => v.role === 'judge').map(v => v.score);
          const spectatorLikes = votes.filter(v => v.role === 'spectator').length;
          
          return {
            ...presentation,
            judgeScores,
            spectatorLikes
          };
        })
      );

      setPresentations(presentationsWithVotes);
    } catch (error) {
      console.error('Error loading presentations:', error);
      toast({
        title: "Error",
        description: "Failed to load presentations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserVotes = async () => {
    if (!currentUser) return;

    try {
      const snapshot = await getDocs(
        query(collection(db, 'votes'), where('userId', '==', currentUser.id))
      );
      
      const votes: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const vote = doc.data() as Vote;
        votes[vote.presentationId] = vote.score;
      });
      
      setUserVotes(votes);
    } catch (error) {
      console.error('Error loading user votes:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredPresentations = presentations.filter(presentation => {
    const matchesSearch = presentation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         presentation.authors.some(author => author.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRoom = selectedRoom === 'all' || presentation.room === selectedRoom;
    return matchesSearch && matchesRoom;
  });

  const presentationsByRoom = ROOMS.reduce((acc, room) => {
    acc[room] = filteredPresentations.filter(p => p.room === room);
    return acc;
  }, {} as Record<string, Presentation[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading presentations...</p>
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
                <h1 className="text-2xl font-bold">Presentation Pulse</h1>
                <p className="text-sm text-muted-foreground">Real-time Scoring Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-medium">{currentUser?.name}</p>
                <p className="text-sm text-muted-foreground capitalize flex items-center">
                  {currentUser?.role === 'judge' ? (
                    <Trophy className="h-4 w-4 mr-1" />
                  ) : (
                    <Users className="h-4 w-4 mr-1" />
                  )}
                  {currentUser?.role}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filter Presentations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search presentations or authors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {ROOMS.map(room => (
                    <SelectItem key={room} value={room}>{room}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={loadPresentations}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Presentations */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({filteredPresentations.length})</TabsTrigger>
            {ROOMS.map(room => (
              <TabsTrigger key={room} value={room}>
                {room} ({presentationsByRoom[room].length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {filteredPresentations.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No presentations found matching your criteria.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredPresentations.map(presentation => (
                  <PresentationCard
                    key={presentation.id}
                    presentation={presentation}
                    userVote={userVotes[presentation.id]}
                    hasVoted={!!userVotes[presentation.id]}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {ROOMS.map(room => (
            <TabsContent key={room} value={room} className="space-y-4">
              <div className="grid gap-4">
                {presentationsByRoom[room].map(presentation => (
                  <PresentationCard
                    key={presentation.id}
                    presentation={presentation}
                    userVote={userVotes[presentation.id]}
                    hasVoted={!!userVotes[presentation.id]}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}