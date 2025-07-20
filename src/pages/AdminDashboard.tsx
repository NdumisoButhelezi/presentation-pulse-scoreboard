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
import { Shield, BarChart3, FileText, LogOut, Database, RefreshCw, Search, CalendarClock, AlertTriangle } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">ICTAS 2025 Management Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Global Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search presentations, authors, or reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-80"
                />
              </div>
              <div className="text-right">
                <p className="font-medium">{currentUser.name}</p>
                <p className="text-sm text-muted-foreground flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  Administrator
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Search Results Summary */}
        {searchTerm && (
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Searching for: <strong>"{searchTerm}"</strong>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions Bar - Update with new recalculate button */}
        <div className="mb-6 flex flex-wrap gap-3">
          <Button 
            variant="outline" 
            onClick={handleBulkImport}
            disabled={importing}
            className="flex items-center gap-2"
          >
            {importing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <CalendarClock className="h-4 w-4" />
                Import Conference Presentations
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleCleanupDuplicateVotes}
            disabled={cleaningVotes}
            className="flex items-center gap-2"
          >
            {cleaningVotes ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Cleaning...
              </>
            ) : (
              <>
                <Database className="h-4 w-4" />
                Clean Duplicate Votes
              </>
            )}
          </Button>

          <Button 
            variant="outline" 
            onClick={handleRecalculateStats}
            disabled={recalculating}
            className="flex items-center gap-2"
          >
            {recalculating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Recalculating...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4" />
                Recalculate Scores
              </>
            )}
          </Button>

          <Button 
            variant="outline" 
            onClick={handleFixNanScores}
            disabled={fixingScores}
            className="flex items-center gap-2"
          >
            {fixingScores ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Fixing NaN Scores...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                Fix NaN Scores
              </>
            )}
          </Button>
        </div>

        <Tabs defaultValue="presentations" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="presentations" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Presentations
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Reports & Analytics
            </TabsTrigger>
            <TabsTrigger value="data-integrity" className="flex items-center">
              <Database className="h-4 w-4 mr-2" />
              Data Integrity
            </TabsTrigger>
            <TabsTrigger value="judge-assignment" className="flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Judge Assignment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="presentations" className="space-y-6">
            <PresentationManagement searchTerm={searchTerm} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ReportsView searchTerm={searchTerm} />
          </TabsContent>

          <TabsContent value="data-integrity" className="space-y-6">
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

                  {/* Progress indicator when cleaning */}
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

                {/* Additional Data Integrity Tools */}
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
          </TabsContent>

          <TabsContent value="judge-assignment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
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
                      <div className="flex flex-wrap gap-2">
                        {ROOMS.map(room => (
                          <label key={room} className="flex items-center space-x-2">
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
                            <span>{room}</span>
                          </label>
                        ))}
                      </div>
                      <Button
                        className="mt-4"
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}