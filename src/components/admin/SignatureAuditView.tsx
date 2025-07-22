import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SignatureDisplay } from '@/components/ui/signature-display';
import { User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SignatureAuditView() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [judges, setJudges] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadJudges();
  }, []);

  const loadJudges = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const judgeList: User[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data() as User;
        // Ensure ID is set
        data.id = docSnap.id;
        if (data.role === 'judge' || data.role === 'conference-chair' || data.role === 'technical-chair') {
          judgeList.push(data);
        }
      });
      setJudges(judgeList);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load judges.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSignature = async (userId: string) => {
    setDeletingId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), {
        signature: null,
        signatureOnboardingComplete: false,
        updatedAt: new Date(),
      });
      toast({
        title: 'Signature Deleted',
        description: 'Judge can now re-do their signature.',
      });
      loadJudges();
    } catch (error) {
      toast({
        title: 'Delete Error',
        description: 'Failed to delete signature.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Judge Signature Audit</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 text-sm text-muted-foreground">
          System Administrator can see which judges have signed and delete signatures if needed.
        </div>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading judges...</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {judges.map(judge => (
                <TableRow key={judge.id}>
                  <TableCell>{judge.name}</TableCell>
                  <TableCell>{judge.email}</TableCell>
                  <TableCell>{judge.role}</TableCell>
                  <TableCell>
                    {judge.signature?.data ? (
                      <SignatureDisplay user={judge} size="sm" showLabel={false} />
                    ) : (
                      <span className="text-xs text-gray-500">No signature</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {judge.signature?.data ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle className="h-4 w-4 mr-1 inline" /> Signed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                        <XCircle className="h-4 w-4 mr-1 inline" /> Not Signed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {judge.signature?.data && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingId === judge.id}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Signature</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this judge's signature? They will be required to re-sign on next login.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSignature(judge.id!)}>
                              Delete Signature
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
} 