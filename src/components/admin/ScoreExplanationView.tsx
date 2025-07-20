import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle } from 'lucide-react';
import { explainScoreCalculation, calculateScoreBreakdown } from '@/lib/scores';

interface ScoreExplanationProps {
  presentation: any;
}

export function ScoreExplanationView({ presentation }: ScoreExplanationProps) {
  if (!presentation) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No presentation selected</AlertTitle>
        <AlertDescription>
          Please select a presentation to view score details.
        </AlertDescription>
      </Alert>
    );
  }

  const breakdown = calculateScoreBreakdown(presentation);
  
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Info className="h-5 w-5 mr-2" />
          Score Calculation Explained
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score explanation box */}
        <div className="bg-muted/30 p-4 rounded-md">
          <h3 className="font-medium mb-2">How this score was calculated:</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {explainScoreCalculation(presentation)}
          </p>
        </div>
        
        {/* Score breakdown table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Score Component</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Number of Judges</TableCell>
              <TableCell className="text-right">{breakdown.numberOfJudges}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Individual Judge Scores</TableCell>
              <TableCell className="text-right">
                {breakdown.individualScores.length > 0 ? 
                  breakdown.individualScores.map((score: number, index: number) => (
                    <Badge key={index} variant="outline" className="ml-1">
                      {score}
                    </Badge>
                  )) : 
                  "No scores recorded"
                }
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Judge Total Score</TableCell>
              <TableCell className="text-right font-bold">{breakdown.judgeTotal}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Final Score</TableCell>
              <TableCell className="text-right font-bold">{breakdown.finalScore}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        
        {/* Vote calculation details */}
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">How Judge Scores Work</AlertTitle>
          <AlertDescription className="text-blue-700 space-y-2">
            <p>{breakdown.scoreExplanation}</p>
            
            <p className="font-medium mt-2">Key Points:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Each judge rates in multiple categories (usually 0-5 points per category)</li>
              <li>These category ratings are summed, then multiplied by 10</li>
              <li>So a judge giving ratings of 3+4+3+3 (13 total) creates a score of 130</li>
              <li>This is why even with just 1-2 judges, scores can reach 130 or higher</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
