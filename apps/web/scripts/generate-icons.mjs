// Genera los iconos PWA/favicon a partir del corazon de marca (public/heart-mark.svg).
// Re-ejecutar con `node scripts/generate-icons.mjs` si el logo cambia.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

const ACCENT = '#E0447B';
const ACCENT_STRONG = '#B4285C';
const CREAM = '#FBF3EF';

const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

function buildSvg({ size, background, heartScale, cornerRadius = 0 }) {
  const heartSize = size * heartScale;
  const offset = (size - heartSize) / 2;
  const bg = background
    ? `<rect width="${size}" height="${size}" rx="${cornerRadius}" fill="${background}" />`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <g transform="translate(${offset}, ${offset}) scale(${heartSize / 24})">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="24" y2="24">
        <stop offset="0%" stop-color="${ACCENT}" />
        <stop offset="100%" stop-color="${ACCENT_STRONG}" />
      </linearGradient>
    </defs>
    <path d="${HEART_PATH}" fill="url(#g)" />
  </g>
</svg>`;
}

const targets = [
  { file: 'pwa-192.png', size: 192, background: CREAM, heartScale: 0.6, cornerRadius: 192 * 0.22 },
  { file: 'pwa-512.png', size: 512, background: CREAM, heartScale: 0.6, cornerRadius: 512 * 0.22 },
  // Maskable: fondo a sangre completa, corazon dentro del circulo de seguridad (~80%).
  { file: 'pwa-maskable-512.png', size: 512, background: CREAM, heartScale: 0.5 },
  { file: 'apple-touch-icon.png', size: 180, background: CREAM, heartScale: 0.6 },
  { file: 'favicon-32.png', size: 32, background: null, heartScale: 0.9 },
  { file: 'favicon-16.png', size: 16, background: null, heartScale: 0.9 },
];

for (const target of targets) {
  const svg = buildSvg(target);
  const outPath = path.join(publicDir, target.file);
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(outPath, buffer);
  console.log('Generado', target.file);
}
