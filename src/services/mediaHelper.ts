/**
 * Helper utility for handling multimedia in exam questions:
 * - Detecting media types (image, audio, video)
 * - Normalizing URLs (Google Drive, YouTube, Vimeo, Dropbox, Imgur, direct files)
 * - File uploads from PC with auto-compression for photos/images
 * - Parsing markdown and HTML embedded media inside question prompts
 */

export type MediaType = 'image' | 'audio' | 'video' | 'none';

export interface ProcessedMedia {
  type: MediaType;
  originalUrl: string;
  directUrl: string;
  embedUrl?: string;
  isIframe: boolean;
  provider: 'youtube' | 'drive' | 'vimeo' | 'dropbox' | 'direct' | 'data';
  thumbnailUrl?: string;
}

export interface UploadedMediaResult {
  dataUrl: string;
  mediaType: MediaType;
  fileName: string;
  fileSize: number;
  fileSizeFormatted: string;
}

export interface PromptSegment {
  type: 'text' | 'image' | 'audio' | 'video';
  content: string;
  alt?: string;
  originalUrl?: string;
}

/**
 * Format bytes into human-readable string (KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Extract Google Drive file ID from various link styles
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url) return null;
  const match = 
    url.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)|lh3\.googleusercontent\.com\/d\/)([a-zA-Z0-9_-]{25,})/i) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]{25,})/i);
  return match ? match[1] : null;
}

/**
 * Extract YouTube video ID
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

/**
 * Extract Vimeo video ID
 */
export function extractVimeoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]{6,12})/i);
  return match ? match[1] : null;
}

/**
 * Automatically detect whether a URL or data URI represents image, audio, or video
 */
export function detectMediaType(url?: string, defaultType: MediaType = 'none'): MediaType {
  if (!url || typeof url !== 'string') return defaultType;
  const trimmed = url.trim();
  if (!trimmed) return defaultType;

  // Data URLs
  if (trimmed.startsWith('data:image/')) return 'image';
  if (trimmed.startsWith('data:audio/')) return 'audio';
  if (trimmed.startsWith('data:video/')) return 'video';

  // Video providers
  if (extractYouTubeId(trimmed) || extractVimeoId(trimmed)) return 'video';

  // File extension checks
  const cleanUrl = trimmed.split('?')[0].toLowerCase();
  
  // Audio extensions
  if (/\.(mp3|wav|ogg|m4a|aac|flac|opus|wma)$/i.test(cleanUrl)) {
    return 'audio';
  }

  // Video extensions
  if (/\.(mp4|webm|mov|mkv|avi|m4v|ogv)$/i.test(cleanUrl)) {
    return 'video';
  }

  // Image extensions
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif|ico|tiff)$/i.test(cleanUrl)) {
    return 'image';
  }

  // Known image hosts
  if (
    trimmed.includes('images.unsplash.com') ||
    trimmed.includes('imgur.com') ||
    trimmed.includes('giphy.com') ||
    trimmed.includes('cloudinary.com') ||
    trimmed.includes('freepik.com') ||
    trimmed.includes('pixabay.com') ||
    trimmed.includes('pexels.com')
  ) {
    return 'image';
  }

  // If user had a preference that is not 'none', keep it
  if (defaultType !== 'none') {
    return defaultType;
  }

  // If Google Drive link and no explicit type:
  // Google Drive files could be anything, but commonly teachers use them for images or videos.
  // Default to image if undetermined, which will try previewing image first.
  if (extractGoogleDriveId(trimmed)) {
    return 'image';
  }

  // Default fallback if it's a URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return 'image';
  }

  return defaultType;
}

/**
 * Convert any media link (Google Drive, YouTube, Vimeo, Dropbox, Imgur, direct file)
 * into a clean, embeddable and playable URL structure.
 */
export function processMediaUrl(url: string, explicitType?: MediaType): ProcessedMedia {
  const trimmed = (url || '').trim();
  const type = explicitType && explicitType !== 'none' 
    ? explicitType 
    : detectMediaType(trimmed, 'image');

  // 1. Data URLs (uploaded files from PC)
  if (trimmed.startsWith('data:')) {
    return {
      type,
      originalUrl: trimmed,
      directUrl: trimmed,
      isIframe: false,
      provider: 'data'
    };
  }

  // 2. YouTube
  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    const embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`;
    return {
      type: 'video',
      originalUrl: trimmed,
      directUrl: embedUrl,
      embedUrl,
      isIframe: true,
      provider: 'youtube',
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    };
  }

  // 3. Vimeo
  const vimeoId = extractVimeoId(trimmed);
  if (vimeoId) {
    const embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
    return {
      type: 'video',
      originalUrl: trimmed,
      directUrl: embedUrl,
      embedUrl,
      isIframe: true,
      provider: 'vimeo'
    };
  }

  // 4. Google Drive
  const driveId = extractGoogleDriveId(trimmed);
  if (driveId) {
    if (type === 'video') {
      const previewUrl = `https://drive.google.com/file/d/${driveId}/preview`;
      return {
        type: 'video',
        originalUrl: trimmed,
        directUrl: previewUrl,
        embedUrl: previewUrl,
        isIframe: true,
        provider: 'drive',
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`
      };
    } else if (type === 'audio') {
      const audioUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
      const previewUrl = `https://drive.google.com/file/d/${driveId}/preview`;
      return {
        type: 'audio',
        originalUrl: trimmed,
        directUrl: audioUrl,
        embedUrl: previewUrl,
        isIframe: false,
        provider: 'drive'
      };
    } else {
      // Image: lh3 is direct & fast, with thumbnail fallback
      const directUrl = `https://lh3.googleusercontent.com/d/${driveId}`;
      const thumbnailUrl = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;
      return {
        type: 'image',
        originalUrl: trimmed,
        directUrl,
        thumbnailUrl,
        isIframe: false,
        provider: 'drive'
      };
    }
  }

  // 5. Dropbox
  if (trimmed.includes('dropbox.com')) {
    const directUrl = trimmed.replace(/[?&]dl=0/, '?raw=1').replace(/[?&]dl=1/, '?raw=1');
    return {
      type,
      originalUrl: trimmed,
      directUrl: directUrl.includes('raw=1') ? directUrl : `${directUrl}${directUrl.includes('?') ? '&' : '?'}raw=1`,
      isIframe: false,
      provider: 'dropbox'
    };
  }

  // 6. Imgur
  if (trimmed.includes('imgur.com') && !trimmed.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    const imgurMatch = trimmed.match(/imgur\.com\/([a-zA-Z0-9]+)/);
    if (imgurMatch) {
      return {
        type: 'image',
        originalUrl: trimmed,
        directUrl: `https://i.imgur.com/${imgurMatch[1]}.jpg`,
        isIframe: false,
        provider: 'direct'
      };
    }
  }

  // 7. Direct file or normal URL
  return {
    type,
    originalUrl: trimmed,
    directUrl: trimmed,
    isIframe: false,
    provider: 'direct'
  };
}

/**
 * Handle PC file upload with auto-compression for large images
 */
export async function processLocalFile(file: File): Promise<UploadedMediaResult> {
  const fileName = file.name;
  const originalSize = file.size;

  // Detect type by mime or extension
  let mediaType: MediaType = 'image';
  if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fileName)) {
    mediaType = 'audio';
  } else if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(fileName)) {
    mediaType = 'video';
  } else if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName)) {
    mediaType = 'image';
  }

  // If Image: compress using canvas if it's large (e.g. > 400KB)
  if (mediaType === 'image' && file.type !== 'image/svg+xml' && file.type !== 'image/gif') {
    try {
      const compressedDataUrl = await compressImageFile(file, 1400, 0.85);
      // calculate approximate base64 size
      const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);
      return {
        dataUrl: compressedDataUrl,
        mediaType: 'image',
        fileName,
        fileSize: approxBytes,
        fileSizeFormatted: formatFileSize(approxBytes)
      };
    } catch {
      // Fallback to raw FileReader if canvas compression fails
    }
  }

  // Read as Data URL via FileReader
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });

  return {
    dataUrl,
    mediaType,
    fileName,
    fileSize: originalSize,
    fileSizeFormatted: formatFileSize(originalSize)
  };
}

/**
 * Compress an image file using browser canvas to maxDimension and quality
 */
function compressImageFile(file: File, maxDimension: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Prefer webp if supported, otherwise jpeg
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputMime, quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Parse question prompt to extract markdown images, HTML images, and embedded media URLs
 * Returns structured segments for rich rendering.
 */
export function parsePromptSegments(prompt: string): PromptSegment[] {
  if (!prompt) return [];

  const segments: PromptSegment[] = [];
  
  // Patterns:
  // 1. Markdown image: ![alt](url)
  // 2. HTML img: <img src="url" alt="alt" ... />
  // 3. Standalone media URL on its own line: ^https?://...$

  const lines = prompt.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Markdown image check: ![alt](url)
    const mdImageMatch = trimmed.match(/^!\[(.*?)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)$/);
    if (mdImageMatch) {
      segments.push({
        type: 'image',
        content: mdImageMatch[2],
        alt: mdImageMatch[1] || 'Gambar Soal',
        originalUrl: mdImageMatch[2]
      });
      continue;
    }

    // HTML img check: <img ... src="url" ... />
    const htmlImgMatch = trimmed.match(/<img[^>]+src=["'](https?:\/\/[^"']+|data:image\/[^"']+)["'][^>]*>/i);
    if (htmlImgMatch) {
      const altMatch = trimmed.match(/alt=["']([^"']*)["']/i);
      segments.push({
        type: 'image',
        content: htmlImgMatch[1],
        alt: altMatch ? altMatch[1] : 'Gambar Soal',
        originalUrl: htmlImgMatch[1]
      });
      continue;
    }

    // Standalone URL check
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const detected = detectMediaType(trimmed);
      if (detected !== 'none') {
        segments.push({
          type: detected,
          content: trimmed,
          alt: 'Media Tersemat',
          originalUrl: trimmed
        });
        continue;
      }
    }

    // Regular text line
    segments.push({
      type: 'text',
      content: line
    });
  }

  return segments;
}
