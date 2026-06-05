import sharp from 'sharp';
import { config } from '../config.js';

/**
 * Normaliza e comprime uma imagem para upload/leitura:
 * - corrige orientação pela EXIF;
 * - reduz o maior lado para `maxImageDimension`;
 * - converte para JPEG com qualidade configurável.
 * Atende ao requisito de comprimir/redimensionar fotos grandes antes do Drive.
 */
export async function processImage(buffer) {
  const img = sharp(buffer, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const longest = Math.max(meta.width || 0, meta.height || 0);

  let pipeline = img;
  if (longest > config.maxImageDimension) {
    pipeline = pipeline.resize({
      width: meta.width >= meta.height ? config.maxImageDimension : null,
      height: meta.height > meta.width ? config.maxImageDimension : null,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const out = await pipeline
    .jpeg({ quality: config.imageQuality, mozjpeg: true })
    .toBuffer();

  return { buffer: out, mimeType: 'image/jpeg', ext: 'jpg' };
}
