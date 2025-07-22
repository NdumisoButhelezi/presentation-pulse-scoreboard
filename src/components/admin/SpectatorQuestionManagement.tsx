import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { SpectatorQuestion } from '@/types';
import { 
  createSpectatorQuestion, 
  updateSpectatorQuestion, 
  deleteSpectatorQuestion, 
  getSpectatorQuestions 
} from '@/lib/firebase';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  GripVertical, 
  Eye, 
  EyeOff,
  Users,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SpectatorQuestionManagementProps {
  searchTerm?: string;
}

export function SpectatorQuestionManagement({ searchTerm = '' }: SpectatorQuestionManagementProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<SpectatorQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SpectatorQuestion | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    question: '',
    description: '',
    isActive: true,
    order: 0
  });

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const questionsData = await getSpectatorQuestions();
      setQuestions(questionsData);
    } catch (error) {
      console.error('Error loading attendee questions:', error);
      toast({
        title: "Error",
        description: "Failed to load attendee questions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      question: '',
      description: '',
      isActive: true,
      order: questions.length
    });
    setEditingQuestion(null);
  };

  const handleEdit = (question: SpectatorQuestion) => {
    setFormData({
      question: question.question,
      description: question.description || '',
      isActive: question.isActive,
      order: question.order
    });
    setEditingQuestion(question);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);
    try {
      if (editingQuestion) {
        await updateSpectatorQuestion(editingQuestion.id, {
          ...formData,
          updatedAt: new Date()
        });
        toast({
          title: "Success",
          description: "Attendee question updated successfully",
        });
      } else {
        await createSpectatorQuestion({
          ...formData,
          createdBy: currentUser.id
        });
        toast({
          title: "Success",
          description: "Attendee question created successfully",
        });
      }
      await loadQuestions();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving attendee question:', error);
      toast({
        title: "Error",
        description: "Failed to save attendee question",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    setLoading(true);
    try {
      await deleteSpectatorQuestion(questionId);
      toast({
        title: "Success",
        description: "Attendee question deleted successfully",
      });
      await loadQuestions();
    } catch (error) {
      console.error('Error deleting attendee question:', error);
      toast({
        title: "Error",
        description: "Failed to delete attendee question",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (question: SpectatorQuestion) => {
    try {
      await updateSpectatorQuestion(question.id, {
        isActive: !question.isActive
      });
      toast({
        title: "Success",
        description: `Question ${!question.isActive ? 'activated' : 'deactivated'}`,
      });
      await loadQuestions();
    } catch (error) {
      console.error('Error toggling question status:', error);
      toast({
        title: "Error",
        description: "Failed to update question status",
        variant: "destructive",
      });
    }
  };

  const filteredQuestions = questions.filter(question =>
    question.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (question.description && question.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Attendee Questions</h2>
            <p className="text-muted-foreground mt-2">
              Manage rating questions that attendees use to evaluate presentations
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion ? 'Edit Question' : 'Add New Question'}
              </DialogTitle>
              <DialogDescription>
                Create questions that attendees will use to rate presentations
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="question">Question *</Label>
                <Input
                  id="question"
                  value={formData.question}
                  onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="e.g., How clear was the presentation?"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Additional context or guidance for attendees"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="isActive">Active (visible to attendees)</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : (editingQuestion ? 'Update' : 'Create')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {loading && questions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Loading questions...</p>
            </CardContent>
          </Card>
        ) : filteredQuestions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No questions match your search.' : 'No attendee questions created yet.'}
              </p>
              {!searchTerm && (
                <Button 
                  className="mt-4" 
                  onClick={() => { resetForm(); setIsDialogOpen(true); }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Question
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredQuestions.map((question, index) => (
            <Card key={question.id} className={`transition-all ${!question.isActive ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full text-sm font-medium">
                      {question.order + 1}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{question.question}</CardTitle>
                      {question.description && (
                        <p className="text-sm text-muted-foreground mt-1">{question.description}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant={question.isActive ? "default" : "secondary"}>
                          {question.isActive ? (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Created {question.createdAt.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(question)}
                    >
                      {question.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(question)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Question</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this question? This action cannot be undone.
                            All existing attendee ratings for this question will be lost.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(question.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <HelpCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Tips for creating effective attendee questions:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Keep questions clear and specific</li>
                <li>Focus on aspects attendees can observe (clarity, engagement, content relevance)</li>
                <li>Use a 1-5 rating scale like judges (1 = Poor, 5 = Excellent)</li>
                <li>Limit to 3-5 questions to avoid survey fatigue</li>
                <li>Test questions with a few attendees before going live</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 