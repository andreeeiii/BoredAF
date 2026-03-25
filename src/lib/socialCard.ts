import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { SocialCardConfig } from '@/types/share';

export async function generateSocialCard(config: SocialCardConfig): Promise<string> {
  const { suggestion, emoji, vibe } = config;
  
  // Generate QR code
  const qrCodeDataUrl = await QRCode.toDataURL('https://bored-af.app/join', {
    width: 120,
    margin: 1,
    color: {
      dark: '#ffffff',
      light: '#6200ea',
    },
  });

  // Create the social card HTML
  const cardHtml = `
    <div style="
      width: 360px;
      height: 640px;
      background: linear-gradient(135deg, #6200ea 0%, #3700b3 50%, #000000 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 40px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
      position: relative;
      overflow: hidden;
    ">
      <!-- Watermark -->
      <div style="
        position: absolute;
        top: 10px;
        right: 10px;
        font-size: 12px;
        opacity: 0.3;
        font-weight: bold;
      ">BAF</div>
      
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">BAF rescued me from boredom! 🛸</div>
      </div>
      
      <!-- Main Content -->
      <div style="
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        margin: 20px 0;
      ">
        <div style="
          font-size: 48px;
          margin-bottom: 20px;
          text-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">${emoji}</div>
        <div style="
          font-size: 20px;
          font-weight: bold;
          line-height: 1.3;
          margin-bottom: 10px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">BAF told me to:</div>
        <div style="
          font-size: 24px;
          font-weight: bold;
          line-height: 1.4;
          background: rgba(255,255,255,0.1);
          padding: 15px 20px;
          border-radius: 15px;
          border: 2px solid rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          max-width: 300px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${suggestion}</div>
        <div style="
          font-size: 16px;
          opacity: 0.8;
          margin-top: 15px;
          font-style: italic;
        ">${vibe}</div>
      </div>
      
      <!-- Footer with QR Code -->
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 20px;
      ">
        <img src="${qrCodeDataUrl}" alt="QR Code" style="
          width: 120px;
          height: 120px;
          border-radius: 10px;
          border: 3px solid rgba(255,255,255,0.3);
          margin-bottom: 10px;
        " />
        <div style="
          font-size: 14px;
          opacity: 0.8;
          text-align: center;
        ">Scan to join BAF</div>
        <div style="
          font-size: 12px;
          opacity: 0.6;
          text-align: center;
          margin-top: 5px;
        ">bored-af.app/join</div>
      </div>
    </div>
  `;

  // Create a temporary div to render the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = cardHtml;
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  document.body.appendChild(tempDiv);

  try {
    // Generate the PNG image
    const dataUrl = await toPng(tempDiv.firstElementChild as HTMLElement, {
      width: 360,
      height: 640,
      quality: 0.9,
      pixelRatio: 2,
    });

    return dataUrl;
  } finally {
    // Clean up the temporary div
    document.body.removeChild(tempDiv);
  }
}
