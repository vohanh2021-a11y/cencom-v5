// Sinh icon.ico (256x256) và icon.png từ mã thuần Node (không cần thư viện).
// Chạy: node scripts/gen-icon.mjs  (từ thư mục DesktopLauncher)
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const W = 256,
  H = 256;

// CRC32 (chuẩn PNG)
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

// Vẽ: nền tối + ô vuông xanh sáng ở giữa (logo đơn giản)
const px = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    let r = 15,
      g = 23,
      b = 42;
    if (x >= 68 && x < 188 && y >= 68 && y < 188) {
      r = 56;
      g = 189;
      b = 248;
    }
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  }
}

// Thêm filter byte (0) mỗi dòng
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, y * W * 4 + W * 4);
}
const idat = zlib.deflateSync(raw);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

// Đóng gói thành ICO (chứa PNG)
const sig = Buffer.alloc(6);
sig.writeUInt16LE(0, 0); // reserved
sig.writeUInt16LE(1, 2); // type = icon
sig.writeUInt16LE(1, 4); // count = 1
const entry = Buffer.alloc(16);
entry[0] = 0; // width 256 -> 0
entry[1] = 0; // height
entry[2] = 0; // colors
entry[3] = 0; // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bpp
entry.writeUInt32LE(png.length, 8); // size
entry.writeUInt32LE(22, 12); // offset
const ico = Buffer.concat([sig, entry, png]);

const outDir = path.resolve("src-tauri/icons");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon.ico"), ico);
fs.writeFileSync(path.resolve("public/icon.png"), png);
console.log("Đã tạo src-tauri/icons/icon.ico và public/icon.png");
