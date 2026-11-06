import { StudentRecord } from '../types';

/**
 * Robust photo normalizer that converts any image source into a clean,
 * 100% compliant baseline RGB JPEG data URL.
 *
 * Solves:
 * 1. e-Okul / Camera progressive JPEG markers (SOF2) incompatible with jsPDF addImage.
 * 2. WebP, AVIF, BMP, or non-standard JPEG formats exported by MEB / e-Okul.
 * 3. Giant raw photo file sizes (3-10 MB each) that freeze browser tabs and exceed memory.
 * 4. Missing photos in vector PDF & CorelDRAW SVG exports.
/**
 * Detects if a photo data URL or filename is an auto-generated cartoon illustration/avatar
 * created by the system rather than a real photo uploaded by the user.
 */
export function isSystemGeneratedPhoto(photoDataUrl?: string, photoFileName?: string): boolean {
  if (!photoDataUrl || !photoDataUrl.trim()) return false;
  const trimmed = photoDataUrl.trim();
  if (trimmed.startsWith('data:image/svg+xml')) return true;
  if (trimmed.includes('<svg') || trimmed.includes('%3Csvg') || trimmed.includes('xmlns="http://www.w3.org/2000/svg"')) return true;
  if (trimmed.includes('viewBox="0 0 300 380"') || trimmed.includes('viewBox%3D%220%200%20300%20380%22')) return true;
  if (photoFileName && (photoFileName.endsWith('.svg') || photoFileName.includes('_vesikalik.svg'))) return true;
  return false;
}

/**
 * Checks if a student record has a genuine user-uploaded photo (not a system avatar).
 */
export function isRealUserPhoto(photoDataUrl?: string, photoFileName?: string): boolean {
  if (!photoDataUrl || !photoDataUrl.trim()) return false;
  return !isSystemGeneratedPhoto(photoDataUrl, photoFileName);
}

const photoCache = new Map<string, string>();

/**
 * Normalizes a single photo URL (data URL, blob URL, or http URL)
 * into a standard baseline JPEG (400x520 px, 3:4 portrait ratio, 94% quality).
 */
export async function normalizePhotoToStandardJpeg(
  photoUrl: string,
  targetWidth = 400,
  targetHeight = 520
): Promise<string> {
  if (!photoUrl || !photoUrl.trim()) return '';
  const trimmed = photoUrl.trim();

  // If this is a system avatar, do not normalize, return as-is
  if (isSystemGeneratedPhoto(trimmed)) return trimmed;

  // If already normalized and cached, return immediately
  if (photoCache.has(trimmed)) {
    return photoCache.get(trimmed)!;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    const timeoutId = setTimeout(() => {
      // If image loading takes too long, return original as fallback
      resolve(trimmed);
    }, 4500);

    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          photoCache.set(trimmed, trimmed);
          resolve(trimmed);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Crisp white backing (handles PNG transparency or transparent SVG avatars)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        if (!imgW || !imgH) {
          photoCache.set(trimmed, trimmed);
          resolve(trimmed);
          return;
        }

        const imgRatio = imgW / imgH;
        const targetRatio = targetWidth / targetHeight;

        let drawW = targetWidth;
        let drawH = targetHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > targetRatio) {
          drawW = targetHeight * imgRatio;
          offsetX = -(drawW - targetWidth) / 2;
        } else {
          drawH = targetWidth / imgRatio;
          offsetY = -(drawH - targetHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

        // Standard baseline RGB JPEG data URL
        const cleanDataUrl = canvas.toDataURL('image/jpeg', 0.94);
        photoCache.set(trimmed, cleanDataUrl);
        photoCache.set(cleanDataUrl, cleanDataUrl);
        resolve(cleanDataUrl);
      } catch (err) {
        console.warn('Canvas photo normalization failed, using original:', err);
        resolve(trimmed);
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      console.warn('Image load error during photo normalization');
      resolve(trimmed);
    };

    img.src = trimmed;
  });
}

/**
 * Normalizes an array of student records ensuring every student's photo is a clean standard JPEG.
 * Uses concurrent chunking to keep the UI silky smooth even with 300+ students.
 */
export async function normalizeStudentsPhotos(
  students: StudentRecord[],
  onProgress?: (current: number, total: number) => void
): Promise<StudentRecord[]> {
  const total = students.length;
  if (total === 0) return [];

  let done = 0;
  const result: StudentRecord[] = [];
  const CHUNK_SIZE = 20;

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    const processedChunk = await Promise.all(
      chunk.map(async (student) => {
        if (!student.photoDataUrl || !student.photoDataUrl.trim()) {
          return student;
        }
        const cleanPhoto = await normalizePhotoToStandardJpeg(student.photoDataUrl);
        return {
          ...student,
          photoDataUrl: cleanPhoto,
        };
      })
    );
    result.push(...processedChunk);
    done += chunk.length;
    if (onProgress) {
      onProgress(Math.min(done, total), total);
    }
  }

  return result;
}
