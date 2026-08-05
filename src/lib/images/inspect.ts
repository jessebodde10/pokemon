/**
 * Minimal image inspector.
 *
 * Reads the real format and pixel dimensions from the file header instead of
 * trusting the browser-supplied MIME type or extension, which is the whole
 * point of server-side upload validation. Implemented by hand so the MVP does
 * not need a native image dependency.
 */

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export type ImageInfo = {
  format: ImageFormat;
  width: number;
  height: number;
};

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length > 16 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16)
  );
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } {
  return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
}

function jpegDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    // Standalone markers carry no length field.
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    const length = readUint16BE(bytes, offset + 2);
    // SOF0..SOF15, excluding DHT (c4), JPG (c8) and DAC (cc).
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      return {
        height: readUint16BE(bytes, offset + 5),
        width: readUint16BE(bytes, offset + 7),
      };
    }
    if (length <= 0) return null;
    offset += 2 + length;
  }
  return null;
}

function webpDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const chunk = String.fromCharCode(
    bytes[12] ?? 0,
    bytes[13] ?? 0,
    bytes[14] ?? 0,
    bytes[15] ?? 0,
  );

  if (chunk === 'VP8L') {
    const bits =
      (bytes[21] ?? 0) |
      ((bytes[22] ?? 0) << 8) |
      ((bytes[23] ?? 0) << 16) |
      ((bytes[24] ?? 0) << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8X') {
    return {
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }
  return null;
}

function lossyWebpDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  // Simple lossy WebP: keyframe header at offset 20, dimensions at 26.
  if (bytes.length < 30) return null;
  const width = ((bytes[27] ?? 0) << 8) | (bytes[26] ?? 0);
  const height = ((bytes[29] ?? 0) << 8) | (bytes[28] ?? 0);
  return { width: width & 0x3fff, height: height & 0x3fff };
}

/**
 * Returns format and dimensions, or null when the bytes are not one of the
 * three accepted formats or the header could not be parsed.
 */
export function inspectImage(bytes: Uint8Array): ImageInfo | null {
  if (isPng(bytes)) {
    const size = pngDimensions(bytes);
    if (size.width > 0 && size.height > 0) {
      return { format: 'image/png', ...size };
    }
    return null;
  }

  if (isJpeg(bytes)) {
    const size = jpegDimensions(bytes);
    return size && size.width > 0 && size.height > 0
      ? { format: 'image/jpeg', ...size }
      : null;
  }

  if (isWebp(bytes)) {
    const chunk = String.fromCharCode(
      bytes[12] ?? 0,
      bytes[13] ?? 0,
      bytes[14] ?? 0,
      bytes[15] ?? 0,
    );
    const size =
      chunk === 'VP8 ' ? lossyWebpDimensions(bytes) : webpDimensions(bytes);
    return size && size.width > 0 && size.height > 0
      ? { format: 'image/webp', ...size }
      : null;
  }

  return null;
}
