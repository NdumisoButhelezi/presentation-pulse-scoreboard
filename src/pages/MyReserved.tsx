import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PresentationCard } from '@/components/presentations/PresentationCard';
import { Bookmark, ArrowLeft } from 'lucide-react';
import { Presentation } from '@/types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function MyReserved() {
  const navigate = useNavigate();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [reserved, setReserved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load reserved from localStorage
    const saved = localStorage.getItem('reservedSeats');
    setReserved(saved ? JSON.parse(saved) : {});
    // Load all presentations
    getDocs(collection(db, 'presentations')).then(snapshot => {
      setPresentations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Presentation[]);
    });
  }, []);

  const reservedPresentations = presentations
    .filter(p => reserved[p.id])
    .sort((a, b) => {
      // Sort by sessionDate then startTime
      if (a.sessionDate !== b.sessionDate) return a.sessionDate.localeCompare(b.sessionDate);
      return a.startTime.localeCompare(b.startTime);
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5">
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bookmark className="h-5 w-5 mr-2" />
              My Reserved Seats
            </CardTitle>
            <Button variant="outline" onClick={() => navigate(-1)} className="mt-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardHeader>
          <CardContent>
            {reservedPresentations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bookmark className="h-12 w-12 mx-auto mb-4" />
                <p>No reserved presentations yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reservedPresentations.map(presentation => (
                  <PresentationCard key={presentation.id} presentation={presentation} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
