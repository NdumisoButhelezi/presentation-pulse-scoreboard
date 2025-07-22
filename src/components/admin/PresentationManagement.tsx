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
import { Plus, Edit, Trash2, Upload, RefreshCw, AlertTriangle, FileText, Search, Filter } from 'lucide-react';
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
  const [filterRoom, setFilterRoom] = useState<string>('all');

  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    presentingAuthor: '',
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
      presentingAuthor: '',
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
      presentingAuthor: formData.presentingAuthor,
      abstract: formData.abstract,
      room: formData.room,
      sessionDate: formData.sessionDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      judgeScores: [],
      spectatorLikes: 0,
      totalVotes: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      if (editingPresentation) {
        await updateDoc(doc(db, 'presentations', editingPresentation.id), {
          ...presentationData,
          updatedAt: new Date()
        });
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
      
      setIsDialogOpen(false);
      resetForm();
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
      authors: presentation.authors?.join(', ') || '',
      presentingAuthor: (presentation as any).presentingAuthor || '',
      abstract: presentation.abstract || '',
      room: presentation.room || '',
      sessionDate: presentation.sessionDate || '',
      startTime: presentation.startTime || '',
      endTime: presentation.endTime || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this presentation?')) return;
    
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
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL presentations? This action cannot be undone.')) return;
    
    setDeleting('all');
    try {
      const snapshot = await getDocs(collection(db, 'presentations'));
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      toast({
        title: "Success",
        description: "All presentations deleted successfully",
      });
      loadPresentations();
    } catch (error) {
      console.error('Error deleting all presentations:', error);
      toast({
        title: "Error",
        description: "Failed to delete all presentations",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkImport = async () => {
    setUploading(true);
    setUploadProgress(0);
    try {
      await bulkImportConferencePresentations(toast);
      setUploadProgress(100);
      toast({
        title: "Import Complete",
        description: "Conference presentations imported successfully",
      });
      loadPresentations();
    } catch (error) {
      console.error('Error importing presentations:', error);
      toast({
        title: "Import Error",
        description: "Failed to import presentations",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const [title, authors, abstract, room, sessionDate, startTime, endTime] = line.split('|');
        
        if (title && authors) {
          await addDoc(collection(db, 'presentations'), {
            title: title.trim(),
            authors: authors.split(',').map(a => a.trim()),
            abstract: abstract?.trim() || '',
            room: room?.trim() || '',
            sessionDate: sessionDate?.trim() || '',
            startTime: startTime?.trim() || '',
            endTime: endTime?.trim() || '',
            judgeScores: [],
            spectatorLikes: 0,
            totalVotes: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
        
        setUploadProgress((i / lines.length) * 100);
      }
      
      toast({
        title: "Upload Complete",
        description: "Presentations uploaded successfully",
      });
      loadPresentations();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload presentations",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Filter presentations based on search term and room filter
  const filteredPresentations = presentations.filter(presentation => {
    const matchesSearch = !searchTerm || 
      presentation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      presentation.authors?.some(author => 
        author.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      presentation.abstract?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRoom = filterRoom === 'all' || presentation.room === filterRoom;
    
    return matchesSearch && matchesRoom;
  });

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Presentation Management</h2>
          <p className="text-muted-foreground">
            Manage conference presentations and schedules
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Presentation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingPresentation ? 'Edit Presentation' : 'Add New Presentation'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="Presentation title"
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="authors">Authors *</Label>
                    <Input
                      id="authors"
                      value={formData.authors}
                      onChange={(e) => setFormData({...formData, authors: e.target.value})}
                      placeholder="Author names (comma separated)"
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="presentingAuthor">Presenting Author *</Label>
                    <Input
                      id="presentingAuthor"
                      value={formData.presentingAuthor}
                      onChange={(e) => setFormData({...formData, presentingAuthor: e.target.value})}
                      placeholder="Presenting author name"
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="abstract">Abstract</Label>
                    <Textarea
                      id="abstract"
                      value={formData.abstract}
                      onChange={(e) => setFormData({...formData, abstract: e.target.value})}
                      placeholder="Presentation abstract"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="room">Room</Label>
                    <Select value={formData.room} onValueChange={(value) => setFormData({...formData, room: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select room" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROOMS.map(room => (
                          <SelectItem key={room} value={room}>{room}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="sessionDate">Session Date</Label>
                    <Input
                      id="sessionDate"
                      type="date"
                      value={formData.sessionDate}
                      onChange={(e) => setFormData({...formData, sessionDate: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingPresentation ? 'Update' : 'Create'} Presentation
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBulkImport} disabled={uploading} className="flex-1 sm:flex-none">
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Bulk Import</span>
                  <span className="sm:hidden">Import</span>
                </>
              )}
            </Button>
            
            <Button variant="destructive" onClick={handleDeleteAll} disabled={deleting === 'all'} className="flex-1 sm:flex-none">
              {deleting === 'all' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Delete All</span>
                  <span className="sm:hidden">Clear All</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filter by Room:</span>
        </div>
        <Select value={filterRoom} onValueChange={setFilterRoom}>
          <SelectTrigger className="w-full sm:w-48">
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

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Upload Presentations from File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file with columns: Title|Authors|Abstract|Room|SessionDate|StartTime|EndTime
            </p>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                disabled={uploading}
                className="flex-1"
              />
              {uploading && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">{Math.round(uploadProgress)}%</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Presentations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Presentations ({filteredPresentations.length})
            </div>
            {loading && (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Loading presentations...</p>
            </div>
          ) : filteredPresentations.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No presentations found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPresentations.map((presentation) => (
                <div key={presentation.id} className="border rounded-lg p-4 sm:p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{presentation.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {presentation.authors?.join(', ')}
                      </p>
                      {presentation.abstract && (
                        <p className="text-sm mt-2 line-clamp-2">{presentation.abstract}</p>
                      )}
                      {(presentation as any).presentingAuthor && (
                        <p className="text-xs text-blue-700 font-semibold mt-1">Presenting Author: {(presentation as any).presentingAuthor}</p>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(presentation)}
                        className="min-w-[80px]"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(presentation.id)}
                        disabled={deleting === presentation.id}
                        className="min-w-[80px]"
                      >
                        {deleting === presentation.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Delete</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {presentation.room && (
                      <Badge variant="secondary">{presentation.room}</Badge>
                    )}
                    {presentation.sessionDate && (
                      <Badge variant="outline">{presentation.sessionDate}</Badge>
                    )}
                    {presentation.startTime && presentation.endTime && (
                      <Badge variant="outline">
                        {presentation.startTime} - {presentation.endTime}
                      </Badge>
                    )}
                    <Badge variant="default">
                      {(presentation as any).totalVotes || 0} votes
                    </Badge>
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