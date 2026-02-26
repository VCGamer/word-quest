// Generate simple app icons as PNG
// Uses raw PNG encoding (no dependencies needed)
import { writeFileSync } from 'fs';

function createPNG(size) {
  // Create a simple colored square icon
  // We'll create a raw RGBA buffer then encode as PNG
  const pixels = new Uint8Array(size * size * 4);

  const bg = [0x1A, 0x1D, 0x23]; // --bg-dark
  const green = [0x00, 0xB0, 0x6A]; // --roblox-green
  const greenLight = [0x00, 0xD4, 0x7E];
  const border = 4;
  const cornerR = Math.floor(size * 0.15);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Default: background
      let r = bg[0], g = bg[1], b = bg[2], a = 255;

      // Green border (simple rectangle, no rounded corners for simplicity)
      const bw = Math.floor(size * 0.04);
      const inBorder = (x < bw || x >= size - bw || y < bw || y >= size - bw);
      if (inBorder) {
        r = green[0]; g = green[1]; b = green[2];
      }

      // Center area: draw a green "W" shape for Word Quest
      const cx = size / 2;
      const cy = size / 2;
      const letterSize = size * 0.3;
      const letterTop = cy - letterSize * 0.4;
      const letterBot = cy + letterSize * 0.4;
      const letterLeft = cx - letterSize * 0.5;
      const letterRight = cx + letterSize * 0.5;
      const letterMid = cx;
      const thick = Math.max(3, Math.floor(size * 0.06));

      // Draw "W" shape
      if (y >= letterTop && y <= letterBot) {
        const progress = (y - letterTop) / (letterBot - letterTop);

        // Left stroke of W
        const lx = letterLeft + progress * letterSize * 0.15;
        if (Math.abs(x - lx) < thick) {
          r = greenLight[0]; g = greenLight[1]; b = greenLight[2];
        }

        // Left-mid valley
        const lmx = letterLeft + letterSize * 0.25 - (1 - progress) * letterSize * 0.1;
        if (Math.abs(x - lmx) < thick) {
          r = greenLight[0]; g = greenLight[1]; b = greenLight[2];
        }

        // Center peak
        const cmx = cx + progress * letterSize * 0.05;
        if (Math.abs(x - cmx) < thick && progress < 0.7) {
          r = greenLight[0]; g = greenLight[1]; b = greenLight[2];
        }

        // Right-mid valley
        const rmx = letterRight - letterSize * 0.25 + (1 - progress) * letterSize * 0.1;
        if (Math.abs(x - rmx) < thick) {
          r = greenLight[0]; g = greenLight[1]; b = greenLight[2];
        }

        // Right stroke of W
        const rx = letterRight - progress * letterSize * 0.15;
        if (Math.abs(x - rx) < thick) {
          r = greenLight[0]; g = greenLight[1]; b = greenLight[2];
        }
      }

      // Draw "Q" below — simple circle with tail
      const qcy = cy + letterSize * 0.65;
      const qcx = cx;
      const qr = letterSize * 0.22;
      const dist = Math.sqrt((x - qcx) ** 2 + (y - qcy) ** 2);
      if (dist >= qr - thick && dist <= qr + thick/2) {
        r = greenLight[0]; g = greenLight[1]; b = greenLight[2];
      }
      // Q tail
      if (x > qcx && y > qcy && Math.abs(x - qcx - (y - qcy)) < thick && dist < qr * 2) {
        r = greenLight[0]; g = greenLight[1]; b = greenLight[2];
      }

      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = a;
    }
  }

  return encodePNG(pixels, size, size);
}

// Minimal PNG encoder
function encodePNG(pixels, width, height) {
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let cc = n;
      for (let k = 0; k < 8; k++) cc = cc & 1 ? 0xEDB88320 ^ (cc >>> 1) : cc >>> 1;
      table[n] = cc;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function adler32(buf) {
    let a = 1, b = 0;
    for (let i = 0; i < buf.length; i++) {
      a = (a + buf[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function writeU32BE(arr, offset, val) {
    arr[offset] = (val >>> 24) & 0xFF;
    arr[offset + 1] = (val >>> 16) & 0xFF;
    arr[offset + 2] = (val >>> 8) & 0xFF;
    arr[offset + 3] = val & 0xFF;
  }

  function makeChunk(type, data) {
    const chunk = new Uint8Array(4 + type.length + data.length + 4);
    writeU32BE(chunk, 0, data.length);
    for (let i = 0; i < type.length; i++) chunk[4 + i] = type.charCodeAt(i);
    chunk.set(data, 4 + type.length);
    const crcBuf = chunk.slice(4, 4 + type.length + data.length);
    writeU32BE(chunk, 4 + type.length + data.length, crc32(crcBuf));
    return chunk;
  }

  // IHDR
  const ihdr = new Uint8Array(13);
  writeU32BE(ihdr, 0, width);
  writeU32BE(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data with filter byte per row
  const rawSize = height * (1 + width * 4);
  const raw = new Uint8Array(rawSize);
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 4) + 1 + x * 4;
      raw[di] = pixels[si];
      raw[di + 1] = pixels[si + 1];
      raw[di + 2] = pixels[si + 2];
      raw[di + 3] = pixels[si + 3];
    }
  }

  // Deflate using store (no compression) blocks
  // For simplicity, use uncompressed deflate blocks
  const maxBlock = 65535;
  const numBlocks = Math.ceil(raw.length / maxBlock);
  const deflateSize = 2 + raw.length + numBlocks * 5 + 4; // header + data + block headers + adler
  const deflated = new Uint8Array(deflateSize);
  let pos = 0;
  deflated[pos++] = 0x78; // CMF
  deflated[pos++] = 0x01; // FLG

  for (let i = 0; i < numBlocks; i++) {
    const start = i * maxBlock;
    const end = Math.min(start + maxBlock, raw.length);
    const len = end - start;
    const isLast = i === numBlocks - 1;

    deflated[pos++] = isLast ? 1 : 0;
    deflated[pos++] = len & 0xFF;
    deflated[pos++] = (len >>> 8) & 0xFF;
    deflated[pos++] = (~len) & 0xFF;
    deflated[pos++] = ((~len) >>> 8) & 0xFF;
    deflated.set(raw.slice(start, end), pos);
    pos += len;
  }

  const adler = adler32(raw);
  writeU32BE(deflated, pos, adler);
  pos += 4;

  const idatData = deflated.slice(0, pos);

  // Build PNG
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  let off = 0;
  png.set(sig, off); off += sig.length;
  png.set(ihdrChunk, off); off += ihdrChunk.length;
  png.set(idatChunk, off); off += idatChunk.length;
  png.set(iendChunk, off);

  return png;
}

// Generate and save
console.log('Generating 192x192 icon...');
const icon192 = createPNG(192);
writeFileSync('public/icon-192.png', icon192);
console.log(`Saved icon-192.png (${icon192.length} bytes)`);

console.log('Generating 512x512 icon...');
const icon512 = createPNG(512);
writeFileSync('public/icon-512.png', icon512);
console.log(`Saved icon-512.png (${icon512.length} bytes)`);
