import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Clock, RefreshCw, Download, Filter, Search, AlertCircle, TrendingUp, ChevronDown, ChevronRight, History, Plus, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import React from 'react'; // Added for React.Fragment
import { User } from '@/types';
import { DEFAULT_SCORING_CATEGORIES } from '@/lib/scoringConfig';

interface VoteAuditEntry {
  id: string;
  userId: string;
  presentationId: string;
  presentationTitle?: string;
  role: string;
  totalScore: number;
  timestamp: any;
  updatedAt?: any;
  ratings?: any[];
  history?: any[]; // New field for history
  historyCount: number; // New field for history count
  isUpdate?: boolean;
  isAbsent?: boolean; // New field for absent status
}

interface VoteAuditViewProps {
  searchTerm?: string;
}

export function VoteAuditView({ searchTerm = '' }: VoteAuditViewProps) {
  const [votes, setVotes] = useState<VoteAuditEntry[]>([]);
  const [presentations, setPresentations] = useState<Record<string, any>>({});
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'updated' | 'recent'>('all');
  const [filterRole, setFilterRole] = useState<'all' | 'judge' | 'spectator'>('all');
  const [filterDate, setFilterDate] = useState('');
  const [expandedVotes, setExpandedVotes] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadVoteAuditData();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersMap: Record<string, User> = {};
      usersSnapshot.docs.forEach(doc => {
        usersMap[doc.id] = { id: doc.id, ...doc.data() } as User;
      });
      setUsers(usersMap);
    } catch (error) {
      // Optionally handle error
    }
  };

  const loadVoteAuditData = async () => {
    setLoading(true);
    try {
      // Load all presentations for reference
      const presentationsSnapshot = await getDocs(collection(db, 'presentations'));
      const presentationsMap: Record<string, any> = {};
      presentationsSnapshot.docs.forEach(doc => {
        presentationsMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setPresentations(presentationsMap);

      // Load all votes
      const votesSnapshot = await getDocs(collection(db, 'votes'));
      const voteData: VoteAuditEntry[] = votesSnapshot.docs.map(doc => {
        const data = doc.data();
        const presentation = presentationsMap[data.presentationId];
        
        // Get history information
        const history = data.history && Array.isArray(data.history) ? data.history : [];
        const hasHistory = history.length > 0;
        
        // Determine if this is an update (multiple history entries or legacy updatedAt)
        const isUpdate = hasHistory ? history.length > 1 : 
          !!(data.updatedAt && data.timestamp && data.updatedAt !== data.timestamp);
        
        return {
          id: doc.id,
          userId: data.userId,
          presentationId: data.presentationId,
          presentationTitle: presentation?.title || 'Unknown Presentation',
          role: data.role,
          totalScore: data.totalScore || data.score || 0,
          timestamp: data.timestamp,
          updatedAt: data.updatedAt,
          ratings: data.ratings,
          history: history,
          historyCount: hasHistory ? history.length : (isUpdate ? 2 : 1),
          isUpdate,
          isAbsent: data.isAbsent // Add isAbsent field
        };
      });

      setVotes(voteData);
    } catch (error) {
      console.error('Error loading vote audit data:', error);
      toast({
        title: "Error",
        description: "Failed to load vote audit data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Not recorded';
    
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return 'Invalid timestamp';
    }
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const toggleVoteExpansion = (voteId: string) => {
    const newExpanded = new Set(expandedVotes);
    if (newExpanded.has(voteId)) {
      newExpanded.delete(voteId);
    } else {
      newExpanded.add(voteId);
    }
    setExpandedVotes(newExpanded);
  };

  const getHistoryFromVote = (vote: VoteAuditEntry) => {
    if (vote.history && Array.isArray(vote.history)) {
      return vote.history.sort((a: any, b: any) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return aTime.getTime() - bTime.getTime();
      });
    }
    
    // Legacy support
    const legacyHistory = [];
    if (vote.timestamp) {
      legacyHistory.push({
        timestamp: vote.timestamp,
        action: 'created',
        totalScore: vote.totalScore,
        ratings: vote.ratings
      });
    }
    if (vote.updatedAt && vote.updatedAt !== vote.timestamp) {
      legacyHistory.push({
        timestamp: vote.updatedAt,
        action: 'updated',
        totalScore: vote.totalScore,
        ratings: vote.ratings
      });
    }
    return legacyHistory;
  };

  const exportAuditData = () => {
    if (!votes.length) return;
    
    // Include complete history for each vote
    const exportData = votes.map(vote => {
      const history = getHistoryFromVote(vote);
      return {
        voteId: vote.id,
        userId: vote.userId,
        presentationId: vote.presentationId,
        presentationTitle: vote.presentationTitle,
        role: vote.role,
        currentScore: vote.totalScore,
        originalSubmitTime: formatTimestamp(vote.timestamp),
        lastUpdateTime: vote.updatedAt ? formatTimestamp(vote.updatedAt) : 'Not updated',
        totalHistoryEntries: history.length,
        isUpdated: vote.isUpdate,
        completeHistory: history.map((entry, index) => ({
          entryNumber: index + 1,
          timestamp: formatTimestamp(entry.timestamp),
          action: entry.action,
          totalScore: entry.totalScore,
          previousScore: entry.previousScore || 'N/A',
          individualRatings: entry.ratings?.map((r: any) => ({
            category: r.categoryId || r.questionId || 'Unknown',
            score: r.score
          })) || []
        }))
      };
    });
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complete-vote-audit-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export Complete",
      description: `Exported complete history for ${votes.length} votes`,
    });
  };

  // CSV Export Function
  const exportAuditCsv = () => {
    if (!filteredVotes.length) return;
    // Per-question columns
    const questionColumns = DEFAULT_SCORING_CATEGORIES.map(cat => cat.name);
    const headers = [
      'userName',
      'presentationTitle',
      'totalScore',
      'originalSubmitTime',
      'lastUpdateTime',
      'isUpdate',
      'isAbsent',
      ...questionColumns
    ];
    const rows = filteredVotes.map(vote => {
      // Map category id to score for this vote
      const ratingMap = (vote.ratings || []).reduce((acc, rating) => {
        acc[rating.categoryId] = rating.score;
        return acc;
      }, {} as Record<string, number>);
      return [
        users[vote.userId]?.name || vote.userId || 'Unknown User',
        vote.presentationTitle?.replace(/\n|\r|,/g, ' '),
        vote.totalScore,
        formatTimestamp(vote.timestamp),
        vote.updatedAt ? formatTimestamp(vote.updatedAt) : 'Not updated',
        vote.isUpdate ? 'Yes' : 'No',
        vote.isAbsent ? 'Yes' : 'No',
        ...DEFAULT_SCORING_CATEGORIES.map(cat => ratingMap[cat.id] ?? '')
      ];
    });
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote-audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'CSV Export Complete',
      description: `Exported ${filteredVotes.length} votes to CSV`,
    });
  };

  // Filter votes based on current filters
  const filteredVotes = votes
    .filter(vote => {
      // Search filter
      const matchesSearch = !searchTerm || 
        vote.presentationTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vote.userId.toLowerCase().includes(searchTerm.toLowerCase());

      // Type filter
      const matchesType = filterType === 'all' || 
        (filterType === 'updated' && vote.isUpdate) ||
        (filterType === 'recent' && vote.timestamp && 
          new Date(vote.timestamp.toDate ? vote.timestamp.toDate() : vote.timestamp) > 
          new Date(Date.now() - 24 * 60 * 60 * 1000));

      // Role filter
      const matchesRole = filterRole === 'all' || vote.role === filterRole;

      // Date filter
      const matchesDate = !filterDate || 
        (vote.timestamp && 
          formatTimestamp(vote.timestamp).includes(filterDate));

      return matchesSearch && matchesType && matchesRole && matchesDate;
    })
    .sort((a, b) => {
      // Sort by most recent activity
      const aTime = a.updatedAt || a.timestamp;
      const bTime = b.updatedAt || b.timestamp;
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      
      const aDate = aTime.toDate ? aTime.toDate() : new Date(aTime);
      const bDate = bTime.toDate ? bTime.toDate() : new Date(bTime);
      return bDate.getTime() - aDate.getTime();
    });

  const updateCount = votes.filter(v => v.isUpdate).length;
  const recentCount = votes.filter(v => 
    v.timestamp && new Date(v.timestamp.toDate ? v.timestamp.toDate() : v.timestamp) > 
    new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading vote audit data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{votes.length}</p>
                <p className="text-xs text-muted-foreground">Total Votes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-2xl font-bold">{updateCount}</p>
                <p className="text-xs text-muted-foreground">Updated Votes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{recentCount}</p>
                <p className="text-xs text-muted-foreground">Last 24 Hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {updateCount > 0 ? Math.round((updateCount / votes.length) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Update Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Audit Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Vote Audit Trail
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadVoteAuditData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportAuditData}
                disabled={!votes.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportAuditCsv}
                disabled={!filteredVotes.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            <Select value={filterType} onValueChange={(value) => setFilterType(value as 'all' | 'updated' | 'recent')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Votes</SelectItem>
                <SelectItem value="updated">Updated Only</SelectItem>
                <SelectItem value="recent">Last 24h</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterRole} onValueChange={(value) => setFilterRole(value as 'all' | 'judge' | 'spectator')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="judge">Judges</SelectItem>
                <SelectItem value="spectator">Attendees</SelectItem>
              </SelectContent>
            </Select>
            
            <Input
              placeholder="Search date..."
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judge/User ID</TableHead>
                  <TableHead>Presentation</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Original Submit</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>History Count</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No vote data found matching current filters</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVotes.map((vote) => {
                    const isExpanded = expandedVotes.has(vote.id);
                    const history = getHistoryFromVote(vote);
                    const hasMultipleEntries = history.length > 1;
                    // Get latest ratings (from main vote object)
                    const latestRatings = vote.ratings;
                    return (
                      <React.Fragment key={vote.id}>
                        <TableRow className={vote.isUpdate ? "bg-yellow-50" : ""}>
                          <TableCell className="font-mono text-xs">
                            <div className="flex flex-col items-start gap-1">
                              <div className="flex items-center gap-2">
                                <span>{users[vote.userId]?.name || 'Unknown User'}</span>
                                <Badge variant="secondary" className="text-xxs">{vote.userId?.substring(0, 8)}...</Badge>
                                {vote.isUpdate && (
                                  <Badge variant="outline" className="text-xs bg-yellow-100">
                                    Updated
                                  </Badge>
                                )}
                                {vote.isAbsent && (
                                  <Badge variant="destructive" className="text-xs">
                                    Absent
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate text-sm">{vote.presentationTitle}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={vote.role === 'judge' ? 'default' : 'secondary'}>
                              {vote.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-bold">{vote.totalScore}</span>
                              {/* Per-question ratings always visible for judges */}
                              {vote.role === 'judge' && latestRatings && Array.isArray(latestRatings) && latestRatings.length > 0 && (
                                <div className="mt-1 p-1 bg-white rounded border">
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                                    {latestRatings.map((rating: any, idx: number) => {
                                      const category = DEFAULT_SCORING_CATEGORIES.find(cat => cat.id === rating.categoryId);
                                      return (
                                        <div key={idx} className="flex items-center justify-between p-1 bg-gray-50 rounded text-xs">
                                          <span className="font-medium text-gray-700">
                                            {category ? category.name : rating.categoryId}:
                                          </span>
                                          <Badge variant="secondary" className="text-xs">
                                            {rating.score}
                                          </Badge>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>{formatTimestamp(vote.timestamp)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {vote.isUpdate ? (
                              <div className="flex items-center gap-1">
                                <RefreshCw className="h-3 w-3 text-amber-600" />
                                <span className="text-amber-700 font-medium">
                                  {formatTimestamp(vote.updatedAt)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not updated</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={vote.isUpdate ? "destructive" : "default"} className="text-xs">
                              {vote.isUpdate ? "Updated" : "Original"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {vote.historyCount}
                          </TableCell>
                          <TableCell>
                            {hasMultipleEntries ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleVoteExpansion(vote.id)}
                                className="p-1"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Single entry</span>
                            )}
                          </TableCell>
                        </TableRow>
                        
                        {/* Expandable details row */}
                        {isExpanded && hasMultipleEntries && (
                          <TableRow>
                            <TableCell colSpan={9} className="p-0">
                              <div className="p-4 bg-gray-50 border-t">
                                <div className="mb-3">
                                  <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                                    <History className="h-4 w-4" />
                                    Complete Scoring History ({history.length} entries)
                                  </h4>
                                </div>
                                
                                <div className="space-y-3">
                                  {history.map((entry, index) => (
                                    <div
                                      key={index}
                                      className={`p-3 rounded-lg border-l-4 ${
                                        entry.action === 'created' 
                                          ? 'border-l-green-400 bg-green-50' 
                                          : 'border-l-amber-400 bg-amber-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          {entry.action === 'created' ? (
                                            <Plus className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <Edit className="h-4 w-4 text-amber-600" />
                                          )}
                                          <span className="text-sm font-medium capitalize">
                                            {entry.action}
                                          </span>
                                          <span className="text-sm text-muted-foreground">
                                            {formatTimestamp(entry.timestamp)}
                                          </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-sm font-bold">
                                            Total: {entry.totalScore}
                                          </Badge>
                                          {entry.previousScore && entry.previousScore !== entry.totalScore && (
                                            <span className="text-xs text-muted-foreground">
                                              (was {entry.previousScore})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Individual ratings for this entry */}
                                      {entry.ratings && Array.isArray(entry.ratings) && entry.ratings.length > 0 && (
                                        <div className="mt-2 p-2 bg-white rounded border">
                                          <p className="text-xs font-medium mb-2 text-gray-600">Individual Ratings at this time:</p>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {entry.ratings.map((rating: any, rIdx: number) => (
                                              <div key={rIdx} className="flex items-center justify-between p-1 bg-gray-50 rounded text-xs">
                                                <span className="font-medium text-gray-700">
                                                  {rating.categoryId || rating.questionId || `Rating ${rIdx + 1}`}:
                                                </span>
                                                <Badge variant="secondary" className="text-xs">
                                                  {rating.score}
                                                </Badge>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="mt-2 pt-2 border-t border-gray-200">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-medium text-gray-600">Calculated Total:</span>
                                              <span className="text-sm font-bold text-gray-800">{entry.totalScore}</span>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {(!entry.ratings || !Array.isArray(entry.ratings) || entry.ratings.length === 0) && (
                                        <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
                                          No detailed rating breakdown available for this entry
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {filteredVotes.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Audit Trail Information</span>
              </div>
              <ul className="text-blue-700 space-y-1 text-xs">
                <li>• <strong>Updated votes</strong> are highlighted with yellow background and amber border</li>
                <li>• Votes are sorted by most recent activity (updates or submissions)</li>
                <li>• Export includes full judge ratings and detailed timestamps</li>
                <li>• Use filters to focus on specific timeframes or vote types</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 