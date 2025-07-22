import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PresentationCard } from '@/components/presentations/PresentationCard';
import { Bookmark, ArrowLeft, Home } from 'lucide-react';
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

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5">
      <div className="container mx-auto px-4 py-6">
        {/* Navigation Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="outline" 
              onClick={handleBackToDashboard}
              className="flex items-center gap-2 hover:bg-primary/10"
            >
              <Home className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous Page
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bookmark className="h-5 w-5 mr-2" />
              My Reserved Presentations
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Presentations you've bookmarked to attend. Use this to keep track of your schedule.
            </p>
          </CardHeader>
          <CardContent>
            {reservedPresentations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bookmark className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No reserved presentations yet</h3>
                <p className="text-sm mb-4">Start exploring presentations and bookmark the ones you want to attend.</p>
                <Button onClick={handleBackToDashboard} className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Browse Presentations
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    You have {reservedPresentations.length} presentation{reservedPresentations.length !== 1 ? 's' : ''} reserved
                  </p>
                </div>
                <div className="grid gap-4">
                  {reservedPresentations.map(presentation => (
                    <PresentationCard 
                      key={presentation.id} 
                      presentation={presentation}
                      reserved={reserved[presentation.id]}
                      onReserve={() => {
                        const newReserved = { ...reserved };
                        if (newReserved[presentation.id]) {
                          delete newReserved[presentation.id];
                        } else {
                          newReserved[presentation.id] = true;
                        }
                        setReserved(newReserved);
                        localStorage.setItem('reservedSeats', JSON.stringify(newReserved));
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
