import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { User, Presentation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Download, RefreshCw, FileText } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Improved wrapText: breaks at word or character level
function wrapText(text: string, font: any, fontSize: number, maxWidth: number) {
  const words = text.split(' ');
  let lines: string[] = [];
  let currentLine = '';
  for (let word of words) {
    let testLine = currentLine ? currentLine + ' ' + word : word;
    let width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
      // Word itself is too long, break at character level
      let chars = word.split('');
      let chunk = '';
      for (let c of chars) {
        let testChunk = chunk + c;
        if (font.widthOfTextAtSize(testChunk, fontSize) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = c;
        } else {
          chunk = testChunk;
        }
      }
      if (chunk) {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = chunk;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export function CertificateManagement() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    setLoading(true);
    try {
      // Only include presentations that have been rated (have at least one vote)
      const q = query(collection(db, 'presentations'));
      const snapshot = await getDocs(q);
      const list: Presentation[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Presentation;
        // Only include if there is at least one judge score or attendee rating
        if ((data.judgeScores && data.judgeScores.length > 0) || (data.spectatorRatings && data.spectatorRatings.length > 0)) {
          list.push({ ...data, id: docSnap.id });
        }
      });
      setPresentations(list);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load presentations.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCertificate = async (presentation: Presentation) => {
    try {
      const templateUrl = '/certificate-template.pdf';
      const templateBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(templateBytes);
      const page = pdfDoc.getPages()[0];
      // Try to embed Calibri (MS) font if available, fallback to Helvetica
      let font;
      try {
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      } catch {
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
      const author = presentation.authors && presentation.authors.length > 0 ? presentation.authors[0] : 'Unknown Author';
      const title = presentation.title || 'Untitled Paper';
      const pageHeight = page.getHeight();
      const centerX = (text: string, fontSize: number) => (page.getWidth() - font.widthOfTextAtSize(text, fontSize)) / 2;
      // Author name (move left by 80px total, bold)
      let boldFont;
      try {
        boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      } catch {
        boldFont = font;
      }
      page.drawText(author, {
        x: centerX(author, 20) - 80,
        y: pageHeight - 260,
        size: 20,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      // Paper title (move left by 58px total to start at left margin)
      const leftMargin = 140;
      const rightMargin = 180;
      const maxTitleWidth = page.getWidth() - leftMargin - rightMargin;
      const titleFontSize = 15.9;
      const titleLines = wrapText(title, font, titleFontSize, maxTitleWidth);
      let titleY = pageHeight - 325;
      for (const line of titleLines) {
        const lineWidth = font.widthOfTextAtSize(line, titleFontSize);
        const x = leftMargin + (maxTitleWidth - lineWidth) / 2-30;
        page.drawText(line, {
          x,
          y: titleY,
          size: titleFontSize,
          font,
          color: rgb(215/255, 182/255, 128/255), // #d7b680
        });
        titleY -= 26; // 22 + 4px gap for readability
      }
      // Fetch technical chair and conference chair users with signatures
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', 'in', ['conference-chair', 'technical-chair'])));
      const chairUsers = usersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => (u as any).signature && (u as any).signature.data);
      // After filtering chairUsers, sort so technical chair is first (left), conference chair is second (right)
      const sortedChairUsers = [...chairUsers].sort((a, b) => {
        const roleA = (a as any).role;
        const roleB = (b as any).role;
        if (roleA === 'technical-chair') return -1;
        if (roleB === 'technical-chair') return 1;
        return 0;
      });
      // Draw signatures (up to 2, left and right)
      const sigY = 170; // was 220, move down by 50px
      const sigWidth = 120;
      const sigHeight = 48;
      const sigSpacing = 80;
      const startX = page.getWidth() / 2 - (chairUsers.length === 2 ? sigWidth + sigSpacing/2 : sigWidth/2);
      sortedChairUsers.forEach((user, idx) => {
        const x = startX + idx * (sigWidth + sigSpacing) - 50; // move left by 50px
        // Draw signature image
        pdfDoc.embedPng((user as any).signature.data).then(sigImg => {
          page.drawImage(sigImg, {
            x,
            y: sigY,
            width: sigWidth,
            height: sigHeight,
            opacity: 0.6, // 60% transparent
          });
          // Do NOT draw name and role below signature
        });
      });
      // Save and download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${author.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Certificate Error',
        description: 'Failed to generate certificate.',
        variant: 'destructive',
      });
    }
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificate Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 text-sm text-muted-foreground">
          Generate and download certificates for all rated presentations.
        </div>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading presentations...</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Author</TableHead>
                <TableHead>Paper Title</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presentations.map(pres => (
                <TableRow key={pres.id}>
                  <TableCell>{pres.authors && pres.authors.length > 0 ? pres.authors[0] : 'Unknown Author'}</TableCell>
                  <TableCell>{pres.title}</TableCell>
                  <TableCell>
                    <Button onClick={() => handleDownloadCertificate(pres)} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download Certificate
                    </Button>
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