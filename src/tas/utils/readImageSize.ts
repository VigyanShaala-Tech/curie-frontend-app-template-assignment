/**
 * Read the pixel size of an uploaded template image.
 * Saved templates keep whatever size was stored; only a newly chosen file is measured.
 * The page constants are the fallback before a file is chosen, not a size every image is forced into.
 */

export const TEMPLATE_PAGE_WIDTH = 794;
export const TEMPLATE_PAGE_HEIGHT = 1123;

export interface ImageFileSize {
  width: number;
  height: number;
  url: string;
}

export function readImageSize(file: File): Promise<ImageFileSize> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read the template image size.'));
        return;
      }
      resolve({ width: img.naturalWidth, height: img.naturalHeight, url });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the template image size.'));
    };
    img.src = url;
  });
}
