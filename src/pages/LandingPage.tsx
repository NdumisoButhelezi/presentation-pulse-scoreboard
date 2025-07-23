import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, BarChart3, Shield, ArrowRight, Play, Star, Calendar, MapPin, LogIn, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export function LandingPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  const handleGetStarted = () => {
    if (currentUser) {
      navigate('/dashboard');
    } else {
      setShowLogin(true);
    }
  };

  const handleBackToLanding = () => {
    setShowLogin(false);
  };

  const features = [
    {
      icon: Trophy,
      title: "Real-time Scoring",
      description: "Watch live scores update as judges and attendees vote on presentations"
    },
    {
      icon: Users,
      title: "Interactive Voting",
      description: "Attendees can rate presentations while judges provide detailed scores"
    },
    {
      icon: BarChart3,
      title: "Live Leaderboards",
      description: "See rankings update in real-time with beautiful visualizations"
    },
    {
      icon: Shield,
      title: "Secure Platform",
      description: "Protected voting system with duplicate prevention and data integrity"
    }
  ];

  if (showLogin) {
    return <LoginForm onBack={handleBackToLanding} />;
  }

  return (
    <div className="w-screen min-h-screen overflow-x-hidden" style={{ margin: 0, padding: 0 }}>
      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 w-screen bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="w-full px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Trophy className="h-8 w-8 text-yellow-400 mr-3" />
            <span className="text-xl font-bold text-white">Present Score</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowLogin(true)}
              className="text-white hover:bg-white/20 font-medium"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Login
            </Button>
            <Button 
              size="sm"
              onClick={() => setShowLogin(true)}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
            >
              Register
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section - Full Viewport */}
      <section 
        className="relative w-screen h-screen flex items-center justify-center overflow-hidden"
        style={{ margin: 0, padding: 0 }}
      >
        {/* Background Image */}
        <div 
          className="absolute inset-0 w-screen h-screen bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/hero-bg.png')",
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            margin: 0,
            padding: 0
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50" style={{ margin: 0, padding: 0 }}></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center text-white px-6 max-w-6xl mx-auto w-full">
          <div className="mb-12">
            <Trophy className="h-20 w-20 mx-auto mb-8 text-yellow-400 drop-shadow-lg" />
            <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-tight tracking-tight">
              This Is Their Home
            </h1>
            <p className="text-2xl md:text-3xl text-gray-200 mb-12 max-w-4xl mx-auto leading-relaxed font-light">
              This isn't just a conference. It's where brilliant minds come together to share groundbreaking research and innovations that will shape our future.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Button 
                size="lg" 
                onClick={handleGetStarted}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-10 py-6 text-xl shadow-2xl hover:shadow-yellow-500/25 transition-all duration-300 transform hover:scale-105"
              >
                Get Started
                <ArrowRight className="ml-3 h-6 w-6" />
              </Button>
              {/*
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/hall-of-fame')}
                className="border-2 border-white text-white hover:bg-white hover:text-black px-10 py-6 text-xl font-semibold transition-all duration-300 transform hover:scale-105"
              >
                <Play className="mr-3 h-6 w-6" />
                View Hall of Fame
              </Button>
              */}
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-8 h-12 border-2 border-white rounded-full flex justify-center">
            <div className="w-1 h-4 bg-white rounded-full mt-3 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Features Section - Full Width */}
      <section className="w-screen py-24 bg-white" style={{ margin: 0, padding: '6rem 0' }}>
        <div className="w-full px-6 max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              Experience the Future of Conference Scoring
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Join us for ICTAS 2025 and be part of the most advanced presentation scoring system ever created.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="text-center hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border-0 shadow-lg">
                  <CardContent className="p-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <Icon className="h-10 w-10 text-yellow-600" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-gray-900">{feature.title}</h3>
                    <p className="text-gray-600 text-lg leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Section - Full Width */}
      <section className="w-screen py-24 bg-gradient-to-br from-gray-50 to-gray-100" style={{ margin: 0, padding: '6rem 0' }}>
        <div className="w-full px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-5xl font-bold text-gray-900 mb-8 leading-tight">
                Where Innovation Meets Recognition
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                ICTAS 2025 brings together the brightest minds in technology and science. 
                Our advanced scoring platform ensures every presentation gets the recognition it deserves.
              </p>
              <div className="space-y-6">
                <div className="flex items-center group">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
                    <Star className="h-6 w-6 text-yellow-600" />
                  </div>
                  <span className="text-lg text-gray-700 font-medium">Real-time voting and scoring</span>
                </div>
                <div className="flex items-center group">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
                    <Calendar className="h-6 w-6 text-yellow-600" />
                  </div>
                  <span className="text-lg text-gray-700 font-medium">Live leaderboards and rankings</span>
                </div>
                <div className="flex items-center group">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
                    <MapPin className="h-6 w-6 text-yellow-600" />
                  </div>
                  <span className="text-lg text-gray-700 font-medium">Multiple presentation rooms</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 rounded-3xl p-10 text-white shadow-2xl">
                <h3 className="text-3xl font-bold mb-6">Join the Experience</h3>
                <p className="text-lg mb-8 leading-relaxed">
                  Register now to participate in the most innovative conference scoring system. 
                  Whether you're presenting, judging, or spectating, you'll be part of something extraordinary.
                </p>
                <Button 
                  size="lg" 
                  onClick={handleGetStarted}
                  className="bg-white text-yellow-600 hover:bg-gray-100 font-bold text-lg px-8 py-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  Start Your Journey
                  <ArrowRight className="ml-3 h-6 w-6" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Registration Section - Full Width */}
      <section id="registration-section" className="w-screen py-24 bg-white" style={{ margin: 0, padding: '6rem 0' }}>
        <div className="w-full px-6 max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-2xl text-gray-600 leading-relaxed">
              Join thousands of participants in the most advanced conference scoring platform
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <Card className="shadow-2xl border-0">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-3xl font-bold">Create Your Account</CardTitle>
                <p className="text-gray-600 text-lg">Join as an attendee to view and rate presentations</p>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6">
                    <div className="flex items-center gap-3">
                      <Users className="h-6 w-6 text-blue-600" />
                      <span className="text-lg text-blue-800 font-bold">Attendee Account</span>
                    </div>
                    <p className="text-blue-700 mt-2 leading-relaxed">
                      You will be registered as an attendee and can view and rate presentations.
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShowLogin(true)}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold text-lg py-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    Register Now
                    <ArrowRight className="ml-3 h-6 w-6" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer - Full Width */}
      <footer className="w-screen bg-gradient-to-br from-gray-900 to-black text-white py-16" style={{ margin: 0, padding: '4rem 0' }}>
        <div className="w-full px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="flex items-center mb-6">
                <Trophy className="h-10 w-10 text-yellow-400 mr-3" />
                <span className="text-2xl font-bold">Present Score</span>
              </div>
              <p className="text-gray-400 text-lg leading-relaxed">
                The most advanced conference scoring platform for ICTAS 2025.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-6">Quick Links</h3>
              <ul className="space-y-3 text-gray-400">
                <li><button onClick={() => navigate('/')} className="hover:text-white text-lg transition-colors duration-300">Home</button></li>
                {/* <li><button onClick={() => navigate('/hall-of-fame')} className="hover:text-white text-lg transition-colors duration-300">Hall of Fame</button></li> */}
                <li><button onClick={() => navigate('/admin')} className="hover:text-white text-lg transition-colors duration-300">Admin Panel</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-6">Contact</h3>
              <p className="text-gray-400 text-lg leading-relaxed">
                ICTAS 2025 Conference<br />
                Advanced scoring platform<br />
                Real-time voting system
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p className="text-lg">&copy; 2025 ICTAS Conference. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 