import fs from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import archiver from 'archiver';
import { config, STORAGE_DIR } from '../config.js';
import { buildDadosTxt } from './dadosTxt.js';
import {
  sanitizeName,
  dateISO,
  dateBR,
  NOME_PLACA,
  NOME_PANORAMICA,
} from './utils.js';

const DOWNLOADS_DIR = path.join(STORAGE_DIR, '_downloads');

// Mapa id -> caminho do .zip gerado, para servir o download.
const downloads = new Map();

function rootDir() {
  return path.join(STORAGE_DIR, sanitizeName(config.rootFolderName));
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Verifica se já existe pasta para este cliente/motor. */
export async function motorExiste(cliente, motor) {
  const dir = path.join(rootDir(), sanitizeName(cliente), sanitizeName(motor));
  return exists(dir);
}

async function zipFolder(folderPath) {
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
  const id = crypto.randomBytes(8).toString('hex');
  const zipPath = path.join(DOWNLOADS_DIR, `${id}.zip`);

  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(folderPath, path.basename(folderPath));
    archive.finalize();
  });

  downloads.set(id, zipPath);
  return id;
}

export function getDownloadPath(id) {
  return downloads.get(id) || null;
}

export { createReadStream };

/**
 * Salva o cadastro do motor em pasta local padronizada e gera um .zip para download.
 * mode: 'create' | 'update' | 'new'
 */
export async function salvarMotor(payload) {
  const {
    cliente,
    motor,
    dados,
    vezesRebobinado,
    observacoes,
    placa,
    panoramica,
    extras = [],
    mode = 'create',
  } = payload;

  const clienteSafe = sanitizeName(cliente);
  let motorSafe = sanitizeName(motor);

  if (mode === 'new') {
    motorSafe = `${motorSafe} - ${dateISO()}`;
  }

  const motorDir = path.join(rootDir(), clienteSafe, motorSafe);
  await fs.mkdir(motorDir, { recursive: true });

  // Fotos principais
  if (placa) {
    await fs.writeFile(path.join(motorDir, `${NOME_PLACA}.${placa.ext}`), placa.buffer);
  }
  if (panoramica) {
    await fs.writeFile(
      path.join(motorDir, `${NOME_PANORAMICA}.${panoramica.ext}`),
      panoramica.buffer,
    );
  }

  // Fotos adicionais
  const nomesExtras = [];
  for (const extra of extras) {
    const nome = sanitizeName(extra.name);
    nomesExtras.push(nome);
    await fs.writeFile(path.join(motorDir, `${nome}.${extra.ext}`), extra.buffer);
  }

  // dados.txt (texto puro)
  const txt = buildDadosTxt({
    cliente,
    motor: mode === 'new' ? motorSafe : motor,
    dataCadastro: dateBR(),
    dados,
    vezesRebobinado,
    fotosAdicionais: nomesExtras,
    observacoes,
  });
  await fs.writeFile(path.join(motorDir, 'dados.txt'), txt, 'utf8');

  const downloadId = await zipFolder(motorDir);

  return {
    storage: 'local',
    folderPath: `${sanitizeName(config.rootFolderName)} › ${clienteSafe} › ${motorSafe}`,
    motorFolderName: motorSafe,
    localPath: motorDir,
    downloadId,
    link: `/api/download/${downloadId}`,
  };
}
