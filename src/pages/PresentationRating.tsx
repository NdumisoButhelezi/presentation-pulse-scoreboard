import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoginForm } from '@/components/auth/LoginForm';
import { VoteModal } from '@/components/presentations/VoteModal';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Presentation } from '@/types';
import { QrCode, Star, Users, Clock, MapPin, ArrowLeft, Home } from 'lucide-react';
import { RoomBadge } from '@/components/ui/room-badge';

export default function PresentationRating() {
  const { presentationId } = useParams<{ presentationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);

  useEffect(() => {
    if (presentationId) {
      loadPresentation(presentationId);
    } else {
      setError("No presentation ID provided");
      setLoading(false);
    }
  }, [presentationId]);

  const loadPresentation = async (id: string) => {
    try {
      const presentationRef = doc(db, 'presentations', id);
      const presentationDoc = await getDoc(presentationRef);
      
      if (presentationDoc.exists()) {
        setPresentation({ id: presentationDoc.id, ...presentationDoc.data() } as Presentation);
      } else {
        setError("Presentation not found");
      }
    } catch (error) {
      console.error('Error loading presentation:', error);
      setError("Failed to load presentation");
    } finally {
      setLoading(false);
    }
  };

  const handleRatePresentation = () => {
    if (!currentUser) {
      setShowLoginForm(true);
    } else {
      setShowVoteModal(true);
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginForm(false);
    // Auto-open vote modal after successful login
    setShowVoteModal(true);
  };

  const handleVoteSubmitted = () => {
    setShowVoteModal(false);
    // Could show a success message or redirect
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <QrCode className="h-12 w-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
            <p>Loading presentation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <QrCode className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Presentation Not Found</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showLoginForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-md mx-auto">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <QrCode className="h-5 w-5 mr-2" />
                  Rate Presentation
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Sign in or create an account to rate this presentation
                </p>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-1">{presentation.title}</h4>
                  <p className="text-sm text-blue-700">
                    {presentation.authors?.join(', ')}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <LoginForm onSuccess={handleLoginSuccess} next={location.pathname} />
            
            <div className="mt-4 text-center">
              <Button 
                variant="ghost" 
                onClick={() => setShowLoginForm(false)}
                className="text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Presentation
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Navigation */}
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Button>
          </div>

          {/* Presentation Details */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-2">{presentation.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {presentation.authors && presentation.authors.length > 0 && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="h-4 w-4 mr-1" />
                        {presentation.authors.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <QrCode className="h-8 w-8 text-primary ml-4" />
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <RoomBadge room={presentation.room as "AZANIA" | "ALOE" | "CYCAD" | "KHANYA"} />
                <div className="flex items-center text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  {presentation.startTime} - {presentation.endTime}
                </div>
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-1" />
                  {presentation.sessionDate}
                </div>
              </div>
            </CardHeader>
            
            {presentation.abstract && (
              <CardContent>
                <h4 className="font-medium mb-2">Abstract</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {presentation.abstract}
                </p>
              </CardContent>
            )}
          </Card>

          {/* Rating Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="h-5 w-5 mr-2" />
                Rate This Presentation
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Share your feedback about this presentation to help improve future events.
              </p>
            </CardHeader>
            <CardContent>
              {currentUser ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center mb-2">
                      <Users className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm font-medium text-green-800">
                        Signed in as {currentUser.name}
                      </span>
                    </div>
                    <p className="text-sm text-green-700">
                      You're all set to rate this presentation!
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleRatePresentation}
                    className="w-full"
                    size="lg"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Rate Presentation
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">Ready to Rate?</h4>
                    <p className="text-sm text-blue-700">
                      Sign in to your account or create a new one to rate this presentation.
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => setShowLoginForm(true)}
                    className="w-full"
                    size="lg"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Sign In to Rate
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Vote Modal */}
      {showVoteModal && presentation && (
        <VoteModal
          presentation={presentation}
          isOpen={showVoteModal}
          onClose={() => setShowVoteModal(false)}
          onVoteSubmitted={handleVoteSubmitted}
        />
      )}
    </div>
  );
} 