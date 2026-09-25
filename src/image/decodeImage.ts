export interface DecodedImage {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

const SUPPORTED_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;

export function validateImageFile(file: File): void {
  if (file.size === 0) throw new Error(`"${file.name}" is empty.`);
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`"${file.name}" is larger than the 40MB image limit.`);
  }
  if (!file.type.startsWith('image/') && !SUPPORTED_IMAGE_EXTENSIONS.test(file.name)) {
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  }
}

/** Decode and downsample in the browser. The domain simplifier receives
 * plain RGBA data and remains independent of DOM/browser APIs. */
export async function decodeImageFile(file: File, maxEdgePx: number): Promise<DecodedImage> {
  validateImageFile(file);
  const source = await loadImageSource(file);
  try {
    const scale = Math.min(1, maxEdgePx / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser could not prepare the image for processing.');
    context.drawImage(source.image, 0, 0, width, height);
    return { width, height, rgba: context.getImageData(0, 0, width, height).data };
  } finally {
    source.dispose();
  }
}

async function loadImageSource(file: File): Promise<{
  image: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('This image could not be decoded.'));
      image.src = url;
    });
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
