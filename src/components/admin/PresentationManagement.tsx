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
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Plus, Edit, Trash2, Upload, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function PresentationManagement() {
  const { toast } = useToast();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
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
      }
    }
  };

  const bulkImportConferencePresentations = async () => {
    const conferencePresentations = [
      // Day 1 - AZANIA ROOM
      {
        title: "Performance Analysis of Deep Learning Techniques in Brain Tumor Segmentation",
        authors: ["Kevin Moorgas", "Nelendran Pillay", "Shaveen Maharaj"],
        abstract: "This research analyzes the performance of various deep learning techniques for brain tumor segmentation in medical imaging.",
        room: "AZANIA",
        sessionDate: "2025-07-23",
        startTime: "10h50",
        endTime: "11h15",
        paperId: "1571139421"
      },
      {
        title: "Epistemic Network Analysis: Artificial Intelligence Systems, Linguistic Tools, and Pedagogical Practices Pathways",
        authors: ["Anass Bayaga"],
        abstract: "An epistemic network analysis exploring the pathways between AI systems, linguistic tools, and pedagogical practices.",
        room: "AZANIA",
        sessionDate: "2025-07-23",
        startTime: "11h15",
        endTime: "11h40",
        paperId: "1571144460"
      },
      {
        title: "A Bibliometric Analysis of Embedding Techniques for Addressing Meaning Conflation Deficiency in Low-Resourced Languages",
        authors: ["Mosima A. Masethe", "Sunday O. Ojo", "Hlaudi D. Masethe"],
        abstract: "A comprehensive bibliometric analysis of embedding techniques for addressing meaning conflation in low-resourced languages.",
        room: "AZANIA",
        sessionDate: "2025-07-23",
        startTime: "11h40",
        endTime: "12h05",
        paperId: "1571149138"
      },
      {
        title: "Towards a Circular Economy in Mobile Communications Technology: A Systematic Review",
        authors: ["Rozeena Ebrahim", "Chris Burger", "Moshe Timothy Masonta", "Siyanda Sikrenya", "Obakeng R Hlatshwayo"],
        abstract: "A systematic review examining the transition towards a circular economy in mobile communications technology.",
        room: "AZANIA",
        sessionDate: "2025-07-23",
        startTime: "12h05",
        endTime: "12h30",
        paperId: "1571132262"
      },
      
      // Day 1 - ALOE ROOM
      {
        title: "Using Machine Learning to Predict Loss to Follow-Up from Antiretroviral Therapy Care: A Case of HIV Clinics in Lilongwe, Malawi",
        authors: ["Agness Thawani", "Bennett Kankuzi"],
        abstract: "Application of machine learning techniques to predict patient loss to follow-up in HIV treatment programs in Malawi.",
        room: "ALOE",
        sessionDate: "2025-07-23",
        startTime: "10h50",
        endTime: "11h15",
        paperId: "1571149077"
      },
      {
        title: "Towards a Systemic Framework for the Theory and Practice of Agile Software Development",
        authors: ["Victoria Macha", "Jeanette Wing", "Theo Andrew"],
        abstract: "Development of a systemic framework for understanding and implementing agile software development practices.",
        room: "ALOE",
        sessionDate: "2025-07-23",
        startTime: "11h15",
        endTime: "11h40",
        paperId: "1571143925"
      },
      {
        title: "Impact of Encoding Techniques on Convolutional Neural Networks Performance in DNA Sequence Classification: A Comparative Study of One-Hot and TF-IDF",
        authors: ["Theresa Omolayo Ojewumi", "Justice Ono Emuoyibofarhe", "Akinyinka Tosin Akindele"],
        abstract: "Comparative analysis of encoding techniques for DNA sequence classification using convolutional neural networks.",
        room: "ALOE",
        sessionDate: "2025-07-23",
        startTime: "11h40",
        endTime: "12h05",
        paperId: "1571148868"
      },
      {
        title: "Designing a Swahili-Speaking Medical Chatbot for Oncology, Dermatology, and Otorhinolaryngology Care in Low-Resource Settings",
        authors: ["Divin Kayeye Kabeya", "Witesyavwirwa Vianney Kambale", "Jean-Gilbert Mbula Mboma", "Vincent Nsasi Bendo", "Selain Kasereka", "Kyandoghere Kyamakya"],
        abstract: "Development of a Swahili-speaking medical chatbot for specialized healthcare domains in resource-constrained environments.",
        room: "ALOE",
        sessionDate: "2025-07-23",
        startTime: "12h05",
        endTime: "12h30",
        paperId: "1571149785"
      },
      
      // Day 1 - CYCAD ROOM
      {
        title: "Hybrid Multi-Objective Swarm Intelligence and Self-Evolving Neural Networks for Grid Stability in Renewable-Heavy Systems",
        authors: ["Kwabena Addo", "Katleho Moloi", "Musasa Kabeya", "Evans Eshiemogie Ojo"],
        abstract: "Development of hybrid swarm intelligence and neural network approaches for maintaining grid stability in renewable energy systems.",
        room: "CYCAD",
        sessionDate: "2025-07-23",
        startTime: "10h50",
        endTime: "11h15",
        paperId: "1571125202"
      },
      {
        title: "Melting Efficiency in Secondary Aluminum Foundry Application",
        authors: ["Khutsiso R. Chiloane-Nkomo", "S. Pouabe Eboule", "Jan Harm C. Pretorius"],
        abstract: "Analysis and optimization of melting efficiency in secondary aluminum foundry operations.",
        room: "CYCAD",
        sessionDate: "2025-07-23",
        startTime: "11h15",
        endTime: "11h40",
        paperId: "1571127817"
      },
      {
        title: "Load Frequency Control of an Interconnected Power System: Analysis of Frequency and Power Regulation",
        authors: ["Luyanda Sbahle Zulu", "Namhla Faith Mtukushe", "Evans Eshiemogie Ojo"],
        abstract: "Comprehensive analysis of load frequency control mechanisms in interconnected power systems.",
        room: "CYCAD",
        sessionDate: "2025-07-23",
        startTime: "11h40",
        endTime: "12h05",
        paperId: "1571132484"
      },
      {
        title: "Energy Storage Systems in South Africa: A Comprehensive Review of Policy Challenges and Opportunities for MV/LV Networks",
        authors: ["O. Apata", "F.C. Mushid"],
        abstract: "Comprehensive review of energy storage systems implementation challenges and opportunities in South African power networks.",
        room: "CYCAD",
        sessionDate: "2025-07-23",
        startTime: "12h05",
        endTime: "12h30",
        paperId: "1571149360"
      },

      // Day 1 Afternoon Sessions
      {
        title: "Considerations for a Simplified Temperature Calibration Procedure for Infrared Cameras",
        authors: ["Mathews Chirindo", "Mirriam Molekoa"],
        abstract: "Development of simplified calibration procedures for infrared camera temperature measurements.",
        room: "AZANIA",
        sessionDate: "2025-07-23",
        startTime: "15h25",
        endTime: "15h50",
        paperId: "1571147946"
      },
      {
        title: "Machine Learning-Based Detection and Classification of SQL Injection Attacks Using a Stacking Ensemble Model",
        authors: ["Gbeminiyi Falowo", "Blessing Oluwatobi Olorunfemi", "Abidemi Emmanuel Adeniyi", "Oguntunde Boladale Abosede", "Emeka Ogbuju", "Oluwasegun Julius Aroba"],
        abstract: "Implementation of stacking ensemble models for detecting and classifying SQL injection attacks.",
        room: "ALOE",
        sessionDate: "2025-07-23",
        startTime: "15h25",
        endTime: "15h50",
        paperId: "1571123580"
      },
      {
        title: "Design, Simulation, and Analysis of PMSG For Hydroelectric Plant Based on the Concept of the Generalized Theory of Electrical Machines",
        authors: ["Kershan Moodley", "Sandile Maduna", "Mbuleleo Ngongonma", "Evans Eshiemogie Ojo"],
        abstract: "Design and analysis of permanent magnet synchronous generators for hydroelectric applications.",
        room: "CYCAD",
        sessionDate: "2025-07-23",
        startTime: "15h25",
        endTime: "15h50",
        paperId: "1571129303"
      },
      {
        title: "Hybrid CNN-GRU Framework for Intelligent Video Advertisement Classification",
        authors: ["Roseline Oluwaseun Ogundokun", "Pius Adewale Owolawi", "Etienne van Wyk"],
        abstract: "Development of hybrid CNN-GRU framework for automated video advertisement classification.",
        room: "KHANYA",
        sessionDate: "2025-07-23",
        startTime: "15h25",
        endTime: "15h50",
        paperId: "1571128769"
      }
    ];

    try {
      let imported = 0;
      for (const presentation of conferencePresentations) {
        const { paperId, ...presentationData } = presentation;
        await addDoc(collection(db, 'presentations'), presentationData);
        imported++;
      }
      
      toast({
        title: "Success",
        description: `Successfully imported ${imported} conference presentations`,
      });
      
      loadPresentations();
    } catch (error) {
      console.error('Error importing presentations:', error);
      toast({
        title: "Error",
        description: "Failed to import presentations",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Presentation Management</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={bulkImportConferencePresentations}>
            <Upload className="h-4 w-4 mr-2" />
            Import Conference Data
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Presentation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingPresentation ? 'Edit Presentation' : 'Add New Presentation'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="authors">Authors (comma-separated)</Label>
                    <Input
                      id="authors"
                      value={formData.authors}
                      onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                      placeholder="John Doe, Jane Smith"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="abstract">Abstract</Label>
                    <Textarea
                      id="abstract"
                      value={formData.abstract}
                      onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="room">Room</Label>
                    <Select value={formData.room} onValueChange={(value) => setFormData({ ...formData, room: value })}>
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
                      onChange={(e) => setFormData({ ...formData, sessionDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      placeholder="10h50"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      placeholder="11h15"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingPresentation ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4">
        {presentations.map((presentation) => (
          <Card key={presentation.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{presentation.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {presentation.authors.join(', ')}
                  </p>
                  <p className="text-sm mb-3 line-clamp-2">{presentation.abstract}</p>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{presentation.room}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {presentation.sessionDate} • {presentation.startTime}-{presentation.endTime}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(presentation)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(presentation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}