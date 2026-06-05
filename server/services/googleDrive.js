import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { config, STORAGE_DIR } from '../config.js';
import { buildDadosTxt } from './dadosTxt.js';
import {
  sanitizeName,
  dateISO,
  dateBR,
  NOME_PLACA,
  NOME_PANORAMICA,
} from './utils.js';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = path.join(STORAGE_DIR, 'google-token.json');

export function configured() {
  return config.google.configured;
}

function oauthClient() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );
}

async function loadStoredToken() {
  try {
    const raw = await fs.readFile(TOKEN_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadCredentials() {
  const stored = await loadStoredToken();
  if (stored && stored.refresh_token) return stored;
  if (config.google.refreshToken) {
    return { refresh_token: config.google.refreshToken };
  }
  return null;
}

/** Drive está configurado e já temos um refresh token utilizável. */
export async function connected() {
  if (!configured()) return false;
  return Boolean(await loadCredentials());
}

export function getAuthUrl() {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

export async function handleCallback(code) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  // Mescla com token anterior para não perder o refresh_token em reautenticações.
  const previous = (await loadStoredToken()) || {};
  const merged = { ...previous, ...tokens };
  await fs.writeFile(TOKEN_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

async function drive() {
  const credentials = await loadCredentials();
  if (!credentials) throw new Error('Google Drive não está conectado.');
  const client = oauthClient();
  client.setCredentials(credentials);
  return google.drive({ version: 'v3', auth: client });
}

async function findFolder(d, name, parentId) {
  const safeName = name.replace(/'/g, "\\'");
  const parent = parentId || 'root';
  const res = await d.files.list({
    q: `mimeType='${FOLDER_MIME}' and name='${safeName}' and '${parent}' in parents and trashed=false`,
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive',
    pageSize: 1,
  });
  return res.data.files?.[0] || null;
}

async function createFolder(d, name, parentId) {
  const res = await d.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id, name, webViewLink',
  });
  return res.data;
}

async function ensureFolder(d, name, parentId) {
  return (await findFolder(d, name, parentId)) || createFolder(d, name, parentId);
}

async function uploadImage(d, name, buffer, parentId) {
  await d.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType: 'image/jpeg', body: Readable.from(buffer) },
    fields: 'id',
  });
}

async function uploadText(d, name, content, parentId) {
  // mimeType text/plain mantém o arquivo como .txt puro (sem virar Google Docs).
  await d.files.create({
    requestBody: { name, parents: [parentId], mimeType: 'text/plain' },
    media: { mimeType: 'text/plain', body: Readable.from(content) },
    fields: 'id',
  });
}

/** Verifica se já existe pasta do motor dentro do cliente. */
export async function motorExiste(cliente, motor) {
  const d = await drive();
  const root = await findFolder(d, config.rootFolderName, config.google.parentFolderId);
  if (!root) return false;
  const clienteFolder = await findFolder(d, sanitizeName(cliente), root.id);
  if (!clienteFolder) return false;
  const motorFolder = await findFolder(d, sanitizeName(motor), clienteFolder.id);
  return Boolean(motorFolder);
}

/**
 * Salva o cadastro no Google Drive seguindo a estrutura:
 * Cadastro de Motores › Cliente › Motor.
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

  const d = await drive();

  const root = await ensureFolder(d, config.rootFolderName, config.google.parentFolderId);
  const clienteFolder = await ensureFolder(d, sanitizeName(cliente), root.id);

  let motorName = sanitizeName(motor);
  if (mode === 'new') motorName = `${motorName} - ${dateISO()}`;

  let motorFolder;
  if (mode === 'update') {
    motorFolder =
      (await findFolder(d, motorName, clienteFolder.id)) ||
      (await createFolder(d, motorName, clienteFolder.id));
  } else {
    motorFolder = await createFolder(d, motorName, clienteFolder.id);
  }

  if (placa) {
    await uploadImage(d, `${NOME_PLACA}.${placa.ext}`, placa.buffer, motorFolder.id);
  }
  if (panoramica) {
    await uploadImage(
      d,
      `${NOME_PANORAMICA}.${panoramica.ext}`,
      panoramica.buffer,
      motorFolder.id,
    );
  }

  const nomesExtras = [];
  for (const extra of extras) {
    const nome = sanitizeName(extra.name);
    nomesExtras.push(nome);
    await uploadImage(d, `${nome}.${extra.ext}`, extra.buffer, motorFolder.id);
  }

  const txt = buildDadosTxt({
    cliente,
    motor: motorName,
    dataCadastro: dateBR(),
    dados,
    vezesRebobinado,
    fotosAdicionais: nomesExtras,
    observacoes,
  });
  await uploadText(d, 'dados.txt', txt, motorFolder.id);

  return {
    storage: 'drive',
    folderPath: `${config.rootFolderName} › ${sanitizeName(cliente)} › ${motorName}`,
    motorFolderName: motorName,
    link: motorFolder.webViewLink || null,
  };
}
