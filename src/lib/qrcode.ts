import QRCode from 'qrcode';

/**
 * Generate QR code for a presentation
 * Creates a QR code that links to a rating page for the specific presentation
 */
export async function generatePresentationQRCode(presentationId: string, title: string): Promise<string> {
  try {
    // Create the URL that the QR code will point to
    const baseUrl = window.location.origin;
    const ratingUrl = `${baseUrl}/rate/${presentationId}`;
    
    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(ratingUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate the rating URL for a presentation
 */
export function getPresentationRatingUrl(presentationId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/rate/${presentationId}`;
}

/**
 * Extract presentation ID from a rating URL
 */
export function extractPresentationIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const rateIndex = pathParts.indexOf('rate');
    
    if (rateIndex !== -1 && rateIndex + 1 < pathParts.length) {
      return pathParts[rateIndex + 1];
    }
    
    return null;
  } catch {
    return null;
  }
} 