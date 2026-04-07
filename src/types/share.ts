export type SharePlatform = 'whatsapp' | 'x' | 'copy';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: string;
  onShare: (platform: SharePlatform) => void;
}

export interface SocialCardConfig {
  suggestion: string;
  emoji: string;
  vibe: string;
}

export interface ShareData {
  text: string;
  imageUrl?: string;
  url: string;
}
