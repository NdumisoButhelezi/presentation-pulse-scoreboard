import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoomBadge } from '@/components/ui/room-badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PresentationCard } from '@/components/presentations/PresentationCard';
import { useAuth } from '@/contexts/AuthContext';
import { Presentation, ROOMS, Vote } from '@/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, Filter, Trophy, Users, LogOut, RefreshCw, ThumbsUp, Calendar, Clock, MapPin, Play, Coffee, Utensils, Bookmark, BookmarkCheck, CheckCircle2, Circle, AlertCircle, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ParticleBackground } from '@/components/ui/ParticleBackground';
import { Skeleton } from '@/components/ui/skeleton';
import { SignatureOnboarding } from '@/components/auth/SignatureOnboarding';
import { useSignatureOnboarding } from '@/hooks/use-signature-onboarding';
import { useMediaQuery } from '@/hooks/use-media-query';
import { getAssignmentsForJudge } from '@/lib/firebase';

// Add agenda item types
interface AgendaItem {
  id: string;
  type: 'presentation' | 'break' | 'lunch' | 'keynote' | 'workshop';
  title: string;
  startTime: string;
  endTime: string;
  sessionDate: string;
  room?: string;
  description?: string;
  isBreak?: boolean;
}

export function Dashboard() {
  const { currentUser, firebaseUser, logout } = useAuth();
  const { needsSignatureOnboarding } = useSignatureOnboarding();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // State
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [userReservations, setUserReservations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [judgeProgressFilter, setJudgeProgressFilter] = useState<'all' | 'judged' | 'unjudged'>('all');
  const [agendaView, setAgendaView] = useState<'list' | 'timeline' | 'focus'>(
    (currentUser?.role === 'judge' || currentUser?.role === 'conference-chair' || currentUser?.role === 'technical-chair') ? 'timeline' : 'list'
  );
  const [showSignatureOnboarding, setShowSignatureOnboarding] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [showCurrentEvents, setShowCurrentEvents] = useState(false);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [reserved, setReserved] = useState<Record<string, boolean>>(() => {
    // Try to load from localStorage for persistence
    const saved = localStorage.getItem('reservedSeats');
    return saved ? JSON.parse(saved) : {};
  });
  const [assignedPresentationIds, setAssignedPresentationIds] = useState<string[] | null>(null);

  // Save reserved seats to localStorage on change
  useEffect(() => {
    localStorage.setItem('reservedSeats', JSON.stringify(reserved));
  }, [reserved]);

  // Function to determine if a presentation is currently happening - MOVED BEFORE USAGE
  const isCurrentEvent = (item: Presentation | AgendaItem) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    if (item.sessionDate !== today) {
      return false;
    }
    
    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.replace('h', ':').split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const startTime = parseTime(item.startTime);
    const endTime = parseTime(item.endTime);
    
    return currentTime >= startTime && currentTime <= endTime;
  };

  useEffect(() => {
    loadPresentations();
    loadAgendaItems();
    if (currentUser) {
      loadUserVotes();
      if (currentUser.role === 'judge' || currentUser.role === 'conference-chair' || currentUser.role === 'technical-chair') {
        setAgendaView('timeline');
        // Fetch assigned presentations for judges
        getAssignmentsForJudge(currentUser.id).then(assignments => {
          setAssignedPresentationIds(assignments.map(a => a.presentationId));
        });
      } else {
        setAssignedPresentationIds(null);
      }
    }
  }, [currentUser]);

  // Check for signature onboarding needs
  useEffect(() => {
    if (currentUser && needsSignatureOnboarding) {
      setShowSignatureOnboarding(true);
    }
  }, [currentUser, needsSignatureOnboarding]);

  const handleSignatureOnboardingComplete = () => {
    setShowSignatureOnboarding(false);
    toast({
      title: "Signature Setup Complete!",
      description: "Your digital signature is ready for certificate generation.",
    });
    // Reload user data to get updated signature status
    window.location.reload();
  };

  // Real-time update for current events - refresh every minute
  useEffect(() => {
    if (showCurrentEvents) {
      const interval = setInterval(() => {
        // Force re-render to update current events status
        setShowCurrentEvents(true);
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [showCurrentEvents]);

  const loadPresentations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'presentations'));
      const presentationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Ensure judgeScores and spectatorLikes are initialized with default values
        judgeScores: doc.data().judgeScores || [],
        spectatorLikes: doc.data().spectatorLikes || 0
      })) as Presentation[];

      // Load vote data for each presentation with better error handling
      const presentationsWithVotes = await Promise.all(
        presentationData.map(async (presentation) => {
          try {
            const votesSnapshot = await getDocs(
              query(collection(db, 'votes'), where('presentationId', '==', presentation.id))
            );
            
            // Define a type for the vote object to satisfy TypeScript
            type VoteDoc = {
              id: string;
              role?: string;
              totalScore?: number;
              ratings?: { score: number }[];
              score?: number;
              [key: string]: any;
            };

            const votes: VoteDoc[] = votesSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            // Process judge votes, handling both old and new formats
            const judgeVotes = votes.filter(v => v.role === 'judge');
            const judgeScores = judgeVotes.map(vote => {
              // Handle votes with totalScore (new format)
              if (typeof vote.totalScore === 'number' && !isNaN(vote.totalScore)) {
                return vote.totalScore;
              }
              // Handle votes with ratings array
              else if (vote.ratings && Array.isArray(vote.ratings)) {
                // Calculate score from ratings (would match scoringConfig.ts logic)
                // This is simplified - ideally would use the same calculation as in scoringConfig.ts
                const totalScore = vote.ratings.reduce((sum, r) => sum + r.score, 0) / vote.ratings.length * 10;
                return Math.round(totalScore);
              } 
              // Handle legacy votes with just a score field
              else if (typeof vote.score === 'number' && !isNaN(vote.score)) {
                return vote.score;
              }
              // Skip invalid votes
              return null;
            }).filter(score => score !== null);
            
            const spectatorLikes = votes.filter(v => v.role === 'spectator').length;
            
            // Ensure we're not storing NaN or undefined values
            const validJudgeScores = judgeScores.filter(score => !isNaN(Number(score)));
            
            return {
              ...presentation,
              judgeScores: validJudgeScores,
              spectatorLikes
            };
          } catch (error) {
            console.error(`Error loading votes for presentation ${presentation.id}:`, error);
            return {
              ...presentation,
              judgeScores: [],
              spectatorLikes: 0
            };
          }
        })
      );

      // Filter out absent presentations for attendees
      let finalPresentations = presentationsWithVotes;
      
      if (currentUser?.role !== 'judge' && currentUser?.role !== 'conference-chair' && currentUser?.role !== 'technical-chair') {
        // For attendees, filter out presentations that have been marked as absent by judges
        const presentationsToShow = await Promise.all(
          presentationsWithVotes.map(async (presentation) => {
            try {
              const absentVotesSnapshot = await getDocs(
                query(
                  collection(db, 'votes'), 
                  where('presentationId', '==', presentation.id),
                  where('role', '==', 'judge'),
                  where('isAbsent', '==', true)
                )
              );
              
              // If any judge marked this presentation as absent, exclude it for attendees
              return absentVotesSnapshot.docs.length === 0 ? presentation : null;
            } catch (error) {
              console.error(`Error checking absent status for presentation ${presentation.id}:`, error);
              // On error, include the presentation (fail safe)
              return presentation;
            }
          })
        );
        
        finalPresentations = presentationsToShow.filter(p => p !== null) as typeof presentationsWithVotes;
      }

      setPresentations(finalPresentations as unknown as Presentation[]);
    } catch (error) {
      console.error('Error loading presentations:', error);
      toast({
        title: "Error",
        description: "Failed to load presentations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAgendaItems = () => {
    // Define conference agenda items including breaks
    const agendaData: AgendaItem[] = [
      // Day 1 - Wednesday, 23rd July 2025
      { id: 'welcome-1', type: 'keynote', title: 'Welcome & Opening Remarks', startTime: '08h30', endTime: '09h00', sessionDate: '2025-07-23', description: 'Conference opening ceremony' },
      { id: 'keynote-1', type: 'keynote', title: 'Keynote Address', startTime: '09h00', endTime: '10h00', sessionDate: '2025-07-23', description: 'Opening keynote presentation' },
      { id: 'tea-1', type: 'break', title: 'Tea Break', startTime: '10h00', endTime: '10h50', sessionDate: '2025-07-23', isBreak: true },
      { id: 'lunch-1', type: 'lunch', title: 'Lunch Break', startTime: '12h30', endTime: '15h25', sessionDate: '2025-07-23', isBreak: true },
      { id: 'tea-2', type: 'break', title: 'Afternoon Tea', startTime: '17h20', endTime: '17h40', sessionDate: '2025-07-23', isBreak: true },
      
      // Day 2 - Thursday, 24th July 2025
      { id: 'keynote-2', type: 'keynote', title: 'Industry Keynote', startTime: '09h00', endTime: '10h00', sessionDate: '2025-07-24', description: 'Industry insights presentation' },
      { id: 'tea-3', type: 'break', title: 'Morning Tea', startTime: '10h00', endTime: '10h45', sessionDate: '2025-07-24', isBreak: true },
      { id: 'lunch-2', type: 'lunch', title: 'Lunch Break', startTime: '12h25', endTime: '15h25', sessionDate: '2025-07-24', isBreak: true },
      { id: 'tea-4', type: 'break', title: 'Afternoon Tea', startTime: '17h20', endTime: '17h40', sessionDate: '2025-07-24', isBreak: true },
      { id: 'workshop-1', type: 'workshop', title: 'SAP Student Workshop', startTime: '15h25', endTime: '17h20', sessionDate: '2025-07-24', room: 'Workshop Hall' },
      
      // Day 3 - Friday, 25th July 2025
      { id: 'keynote-3', type: 'keynote', title: 'Closing Keynote', startTime: '09h00', endTime: '10h00', sessionDate: '2025-07-25', description: 'Closing ceremony keynote' },
      { id: 'tea-5', type: 'break', title: 'Morning Tea', startTime: '10h00', endTime: '10h45', sessionDate: '2025-07-25', isBreak: true },
      { id: 'lunch-3', type: 'lunch', title: 'Lunch Break', startTime: '12h25', endTime: '14h00', sessionDate: '2025-07-25', isBreak: true },
      { id: 'workshop-2', type: 'workshop', title: 'Students Cybersecurity Workshop', startTime: '14h50', endTime: '16h30', sessionDate: '2025-07-25', room: 'Security Lab' },
      { id: 'closing', type: 'keynote', title: 'Closing Ceremony', startTime: '16h30', endTime: '17h00', sessionDate: '2025-07-25', description: 'Conference closing and awards' }
    ];
    
    setAgendaItems(agendaData);
  };

  const loadUserVotes = async () => {
    if (!currentUser) return;

    try {
      const snapshot = await getDocs(
        query(collection(db, 'votes'), where('userId', '==', currentUser.id))
      );
      
      const votes: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const vote = doc.data();
        // Handle both new format (totalScore) and old format (score)
        const userScore = vote.totalScore || vote.score || 0;
        votes[vote.presentationId] = userScore;
      });
      
      console.log(`User ${currentUser.id} has voted on ${Object.keys(votes).length} presentations`);
      setUserVotes(votes);
    } catch (error) {
      console.error('Error loading user votes:', error);
      toast({
        title: "Warning",
        description: "Could not load your voting history. You can still vote on presentations.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Agenda helper functions
  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.replace('h', ':').split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatTime = (timeStr: string) => {
    return timeStr.replace('h', ':');
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };

  // Helper to map sessionDate to Day label
  const getDayLabel = (date: string) => {
    const uniqueDates = Array.from(
      new Set(
        [...presentations.map(p => p.sessionDate), ...agendaItems.map(a => a.sessionDate)]
      )
    ).sort();
    const idx = uniqueDates.indexOf(date);
    return idx !== -1 ? `Day ${idx + 1}` : '';
  };

  // Enhanced getTimeSlots to include all agenda items
  const getTimeSlots = () => {
    const slots: Array<{
      time: string;
      displayTime: string;
      presentations: Presentation[];
      agendaItems: AgendaItem[];
      isActive: boolean;
      isPast: boolean;
      hasBreak: boolean;
    }> = [];
    
    const timeGroups: Record<string, { presentations: Presentation[]; agendaItems: AgendaItem[] }> = {};
    
    // Group presentations by start time and date
    presentations.forEach(presentation => {
      const key = `${presentation.sessionDate}|${presentation.startTime}`;
      if (!timeGroups[key]) {
        timeGroups[key] = { presentations: [], agendaItems: [] };
      }
      timeGroups[key].presentations.push(presentation);
    });

    // Group agenda items by start time and date
    agendaItems.forEach(item => {
      const key = `${item.sessionDate}|${item.startTime}`;
      if (!timeGroups[key]) {
        timeGroups[key] = { presentations: [], agendaItems: [] };
      }
      timeGroups[key].agendaItems.push(item);
    });

    // Convert to sorted time slots
    Object.entries(timeGroups).forEach(([key, group]) => {
      const [date, time] = key.split('|');
      const currentTime = getCurrentTime();
      const slotTime = parseTime(time);
      const isToday = date === new Date().toISOString().split('T')[0];
      
      // Get end time from presentations or agenda items
      const allItems = [...group.presentations, ...group.agendaItems];
      const endTime = allItems.length > 0 ? allItems[0].endTime : time;
      
      const filteredPresentations = group.presentations.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             p.authors.some(author => author.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesRoom = selectedRoom === 'all' || p.room === selectedRoom;
        return matchesSearch && matchesRoom;
      });

      slots.push({
        time: key,
        displayTime: `${formatTime(time)} - ${formatTime(endTime)}`,
        presentations: filteredPresentations,
        agendaItems: group.agendaItems,
        isActive: isToday && currentTime >= slotTime && currentTime <= parseTime(endTime),
        isPast: isToday ? currentTime > parseTime(endTime) : new Date(date) < new Date(),
        hasBreak: group.agendaItems.some(item => item.isBreak)
      });
    });

    // Sort by date and time (ascending - earliest first)
    return slots.sort((a, b) => {
      const [dateA, timeA] = a.time.split('|');
      const [dateB, timeB] = b.time.split('|');
      
      // First compare dates
      const dateComparison = new Date(dateA).getTime() - new Date(dateB).getTime();
      if (dateComparison !== 0) {
        return dateComparison;
      }
      
      // If dates are equal, compare times
      return parseTime(timeA) - parseTime(timeB);
    });
  };

  const getSelectedEventItems = () => {
    if (!selectedTimeSlot) return { presentations: [], agendaItems: [] };
    const timeSlots = getTimeSlots();
    const slot = timeSlots.find(s => s.time === selectedTimeSlot);
    return slot ? { presentations: slot.presentations, agendaItems: slot.agendaItems } : { presentations: [], agendaItems: [] };
  };

  const filteredPresentations = presentations.filter(presentation => {
    // If showing current events, only show presentations happening now
    if (showCurrentEvents) {
      return isCurrentEvent(presentation);
    }
    // Only show presentations assigned to this judge
    if (
      (currentUser?.role === 'judge' || currentUser?.role === 'conference-chair' || currentUser?.role === 'technical-chair') &&
      Array.isArray(assignedPresentationIds)
    ) {
      if (!assignedPresentationIds.includes(presentation.id)) {
        return false;
      }
    }
    // Only show presentations in assigned rooms for judges, conference chairs, and technical chairs
    if (
      (currentUser?.role === 'judge' || currentUser?.role === 'conference-chair' || currentUser?.role === 'technical-chair') &&
      Array.isArray((currentUser as any).assignedRooms) &&
      (currentUser as any).assignedRooms.length > 0
    ) {
      if (!(currentUser as any).assignedRooms.includes(presentation.room)) {
      return false;
      }
    }

    // Judge progress filter
    if ((currentUser?.role === 'judge' || currentUser?.role === 'conference-chair' || currentUser?.role === 'technical-chair') && judgeProgressFilter !== 'all') {
      const hasVoted = !!userVotes[presentation.id];
      if (judgeProgressFilter === 'judged' && !hasVoted) {
        return false;
      }
      if (judgeProgressFilter === 'unjudged' && hasVoted) {
        return false;
      }
    }

    const matchesSearch = presentation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      presentation.authors.some(author => author.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRoom = selectedRoom === 'all' || presentation.room === selectedRoom;
    return matchesSearch && matchesRoom;
  });

  // Calculate judge progress statistics
  const judgeProgressStats = () => {
    if (currentUser?.role !== 'judge' && currentUser?.role !== 'conference-chair' && currentUser?.role !== 'technical-chair') return null;
    
    let judgeRelevantPresentations = presentations;
    // Filter by assigned presentations if available
    if (Array.isArray(assignedPresentationIds)) {
      judgeRelevantPresentations = presentations.filter(p => assignedPresentationIds.includes(p.id));
    } else if (Array.isArray((currentUser as any).assignedRooms) && (currentUser as any).assignedRooms.length > 0) {
      judgeRelevantPresentations = presentations.filter(p => 
        (currentUser as any).assignedRooms.includes(p.room)
      );
    }
    const total = judgeRelevantPresentations.length;
    const judged = judgeRelevantPresentations.filter(p => !!userVotes[p.id]).length;
    const unjudged = total - judged;
    const percentage = total > 0 ? Math.round((judged / total) * 100) : 0;
    return { total, judged, unjudged, percentage };
  };

  const presentationsByRoom = ROOMS.reduce((acc, room) => {
    acc[room] = filteredPresentations.filter(p => p.room === room);
    return acc;
  }, {} as Record<string, Presentation[]>);

  // Get all current events (presentations and agenda items)
  const getCurrentEvents = () => {
    const currentPresentations = presentations.filter(isCurrentEvent);
    const currentAgendaItems = agendaItems.filter(isCurrentEvent);
    return { presentations: currentPresentations, agendaItems: currentAgendaItems };
  };

  // Helper function to render agenda item icon
  const getAgendaIcon = (type: string) => {
    switch (type) {
      case 'break':
        return <Coffee className="h-4 w-4" />;
      case 'lunch':
        return <Utensils className="h-4 w-4" />;
      case 'keynote':
        return <Trophy className="h-4 w-4" />;
      case 'workshop':
        return <Users className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  // Filter ROOMS for judge to only show assigned rooms
  const visibleRooms =
    (currentUser?.role === 'judge' || currentUser?.role === 'conference-chair' || currentUser?.role === 'technical-chair') &&
    Array.isArray((currentUser as any).assignedRooms) &&
    (currentUser as any).assignedRooms.length > 0
      ? ROOMS.filter(room => (currentUser as any).assignedRooms.includes(room))
      : ROOMS;

  // Handle seat reservation toggle
  const handleReserve = (presentationId: string) => {
    try {
      setReserved(prev => {
        const newReserved = {
          ...prev,
          [presentationId]: !prev[presentationId]
        };
        localStorage.setItem('reservedSeats', JSON.stringify(newReserved));
        toast({
          title: newReserved[presentationId] ? 'Seat Reserved' : 'Reservation Removed',
          description: newReserved[presentationId]
            ? 'You have reserved a seat for this presentation.'
            : 'Your reservation for this presentation has been removed.',
          variant: 'default',
        });
        return newReserved;
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update reservation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle vote submission refresh
  const handleVoteSubmitted = async () => {
    try {
      toast({
        title: "Updating...",
        description: "Refreshing presentation data...",
      });
      
      // Refresh both presentations and user votes
      await Promise.all([
        loadPresentations(),
        loadUserVotes()
      ]);
      
      toast({
        title: "Updated!",
        description: "Your vote has been recorded and the display has been updated.",
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: "Warning",
        description: "Vote submitted but display may not reflect changes immediately.",
        variant: "destructive",
      });
    }
  };

  // Block unverified attendees using firebaseUser
  if (
    currentUser &&
    currentUser.role === 'spectator' &&
    firebaseUser &&
    firebaseUser.emailVerified === false
  ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-yellow-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center border border-yellow-200">
          <h2 className="text-2xl font-bold text-yellow-800 mb-2">Email Verification Required</h2>
          <p className="text-yellow-900 mb-4">
            Please check your inbox for a verification link to activate your account.<br />
            You must verify your email before you can access the ICTAS 2025 Conference system.
          </p>
          <p className="text-sm text-yellow-700 mb-4">
            If you did not receive the email, check your spam folder or click below to resend the verification email.
          </p>
          <Button onClick={async () => {
            try {
              const user = (await import('firebase/auth')).getAuth().currentUser;
              if (user) {
                await (await import('firebase/auth')).sendEmailVerification(user);
                toast({
                  title: "Verification Email Sent",
                  description: "Please check your inbox for the verification link.",
                });
              }
            } catch (error: any) {
              toast({
                title: "Resend Failed",
                description: error.message || "Could not resend verification email.",
                variant: "destructive",
              });
            }
          }}>
            Resend Verification Email
          </Button>
          <div className="mt-6 text-xs text-gray-400">ICTAS 2025 Conference System</div>
        </div>
      </div>
    );
  }

  if (loading) {
    // Show skeleton cards instead of spinner
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-primary/5">
        <div className="w-full max-w-5xl px-2 sm:px-8 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl shadow-lg bg-white/80 p-0 flex flex-col animate-pulse">
              <Skeleton className="h-8 w-3/4 rounded-lg mb-2 mt-4 mx-4" />
              <Skeleton className="h-4 w-1/2 rounded mb-2 mx-4" />
              <Skeleton className="h-4 w-5/6 rounded mb-4 mx-4" />
              <Skeleton className="h-3 w-full rounded mb-2 mx-4" />
              <Skeleton className="h-3 w-2/3 rounded mb-2 mx-4" />
              <div className="flex-1" />
              <div className="flex items-center justify-end gap-2 pt-4 px-4 pb-3 border-t mt-3">
                <Skeleton className="h-8 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="main-container min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5">
      <ParticleBackground />
      {/* Header */}
      <header className="sticky top-0 z-20 w-full bg-white/30 backdrop-blur-lg border-b border-white/30 shadow-lg transition-all duration-300">
        <div className="w-full px-2 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-4">
            {/* Animated logo with pulse */}
            <div className="relative flex items-center justify-center">
              <Trophy className="h-10 w-10 text-primary animate-pulse-slow drop-shadow-lg" />
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary/30 rounded-full blur-sm animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-primary drop-shadow-sm">Present Score</h1>
              <p className="text-sm text-muted-foreground font-medium">Real-time Scoring Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {(getCurrentEvents().presentations.length > 0 || getCurrentEvents().agendaItems.length > 0) && (
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-green-100/80 text-green-800 rounded-full text-sm shadow-md">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium">
                  {getCurrentEvents().presentations.length + getCurrentEvents().agendaItems.length} Live Event{getCurrentEvents().presentations.length + getCurrentEvents().agendaItems.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {/* User profile section with better hierarchy */}
            <div className="flex flex-col items-end text-right bg-white/60 rounded-lg px-3 py-1 shadow-sm border border-white/40">
              <p className="font-semibold text-primary text-base leading-tight">{currentUser?.name}</p>
              <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                {currentUser?.role === 'judge' ? (
                  <Trophy className="h-4 w-4 mr-1 text-primary" />
                ) : (
                  <Users className="h-4 w-4 mr-1 text-accent" />
                )}
                {currentUser?.role}
              </p>
            </div>
            {/* Improved search bar styling */}
            <div className="relative ml-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary/60" />
              <Input
                placeholder="Search presentations or authors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-56 min-w-0 rounded-lg border border-primary/20 bg-white/70 shadow-inner focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            {/* My Reserved and Logout buttons */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/my-reserved')}
              className="hidden sm:flex ml-2"
            >
              <Bookmark className="h-4 w-4 mr-2" />
              My Reserved
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="ml-2">
              <LogOut className="h-4 w-4 mr-2" />
              <span className="sm:inline hidden">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="w-full px-2 sm:px-8 py-4 sm:py-6 min-w-0">
        {/* Filters & View Controls */}
        <Card className="mb-4 sm:mb-6 w-full rounded-none border-0 shadow-none bg-white/90 min-w-0">
          <CardHeader className="p-0 sm:p-0 px-2 sm:px-8 pt-8 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                <span>Filter & View Options</span>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Button
                  variant={agendaView === 'timeline' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAgendaView('timeline')}
                  className="flex items-center"
                >
                  Presentations
                </Button>
                <Button
                  variant={agendaView === 'focus' || agendaView === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAgendaView('list')}
                  className="flex-1 sm:flex-initial"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Agenda
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-0 px-2 sm:px-8 pt-0 pb-8">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 sm:flex gap-2 min-w-0">
                <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filter by room" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rooms</SelectItem>
                    {ROOMS.map(room => (
                      <SelectItem key={room} value={room}>{room}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={loadPresentations} className="w-full sm:w-auto">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="sm:inline hidden">Refresh</span>
                </Button>
                <Button 
                  variant={showCurrentEvents ? "default" : "outline"} 
                  onClick={() => {
                    setShowCurrentEvents(!showCurrentEvents);
                    if (!showCurrentEvents) {
                      setSelectedRoom('all');
                      setSearchTerm('');
                      setAgendaView('list');
                    }
                  }}
                  className={`w-full sm:w-auto ${(getCurrentEvents().presentations.length > 0 || getCurrentEvents().agendaItems.length > 0) ? "border-green-500 text-green-700" : ""}`}
                >
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${(getCurrentEvents().presentations.length > 0 || getCurrentEvents().agendaItems.length > 0) ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    <span className="truncate">Current ({getCurrentEvents().presentations.length + getCurrentEvents().agendaItems.length})</span>
                  </div>
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/my-reserved')}
                  className="w-full sm:w-auto"
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  <span className="truncate">My Reserved</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Judge Progress Statistics */}
        {currentUser && (currentUser.role === 'judge' || currentUser.role === 'conference-chair' || currentUser.role === 'technical-chair') && (
          <Card className="mb-4 sm:mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 w-full rounded-lg shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Trophy className="h-5 w-5 text-amber-600 mr-2" />
                    <div>
                      <p className="font-medium text-amber-900">Judge Progress Overview</p>
                      <p className="text-sm text-amber-700">
                        {judgeProgressStats()?.judged} of {judgeProgressStats()?.total} presentations scored
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-amber-800">
                      {judgeProgressStats()?.percentage}%
                    </div>
                    <p className="text-sm text-amber-600">Complete</p>
                  </div>
                </div>
                
                {/* Progress breakdown */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mr-1" />
                      <span className="text-lg font-bold text-green-700">
                        {judgeProgressStats()?.judged}
                      </span>
                    </div>
                    <p className="text-xs text-green-600">Judged</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Circle className="h-4 w-4 text-orange-600 mr-1" />
                      <span className="text-lg font-bold text-orange-700">
                        {judgeProgressStats()?.unjudged}
                      </span>
                    </div>
                    <p className="text-xs text-orange-600">Remaining</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <AlertCircle className="h-4 w-4 text-blue-600 mr-1" />
                      <span className="text-lg font-bold text-blue-700">
                        {judgeProgressStats()?.total}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600">Total</p>
                  </div>
                </div>

                {/* Filter buttons for judges */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={judgeProgressFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setJudgeProgressFilter('all')}
                    className="text-xs"
                  >
                    All Presentations
                  </Button>
                  <Button
                    variant={judgeProgressFilter === 'unjudged' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setJudgeProgressFilter('unjudged')}
                    className="text-xs"
                  >
                    <Circle className="h-3 w-3 mr-1" />
                    Need to Judge ({judgeProgressStats()?.unjudged})
                  </Button>
                  <Button
                    variant={judgeProgressFilter === 'judged' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setJudgeProgressFilter('judged')}
                    className="text-xs"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Already Judged ({judgeProgressStats()?.judged})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Regular Voting Progress for Non-Judges */}
        {currentUser && currentUser.role !== 'judge' && (
          <Card className="mb-4 sm:mb-6 bg-gradient-to-r from-gray-50 to-blue-50 border-gray-200 w-full rounded-lg shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                    Your Rating Progress
                  </h3>
                  <p className="text-sm text-gray-600">
                    You have rated {Object.keys(userVotes).length} out of {presentations.length} presentations
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {Object.keys(userVotes).length}
                  </div>
                  <div className="text-sm text-gray-500">rated</div>
                </div>
              </div>
              
              <div className="mt-3">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ 
                      width: `${presentations.length > 0 ? (Object.keys(userVotes).length / presentations.length) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendee Instructions */}
        {currentUser && currentUser.role === 'spectator' && (
          <Card className="mb-4 sm:mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 w-full rounded-lg shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <Star className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-2">
                    Welcome, Attendee! 
                  </h3>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>As an attendee, you can rate presentations you attended using our structured rating system.</p>
                    <p>Click "Rate Presentation" on any presentation to provide your detailed feedback across multiple criteria.</p>
                    <p>Your ratings help provide valuable attendee perspective alongside judge evaluations.</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-blue-700">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>Rate presentations 1-5 on multiple criteria</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                  <span>Your feedback matters to the community</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dynamic Agenda & Presentations */}
        {agendaView === 'timeline' ? (
          <Tabs defaultValue="all" className="w-full">
            {/* Hide TabsList on mobile, show only on sm and up */}
            <TabsList
              className={`hidden sm:grid w-full ${
                visibleRooms.length > 0 ? `grid-cols-${visibleRooms.length + 1}` : 'grid-cols-1'
              }`}
            >
              <TabsTrigger value="all">
                All ({filteredPresentations.length})
              </TabsTrigger>
              {visibleRooms.map(room => (
                <TabsTrigger key={room} value={room}>
                  {room} ({presentationsByRoom[room].length})
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="space-y-4 w-full px-2 sm:px-8 min-w-0">
              {filteredPresentations.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {showCurrentEvents
                          ? "No presentations are currently happening. Check back during scheduled presentation times!"
                          : "No presentations found matching your criteria."
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredPresentations.map(presentation => (
                    <PresentationCard
                      key={presentation.id}
                      presentation={presentation}
                      userVote={userVotes[presentation.id]}
                      hasVoted={!!userVotes[presentation.id]}
                      reserved={!!reserved[presentation.id]}
                      onReserve={() => handleReserve(presentation.id)}
                      onVoteSubmitted={handleVoteSubmitted}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Room-based tabs */}
            {visibleRooms.map(room => (
              <TabsContent key={room} value={room} className="space-y-4 w-full px-2 sm:px-8 min-w-0">
                <div className="grid gap-4">
                  {presentationsByRoom[room].map(presentation => (
                    <PresentationCard
                      key={presentation.id}
                      presentation={presentation}
                      userVote={userVotes[presentation.id]}
                      hasVoted={!!userVotes[presentation.id]}
                      reserved={!!reserved[presentation.id]}
                      onReserve={() => handleReserve(presentation.id)}
                      onVoteSubmitted={handleVoteSubmitted}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          /* Agenda View - Make responsive */
          <div className="space-y-5 sm:space-y-6 w-full min-w-0">
            {/* Event Selector - Improve mobile view */}
            <Card className="w-full rounded-none border-0 shadow-none bg-white/90 min-w-0">
              <CardHeader className="p-0 px-2 sm:px-8 pt-8 pb-4">
                <CardTitle className="flex items-center text-lg sm:text-xl">
                  <Calendar className="h-5 w-5 mr-2" />
                  Conference Agenda
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 px-2 sm:px-8 pt-0 pb-8">
                <div className="grid gap-3 sm:gap-4">
                  {/* Group slots by day and show day label */}
                  {(() => {
                    const slots = getTimeSlots();
                    let lastDate = '';
                    return slots.map((slot, idx) => {
                      const [date] = slot.time.split('|');
                      const showDay = date !== lastDate;
                      lastDate = date;
                      const isFocused = selectedTimeSlot === slot.time;
                      return (
                        <div key={slot.time}>
                          {showDay && (
                            <div className="mb-2 mt-3 sm:mt-4 text-base sm:text-lg font-bold text-primary flex items-center">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span className="truncate">{getDayLabel(date)} &mdash; {date}</span>
                            </div>
                          )}
                          <div
                            className={`p-4 sm:p-4 rounded-xl border-2 cursor-pointer transition-all select-none ${
                              isFocused
                                ? 'border-primary bg-primary/10 shadow-lg'
                                : slot.isActive
                                ? 'border-green-500 bg-green-50'
                                : slot.isPast
                                ? 'border-gray-300 bg-gray-50 opacity-75'
                                : 'border-border hover:border-primary/50'
                            } ${isFocused ? 'ring-2 ring-primary' : ''} active:scale-[0.98]`}
                            style={{ minHeight: 56, touchAction: 'manipulation' }}
                            onClick={() =>
                              setSelectedTimeSlot(isFocused ? null : slot.time)
                            }
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                  <Clock className="h-5 w-5 text-muted-foreground" />
                                  <span className="font-semibold text-base sm:text-lg">{slot.displayTime}</span>
                                </div>
                                {slot.isActive && (
                                  <div className="flex items-center space-x-1 text-green-600">
                                    <Play className="h-5 w-5" />
                                    <span className="text-sm font-semibold">Live Now</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                                {slot.hasBreak && (
                                  <div className="flex items-center space-x-1 text-blue-600">
                                    <Coffee className="h-4 w-4 sm:h-5 sm:w-5" />
                                    <span className="font-medium">Break</span>
                                  </div>
                                )}
                                {slot.agendaItems.length > 0 && (
                                  <div className="flex items-center space-x-1 text-muted-foreground max-w-[120px] sm:max-w-none">
                                    {getAgendaIcon(slot.agendaItems[0].type)}
                                    <span className="truncate font-medium text-sm">{slot.agendaItems[0].title}</span>
                                  </div>
                                )}
                                {slot.presentations.length > 0 && (
                                  <span className="text-muted-foreground font-medium">
                                    {slot.presentations.length} session{slot.presentations.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Show presentation titles under the slot */}
                            <div className="flex flex-col mt-2 ml-2 sm:ml-6">
                              {slot.presentations.length > 0 && (
                                <ul className="list-disc pl-4 text-xs sm:text-sm text-primary">
                                  {slot.presentations.map((presentation) => (
                                    <li key={presentation.id} className="truncate max-w-[180px] sm:max-w-none">{presentation.title}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>

                          {/* Improve focused session content for better mobile formatting */}
                          {isFocused && (
                            <Card className="my-3 sm:my-4 shadow-xl border-primary border-2">
                              <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2 bg-primary/10 rounded-t-xl">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <h3 className="text-lg sm:text-xl font-bold flex items-center text-primary">
                                    <Play className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                                    Focused Session
                                  </h3>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedTimeSlot(null)}
                                    className="self-end sm:self-auto"
                                  >
                                    Clear Focus
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="p-3 sm:p-4">
                                <div className="space-y-4">
                                  {/* Agenda Items - Better mobile format */}
                                  {slot.agendaItems.length > 0 && (
                                    <div className="space-y-3">
                                      <h3 className="text-base font-semibold flex items-center border-b pb-1 mb-2">
                                        <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                                        <span>Scheduled Events</span>
                                      </h3>
                                      <div className="grid gap-3">
                                        {slot.agendaItems.map(item => (
                                          <div key={item.id} className={`p-4 rounded-xl border ${
                                            item.isBreak ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                                          } active:scale-[0.98]`} style={{ minHeight: 56, touchAction: 'manipulation' }}>
                                            <div className="flex items-start gap-3">
                                              <div className="mt-0.5 flex-shrink-0">
                                                {getAgendaIcon(item.type)}
                                              </div>
                                              <div className="flex-grow min-w-0">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                                  <h4 className="font-semibold truncate text-base sm:text-lg">{item.title}</h4>
                                                  <div className="text-xs font-semibold mt-1 sm:mt-0">
                                                    {formatTime(item.startTime)} - {formatTime(item.endTime)}
                                                  </div>
                                                </div>
                                                {item.description && (
                                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                                                )}
                                                {item.room && (
                                                  <p className="text-xs text-muted-foreground flex items-center mt-1">
                                                    <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                                    <span className="truncate">{item.room}</span>
                                                  </p>
                                                )}
                                                <div className="text-xs text-muted-foreground capitalize mt-1">
                                                  {item.type}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Presentations - Better mobile format */}
                                  {slot.presentations.length > 0 && (
                                    <div className="space-y-3">
                                      <h3 className="text-base font-semibold flex items-center border-b pb-1 mb-2">
                                        <Trophy className="h-4 w-4 mr-2 flex-shrink-0" />
                                        <span>Presentations ({slot.presentations.length})</span>
                                      </h3>
                                      <div className="grid gap-3">
                                        {slot.presentations.map(presentation => (
                                          <div key={presentation.id} className="pb-2">
                                            <div className="bg-white rounded-xl p-0 flex flex-col h-full">
                                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                  <CardTitle className="text-lg leading-tight mb-2">{presentation.title}</CardTitle>
                                                  {/* Authors, abstract, etc. can be added here if needed */}
                                                </div>
                                                <div className="flex flex-col items-end min-w-fit">
                                                  <div className="flex items-center text-sm text-muted-foreground mb-1">
                                                    <Clock className="h-4 w-4 mr-1" />
                                                    {presentation.startTime} - {presentation.endTime}
                                                  </div>
                                                  <Badge variant="outline" className="text-xs mb-2">
                                                    {presentation.sessionDate}
                                                  </Badge>
                                                </div>
                                              </div>
                                              {/* Card content here */}
                                              <div className="flex-1" />
                                              {/* Action row at the bottom */}
                                              <div className="flex items-center justify-between gap-2 pt-4 px-4 pb-3 border-t mt-3">
                                                <Button
                                                  variant={reserved[presentation.id] ? "default" : "outline"}
                                                  size="sm"
                                                  onClick={() => handleReserve(presentation.id)}
                                                  aria-label={reserved[presentation.id] ? "Unreserve Seat" : "Reserve Seat"}
                                                >
                                                  {reserved[presentation.id] ? (
                                                    <BookmarkCheck className="h-4 w-4 text-green-600 mr-1" />
                                                  ) : (
                                                    <Bookmark className="h-4 w-4 mr-1" />
                                                  )}
                                                  <span className="text-xs">
                                                    {reserved[presentation.id] ? "Reserved" : "Reserve"}
                                                  </span>
                                                </Button>
                                                {/* Placeholder for other actions, e.g., Vote Now button */}
                                                {/* <Button variant="gradient">Vote Now</Button> */}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* No events case - Better mobile format */}
                                  {slot.presentations.length === 0 && slot.agendaItems.length === 0 && (
                                    <div className="text-center py-6">
                                      <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                                      <p className="text-muted-foreground">No events scheduled for this time slot.</p>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Quick Navigation when no event is selected */}
            {!selectedTimeSlot && (
              <Card className="w-full rounded-none border-0 shadow-none bg-white/90 min-w-0">
                <CardContent className="py-6 sm:py-8 text-center px-3 sm:px-6">
                  <Calendar className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-medium mb-2">Select a Session to Focus</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose a time slot above to view and interact with presentations in that session.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
                    <Button
                      onClick={() => {
                        const activeSlot = getTimeSlots().find(s => s.isActive);
                        if (activeSlot) {
                          setSelectedTimeSlot(activeSlot.time);
                        } else {
                          const nextSlot = getTimeSlots().find(s => !s.isPast);
                          if (nextSlot) {
                            setSelectedTimeSlot(nextSlot.time);
                          }
                        }
                      }}
                      className="w-full sm:w-auto"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Go to Current/Next Session
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setAgendaView('timeline')}
                      className="w-full sm:w-auto"
                    >
                      View All Presentations
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Improved Floating Action Button for My Reserved on mobile */}
      <div className="fixed bottom-4 right-4 left-4 sm:hidden z-50 flex justify-end pointer-events-none">
        <div className="w-full flex justify-end">
          <Button 
            onClick={() => navigate('/my-reserved')}
            size="lg"
            className="rounded-full shadow-2xl flex items-center pointer-events-auto px-6 py-3 text-base"
            style={{ minHeight: 56 }}
          >
            <Bookmark className="h-6 w-6 mr-2" />
            <span>My Reserved</span>
          </Button>
        </div>
      </div>

      {/* Signature Onboarding Modal */}
      {showSignatureOnboarding && currentUser && (
        <SignatureOnboarding 
          isOpen={showSignatureOnboarding}
          onComplete={handleSignatureOnboardingComplete} 
        />
      )}
    </div>
  );
}