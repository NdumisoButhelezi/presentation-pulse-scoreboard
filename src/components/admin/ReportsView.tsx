import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Presentation, Vote, ROOMS, SpectatorQuestion, SpectatorVote } from '@/types';
import { collection, getDocs } from 'firebase/firestore';
import { db, getSpectatorQuestions, deleteAllVotes, resetAllPresentationScores } from '@/lib/firebase';
import { BarChart3, PieChart as PieChartIcon, Download, Users, Trophy, TrendingUp, RefreshCw, Filter, FileText, Star, ThumbsUp, HelpCircle, AlertCircle, Trash2 } from 'lucide-react';
import { ScoreDisplay, ScoreTableCell } from '@/components/ui/score-display';
import { processTableData, getJudgeTotal, calculateSpectatorTotal, getSpectatorAverageByQuestion } from '@/lib/scores';

interface ReportData {
  presentations: Presentation[];
  votes: Vote[];
  users: any[];
  spectatorQuestions: SpectatorQuestion[];
  spectatorVotes: SpectatorVote[];
  leaderboard: Array<{
    presentation: Presentation;
    judgeTotal: number;
    spectatorTotal: number;
    spectatorLikes: number;
    finalScore: number;
    isAbsent?: boolean; // Add absent tracking
    rank: number;
  }>;
  analytics: {
    totalPresentations: number;
    totalVotes: number;
    totalJudges: number;
    totalSpectators: number;
    totalAbsentPresentations: number; // Add absent count
    absentPresentations: Array<{ // Add absent presentation details
      id: string;
      title: string;
      room: string;
      absentVotes: number;
    }>;
    roomDistribution: Array<{
      room: string;
      count: number;
      absentCount: number; // Add absent count per room
    }>;
    votingActivity: Array<{
      room: string;
      judgeVotes: number;
      spectatorVotes: number;
      absentVotes: number; // Add absent votes per room
    }>;
    spectatorQuestionBreakdown: Array<{
      question: string;
      questionId: string;
      averageRating: number;
      totalResponses: number;
    }>;
    judgeVsSpectatorComparison: Array<{
      presentationId: string;
      presentationTitle: string;
      presentationAuthors: string;
      presentationRoom: string;
      presentationTitleShort: string;
      judgeScore: number;
      spectatorScore: number;
      difference: number;
    }>;
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
  const [deletingVotes, setDeletingVotes] = useState(false);
  const [resettingScores, setResettingScores] = useState(false);

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
        return { id, ...data };
      })) as Presentation[];

      // Load votes
      const votesSnapshot = await getDocs(collection(db, 'votes'));
      const votes = votesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      // Load spectator questions
      const spectatorQuestions = await getSpectatorQuestions();

      // Filter spectator votes
      const spectatorVotes = votes.filter(vote => vote.role === 'spectator') as any[];

      // Load users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => doc.data());

      // Calculate enhanced leaderboard with spectator ratings
      const leaderboard = presentations.map(presentation => {
        const judgeTotal = getJudgeTotal(presentation);
        
        // Calculate spectator total from new rating system
        const presentationSpectatorVotes = spectatorVotes.filter(vote => vote.presentationId === presentation.id);
        const spectatorTotal = calculateSpectatorTotal(presentationSpectatorVotes);
        
        // Check if any judge marked this presentation as absent
        const absentVotes = votes.filter(vote => 
          vote.presentationId === presentation.id && 
          vote.role === 'judge' && 
          vote.isAbsent === true
        );
        const isAbsent = absentVotes.length > 0;
        
        // Keep backward compatibility with simple likes
        const spectatorLikes = presentation.spectatorLikes || 0;
        
        const finalScore = judgeTotal; // Judge score remains primary

        return {
          presentation,
          judgeTotal,
          spectatorTotal,
          spectatorLikes,
          finalScore,
          isAbsent,
          rank: 0 // Will be set after sorting
        };
      })
      .filter(item => item.judgeTotal > 0) // Only include presentations with judge scores
      .sort((a, b) => b.finalScore - a.finalScore) // Sort by final score descending
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

      // Calculate absent presentation analytics
      const absentPresentations = presentations
        .map(presentation => {
          const absentVotes = votes.filter(vote => 
            vote.presentationId === presentation.id && 
            vote.role === 'judge' && 
            vote.isAbsent === true
          );
          
          if (absentVotes.length > 0) {
            return {
              id: presentation.id,
              title: presentation.title,
              room: presentation.room,
              absentVotes: absentVotes.length
            };
          }
          return null;
        })
        .filter(Boolean) as Array<{
          id: string;
          title: string;
          room: string;
          absentVotes: number;
        }>;

      // Calculate analytics
      const judges = users.filter(user => user.role === 'judge');
      const spectators = users.filter(user => user.role === 'spectator');

      const roomDistribution = ROOMS.map(room => ({
        room,
        count: presentations.filter(p => p.room === room).length,
        absentCount: absentPresentations.filter(p => p.room === room).length
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

        const absentVotes = roomVotes.filter(v => 
          v.role === 'judge' && v.isAbsent === true
        ).length;

        return {
          room,
          judgeVotes,
          spectatorVotes,
          absentVotes
        };
      });

      // Calculate spectator question breakdown
      const spectatorQuestionBreakdown = spectatorQuestions.map(question => {
        const questionResponses = spectatorVotes.filter(vote => 
          vote.ratings?.some(rating => rating.questionId === question.id)
        );

        let totalScore = 0;
        let responseCount = 0;

        questionResponses.forEach(vote => {
          const questionRating = vote.ratings?.find(rating => rating.questionId === question.id);
          if (questionRating) {
            totalScore += questionRating.score;
            responseCount++;
          }
        });

        return {
          question: question.question,
          questionId: question.id,
          averageRating: responseCount > 0 ? Math.round((totalScore / responseCount) * 10) / 10 : 0,
          totalResponses: responseCount
        };
      });

      // Calculate judge vs spectator comparison
      const judgeVsSpectatorComparison = presentations
        .filter(p => getJudgeTotal(p) > 0) // Only presentations with judge scores
        .map(presentation => {
          const judgeScore = getJudgeTotal(presentation);
          const presentationSpectatorVotes = spectatorVotes.filter(vote => vote.presentationId === presentation.id);
          const spectatorScore = calculateSpectatorTotal(presentationSpectatorVotes);
          
          // Normalize scores for comparison (judge scores are typically higher)
          const normalizedJudgeScore = judgeScore;
          const normalizedSpectatorScore = spectatorScore;
          
          return {
            presentationId: presentation.id,
            presentationTitle: presentation.title, // Keep full title
            presentationAuthors: presentation.authors?.join(', ') || '',
            presentationRoom: presentation.room,
            presentationTitleShort: presentation.title.length > 25 
              ? presentation.title.substring(0, 25) + '...' 
              : presentation.title, // For chart display only
            judgeScore: normalizedJudgeScore,
            spectatorScore: normalizedSpectatorScore,
            difference: normalizedJudgeScore - normalizedSpectatorScore
          };
        })
        .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
        .slice(0, 10); // Top 10 with biggest differences

      const analytics = {
        totalPresentations: presentations.length,
        totalVotes: votes.length,
        totalJudges: judges.length,
        totalSpectators: spectators.length,
        totalAbsentPresentations: absentPresentations.length,
        absentPresentations,
        roomDistribution,
        votingActivity,
        spectatorQuestionBreakdown,
        judgeVsSpectatorComparison
      };

      setReportData({
        presentations,
        votes,
        users,
        spectatorQuestions,
        spectatorVotes,
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
      // Export enhanced leaderboard with spectator ratings
      const leaderboardData = reportData.leaderboard.map(item => ({
        Rank: item.rank,
        Title: item.presentation.title,
        Authors: item.presentation.authors?.join(', ') || '',
        Room: item.presentation.room || '',
        JudgeTotal: item.judgeTotal,
        SpectatorTotal: item.spectatorTotal,
        SpectatorLikes: item.spectatorLikes,
        FinalScore: item.finalScore,
        Absent: item.isAbsent ? 'Yes' : 'No'
      }));
      
      exportToCSV(leaderboardData, 'presentation-leaderboard-enhanced.csv');

      // Export spectator question breakdown
      exportToCSV(reportData.analytics.spectatorQuestionBreakdown, 'spectator-question-breakdown.csv');

      // Export judge vs spectator comparison with full details
      const comparisonData = reportData.analytics.judgeVsSpectatorComparison.map(comparison => ({
        PresentationTitle: comparison.presentationTitle,
        Authors: comparison.presentationAuthors,
        Room: comparison.presentationRoom,
        JudgeScore: comparison.judgeScore,
        AttendeeScore: comparison.spectatorScore,
        ScoreDifference: comparison.difference,
        AbsoluteDifference: Math.abs(comparison.difference)
      }));
      exportToCSV(comparisonData, 'judge-vs-attendee-comparison-detailed.csv');

      // Export absent presentations
      if (reportData.analytics.absentPresentations.length > 0) {
        exportToCSV(reportData.analytics.absentPresentations, 'absent-presentations.csv');
      }

      // Export room analytics with absent counts
      const roomAnalyticsData = reportData.analytics.roomDistribution.map(room => ({
        Room: room.room,
        TotalPresentations: room.count,
        AbsentPresentations: room.absentCount,
        PercentageAbsent: room.count > 0 ? ((room.absentCount / room.count) * 100).toFixed(1) + '%' : '0%'
      }));
      exportToCSV(roomAnalyticsData, 'room-analytics-with-absent.csv');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAllVotes = async () => {
    if (!window.confirm('Are you sure you want to delete ALL judge and spectator votes? This action cannot be undone.')) return;
    setDeletingVotes(true);
    try {
      await deleteAllVotes();
      alert('All votes have been deleted.');
      loadReportData();
    } catch (error) {
      alert('Error deleting votes. Check console for details.');
      console.error(error);
    } finally {
      setDeletingVotes(false);
    }
  };

  const handleResetAllScores = async () => {
    if (!window.confirm('Are you sure you want to reset ALL judge and spectator scores for all presentations? This action cannot be undone.')) return;
    setResettingScores(true);
    try {
      await resetAllPresentationScores();
      alert('All presentation scores have been reset.');
      loadReportData();
    } catch (error) {
      alert('Error resetting scores. Check console for details.');
      console.error(error);
    } finally {
      setResettingScores(false);
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
            View detailed analytics including spectator rating insights
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
          <Button
            onClick={handleDeleteAllVotes}
            disabled={deletingVotes}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            {deletingVotes ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Deleting Votes...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Votes
              </>
            )}
          </Button>
          <Button
            onClick={handleResetAllScores}
            disabled={resettingScores}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            {resettingScores ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Reset Scores...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Reset All Scores
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
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
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="leaderboard" className="flex items-center text-xs">
            <Trophy className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Leaderboard</span>
            <span className="sm:hidden">Rankings</span>
          </TabsTrigger>
          <TabsTrigger value="spectator-ratings" className="flex items-center text-xs">
            <Star className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Attendee Ratings</span>
            <span className="sm:hidden">Ratings</span>
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center text-xs">
            <BarChart3 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Judge vs Attendee</span>
            <span className="sm:hidden">Compare</span>
          </TabsTrigger>
          <TabsTrigger value="absent-analytics" className="flex items-center text-xs">
            <AlertCircle className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Absent Presentations</span>
            <span className="sm:hidden">Absent</span>
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
                  Enhanced Leaderboard ({filteredLeaderboard.length})
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
                  {filteredLeaderboard.map(item => (
                    <div key={item.presentation.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="default" className="text-xs">
                              #{item.rank}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              Final Score: {item.finalScore}
                            </Badge>
                            {item.isAbsent && (
                              <Badge variant="destructive" className="text-xs">
                                Absent
                              </Badge>
                            )}
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
                            <p className="text-sm font-medium">Spectator Rating Total</p>
                            <p className="text-lg font-bold text-green-600">{item.spectatorTotal}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">Legacy Likes</p>
                            <p className="text-lg font-bold text-blue-600">{item.spectatorLikes}</p>
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

        <TabsContent value="spectator-ratings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendee Question Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Star className="h-5 w-5 mr-2" />
                  Attendee Question Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reportData.analytics.spectatorQuestionBreakdown.length === 0 ? (
                  <div className="text-center py-8">
                    <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No spectator ratings data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.analytics.spectatorQuestionBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="question" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis domain={[0, 5]} />
                      <Tooltip 
                        formatter={(value, name) => [
                          `${value} avg rating`, 
                          'Average Rating'
                        ]}
                        labelFormatter={(label) => `Question: ${label}`}
                      />
                      <Bar dataKey="averageRating" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Spectator Response Volume */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ThumbsUp className="h-5 w-5 mr-2" />
                  Response Volume by Question
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reportData.analytics.spectatorQuestionBreakdown.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No response data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.analytics.spectatorQuestionBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="question" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => [
                          `${value} responses`, 
                          'Total Responses'
                        ]}
                        labelFormatter={(label) => `Question: ${label}`}
                      />
                      <Bar dataKey="totalResponses" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Question Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Question Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.analytics.spectatorQuestionBreakdown.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No attendee rating questions configured yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reportData.analytics.spectatorQuestionBreakdown.map((questionData) => (
                    <div key={questionData.questionId} className="border rounded p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{questionData.question}</h3>
                        <Badge variant="secondary">
                          {questionData.totalResponses} responses
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {questionData.averageRating}/5
                          </p>
                          <p className="text-sm text-muted-foreground">Average Rating</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {questionData.totalResponses}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Responses</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Judge vs Spectator Score Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.analytics.judgeVsSpectatorComparison.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No comparison data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={reportData.analytics.judgeVsSpectatorComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="presentationTitleShort" 
                      angle={-45}
                      textAnchor="end"
                      height={120}
                      interval={0}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [value, name === 'judgeScore' ? 'Judge Score' : 'Attendee Score']}
                      labelFormatter={(label) => {
                        const item = reportData.analytics.judgeVsSpectatorComparison.find(
                          comparison => comparison.presentationTitleShort === label
                        );
                        return item ? `${item.presentationTitle} (${item.presentationRoom})` : label;
                      }}
                    />
                    <Bar dataKey="judgeScore" fill="#8884d8" name="Judge Score" />
                    <Bar dataKey="spectatorScore" fill="#82ca9d" name="Attendee Score" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Detailed Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Score Difference Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.analytics.judgeVsSpectatorComparison.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No comparison data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">Presentation Details</TableHead>
                      <TableHead className="text-right">Judge Score</TableHead>
                      <TableHead className="text-right">Attendee Score</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.analytics.judgeVsSpectatorComparison.map((comparison, index) => (
                      <TableRow key={comparison.presentationId}>
                        <TableCell className="max-w-0">
                          <div className="space-y-1">
                            <div className="font-medium text-sm leading-tight">
                              {comparison.presentationTitle}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <div>Authors: {comparison.presentationAuthors || 'Not specified'}</div>
                              <div>Room: {comparison.presentationRoom}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{comparison.judgeScore}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{comparison.spectatorScore}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={comparison.difference > 0 ? "default" : "destructive"}
                          >
                            {comparison.difference > 0 ? '+' : ''}{comparison.difference}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Existing tabs with minor updates */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Summary Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{reportData.analytics.totalPresentations}</div>
                <p className="text-xs text-muted-foreground">Total Presentations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{reportData.analytics.totalVotes}</div>
                <p className="text-xs text-muted-foreground">Total Votes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{reportData.analytics.totalAbsentPresentations}</div>
                <p className="text-xs text-muted-foreground">Absent Presentations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {((reportData.analytics.totalPresentations - reportData.analytics.totalAbsentPresentations) / reportData.analytics.totalPresentations * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Attendance Rate</p>
              </CardContent>
            </Card>
          </div>

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

        <TabsContent value="absent-analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                Absent Presentations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.analytics.absentPresentations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No presentations were marked as absent.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reportData.analytics.absentPresentations.map((absentPresentation) => (
                    <div key={absentPresentation.id} className="border rounded p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{absentPresentation.title}</h3>
                        <Badge variant="destructive">
                          {absentPresentation.absentVotes} absent votes
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Room: {absentPresentation.room}, Presentation ID: {absentPresentation.id}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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