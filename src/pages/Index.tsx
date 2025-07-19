import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { Dashboard } from '@/pages/Dashboard';
import { RefreshCw, Trophy, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-primary/10">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-primary/10">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">ICTAS 2025 Presentation Scoring</h1>
            <div className="flex justify-center space-x-4 mb-8">
              <Button onClick={() => navigate('/hall-of-fame')} variant="outline">
                <Trophy className="h-4 w-4 mr-2" />
                Hall of Fame
              </Button>
              <Button onClick={() => navigate('/admin')} variant="outline">
                <Shield className="h-4 w-4 mr-2" />
                Admin Panel
              </Button>
            </div>
          </div>
          <LoginForm />
        </div>
      </div>
    );
  }

  return <Dashboard />;
};

export default Index;
