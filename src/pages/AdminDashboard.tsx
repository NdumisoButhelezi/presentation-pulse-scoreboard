import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { PresentationManagement } from '@/components/admin/PresentationManagement';
import { ReportsView } from '@/components/admin/ReportsView';
import { cleanupDuplicateVotes, recalculateAllPresentationStats, fixNanScores, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, BarChart3, FileText, LogOut, Database, RefreshCw, Search, 
  CalendarClock, AlertTriangle, Menu, X, Settings, Users, TrendingUp,
  Activity, BarChart, PieChart, Download, Upload, Trash2, Plus
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { bulkImportConferencePresentations } from '../lib/importPresentations';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ROOMS } from '@/types';

export function AdminDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cleaningVotes, setCleaningVotes] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [fixingScores, setFixingScores] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  // --- Judge Assignment State ---
  const [judges, setJudges] = useState<any[]>([]);
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>('');
  const [selectedJudgeRooms, setSelectedJudgeRooms] = useState<string[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleCleanupDuplicateVotes = async () => {
    setCleaningVotes(true);
    try {
      const duplicatesRemoved = await cleanupDuplicateVotes();
      toast({
        title: "Cleanup Complete",
        description: `Removed ${duplicatesRemoved} duplicate votes. Each user now has only one vote per presentation.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clean up duplicate votes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCleaningVotes(false);
    }
  };

  const handleBulkImport = async () => {
    setImporting(true);
    try {
      await bulkImportConferencePresentations(toast);
    } catch (error) {
      toast({
        title: "Import Error",
        description: "Failed to import conference presentations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleRecalculateStats = async () => {
    setRecalculating(true);
    try {
      const count = await recalculateAllPresentationStats();
      toast({
        title: "Recalculation Complete",
        description: `Successfully recalculated statistics for ${count} presentations.`,
      });
    } catch (error) {
      console.error('Error recalculating stats:', error);
      toast({
        title: "Error",
        description: "Failed to recalculate presentation statistics.",
        variant: "destructive",
      });
    } finally {
      setRecalculating(false);
    }
  };

  const handleFixNanScores = async () => {
    setFixingScores(true);
    try {
      const fixedCount = await fixNanScores();
      toast({
        title: "Fix Complete",
        description: `Fixed ${fixedCount} presentations with NaN scores.`,
      });
    } catch (error) {
      console.error('Error fixing NaN scores:', error);
      toast({
        title: "Error",
        description: "Failed to fix NaN scores.",
        variant: "destructive",
      });
    } finally {
      setFixingScores(false);
    }
  };

  // Load judges from backend API (must be implemented server-side)
  useEffect(() => {
    const fetchJudges = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/judges');
        const judgeList = await res.json();
        setJudges(judgeList);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load judges from API.",
          variant: "destructive",
        });
      }
    };
    fetchJudges();
  }, []);

  // When a judge is selected, load their assigned rooms
  useEffect(() => {
    if (!selectedJudgeId) {
      setSelectedJudgeRooms([]);
      return;
    }
    const judge = judges.find(j => j.id === selectedJudgeId);
    setSelectedJudgeRooms(judge?.assignedRooms || []);
  }, [selectedJudgeId, judges]);

  // Save assigned rooms to Firestore and update local state
  const handleSaveAssignment = async () => {
    if (!selectedJudgeId) return;
    setSavingAssignment(true);
    try {
      await updateDoc(doc(db, 'users', selectedJudgeId), {
        assignedRooms: selectedJudgeRooms,
      });
      // Update local state so UI reflects the change immediately
      setJudges(judges =>
        judges.map(j =>
          j.id === selectedJudgeId
            ? { ...j, assignedRooms: selectedJudgeRooms }
            : j
        )
      );
      toast({
        title: "Success",
        description: "Judge room assignments updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update judge assignments.",
        variant: "destructive",
      });
    } finally {
      setSavingAssignment(false);
    }
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return <AdminLogin />;
  }

  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'presentations', label: 'Presentations', icon: FileText },
    { id: 'reports', label: 'Reports', icon: BarChart },
    { id: 'data-integrity', label: 'Data Integrity', icon: Database },
    { id: 'judge-assignment', label: 'Judge Assignment', icon: Users },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600 mb-1">Total Presentations</p>
                      <p className="text-3xl font-bold text-blue-900">79</p>
                      <p className="text-xs text-blue-600 mt-1">Active sessions</p>
                    </div>
                    <div className="h-12 w-12 bg-blue-500 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600 mb-1">Total Votes</p>
                      <p className="text-3xl font-bold text-green-900">6</p>
                      <p className="text-xs text-green-600 mt-1">Cast today</p>
                    </div>
                    <div className="h-12 w-12 bg-green-500 rounded-lg flex items-center justify-center">
                      <Activity className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600 mb-1">Judges</p>
                      <p className="text-3xl font-bold text-purple-900">8</p>
                      <p className="text-xs text-purple-600 mt-1">Registered</p>
                    </div>
                    <div className="h-12 w-12 bg-purple-500 rounded-lg flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600 mb-1">Spectators</p>
                      <p className="text-3xl font-bold text-orange-900">4</p>
                      <p className="text-xs text-orange-600 mt-1">Active</p>
                    </div>
                    <div className="h-12 w-12 bg-orange-500 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button 
                    variant="outline" 
                    onClick={handleBulkImport}
                    disabled={importing}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {importing ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    <span className="text-sm font-medium">
                      {importing ? 'Importing...' : 'Import Presentations'}
                    </span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleCleanupDuplicateVotes}
                    disabled={cleaningVotes}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {cleaningVotes ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <Database className="h-5 w-5" />
                    )}
                    <span className="text-sm font-medium">
                      {cleaningVotes ? 'Cleaning...' : 'Clean Duplicates'}
                    </span>
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={handleRecalculateStats}
                    disabled={recalculating}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {recalculating ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <BarChart3 className="h-5 w-5" />
                    )}
                    <span className="text-sm font-medium">
                      {recalculating ? 'Recalculating...' : 'Recalculate Scores'}
                    </span>
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={handleFixNanScores}
                    disabled={fixingScores}
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    {fixingScores ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                    <span className="text-sm font-medium">
                      {fixingScores ? 'Fixing...' : 'Fix NaN Scores'}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <FileText className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">New presentation added</p>
                        <p className="text-sm text-muted-foreground">"Advanced AI Applications" by Dr. Smith</p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">2 minutes ago</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">Judge vote recorded</p>
                        <p className="text-sm text-muted-foreground">Judge Johnson voted on "Machine Learning Trends"</p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">5 minutes ago</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">Scores recalculated</p>
                        <p className="text-sm text-muted-foreground">Updated rankings for all presentations</p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">10 minutes ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'presentations':
        return <PresentationManagement searchTerm={searchTerm} />;

      case 'reports':
        return <ReportsView searchTerm={searchTerm} />;

      case 'data-integrity':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  Vote Data Integrity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-medium">Duplicate Vote Cleanup</h3>
                    <p className="text-sm text-muted-foreground">
                      Ensure each user has only one vote per presentation. This removes any duplicate votes while keeping the most recent one.
                    </p>
                    <Button 
                      onClick={handleCleanupDuplicateVotes}
                      disabled={cleaningVotes}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      {cleaningVotes ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Cleaning Up Duplicates...
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4 mr-2" />
                          Clean Up Duplicate Votes
                        </>
                      )}
                    </Button>
                  </div>

                  {cleaningVotes && (
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-yellow-600" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800">
                              Processing vote cleanup...
                            </p>
                            <p className="text-xs text-yellow-600">
                              This may take a few moments depending on the amount of data.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Voting Rules Enforced:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• One vote per user per presentation</li>
                      <li>• Users can update their votes anytime</li>
                      <li>• Judges score from 1-10, spectators like (1) or don't like (0)</li>
                      <li>• Most recent vote is kept in case of duplicates</li>
                    </ul>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-medium mb-4">Additional Data Tools</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Export Backup</h4>
                          <p className="text-xs text-muted-foreground">
                            Download a complete backup of all presentation and voting data.
                          </p>
                          <Button variant="outline" size="sm" className="w-full">
                            <Database className="h-3 w-3 mr-2" />
                            Export Data
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Validate Data</h4>
                          <p className="text-xs text-muted-foreground">
                            Check for data inconsistencies and orphaned records.
                          </p>
                          <Button variant="outline" size="sm" className="w-full">
                            <RefreshCw className="h-3 w-3 mr-2" />
                            Validate
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'judge-assignment':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Assign Judges to Rooms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-1">Select Judge (registered):</label>
                    <select
                      className="border rounded px-3 py-2 w-full"
                      value={selectedJudgeId}
                      onChange={e => setSelectedJudgeId(e.target.value)}
                    >
                      <option value="">-- Select Judge --</option>
                      {judges.map(judge => (
                        <option key={judge.id} value={judge.id}>
                          {judge.name || judge.email || judge.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedJudgeId && (
                    <div>
                      <label className="block font-medium mb-1">Assign Rooms:</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {ROOMS.map(room => (
                          <label key={room} className="flex items-center space-x-2 p-2 border rounded hover:bg-muted/50">
                            <input
                              type="checkbox"
                              checked={selectedJudgeRooms.includes(room)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedJudgeRooms([...selectedJudgeRooms, room]);
                                } else {
                                  setSelectedJudgeRooms(selectedJudgeRooms.filter(r => r !== room));
                                }
                              }}
                            />
                            <span className="text-sm">{room}</span>
                          </label>
                        ))}
                      </div>
                      <Button
                        className="mt-4 w-full sm:w-auto"
                        onClick={handleSaveAssignment}
                        disabled={savingAssignment}
                      >
                        {savingAssignment ? "Saving..." : "Save Assignment"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return <div>Select a section from the sidebar</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">Admin Dashboard</h1>
                  <p className="text-xs text-muted-foreground">ICTAS 2025 Management Portal</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Search Bar */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search presentations, reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-80"
                />
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground">Administrator</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-20 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex flex-col h-full">
            <div className="flex-1 px-4 py-6">
              <nav className="space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeSection === item.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-0">
          <div className="p-6">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Mobile Search Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-10 bg-black bg-opacity-50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}