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
import { BarChart3, PieChart as PieChartIcon, Download, Users, Trophy, TrendingUp, RefreshCw, Filter, FileText } from 'lucide-react';
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
  const [filterRoom, setFilterRoom] = useState<string>('all');

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
          rank: 0 // Will be set after sorting
        };
      })
      .filter(item => item.judgeTotal > 0) // Only include presentations with judge scores
      .sort((a, b) => b.finalScore - a.finalScore) // Sort by final score descending
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

      // Calculate analytics
      const judges = users.filter(user => user.role === 'judge');
      const spectators = users.filter(user => user.role === 'spectator');

      const roomDistribution = ROOMS.map(room => ({
        room,
        count: presentations.filter(p => p.room === room).length
      }));

      const votingActivity = ROOMS.map(room => {
        const roomPresentations = presentations.filter(p => p.room === room);
        const roomVotes = votes.filter(v => 
          roomPresentations.some(p => p.id === v.presentationId)
        );
        
        const judgeVotes = roomVotes.filter(v => 
          judges.some(j => j.id === v.userId)
        ).length;
        
        const spectatorVotes = roomVotes.filter(v => 
          spectators.some(s => s.id === v.userId)
        ).length;

        return {
          room,
          judgeVotes,
          spectatorVotes
        };
      });

      const analytics = {
        totalPresentations: presentations.length,
        totalVotes: votes.length,
        totalJudges: judges.length,
        totalSpectators: spectators.length,
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
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      await loadReportData();
    } finally {
      setGenerating(false);
    }
  };

  const handleExportData = async () => {
    if (!reportData) return;
    
    setExporting(true);
    try {
      // Export leaderboard
      const leaderboardData = reportData.leaderboard.map(item => ({
        Rank: item.rank,
        Title: item.presentation.title,
        Authors: item.presentation.authors?.join(', ') || '',
        Room: item.presentation.room || '',
        JudgeTotal: item.judgeTotal,
        SpectatorLikes: item.spectatorLikes,
        FinalScore: item.finalScore
      }));
      
      exportToCSV(leaderboardData, 'presentation-leaderboard.csv');
    } finally {
      setExporting(false);
    }
  };

  // Filter leaderboard based on search term and room filter
  const filteredLeaderboard = reportData?.leaderboard.filter(item => {
    const matchesSearch = !searchTerm || 
      item.presentation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.presentation.authors?.some(author => 
        author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesRoom = filterRoom === 'all' || item.presentation.room === filterRoom;
    
    return matchesSearch && matchesRoom;
  }) || [];

  if (loading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p>Loading report data...</p>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">No report data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Reports & Analytics</h2>
          <p className="text-muted-foreground">
            View detailed analytics and voting statistics
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button 
            onClick={handleGenerateReport} 
            disabled={generating}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Generate Report</span>
                <span className="sm:hidden">Generate</span>
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleExportData} 
            disabled={exporting || !reportData}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {exporting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Export Data</span>
                <span className="sm:hidden">Export</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filter by Room:</span>
        </div>
        <select
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
          className="border rounded px-3 py-2 w-full sm:w-48"
        >
          <option value="all">All Rooms</option>
          {ROOMS.map(room => (
            <option key={room} value={room}>{room}</option>
          ))}
        </select>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{reportData.analytics.totalPresentations}</p>
                <p className="text-xs text-muted-foreground">Presentations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{reportData.analytics.totalVotes}</p>
                <p className="text-xs text-muted-foreground">Total Votes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Trophy className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{reportData.analytics.totalJudges}</p>
                <p className="text-xs text-muted-foreground">Judges</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{reportData.analytics.totalSpectators}</p>
                <p className="text-xs text-muted-foreground">Spectators</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leaderboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="leaderboard" className="flex items-center text-xs">
            <Trophy className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Leaderboard</span>
            <span className="sm:hidden">Rankings</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center text-xs">
            <BarChart3 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Analytics</span>
            <span className="sm:hidden">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="room-distribution" className="flex items-center text-xs">
            <PieChartIcon className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Room Distribution</span>
            <span className="sm:hidden">Rooms</span>
          </TabsTrigger>
          <TabsTrigger value="voting-activity" className="flex items-center text-xs">
            <Users className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Voting Activity</span>
            <span className="sm:hidden">Activity</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Trophy className="h-5 w-5 mr-2" />
                  Leaderboard ({filteredLeaderboard.length})
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredLeaderboard.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No presentations found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredLeaderboard.map((item) => (
                    <div key={item.presentation.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="default" className="text-xs">
                              #{item.rank}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              Score: {item.finalScore}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-lg truncate">{item.presentation.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {item.presentation.authors?.join(', ')}
                          </p>
                          {item.presentation.room && (
                            <Badge variant="outline" className="mt-2">
                              {item.presentation.room}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <div className="text-right">
                            <p className="text-sm font-medium">Judge Total</p>
                            <p className="text-lg font-bold text-primary">{item.judgeTotal}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">Spectator Likes</p>
                            <p className="text-lg font-bold text-green-600">{item.spectatorLikes}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Room Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChartIcon className="h-5 w-5 mr-2" />
                  Room Distribution
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
                      label={({ room, percent }) => `${room} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {reportData.analytics.roomDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Voting Activity Chart */}
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
          </div>
        </TabsContent>

        <TabsContent value="room-distribution" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChartIcon className="h-5 w-5 mr-2" />
                Room Distribution Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.analytics.roomDistribution.map((item) => (
                  <div key={item.room} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{item.room}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.count} presentation{item.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {((item.count / reportData.analytics.totalPresentations) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voting-activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Voting Activity Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.analytics.votingActivity.map((item) => (
                  <div key={item.room} className="border rounded p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{item.room}</h3>
                      <Badge variant="secondary">
                        {item.judgeVotes + item.spectatorVotes} total votes
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{item.judgeVotes}</p>
                        <p className="text-sm text-muted-foreground">Judge Votes</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{item.spectatorVotes}</p>
                        <p className="text-sm text-muted-foreground">Spectator Votes</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}