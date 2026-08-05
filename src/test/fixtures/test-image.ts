/**
 * Minimal valid PNG generator for upload tests.
 *
 * Builds a real PNG header with correct CRCs so the server-side inspector
 * accepts it exactly as it would a genuine photo - no mocking of validation.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);

  const out = new Uint8Array(4 + body.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(4 + body.length, crc32(body));
  return out;
}

/** Returns a structurally valid PNG of the requested dimensions. */
export function createTestPng(width = 2400, height = 1800): Uint8Array {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // colour type: truecolour
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdr = chunk('IHDR', ihdrData);
  // A zlib stream carrying a single stored (uncompressed) empty block. The
  // inspector only reads the header, but keeping the file structurally sound
  // means it stays a valid image for anything downstream.
  const idat = chunk(
    'IDAT',
    new Uint8Array([
      0x78, 0x01, 0x01, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x01,
    ]),
  );
  const iend = chunk('IEND', new Uint8Array(0));

  // Pad so the file is comfortably above the "heavily compressed" warning
  // threshold and behaves like a real photo in the quality heuristics.
  const padding = chunk('teXt', new Uint8Array(120_000));

  const total =
    signature.length + ihdr.length + padding.length + idat.length + iend.length;
  const png = new Uint8Array(total);

  let offset = 0;
  for (const part of [signature, ihdr, padding, idat, iend]) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}
