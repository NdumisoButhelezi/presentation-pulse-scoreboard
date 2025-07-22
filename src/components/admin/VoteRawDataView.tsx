import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Presentation } from '@/types';
import { Button } from '@/components/ui/button';
import { Info, Download, Clock, RefreshCw, ChevronDown, ChevronRight, History, Edit, Plus } from 'lucide-react';

interface VoteRawDataViewProps {
  presentationId?: string;
}

export function VoteRawDataView({ presentationId }: VoteRawDataViewProps) {
  const [votes, setVotes] = useState<any[]>([]);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedVotes, setExpandedVotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (presentationId) {
      loadVoteData();
    }
  }, [presentationId]);

  const loadVoteData = async () => {
    if (!presentationId) return;
    
    setLoading(true);
    try {
      // Load presentation data
      const presentationRef = doc(collection(db, 'presentations'), presentationId);
      const presentationDoc = await getDoc(presentationRef);
      setPresentation(presentationDoc.data() as Presentation);
      
      // Load votes for this presentation
      const votesQuery = query(
        collection(db, 'votes'),
        where('presentationId', '==', presentationId)
      );
      
      const votesSnapshot = await getDocs(votesQuery);
      const voteData = votesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setVotes(voteData);
    } catch (error) {
      console.error('Error loading vote data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Not recorded';
    
    let date;
    if (timestamp.toDate) {
      // Firestore Timestamp
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

  const getHistoryFromVote = (vote: any) => {
    // Return history if it exists, otherwise create from existing data
    if (vote.history && Array.isArray(vote.history)) {
      return vote.history.sort((a: any, b: any) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return aTime.getTime() - bTime.getTime();
      });
    }
    
    // Legacy support: create history from existing fields
    const legacyHistory = [];
    if (vote.timestamp) {
      legacyHistory.push({
        timestamp: vote.timestamp,
        action: 'created',
        totalScore: vote.totalScore || vote.score || 0,
        ratings: vote.ratings
      });
    }
    if (vote.updatedAt && vote.updatedAt !== vote.timestamp) {
      legacyHistory.push({
        timestamp: vote.updatedAt,
        action: 'updated',
        totalScore: vote.totalScore || vote.score || 0,
        ratings: vote.ratings
      });
    }
    return legacyHistory;
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

  const exportVoteData = () => {
    if (!votes.length) return;
    
    // Include full history information in export
    const exportData = votes.map(vote => {
      const history = getHistoryFromVote(vote);
      return {
        voteId: vote.id,
        userId: vote.userId,
        role: vote.role,
        currentScore: vote.totalScore || vote.score || 0,
        historyCount: history.length,
        history: history.map(h => ({
          timestamp: formatTimestamp(h.timestamp),
          action: h.action,
          score: h.totalScore,
          previousScore: h.previousScore,
          ratings: h.ratings?.map((r: any) => `${r.categoryId || r.questionId}: ${r.score}`).join(', ')
        }))
      };
    });
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote-history-${presentationId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!presentationId) {
    return <Card><CardContent className="p-4">No presentation selected</CardContent></Card>;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p>Loading complete vote history...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <History className="h-5 w-5 mr-2" />
            Complete Vote History & Timeline
          </div>
          <Button variant="outline" size="sm" onClick={exportVoteData}>
            <Download className="h-4 w-4 mr-2" />
            Export Full History
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {presentation && (
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h3 className="text-lg font-medium">{presentation.title}</h3>
            <p className="text-sm text-muted-foreground">
              {presentation.authors?.join(', ')}
            </p>
          </div>
        )}

            {votes.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No votes found for this presentation</p>
          </div>
        ) : (
          <div className="space-y-4">
            {votes
              .sort((a, b) => {
                // Sort by most recent activity
                const aHistory = getHistoryFromVote(a);
                const bHistory = getHistoryFromVote(b);
                const aLatest = aHistory[aHistory.length - 1]?.timestamp;
                const bLatest = bHistory[bHistory.length - 1]?.timestamp;
                
                if (!aLatest && !bLatest) return 0;
                if (!aLatest) return 1;
                if (!bLatest) return -1;
                
                const aTime = aLatest.toDate ? aLatest.toDate() : new Date(aLatest);
                const bTime = bLatest.toDate ? bLatest.toDate() : new Date(bLatest);
                return bTime.getTime() - aTime.getTime();
              })
              .map(vote => {
                const history = getHistoryFromVote(vote);
                const isExpanded = expandedVotes.has(vote.id);
                const hasMultipleEntries = history.length > 1;
                const currentScore = vote.totalScore || vote.score || 0;
                
                return (
                  <Card key={vote.id} className={hasMultipleEntries ? "border-l-4 border-l-amber-400" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                      <Badge variant={vote.role === 'judge' ? 'default' : 'secondary'}>
                        {vote.role}
                      </Badge>
                            <span className="font-mono text-sm text-muted-foreground">
                              {vote.userId?.substring(0, 12)}...
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">{currentScore}</span>
                            <span className="text-sm text-muted-foreground">current score</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {history.length} {history.length === 1 ? 'entry' : 'entries'}
                          </Badge>
                          {hasMultipleEntries && (
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
                          )}
                        </div>
                      </div>

                      {/* Always show latest entry */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            {history[history.length - 1]?.action === 'created' ? (
                              <Plus className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Edit className="h-4 w-4 text-amber-600" />
                            )}
                            <span className="text-sm font-medium">
                              {history[history.length - 1]?.action === 'created' ? 'Initial Submission' : 'Latest Update'}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatTimestamp(history[history.length - 1]?.timestamp)}
                      </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold">{history[history.length - 1]?.totalScore}</span>
                            {history[history.length - 1]?.previousScore && (
                              <span className="text-xs text-muted-foreground ml-2">
                                (was {history[history.length - 1]?.previousScore})
                        </span>
                      )}
                          </div>
                        </div>
                      </div>

                      {/* Complete history timeline (expandable) */}
                      {hasMultipleEntries && (
                        <Collapsible open={isExpanded}>
                          <CollapsibleContent className="space-y-2">
                            <div className="border-t pt-3">
                              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Complete Timeline ({history.length} entries)
                              </h4>
                              <div className="space-y-2">
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
                                    
                                    {/* Detailed ratings breakdown for this specific entry */}
                                    {entry.ratings && Array.isArray(entry.ratings) && entry.ratings.length > 0 && (
                                      <div className="mt-2 p-2 bg-white rounded border">
                                        <p className="text-xs font-medium mb-2 text-gray-600">Individual Ratings at this time:</p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                                    
                                    {/* If no detailed ratings, show minimal info */}
                                    {(!entry.ratings || !Array.isArray(entry.ratings) || entry.ratings.length === 0) && (
                                      <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
                                        No detailed rating breakdown available for this entry
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}
        
        {votes.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800">Complete Vote History</span>
            </div>
            <ul className="text-blue-700 space-y-1 text-xs">
              <li>• <strong>Every update</strong> is tracked with exact timestamps</li>
              <li>• <strong>Yellow borders</strong> indicate votes with multiple entries</li>
              <li>• <strong>Click chevron</strong> to expand complete timeline</li>
              <li>• <strong>Export includes</strong> full history for all votes</li>
              <li>• <strong>Legacy votes</strong> without history are supported</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
