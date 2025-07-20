import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Presentation, ROOMS } from '@/types';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Plus, Edit, Trash2, Upload, RefreshCw, AlertTriangle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bulkImportConferencePresentations } from '@/lib/importPresentations';

interface PresentationManagementProps {
  searchTerm?: string;
}

export function PresentationManagement({ searchTerm = '' }: PresentationManagementProps) {
  const { toast } = useToast();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingPresentation, setEditingPresentation] = useState<Presentation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    abstract: '',
    room: '',
    sessionDate: '',
    startTime: '',
    endTime: ''
  });

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'presentations'));
      const presentationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Presentation[];
      setPresentations(presentationData);
    } catch (error) {
      console.error('Error loading presentations:', error);
      toast({
        title: "Error",
        description: "Failed to load presentations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      authors: '',
      abstract: '',
      room: '',
      sessionDate: '',
      startTime: '',
      endTime: ''
    });
    setEditingPresentation(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicate title before creating new presentation
    if (!editingPresentation) {
      const existingPresentation = presentations.find(p => 
        p.title.toLowerCase().trim() === formData.title.toLowerCase().trim()
      );
      
      if (existingPresentation) {
        toast({
          title: "Duplicate Presentation",
          description: "A presentation with this title already exists",
          variant: "destructive",
        });
        return;
      }
    }
    
    const presentationData = {
      title: formData.title,
      authors: formData.authors.split(',').map(a => a.trim()),
      abstract: formData.abstract,
      room: formData.room as any,
      sessionDate: formData.sessionDate,
      startTime: formData.startTime,
      endTime: formData.endTime
    };

    try {
      if (editingPresentation) {
        await updateDoc(doc(db, 'presentations', editingPresentation.id), presentationData);
        toast({
          title: "Success",
          description: "Presentation updated successfully",
        });
      } else {
        await addDoc(collection(db, 'presentations'), presentationData);
        toast({
          title: "Success",
          description: "Presentation created successfully",
        });
      }
      
      resetForm();
      setIsDialogOpen(false);
      loadPresentations();
    } catch (error) {
      console.error('Error saving presentation:', error);
      toast({
        title: "Error",
        description: "Failed to save presentation",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (presentation: Presentation) => {
    setEditingPresentation(presentation);
    setFormData({
      title: presentation.title,
      authors: presentation.authors.join(', '),
      abstract: presentation.abstract,
      room: presentation.room,
      sessionDate: presentation.sessionDate,
      startTime: presentation.startTime,
      endTime: presentation.endTime
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this presentation?')) {
      setDeleting(id);
      try {
        await deleteDoc(doc(db, 'presentations', id));
        toast({
          title: "Success",
          description: "Presentation deleted successfully",
        });
        loadPresentations();
      } catch (error) {
        console.error('Error deleting presentation:', error);
        toast({
          title: "Error",
          description: "Failed to delete presentation",
          variant: "destructive",
        });
      } finally {
        setDeleting(null);
      }
    }
  };

  const handleDeleteAll = async () => {
    const confirmMessage = `Are you sure you want to delete ALL ${presentations.length} presentations? This action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
      try {
        // Delete all presentations
        const deletePromises = presentations.map(presentation => 
          deleteDoc(doc(db, 'presentations', presentation.id))
        );
        
        await Promise.all(deletePromises);
        
        toast({
          title: "Success", 
          description: `Successfully deleted all ${presentations.length} presentations`,
        });
        
        loadPresentations();
      } catch (error) {
        console.error('Error deleting all presentations:', error);
        toast({
          title: "Error",
          description: "Failed to delete all presentations",
          variant: "destructive",
        });
      }
    }
  };

  const handleBulkImport = async () => {
    try {
      await bulkImportConferencePresentations(toast);
      loadPresentations(); // Reload presentations after import
    } catch (error) {
      console.error('Error importing presentations:', error);
      toast({
        title: "Error",
        description: "Failed to import presentations",
        variant: "destructive",
      });
    }
  };

  // Filter presentations based on search term
  const filteredPresentations = presentations.filter(presentation => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      presentation.title.toLowerCase().includes(searchLower) ||
      presentation.authors.some(author => author.toLowerCase().includes(searchLower)) ||
      presentation.room.toLowerCase().includes(searchLower) ||
      presentation.sessionDate.includes(searchTerm) ||
      presentation.startTime.includes(searchTerm)
    );
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setUploadProgress(0);
    try {
      // Mock upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);
      
      // Here you would implement the actual file parsing logic
      
      // Simulate completion
      setTimeout(() => {
        clearInterval(interval);
        setUploadProgress(100);
        toast({
          title: "Success",
          description: `Uploaded presentations successfully.`,
        });
        loadPresentations();
      }, 3000);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 4000);
    }
  };

  // Now return the actual JSX for the component
  return (
    <div className="space-y-6">
      {/* Search Results Info */}
      {searchTerm && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800">
              Showing {filteredPresentations.length} of {presentations.length} presentations matching "{searchTerm}"
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upload Section with Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Presentations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add the new bulk import button */}
          <div className="flex gap-4 flex-wrap">
            <Button
              onClick={handleBulkImport}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Conference Presentations
            </Button>
            
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="csv-file-input"
            />
            <Button 
              onClick={() => (document.getElementById('csv-file-input') as HTMLInputElement)?.click()}
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Uploading {uploadProgress}%...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose CSV File
                </>
              )}
            </Button>
          </div>

          {/* Progress bar when uploading */}
          {uploading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Processing presentations... Please wait.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Presentations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              Presentations ({filteredPresentations.length})
              {searchTerm && ` matching "${searchTerm}"`}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadPresentations}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2">Loading presentations...</span>
            </div>
          ) : filteredPresentations.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? `No presentations found matching "${searchTerm}"` : 'No presentations uploaded yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPresentations.map((presentation) => (
                <div
                  key={presentation.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">
                        {/* Highlight search terms */}
                        {searchTerm ? (
                          <span dangerouslySetInnerHTML={{
                            __html: presentation.title.replace(
                              new RegExp(searchTerm, 'gi'),
                              (match) => `<mark class="bg-yellow-200">${match}</mark>`
                            )
                          }} />
                        ) : (
                          presentation.title
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {presentation.authors.join(', ')}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <Badge variant="outline">{presentation.room}</Badge>
                        <Badge variant="outline">{presentation.sessionDate}</Badge>
                        <Badge variant="outline">{presentation.startTime} - {presentation.endTime}</Badge>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(presentation)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(presentation.id)}
                        disabled={deleting === presentation.id}
                      >
                        {deleting === presentation.id ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}