import { downscaleConstraints } from '@/config/public';

/**
 * Client-side image preparation, run once per picked file.
 *
 * Two problems are solved in a single decode:
 *
 * 1. Upload weight. A modern phone photo is 8-12 MB, while a vision model
 *    gains nothing above roughly 1600px on the long edge - it downscales
 *    internally anyway. Re-encoding first turns a minute of mobile upload into
 *    a couple of seconds.
 * 2. Decode cost. Rendering the original file into a thumbnail-sized `<img>`
 *    forces the browser to decode the full resolution, and reading its pixel
 *    dimensions through a second `Image` used to decode it all over again.
 *    `createImageBitmap` decodes once, off the main thread where supported,
 *    and the bitmap is released immediately afterwards.
 *
 * The original width, height and byte size are reported back so quality
 * judgement keeps describing the photo the user actually took rather than our
 * re-encoding of it.
 */

export type PreparedUpload = {
  /** The file to upload: re-encoded when that is a clear win, else the original. */
  file: File;
  /** Object URL of a small preview. The caller owns it and must revoke it. */
  previewUrl: string;
  /** Dimensions and size of the file the user picked, before any downscale. */
  source: { width: number; height: number; byteSize: number };
  /** True when `file` is a re-encoded, smaller version of the original. */
  downscaled: boolean;
};

/** Replaces the extension so the name matches the re-encoded content. */
function toJpegName(filename: string): string {
  return `${filename.replace(/\.[^.]+$/, '')}.jpg`;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', downscaleConstraints.quality),
  );
}

/**
 * Falls back to the untouched file whenever anything is unavailable or the
 * re-encode does not pay for itself. Never throws: a preparation problem must
 * not stop someone from uploading.
 */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  const untouched = (): PreparedUpload => ({
    file,
    previewUrl: URL.createObjectURL(file),
    source: { width: 0, height: 0, byteSize: file.size },
    downscaled: false,
  });

  if (typeof createImageBitmap !== 'function') return untouched();

  let bitmap: ImageBitmap;
  try {
    // `from-image` bakes the EXIF rotation into the pixels, so a photo taken
    // sideways reaches the model the right way up.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return untouched();
  }

  const width = bitmap.width;
  const height = bitmap.height;
  const source = { width, height, byteSize: file.size };

  try {
    const scale = Math.min(
      1,
      downscaleConstraints.maxEdge / Math.max(width, height),
    );
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return { ...untouched(), source };
    }

    // JPEG has no alpha; without this a transparent PNG turns black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToBlob(canvas);
    if (!blob) {
      return { ...untouched(), source };
    }

    // Re-encoding an already small or already efficient file can make it
    // bigger. Only keep the result when it is a real saving.
    const saving = 1 - blob.size / Math.max(1, file.size);
    if (saving < downscaleConstraints.minSaving) {
      return { ...untouched(), source };
    }

    const prepared = new File([blob], toJpegName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });

    return {
      file: prepared,
      previewUrl: URL.createObjectURL(prepared),
      source,
      downscaled: true,
    };
  } finally {
    // Frees the decoded pixels straight away instead of waiting for GC. A
    // 12 MP photo holds roughly 48 MB while it is open.
    bitmap.close();
  }
}
