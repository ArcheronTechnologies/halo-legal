// Generates simple placeholder PWA icons (solid brand-blue square, rounded corners) as raw PNG
// bytes — no image library dependency, just zlib for the IDAT deflate stream. Run once; the
// output is checked in like any other static asset (see public/icons/).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const OUT_DIR = join(import.meta.dirname, "..", "public", "icons");
const BLUE = [0x2a, 0x78, 0xd6]; // --gauge-fill, the app's one brand hue (dataviz skill palette)

function buildCrc32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}
const CRC32_TABLE = buildCrc32Table();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Solid-color square with a lighter rounded "pulse" ring inset, so it reads as a mark, not a
 * blank swatch, at a glance on a home screen. */
function buildPng(size) {
  const radius = Math.round(size * 0.18);
  const ringOuter = size * 0.36;
  const ringInner = size * 0.24;
  const cx = size / 2;
  const cy = size / 2;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const inCorner =
        (x < radius && y < radius && (x - radius) ** 2 + (y - radius) ** 2 > radius ** 2) ||
        (x >= size - radius &&
          y < radius &&
          (x - (size - radius)) ** 2 + (y - radius) ** 2 > radius ** 2) ||
        (x < radius &&
          y >= size - radius &&
          (x - radius) ** 2 + (y - (size - radius)) ** 2 > radius ** 2) ||
        (x >= size - radius &&
          y >= size - radius &&
          (x - (size - radius)) ** 2 + (y - (size - radius)) ** 2 > radius ** 2);

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const onRing = dist <= ringOuter && dist >= ringInner;

      const px = rowStart + 1 + x * 4;
      if (inCorner) {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0; // transparent outside the rounded-rect mask
      } else if (onRing) {
        raw[px] = 255;
        raw[px + 1] = 255;
        raw[px + 2] = 255;
        raw[px + 3] = 255; // white ring = the "pulse" mark
      } else {
        raw[px] = BLUE[0];
        raw[px + 1] = BLUE[1];
        raw[px + 2] = BLUE[2];
        raw[px + 3] = 255;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const path = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(path, buildPng(size));
  console.log(`Wrote ${path}`);
}
