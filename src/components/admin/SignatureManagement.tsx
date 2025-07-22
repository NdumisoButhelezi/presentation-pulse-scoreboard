import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import SignaturePad from 'signature_pad';
import { Pen, Eraser, RefreshCw, Download, Save, Eye, Trash2, PenTool } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SignatureManagementProps {
  searchTerm?: string;
}

export function SignatureManagement({ searchTerm = '' }: SignatureManagementProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Signature pad instance
  const signaturePadRef = useRef<SignaturePad | null>(null);
  
  // State
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentSignature, setCurrentSignature] = useState<{data: string, createdAt: any, updatedAt?: any} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Drawing settings
  const [penColor, setPenColor] = useState('#000000');
  const [penWidth, setPenWidth] = useState(2);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 200 });

  useEffect(() => {
    initializeCanvas();
    loadExistingSignature();
    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
      }
    };
  }, []);

  // Update signature pad settings when pen settings change
  useEffect(() => {
    if (signaturePadRef.current) {
      signaturePadRef.current.penColor = penColor;
      signaturePadRef.current.minWidth = penWidth * 0.5;
      signaturePadRef.current.maxWidth = penWidth * 2;
    }
  }, [penColor, penWidth]);

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('Canvas ref not available');
      return;
    }

    try {
      // Set canvas size
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      
      // Clean up existing signature pad
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
      }
      
      // Initialize SignaturePad
      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: penColor,
        minWidth: penWidth * 0.5,
        maxWidth: penWidth * 2,
        throttle: 16,
        minDistance: 1,
      });

      console.log('SignaturePad initialized successfully');

      // Handle signature change
      signaturePadRef.current.addEventListener('endStroke', () => {
        setIsDrawing(false);
      });

      signaturePadRef.current.addEventListener('beginStroke', () => {
        setIsDrawing(true);
      });
    } catch (error) {
      console.error('Error initializing SignaturePad:', error);
    }
  };

  const loadExistingSignature = () => {
    if (currentUser?.signature) {
      setCurrentSignature(currentUser.signature);
    }
  };

  const clearCanvas = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const undoLastStroke = () => {
    if (signaturePadRef.current) {
      const data = signaturePadRef.current.toData();
      if (data.length > 0) {
        data.pop();
        signaturePadRef.current.fromData(data);
      }
    }
  };

  const saveSignature = async () => {
    console.log('saveSignature called');
    console.log('currentUser:', currentUser);
    console.log('currentUser?.id:', currentUser?.id);
    
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      toast({
        title: "No Signature",
        description: "Please draw your signature first.",
        variant: "destructive",
      });
      return;
    }

    if (!currentUser?.id) {
      console.error('User validation failed:', {
        currentUser,
        userId: currentUser?.id,
        userKeys: currentUser ? Object.keys(currentUser) : 'no user'
      });
      toast({
        title: "Save Error",
        description: "User not found or user ID missing.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const signatureDataUrl = signaturePadRef.current.toDataURL();
      
      if (!signatureDataUrl || signatureDataUrl.length < 100) {
        throw new Error('Invalid signature data generated');
      }

      const signatureData = {
        data: signatureDataUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('Saving signature for user:', currentUser.id);
      console.log('Signature data length:', signatureData.data.length);

      await updateDoc(doc(db, 'users', currentUser.id), {
        signature: signatureData,
        updatedAt: serverTimestamp(),
      });

      // Set local state with current date for immediate display
      setCurrentSignature({
        data: signatureDataUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      clearCanvas();

      toast({
        title: "Signature Saved",
        description: "Your signature has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving signature:', error);
      toast({
        title: "Save Error",
        description: `Failed to save signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSignature = async () => {
    if (!currentUser?.id) return;

    try {
      await updateDoc(doc(db, 'users', currentUser.id), {
        signature: null,
        updatedAt: serverTimestamp(),
      });

      setCurrentSignature(null);
      clearCanvas();

      toast({
        title: "Signature Deleted",
        description: "Your signature has been removed.",
      });
    } catch (error) {
      console.error('Error deleting signature:', error);
      toast({
        title: "Delete Error",
        description: `Failed to delete signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const downloadSignature = () => {
    if (!currentSignature?.data) return;

    const link = document.createElement('a');
    link.download = `signature-${currentUser?.name || 'user'}.png`;
    link.href = currentSignature.data;
    link.click();
  };

  // Only allow judges, conference chairs, and technical chairs to manage signatures
  if (!currentUser || (currentUser.role !== 'judge' && currentUser.role !== 'conference-chair' && currentUser.role !== 'technical-chair')) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Signature management is only available for judges, conference chairs, and technical chairs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <PenTool className="h-5 w-5 mr-2" />
              Digital Signature Management
            </div>
            <Badge variant="outline" className="text-xs">
              {currentUser.role === 'judge' ? 'Judge' : 'Conference Chair'}
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Current Signature Display */}
      {currentSignature && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Eye className="h-5 w-5 mr-2" />
                Current Signature
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadSignature}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Signature</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete your signature? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteSignature}>
                        Delete Signature
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <img
                src={currentSignature.data}
                alt="Current Signature"
                className="border rounded-lg mx-auto max-w-full"
                style={{ maxHeight: '200px' }}
              />
              <p className="text-xs text-muted-foreground mt-4">
                Created: {new Date(currentSignature.createdAt?.toDate?.() || currentSignature.createdAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signature Drawing Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Pen className="h-5 w-5 mr-2" />
            {currentSignature ? 'Update' : 'Create'} Signature
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drawing Controls */}
          <div className="flex flex-wrap gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="penColor">Pen Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="penColor"
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="w-12 h-8 p-0 border-0"
                />
                <span className="text-sm text-muted-foreground">{penColor}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="penWidth">Pen Width</Label>
              <Input
                id="penWidth"
                type="range"
                min="1"
                max="10"
                value={penWidth}
                onChange={(e) => setPenWidth(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">{penWidth}px</span>
            </div>
          </div>

          {/* Drawing Canvas */}
          <div className="text-center">
            <div className="inline-block border-2 border-dashed border-muted-foreground rounded-lg p-4">
              <canvas
                ref={canvasRef}
                className="border border-gray-300 rounded-lg cursor-crosshair"
                style={{ touchAction: 'none' }}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Draw your signature above using your mouse or touch
              </p>
            </div>
          </div>

          {/* Canvas Controls */}
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={clearCanvas}>
              <Eraser className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button variant="outline" onClick={undoLastStroke}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <Button 
              onClick={saveSignature} 
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving ? 'Saving...' : 'Save Signature'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 