import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, ROOMS } from '@/types';
import { Users, Plus, Pencil, Trash2, Search, UserCheck, MapPin, Calendar, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JudgeAssignmentManagementProps {
  searchTerm?: string;
}

interface JudgeAssignment {
  judgeId: string;
  judgeName: string;
  judgeEmail: string;
  assignedRooms: string[];
  isActive: boolean;
}

export function JudgeAssignmentManagement({ searchTerm = '' }: JudgeAssignmentManagementProps) {
  const [judges, setJudges] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<JudgeAssignment | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showUnassigned, setShowUnassigned] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadJudgeAssignments();
  }, []);

  const loadJudgeAssignments = async () => {
    try {
      setLoading(true);
      
      // Load all judges
      const judgesQuery = query(
        collection(db, 'users'), 
        where('role', 'in', ['judge', 'conference-chair', 'technical-chair'])
      );
      const judgesSnapshot = await getDocs(judgesQuery);
      const judgeData = judgesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];

      setJudges(judgeData);

      // Create assignment data structure
      const assignmentData: JudgeAssignment[] = judgeData.map(judge => ({
        judgeId: judge.id,
        judgeName: judge.name,
        judgeEmail: judge.email,
        assignedRooms: (judge as any).assignedRooms || [],
        isActive: judge.isActive !== false
      }));

      setAssignments(assignmentData);
    } catch (error) {
      console.error('Error loading judge assignments:', error);
      toast({
        title: "Error",
        description: "Failed to load judge assignments. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAssignment = async (judgeId: string, newRooms: string[]) => {
    try {
      await updateDoc(doc(db, 'users', judgeId), {
        assignedRooms: newRooms,
        updatedAt: new Date()
      });

      // Update local state
      setAssignments(prev => 
        prev.map(assignment => 
          assignment.judgeId === judgeId 
            ? { ...assignment, assignedRooms: newRooms }
            : assignment
        )
      );

      toast({
        title: "Assignment Updated",
        description: "Judge room assignments have been updated successfully.",
      });

      setIsEditDialogOpen(false);
      setEditingAssignment(null);
      setSelectedRooms([]);
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast({
        title: "Error",
        description: "Failed to update judge assignment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAssignment = async (judgeId: string) => {
    try {
      await updateDoc(doc(db, 'users', judgeId), {
        assignedRooms: [],
        updatedAt: new Date()
      });

      // Update local state
      setAssignments(prev => 
        prev.map(assignment => 
          assignment.judgeId === judgeId 
            ? { ...assignment, assignedRooms: [] }
            : assignment
        )
      );

      toast({
        title: "Assignment Removed",
        description: "Judge room assignments have been removed successfully.",
      });
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error",
        description: "Failed to remove judge assignment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (assignment: JudgeAssignment) => {
    setEditingAssignment(assignment);
    setSelectedRooms([...assignment.assignedRooms]);
    setIsEditDialogOpen(true);
  };

  const handleRoomToggle = (room: string) => {
    setSelectedRooms(prev => 
      prev.includes(room) 
        ? prev.filter(r => r !== room)
        : [...prev, room]
    );
  };

  const getRoomBadgeColor = (room: string) => {
    switch (room) {
      case 'AZANIA': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ALOE': return 'bg-green-100 text-green-800 border-green-200';
      case 'CYCAD': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'KHANYA': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Filter assignments based on search, room, and status
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = !searchTerm || 
      assignment.judgeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.judgeEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRoom = filterRoom === 'all' || assignment.assignedRooms.includes(filterRoom);
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'assigned' && assignment.assignedRooms.length > 0) ||
      (filterStatus === 'unassigned' && assignment.assignedRooms.length === 0) ||
      (filterStatus === 'active' && assignment.isActive) ||
      (filterStatus === 'inactive' && !assignment.isActive);
    
    const includeUnassigned = showUnassigned || assignment.assignedRooms.length > 0;
    
    return matchesSearch && matchesRoom && matchesStatus && includeUnassigned;
  });

  // Calculate statistics
  const stats = {
    totalJudges: assignments.length,
    assignedJudges: assignments.filter(a => a.assignedRooms.length > 0).length,
    unassignedJudges: assignments.filter(a => a.assignedRooms.length === 0).length,
    roomCoverage: ROOMS.map(room => ({
      room,
      judgeCount: assignments.filter(a => a.assignedRooms.includes(room)).length
    }))
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading judge assignments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.totalJudges}</div>
            <p className="text-xs text-muted-foreground">Total Judges</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.assignedJudges}</div>
            <p className="text-xs text-muted-foreground">Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.unassignedJudges}</div>
            <p className="text-xs text-muted-foreground">Unassigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round((stats.assignedJudges / stats.totalJudges) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">Coverage</p>
          </CardContent>
        </Card>
      </div>

      {/* Room Coverage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            Room Coverage Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.roomCoverage.map(({ room, judgeCount }) => (
              <div key={room} className="text-center p-4 border rounded-lg">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoomBadgeColor(room)}`}>
                  {room}
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold">{judgeCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {judgeCount === 1 ? 'Judge' : 'Judges'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Judge Assignment Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Judge Room Assignments
            </div>
            <div className="flex space-x-2">
              <Button onClick={loadJudgeAssignments} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={() => setShowUnassigned(!showUnassigned)}
                variant="outline"
                size="sm"
              >
                {showUnassigned ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showUnassigned ? 'Hide Unassigned' : 'Show Unassigned'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted rounded-lg">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="roomFilter">Filter by Room</Label>
              <Select value={filterRoom} onValueChange={setFilterRoom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {ROOMS.map(room => (
                    <SelectItem key={room} value={room}>{room}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="statusFilter">Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Judges</SelectItem>
                  <SelectItem value="assigned">Assigned Only</SelectItem>
                  <SelectItem value="unassigned">Unassigned Only</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignments Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judge</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Assigned Rooms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No judge assignments found matching your criteria.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssignments.map((assignment) => (
                    <TableRow key={assignment.judgeId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <UserCheck className="h-4 w-4 text-blue-600" />
                          <span>{assignment.judgeName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{assignment.judgeEmail}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {assignment.assignedRooms.length === 0 ? (
                            <Badge variant="outline" className="text-gray-500">
                              Unassigned
                            </Badge>
                          ) : (
                            assignment.assignedRooms.map(room => (
                              <Badge 
                                key={room} 
                                className={`${getRoomBadgeColor(room)} border`}
                                variant="outline"
                              >
                                {room}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {assignment.isActive ? (
                            <UserCheck className="h-4 w-4 text-green-600" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-red-600" />
                          )}
                          <span className={assignment.isActive ? "text-green-600" : "text-red-600"}>
                            {assignment.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex space-x-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(assignment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {assignment.assignedRooms.length > 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove all room assignments for {assignment.judgeName}? 
                                    This will remove them from all assigned rooms.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRemoveAssignment(assignment.judgeId)}>
                                    Remove Assignment
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Showing {filteredAssignments.length} of {assignments.length} judge assignments
          </div>
        </CardContent>
      </Card>

      {/* Edit Assignment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Judge Assignment</DialogTitle>
          </DialogHeader>
          {editingAssignment && (
            <div className="space-y-4">
              <div>
                <Label>Judge</Label>
                <Input 
                  value={editingAssignment.judgeName} 
                  disabled 
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Assign to Rooms</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {ROOMS.map(room => (
                    <div key={room} className="flex items-center space-x-2">
                      <Checkbox
                        id={room}
                        checked={selectedRooms.includes(room)}
                        onCheckedChange={() => handleRoomToggle(room)}
                      />
                      <Label 
                        htmlFor={room}
                        className={`flex-1 p-2 rounded border cursor-pointer ${
                          selectedRooms.includes(room) 
                            ? getRoomBadgeColor(room)
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {room}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedRooms.length === 0 
                    ? 'No rooms selected - judge will be unassigned' 
                    : `Selected ${selectedRooms.length} room${selectedRooms.length !== 1 ? 's' : ''}`
                  }
                </p>
              </div>
            </div>
          )}
          <div className="flex space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={() => editingAssignment && handleUpdateAssignment(editingAssignment.judgeId, selectedRooms)} 
              className="flex-1"
            >
              Update Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 