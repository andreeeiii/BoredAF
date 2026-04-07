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
  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/?text=${encodedText}`;
    console.log('Opening WhatsApp URL:', url);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Failed to open WhatsApp:', error);
    alert('Failed to open WhatsApp. Please try again.');
  }
}

export function shareViaX(text: string): void {
  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://twitter.com/intent/tweet?text=${encodedText}`;
    console.log('Opening X (Twitter) URL:', url);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Failed to open X (Twitter):', error);
    alert('Failed to open X (Twitter). Please try again.');
  }
}

export async function copyToClipboard(text: string, imageUrl?: string): Promise<boolean> {
  try {
    // First try to copy text only (most reliable)
    await navigator.clipboard.writeText(text);
    
    // If we have an image, try to copy it separately
    if (imageUrl) {
      try {
        const blob = await dataUrlToBlob(imageUrl);
        const file = new File([blob], 'baf-rescue.png', { type: 'image/png' });
        
        // Try to copy the image
        await navigator.clipboard.write([
          new ClipboardItem({
            [file.type]: file,
          }),
        ]);
      } catch (imageError) {
        console.warn('Could not copy image, but text was copied:', imageError);
        // Text was already copied, so this is still a success
      }
    }
    
    return true;
  } catch (error) {
    console.error('Clipboard copy failed:', error);
    
    // Fallback for older browsers
    try {
      // Create a temporary textarea element
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return successful;
    } catch (fallbackError) {
      console.error('Fallback clipboard copy failed:', fallbackError);
      return false;
    }
  }
}

export async function handleShare(platform: SharePlatform, suggestion: string, imageUrl?: string): Promise<void> {
  const shareText = generateShareText(suggestion);
  console.log('Sharing to platform:', platform, 'with text:', shareText);

  switch (platform) {
    case 'whatsapp':
      console.log('Opening WhatsApp share...');
      shareViaWhatsApp(shareText);
      break;
    case 'x':
      console.log('Opening X (Twitter) share...');
      shareViaX(shareText);
      break;
    case 'copy':
      console.log('Copying to clipboard...');
      const success = await copyToClipboard(shareText, imageUrl);
      if (success) {
        console.log('Successfully copied to clipboard!');
        // Show user feedback
        alert('Link copied to clipboard! 📋');
      } else {
        console.error('Failed to copy to clipboard');
        alert('Failed to copy to clipboard. Please try again.');
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
