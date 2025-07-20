import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Presentation } from '@/types';
import { Button } from '@/components/ui/button';
import { Info, Download } from 'lucide-react';

interface VoteRawDataViewProps {
  presentationId?: string;
}

export function VoteRawDataView({ presentationId }: VoteRawDataViewProps) {
  const [votes, setVotes] = useState<any[]>([]);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(false);

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

  const calculateRawRatingSum = (ratings: any[]) => {
    if (!Array.isArray(ratings)) return 0;
    
    // Pure addition only - sum the raw ratings
    const sum = ratings.reduce((sum, rating) => {
      const ratingScore = typeof rating.score === 'number' ? rating.score : 0;
      return sum + ratingScore;
    }, 0);
    
    // Log the actual raw sum for debugging
    console.log(`Raw sum: ${sum}`);
    return sum;
  };

  const exportVoteData = () => {
    if (!votes.length) return;
    
    const jsonStr = JSON.stringify(votes, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `votes-${presentationId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!presentationId) {
    return <Card><CardContent className="p-4">No presentation selected</CardContent></Card>;
  }

  if (loading) {
    return <Card><CardContent className="p-4">Loading vote data...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Info className="h-5 w-5 mr-2" />
            Raw Vote Data Analysis
          </div>
          <Button variant="outline" size="sm" onClick={exportVoteData}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {presentation && (
          <div className="mb-4">
            <h3 className="text-lg font-medium">{presentation.title}</h3>
            <p className="text-sm text-muted-foreground">
              {presentation.authors?.join(', ')}
            </p>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Judge ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Raw Rating Sum</TableHead>
              <TableHead>Stored Total</TableHead>
              <TableHead>Individual Ratings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {votes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No votes found for this presentation
                </TableCell>
              </TableRow>
            ) : (
              votes.map(vote => {
                const rawSum = calculateRawRatingSum(vote.ratings);
                const storedTotal = vote.totalScore || vote.score || 0;
                
                return (
                  <TableRow key={vote.id}>
                    <TableCell className="font-mono text-xs">
                      {vote.userId?.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant={vote.role === 'judge' ? 'default' : 'secondary'}>
                        {vote.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold">{rawSum}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${
                        Math.abs(rawSum - storedTotal) > 1 ? 'text-red-500' : ''
                      }`}>
                        {storedTotal}
                      </span>
                      {rawSum !== storedTotal && (
                        <span className="text-xs ml-2 text-red-500">
                          Discrepancy! Raw sum: {rawSum}, Stored: {storedTotal}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(vote.ratings) ? 
                          vote.ratings.map((rating: any, idx: number) => (
                            <Badge key={idx} variant="outline">
                              {rating.categoryId}: {rating.score}
                            </Badge>
                          )) : 
                          <span className="text-xs text-muted-foreground">No rating details</span>
                        }
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
