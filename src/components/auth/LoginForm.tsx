import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Trophy, Users, ArrowLeft, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendEmailVerification, getAuth } from 'firebase/auth';

interface LoginFormProps {
  onBack?: () => void;
  onSuccess?: () => void;
}

export function LoginForm({ onBack, onSuccess }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showVerifyNotice, setShowVerifyNotice] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'spectator' as 'judge' | 'spectator' // Always set to spectator
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShowVerifyNotice(false);
    try {
      await login(loginData.email, loginData.password);
      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      if (error.message && error.message.includes('verify your email address')) {
        setShowVerifyNotice(true);
        setVerifyEmail(loginData.email);
      }
      toast({
        title: "Login Failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(registerData.email, registerData.password, registerData.name, 'spectator');
      toast({
        title: "Account Created Successfully",
        description: "A verification email has been sent. Please check your inbox and verify your email before logging in.",
      });
      setTab('login');
      setShowVerifyNotice(true);
      setVerifyEmail(registerData.email);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user && user.email === verifyEmail) {
        await sendEmailVerification(user);
        toast({
          title: "Verification Email Sent",
          description: "Please check your inbox for the verification link.",
        });
      } else {
        toast({
          title: "Resend Failed",
          description: "Please log in again to resend the verification email.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Resend Failed",
        description: error.message || "Could not resend verification email.",
        variant: "destructive",
      });
    }
  };

  const handleBackToLanding = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen w-screen flex relative overflow-hidden">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 bg-gradient-to-br from-background via-secondary/30 to-primary/10 relative z-10">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={handleBackToLanding}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>

          <div className="text-center mb-8 animate-fade-in">
            <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 bg-clip-text text-transparent tracking-tight">
              Present Score
            </h1>
            <p className="text-muted-foreground mt-2 text-base">Real-time scoring & leaderboards</p>
          </div>

          <Card className="shadow-2xl rounded-3xl border-0 transition-all duration-300">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center font-bold">Get Started</CardTitle>
              <CardDescription className="text-center text-base">
                Access the scoring platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={v => setTab(v as 'login' | 'register')} className="w-full">
                <div className="mb-6 flex justify-center">
                  <TabsList className="grid w-full grid-cols-2 rounded-full bg-gray-100 shadow-inner">
                    <TabsTrigger value="login" className="rounded-full py-2 px-4 transition-all duration-200">Login</TabsTrigger>
                    <TabsTrigger value="register" className="rounded-full py-2 px-4 transition-all duration-200">Register</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="login" className="space-y-4 animate-fade-in">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                        className="rounded-xl border-gray-300 focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          required
                          className="rounded-xl border-gray-300 focus:ring-2 focus:ring-yellow-400"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full rounded-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 text-lg shadow-lg transition-all duration-200" disabled={loading}>
                      {loading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="register" className="space-y-4 animate-fade-in">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Full Name</Label>
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="Your full name"
                        value={registerData.name}
                        onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                        required
                        className="rounded-xl border-gray-300 focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="your@email.com"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        required
                        className="rounded-xl border-gray-300 focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={registerData.password}
                          onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                          required
                          className="rounded-xl border-gray-300 focus:ring-2 focus:ring-yellow-400"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    {/* Role information - hidden but always set to spectator */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-800 font-medium">Attendee Account</span>
                      </div>
                      <p className="text-blue-700 text-sm">
                        You will be registered as an attendee and can view and rate presentations.
                      </p>
                    </div>
                    <Button type="submit" className="w-full rounded-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 text-lg shadow-lg transition-all duration-200" disabled={loading}>
                      {loading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          {showVerifyNotice && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-900 flex items-center space-x-2">
              <Mail className="h-5 w-5 mr-2" />
              <div>
                <div className="font-semibold">Email Verification Required</div>
                <div className="text-sm">Please check your inbox for a verification link. You must verify your email before logging in.</div>
                <Button variant="link" size="sm" onClick={handleResendVerification} className="p-0 h-auto mt-1">Resend Verification Email</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Image (Desktop) / Background (Mobile) */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/auth-side.png')",
            backgroundPosition: 'center',
            backgroundSize: 'cover'
          }}
        >
          <div className="absolute inset-0 bg-black/10"></div>
        </div>
      </div>

      {/* Mobile Background */}
      <div className="lg:hidden fixed inset-0 -z-10">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{
            backgroundImage: "url('/auth-side.png')",
            backgroundPosition: 'center',
            backgroundSize: 'cover'
          }}
        >
          <div className="absolute inset-0 bg-white/80"></div>
        </div>
      </div>
    </div>
  );
}