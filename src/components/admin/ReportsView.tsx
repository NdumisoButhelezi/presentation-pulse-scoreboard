import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Presentation, Vote, ROOMS } from '@/types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BarChart3, PieChart as PieChartIcon, Download, Users, Trophy, TrendingUp, RefreshCw } from 'lucide-react';
import { ScoreDisplay, ScoreTableCell } from '@/components/ui/score-display';
import { processTableData, getJudgeTotal } from '@/lib/scores';

interface ReportData {
  presentations: Presentation[];
  votes: Vote[];
  leaderboard: Array<{
    presentation: Presentation;
    judgeTotal: number; // Changed from avgJudgeScore to judgeTotal
    spectatorLikes: number;
    finalScore: number;
    rank: number;
  }>;
  analytics: {
    totalPresentations: number;
    totalVotes: number;
    totalJudges: number;
    totalSpectators: number;
    roomDistribution: Array<{ room: string; count: number }>;
    votingActivity: Array<{ room: string; judgeVotes: number; spectatorVotes: number }>;
  };
}

interface ReportsViewProps {
  searchTerm?: string;
}

export function ReportsView({ searchTerm = '' }: ReportsViewProps) {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    try {
      // Load presentations
      const presentationsSnapshot = await getDocs(collection(db, 'presentations'));
      const presentations = processTableData(presentationsSnapshot.docs.map(doc => {
        const data = doc.data();
        const id = doc.id;
        
        // Add debug for specific presentation
        if (data.title?.includes("Performance Analysis")) {
          console.log("Loading target presentation in ReportsView:", {
            id,
            title: data.title,
            judgeScores: data.judgeScores,
            rawSum: Array.isArray(data.judgeScores) ? 
              data.judgeScores.reduce((sum: number, score: number) => sum + score, 0) : 
              'No scores'
          });
        }
        
        return { id, ...data };
      })) as Presentation[];

      // Load votes
      const votesSnapshot = await getDocs(collection(db, 'votes'));
      const votes = votesSnapshot.docs.map(doc => doc.data() as Vote);

      // Load users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => doc.data());

      // Calculate leaderboard using Judge Total - pure addition only
      const leaderboard = presentations.map(presentation => {
        // Get judge total score - pure sum of all judge scores
        const judgeTotal = getJudgeTotal(presentation);
        const spectatorLikes = presentation.spectatorLikes || 0;
        
        // Final score is equal to the judge total (pure sum)
        const finalScore = judgeTotal;

        // Add debug
        if (presentation.title?.includes("Performance Analysis")) {
          console.log("Processing target presentation in leaderboard:", {
            id: presentation.id, 
            title: presentation.title,
            judgeScores: presentation.judgeScores,
            judgeTotal,
            finalScore,
            calculation: `Sum of ${presentation.judgeScores?.join(" + ")} = ${judgeTotal}`
          });
        }

        return {
          presentation,
          judgeTotal,
          spectatorLikes,
          finalScore,
          rank: 0
        };
      }).sort((a, b) => b.finalScore - a.finalScore)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      // Calculate analytics
      const roomDistribution = ROOMS.map(room => ({
        room,
        count: presentations.filter(p => p.room === room).length
      }));

      const votingActivity = ROOMS.map(room => {
        const roomPresentations = presentations.filter(p => p.room === room);
        const roomVotes = votes.filter(v => 
          roomPresentations.some(p => p.id === v.presentationId)
        );
        
        return {
          room,
          judgeVotes: roomVotes.filter(v => v.role === 'judge').length,
          spectatorVotes: roomVotes.filter(v => v.role === 'spectator').length
        };
      });

      const analytics = {
        totalPresentations: presentations.length,
        totalVotes: votes.length,
        totalJudges: users.filter(u => u.role === 'judge').length,
        totalSpectators: users.filter(u => u.role === 'spectator').length,
        roomDistribution,
        votingActivity
      };

      setReportData({
        presentations,
        votes,
        leaderboard,
        analytics
      });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

  // Filter presentations based on search term
  const filteredPresentations = reportData?.presentations.filter(presentation => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      presentation.title.toLowerCase().includes(searchLower) ||
      presentation.authors.some(author => author.toLowerCase().includes(searchLower)) ||
      presentation.room.toLowerCase().includes(searchLower)
    );
  }) || [];

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      // Simulate report generation logic
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
      // TODO: Implement actual report generation logic
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      // Simulate data export logic
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing
      // TODO: Implement actual data export logic
    } catch (error) {
      console.error('Error exporting data:', error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <BarChart3 className="h-6 w-6 animate-pulse text-primary" />
        <span className="ml-2">Loading reports...</span>
      </div>
    );
  }

  if (!reportData) {
    return <div>No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Search Results Info */}
      {searchTerm && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800">
              Reports filtered for {filteredPresentations.length} presentations matching "{searchTerm}"
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions with Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Report Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Button 
              onClick={handleGenerateReport}
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate Full Report
                </>
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleExportData}
              disabled={exporting}
              className="w-full"
            >
              {exporting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Exporting Data...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </>
              )}
            </Button>
          </div>

          {/* Progress indicators */}
          {(generating || exporting) && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-800">
                    {generating ? 'Generating comprehensive report...' : 'Preparing data export...'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Presentations</p>
                <p className="text-2xl font-bold">{reportData.analytics.totalPresentations}</p>
              </div>
              <Trophy className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Votes</p>
                <p className="text-2xl font-bold">{reportData.analytics.totalVotes}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Judges</p>
                <p className="text-2xl font-bold">{reportData.analytics.totalJudges}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Spectators</p>
                <p className="text-2xl font-bold">{reportData.analytics.totalSpectators}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="charts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="charts">Charts & Analytics</TabsTrigger>
          <TabsTrigger value="leaderboard">Detailed Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Room Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChartIcon className="h-5 w-5 mr-2" />
                  Presentations by Room
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={reportData.analytics.roomDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ room, count }) => `${room}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {reportData.analytics.roomDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Voting Activity by Room */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Voting Activity by Room
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.analytics.votingActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="room" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="judgeVotes" fill="#8884d8" name="Judge Votes" />
                    <Bar dataKey="spectatorVotes" fill="#82ca9d" name="Spectator Votes" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Presentations */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Top 10 Presentations by Final Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={reportData.leaderboard.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="presentation.title" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      interval={0}
                      fontSize={10}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [Number(value).toFixed(2), name]}
                      labelFormatter={(label) => `Presentation: ${label}`}
                    />
                    <Bar dataKey="finalScore" fill="#8884d8" name="Final Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Complete Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Authors</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead className="text-right">Judge Total</TableHead> {/* Changed from Judge Avg */}
                    <TableHead className="text-right">Spectator Likes</TableHead>
                    <TableHead className="text-right">Final Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.leaderboard.map((entry) => (
                    <TableRow key={entry.presentation.id}>
                      <TableCell className="font-medium">
                        <Badge variant={
                          entry.rank === 1 ? "default" :
                          entry.rank === 2 ? "secondary" :
                          entry.rank === 3 ? "outline" : "outline"
                        }>
                          #{entry.rank}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-xs">
                        <div className="truncate" title={entry.presentation.title}>
                          {entry.presentation.title}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={entry.presentation.authors.join(', ')}>
                          {entry.presentation.authors.join(', ')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.presentation.room}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ScoreDisplay value={entry.judgeTotal} />
                      </TableCell>
                      <TableCell className="text-right">{entry.spectatorLikes}</TableCell>
                      <TableCell className="text-right font-bold">
                        <ScoreDisplay value={entry.finalScore} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Presentation Scores - Filtered */}
      <Card>
        <CardHeader>
          <CardTitle>
            Presentation Scores
            {searchTerm && ` (filtered: ${filteredPresentations.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Authors</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="text-right">Judge Total</TableHead> {/* Changed from Judge Avg */}
                <TableHead className="text-right">Spectator Likes</TableHead>
                <TableHead className="text-right">Final Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPresentations.map((presentation, index) => {
                const entry = reportData.leaderboard.find(e => e.presentation.id === presentation.id);
                return (
                  <TableRow key={presentation.id}>
                    <TableCell className="font-medium">
                      <Badge variant={
                        entry?.rank === 1 ? "default" :
                        entry?.rank === 2 ? "secondary" :
                        entry?.rank === 3 ? "outline" : "outline"
                      }>
                        #{entry?.rank}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-xs">
                      <div className="truncate" title={presentation.title}>
                        {presentation.title}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={presentation.authors.join(', ')}>
                        {presentation.authors.join(', ')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{presentation.room}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ScoreDisplay value={entry?.judgeTotal} />
                    </TableCell>
                    <TableCell className="text-right">{entry?.spectatorLikes}</TableCell>
                    <TableCell className="text-right font-bold">
                      <ScoreDisplay value={entry?.finalScore} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}