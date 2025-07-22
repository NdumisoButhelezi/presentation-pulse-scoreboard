import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, serverTimestamp, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, updatePassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import { Users, Plus, Pencil, Trash2, Search, UserCheck, UserX, Crown, Gavel, Eye, Shield, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/lib/firebase';

interface UserManagementProps {
  searchTerm?: string;
}

export function UserManagement({ searchTerm = '' }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { toast } = useToast();
  const { currentUser } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'spectator' as User['role'],
    isActive: true
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('Loading users from Firestore...');
      
      // Try without orderBy first to see if that's the issue
      const snapshot = await getDocs(collection(db, 'users'));
      console.log('Raw snapshot:', snapshot.size, 'documents');
      
      const userData = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('User document:', doc.id, data);
        return {
          id: doc.id,
          ...data,
          // Ensure required fields have defaults
          isActive: data.isActive !== undefined ? data.isActive : true,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null
        };
      }) as User[];
      
      console.log('Processed user data:', userData.length, 'users');
      setUsers(userData);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    try {
      if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
        toast({
          title: "Validation Error",
          description: "Name, email, and password are required.",
          variant: "destructive",
        });
        return;
      }

      if (formData.password.length < 6) {
        toast({
          title: "Password Too Short",
          description: "Password must be at least 6 characters long.",
          variant: "destructive",
        });
        return;
      }

      // Check if email already exists
      const existingUserQuery = query(
        collection(db, 'users'), 
        where('email', '==', formData.email.toLowerCase())
      );
      const existingUserSnapshot = await getDocs(existingUserQuery);
      
      if (!existingUserSnapshot.empty) {
        toast({
          title: "Email Already Exists",
          description: "A user with this email already exists.",
          variant: "destructive",
        });
        return;
      }

      // Use a secondary Firebase Auth instance
      let secondaryApp;
      if (!getApps().some(app => app.name === 'Secondary')) {
        secondaryApp = initializeApp(firebaseConfig, 'Secondary');
      } else {
        secondaryApp = getApps().find(app => app.name === 'Secondary');
      }
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        formData.email.toLowerCase().trim(),
        formData.password
      );

      // Create user document in Firestore
      const newUser = {
        name: formData.name.trim(),
        email: formData.email.toLowerCase().trim(),
        role: formData.role,
        isActive: formData.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Use the Firebase Auth UID as the document ID
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      await secondaryAuth.signOut();
      
      toast({
        title: "User Created",
        description: `User ${formData.name} has been created successfully with a Firebase Auth account.`,
      });

      setIsAddDialogOpen(false);
      resetForm();
      loadUsers();
    } catch (error: any) {
      console.error('Error adding user:', error);
      
      // Provide specific error messages for common Firebase Auth errors
      let errorMessage = "Failed to create user. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already registered with a Firebase account.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address format.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password is too weak. Please use a stronger password.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;

    try {
      if (!formData.name.trim() || !formData.email.trim()) {
        toast({
          title: "Validation Error",
          description: "Name and email are required.",
          variant: "destructive",
        });
        return;
      }

      // Validate password if provided
      if (formData.password.trim() && formData.password.length < 6) {
        toast({
          title: "Password Too Short",
          description: "Password must be at least 6 characters long.",
          variant: "destructive",
        });
        return;
      }

      // Check if email already exists (excluding current user)
      const existingUserQuery = query(
        collection(db, 'users'), 
        where('email', '==', formData.email.toLowerCase())
      );
      const existingUserSnapshot = await getDocs(existingUserQuery);
      const existingUser = existingUserSnapshot.docs.find(doc => doc.id !== editingUser.id);
      
      if (existingUser) {
        toast({
          title: "Email Already Exists",
          description: "Another user with this email already exists.",
          variant: "destructive",
        });
        return;
      }

      const updatedUser = {
        name: formData.name.trim(),
        email: formData.email.toLowerCase().trim(),
        role: formData.role,
        isActive: formData.isActive,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'users', editingUser.id), updatedUser);
      
      // Note about password changes
      let successMessage = `User ${formData.name} has been updated successfully.`;
      if (formData.password.trim()) {
        successMessage += ' Note: Password changes require admin privileges and are handled separately for security.';
      }
      
      toast({
        title: "User Updated",
        description: successMessage,
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      resetForm();
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (user: User) => {
    try {
      // Prevent self-deletion
      if (user.id === currentUser?.id) {
        toast({
          title: "Cannot Delete",
          description: "You cannot delete your own account.",
          variant: "destructive",
        });
        return;
      }

      await deleteDoc(doc(db, 'users', user.id));
      
      toast({
        title: "User Deleted",
        description: `User ${user.name} has been deleted successfully.`,
      });

      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleActiveStatus = async (user: User) => {
    try {
      // Prevent deactivating own account
      if (user.id === currentUser?.id && user.isActive) {
        toast({
          title: "Cannot Deactivate",
          description: "You cannot deactivate your own account.",
          variant: "destructive",
        });
        return;
      }

      const updatedStatus = !user.isActive;
      await updateDoc(doc(db, 'users', user.id), {
        isActive: updatedStatus,
        updatedAt: serverTimestamp()
      });

      toast({
        title: updatedStatus ? "User Activated" : "User Deactivated",
        description: `User ${user.name} has been ${updatedStatus ? 'activated' : 'deactivated'}.`,
      });

      loadUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({
        title: "Error",
        description: "Failed to update user status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const createTestUser = async () => {
    try {
      const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        role: 'spectator' as User['role'],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log('Creating test user:', testUser);
      await addDoc(collection(db, 'users'), testUser);
      
      toast({
        title: "Test User Created",
        description: "A test user has been created to help with debugging.",
      });

      loadUsers();
    } catch (error) {
      console.error('Error creating test user:', error);
      toast({
        title: "Error",
        description: "Failed to create test user: " + (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password for security
      role: user.role,
      isActive: user.isActive ?? true
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'spectator',
      isActive: true
    });
  };

  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'conference-chair':
        return <Crown className="h-4 w-4" />;
      case 'judge':
        return <Gavel className="h-4 w-4" />;
      case 'spectator':
        return <Eye className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getRoleBadgeColor = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'conference-chair':
        return 'default';
      case 'judge':
        return 'secondary';
      case 'spectator':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getRoleDisplayName = (role: User['role']) => {
    switch (role) {
      case 'conference-chair':
        return 'Conference Chair';
      case 'judge':
        return 'Judge';
      case 'spectator':
        return 'Attendee';
      case 'admin':
        return 'Administrator';
      default:
        return role;
    }
  };

  // Filter users based on search term, role, and status
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && user.isActive !== false) ||
      (filterStatus === 'inactive' && user.isActive === false);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const userStats = {
    total: users.length,
    active: users.filter(u => u.isActive !== false).length,
    admins: users.filter(u => u.role === 'admin').length,
    conferenceChairs: users.filter(u => u.role === 'conference-chair').length,
    judges: users.filter(u => u.role === 'judge').length,
    attendees: users.filter(u => u.role === 'spectator').length
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{userStats.total}</div>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{userStats.active}</div>
            <p className="text-xs text-muted-foreground">Active Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{userStats.admins}</div>
            <p className="text-xs text-muted-foreground">Administrators</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{userStats.conferenceChairs}</div>
            <p className="text-xs text-muted-foreground">Conference Chairs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{userStats.judges}</div>
            <p className="text-xs text-muted-foreground">Judges</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">{userStats.attendees}</div>
            <p className="text-xs text-muted-foreground">Attendees</p>
          </CardContent>
        </Card>
      </div>

      {/* Main User Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              User Management
            </div>
            <div className="flex space-x-2">
              <Button onClick={loadUsers} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {users.length === 0 && (
                <Button onClick={createTestUser} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Test User
                </Button>
              )}
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Create a new user account with Firebase authentication. The user will be able to log in with the email and password you provide.
                    </p>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter user's full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter user's email address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter user's password"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Password must be at least 6 characters long. The user can change it after logging in.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as User['role'] }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spectator">Attendee</SelectItem>
                          <SelectItem value="judge">Judge</SelectItem>
                          <SelectItem value="conference-chair">Conference Chair</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="technical-chair">Technical Chair</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                      />
                      <Label htmlFor="isActive">Active User</Label>
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-4">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={handleAddUser} className="flex-1">
                      Create User
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted rounded-lg">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="roleFilter">Filter by Role</Label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Administrators</SelectItem>
                  <SelectItem value="conference-chair">Conference Chairs</SelectItem>
                  <SelectItem value="judge">Judges</SelectItem>
                  <SelectItem value="spectator">Attendees</SelectItem>
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
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No users found matching your criteria.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          {getRoleIcon(user.role)}
                          <span>{user.name}</span>
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeColor(user.role)}>
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {user.isActive !== false ? (
                            <UserCheck className="h-4 w-4 text-green-600" />
                          ) : (
                            <UserX className="h-4 w-4 text-red-600" />
                          )}
                          <span className={user.isActive !== false ? "text-green-600" : "text-red-600"}>
                            {user.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex space-x-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActiveStatus(user)}
                            disabled={user.id === currentUser?.id && user.isActive}
                          >
                            {user.isActive !== false ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={user.id === currentUser?.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {user.name}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter user's full name"
              />
            </div>
            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter user's email address"
              />
            </div>
            <div>
              <Label htmlFor="editPassword">New Password (optional)</Label>
              <Input
                id="editPassword"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Leave blank to keep current password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to keep the current password. Enter a new password to change it.
              </p>
            </div>
            <div>
              <Label htmlFor="editRole">Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as User['role'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spectator">Attendee</SelectItem>
                  <SelectItem value="judge">Judge</SelectItem>
                  <SelectItem value="conference-chair">Conference Chair</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="technical-chair">Technical Chair</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="editIsActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="editIsActive">Active User</Label>
            </div>
          </div>
          <div className="flex space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleEditUser} className="flex-1">
              Update User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 