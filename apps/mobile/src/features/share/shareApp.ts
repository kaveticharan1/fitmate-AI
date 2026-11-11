import { Share } from 'react-native';
import { FitmateShare } from '../../../modules/fitmate-share';

/** Always the newest release; tapping it in WhatsApp downloads the installer. */
export const DOWNLOAD_URL = 'https://github.com/kaveticharan1/fitmate-AI/releases/latest/download/FitMate.apk';
export const RELEASES_URL = 'https://github.com/kaveticharan1/fitmate-AI/releases/latest';

export const canShareFile = (): boolean => !!FitmateShare;

/** Installed app size in MB (rounded), or null if unknown. */
export function appSizeMb(): number | null {
  try {
    const bytes = FitmateShare?.appSize() ?? 0;
    return bytes > 0 ? Math.round(bytes / (1024 * 1024)) : null;
  } catch {
    return null;
  }
}

/**
 * Shares the installable app file with a message. Where file sharing isn't
 * available, shares the message (which carries the download link) instead.
 */
export async function shareAppFile(message: string, chooserTitle: string): Promise<'file' | 'text'> {
  if (FitmateShare) {
    await FitmateShare.shareApp(message, chooserTitle);
    return 'file';
  }
  await Share.share({ message });
  return 'text';
}

/** Shares just the message with the download link (small, quick to send). */
export async function shareAppLink(message: string): Promise<void> {
  await Share.share({ message });
}
