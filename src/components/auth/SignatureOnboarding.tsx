import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import SignaturePad from 'signature_pad';
import { PenTool, Award, FileText, Users, Pen, Eraser, RefreshCw, Save, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SignatureOnboardingProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function SignatureOnboarding({ isOpen, onComplete }: SignatureOnboardingProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Signature pad instance
  const signaturePadRef = useRef<SignaturePad | null>(null);
  
  // State
  const [step, setStep] = useState<'welcome' | 'signature' | 'confirm'>('welcome');
  const [isSaving, setIsSaving] = useState(false);
  const [signatureData, setSignatureData] = useState<string>('');
  
  // Drawing settings
  const penColor = '#000000'; // Always black
  const [penWidth, setPenWidth] = useState(3);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 200 });

  useEffect(() => {
    if (step === 'signature') {
      initializeCanvas();
    }
    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
      }
    };
  }, [step]);

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
      
      // Initialize SignaturePad with professional settings
      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: penColor,
        minWidth: penWidth * 0.6,
        maxWidth: penWidth * 1.8,
        throttle: 16,
        minDistance: 1,
      });

      console.log('Judge signature pad initialized');
    } catch (error) {
      console.error('Error initializing signature pad:', error);
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

  const handleNextStep = () => {
    if (step === 'welcome') {
      setStep('signature');
    } else if (step === 'signature') {
      if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
        toast({
          title: "Signature Required",
          description: "Please create your digital signature before proceeding.",
          variant: "destructive",
        });
        return;
      }
      
      const signature = signaturePadRef.current.toDataURL();
      setSignatureData(signature);
      setStep('confirm');
    }
  };

  const handlePreviousStep = () => {
    if (step === 'confirm') {
      setStep('signature');
    } else if (step === 'signature') {
      setStep('welcome');
    }
  };

  const handleSaveSignature = async () => {
    if (!currentUser?.id || !signatureData) {
      toast({
        title: "Save Error",
        description: "Unable to save signature. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const signatureDoc = {
        data: signatureData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'users', currentUser.id), {
        signature: signatureDoc,
        signatureOnboardingComplete: true,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Signature Saved Successfully!",
        description: "Your digital signature has been created and will be used for certificate generation.",
      });

      onComplete();
    } catch (error) {
      console.error('Error saving judge signature:', error);
      toast({
        title: "Save Error",
        description: `Failed to save signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderWelcomeStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <PenTool className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome, {currentUser?.name}!</h2>
          <p className="text-gray-600 mt-2">Let's set up your digital signature for certificate generation</p>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-800">
            <Award className="h-5 w-5 mr-2" />
            Your Signature Will Be Used For
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start space-x-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Certificate Generation</p>
              <p className="text-sm text-blue-700">Your signature will appear on certificates awarded to presentation authors</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <Users className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Official Recognition</p>
              <p className="text-sm text-blue-700">Adds authenticity and professionalism to awards and acknowledgments</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">One-Time Setup</p>
              <p className="text-sm text-blue-700">You only need to create this signature once</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Privacy Note:</strong> Your signature is securely stored and will only be used for official certificate generation within this conference system.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderSignatureStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Create Your Digital Signature</h2>
        <p className="text-gray-600 mt-2">Draw your signature below using your mouse, stylus, or touch</p>
      </div>

      {/* Drawing Controls */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-6 p-4 bg-gray-50 rounded-lg">
          {/* Removed Color Selection */}
          <div className="flex items-center space-x-2">
            <Label htmlFor="penWidth" className="text-sm font-medium">Width:</Label>
            <Input
              id="penWidth"
              type="range"
              min="1"
              max="8"
              value={penWidth}
              onChange={(e) => setPenWidth(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-gray-600 w-8">{penWidth}px</span>
          </div>
        </div>
      </div>

      {/* Drawing Canvas */}
      <div className="text-center">
        <div className="inline-block border-2 border-dashed border-gray-300 rounded-lg p-6 bg-white">
          <canvas
            ref={canvasRef}
            className="border border-gray-300 rounded-lg cursor-crosshair shadow-sm"
            style={{ touchAction: 'none' }}
          />
          <p className="text-sm text-gray-500 mt-3">
            Sign your name above as you would on official documents
          </p>
        </div>
      </div>

      {/* Canvas Controls */}
      <div className="flex justify-center space-x-3">
        <Button variant="outline" onClick={clearCanvas}>
          <Eraser className="h-4 w-4 mr-2" />
          Clear
        </Button>
        <Button variant="outline" onClick={undoLastStroke}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Undo
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Tip:</strong> Create a clear, professional signature that represents how you normally sign documents. This will appear on certificates given to authors.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Confirm Your Signature</h2>
        <p className="text-gray-600 mt-2">Please review your signature before saving</p>
      </div>

      <div className="text-center">
        <div className="inline-block p-6 border-2 border-gray-200 rounded-lg bg-white shadow-sm">
          <img
            src={signatureData}
            alt="Your signature preview"
            className="max-w-full h-auto"
            style={{ maxHeight: '200px' }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-3">
          This signature will appear on certificates for presentation authors
        </p>
      </div>

      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Ready to Save</p>
              <p className="text-sm text-green-700">Your signature looks great and is ready to be used for certificate generation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> If you made a mistake or need to update your signature later, please contact the admin for assistance.
        </AlertDescription>
      </Alert>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <PenTool className="h-6 w-6 mr-2 text-blue-600" />
              Judge Signature Setup
            </div>
            <Badge variant="outline" className="text-xs">
              Step {step === 'welcome' ? '1' : step === 'signature' ? '2' : '3'} of 3
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6">
          {step === 'welcome' && renderWelcomeStep()}
          {step === 'signature' && renderSignatureStep()}
          {step === 'confirm' && renderConfirmStep()}
        </div>

        <div className="flex justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePreviousStep}
            disabled={step === 'welcome' || isSaving}
          >
            Previous
          </Button>
          
          <div className="flex space-x-3">
            {step === 'confirm' ? (
              <Button
                onClick={handleSaveSignature}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Complete Setup'}
              </Button>
            ) : (
              <Button
                onClick={handleNextStep}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {step === 'welcome' ? 'Get Started' : 'Next Step'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 