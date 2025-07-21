import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { LandingPage } from '@/pages/LandingPage';
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
    return <LandingPage />;
  }

  return <Dashboard />;
};

export default Index;
