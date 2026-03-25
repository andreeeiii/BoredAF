import { SharePlatform, ShareData } from '@/types/share';

export function generateShareText(suggestion: string): string {
  return `I was Bored AF, but the AI just rescued me. It told me to: ${suggestion}. Try it: https://bored-af.app/join`;
}

export async function shareViaWebShareAPI(shareData: ShareData): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  try {
    const files = shareData.imageUrl ? [await dataUrlToFile(shareData.imageUrl, 'baf-rescue.png')] : undefined;
    
    await navigator.share({
      title: 'BAF Rescue!',
      text: shareData.text,
      url: shareData.url,
      files,
    });
    
    return true;
  } catch (error) {
    console.error('Web Share API failed:', error);
    return false;
  }
}

export function shareViaWhatsApp(text: string): void {
  const encodedText = encodeURIComponent(text);
  const url = `https://wa.me/?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function shareViaX(text: string): void {
  const encodedText = encodeURIComponent(text);
  const url = `https://twitter.com/intent/tweet?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyToClipboard(text: string, imageUrl?: string): Promise<boolean> {
  try {
    if (imageUrl && navigator.clipboard && navigator.clipboard.write) {
      // Try to copy both text and image
      const blob = await dataUrlToBlob(imageUrl);
      const files = [new File([blob], 'baf-rescue.png', { type: 'image/png' })];
      
      await navigator.clipboard.write([
        new ClipboardItem({
          [files[0].type]: files[0],
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
    } else {
      // Fallback to text only
      await navigator.clipboard.writeText(text);
    }
    
    return true;
  } catch (error) {
    console.error('Clipboard copy failed:', error);
    return false;
  }
}

export async function handleShare(platform: SharePlatform, suggestion: string, imageUrl?: string): Promise<void> {
  const shareText = generateShareText(suggestion);
  const shareData: ShareData = {
    text: shareText,
    imageUrl,
    url: 'https://bored-af.app/join',
  };

  switch (platform) {
    case 'whatsapp':
      shareViaWhatsApp(shareText);
      break;
    case 'x':
      shareViaX(shareText);
      break;
    case 'copy':
      const success = await copyToClipboard(shareText, imageUrl);
      if (success) {
        // Could show a toast notification here
        console.log('Copied to clipboard!');
      }
      break;
  }
}

// Helper functions
async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const blob = await dataUrlToBlob(dataUrl);
  return new File([blob], filename, { type: 'image/png' });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

// Check if mobile device
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
