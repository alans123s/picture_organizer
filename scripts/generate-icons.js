// Gera os ícones PNG do PWA a partir de um SVG (executa no postinstall e em "npm run icons").
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

function svg({ size, maskable }) {
  const pad = maskable ? size * 0.12 : 0;
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.18}" fill="#0f766e"/>
  <g transform="translate(${pad},${pad})">
    <circle cx="${inner / 2}" cy="${inner / 2}" r="${inner * 0.13}" fill="none" stroke="#ccfbf1" stroke-width="${inner * 0.05}"/>
    ${gearTeeth(inner)}
    <text x="${inner / 2}" y="${inner * 0.86}" font-family="system-ui, sans-serif" font-size="${inner * 0.13}" font-weight="700" fill="#ffffff" text-anchor="middle">MOTOR</text>
  </g>
</svg>`;
}

function gearTeeth(inner) {
  const cx = inner / 2;
  const cy = inner / 2;
  const r = inner * 0.3;
  let teeth = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    teeth += `<rect x="${x - inner * 0.04}" y="${y - inner * 0.04}" width="${inner * 0.08}" height="${inner * 0.08}" rx="${inner * 0.015}" fill="#ccfbf1" transform="rotate(${(a * 180) / Math.PI} ${x} ${y})"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#5eead4" stroke-width="${inner * 0.06}"/>${teeth}`;
}

async function main() {
  await fs.mkdir(ICONS_DIR, { recursive: true });
  const targets = [
    { name: 'icon-192.png', size: 192, maskable: false },
    { name: 'icon-512.png', size: 512, maskable: false },
    { name: 'icon-maskable.png', size: 512, maskable: true },
  ];
  for (const t of targets) {
    const buf = Buffer.from(svg(t));
    await sharp(buf).png().toFile(path.join(ICONS_DIR, t.name));
    console.log('gerado', t.name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
