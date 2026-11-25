#!/usr/bin/env node
/**
 * Print-ready QR code (PNG + SVG) for a present-mode link.
 *
 *   node scripts/make-qr.mjs https://your-site.vercel.app/demo/abc123 [outName] [dark] [light]
 *
 * The link opens present mode directly (no login). Output goes to ./qr/.
 * Needs the "qrcode" package:  npm i -D qrcode
 */
import { mkdirSync, writeFileSync } from 'node:fs';

let QRCode;
try {
  QRCode = (await import('qrcode')).default;
} catch {
  console.error('The "qrcode" package is missing. Run:  npm i -D qrcode');
  process.exit(1);
}

const [, , rawUrl, name = 'present-qr', dark = '#000000', light = '#ffffff'] = process.argv;
if (!rawUrl) {
  console.error('Usage: node scripts/make-qr.mjs <url> [outName] [darkColor] [lightColor]');
  process.exit(1);
}
let url;
try {
  url = new URL(rawUrl);
  if (!/^https?:$/.test(url.protocol)) throw new Error('not http(s)');
} catch {
  console.error(`"${rawUrl}" is not a valid http(s) URL.`);
  process.exit(1);
}
url.searchParams.delete('workspace'); // a QR must never open workspace mode

mkdirSync('qr', { recursive: true });
const opts = { errorCorrectionLevel: 'H', margin: 4, color: { dark, light } };
// 2400px PNG prints sharply up to ~20 cm at 300 dpi; the SVG scales to any size.
await QRCode.toFile(`qr/${name}.png`, url.toString(), { ...opts, width: 2400, type: 'png' });
writeFileSync(`qr/${name}.svg`, await QRCode.toString(url.toString(), { ...opts, type: 'svg' }));
console.log(`QR for ${url}\n  qr/${name}.png\n  qr/${name}.svg`);
