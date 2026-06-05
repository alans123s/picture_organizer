import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(ROOT_DIR, 'storage');

export const config = {
  port: Number(process.env.PORT) || 3000,

  // Nome da pasta raiz no Drive / armazenamento local.
  rootFolderName: process.env.ROOT_FOLDER_NAME || 'Cadastro de Motores',

  // --- IA (leitura da placa) — Google Gemini ---
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  // --- Google Drive ---
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      `http://localhost:${Number(process.env.PORT) || 3000}/auth/google/callback`,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
    // Pasta onde a raiz "Cadastro de Motores" será criada. Vazio = raiz do Meu Drive.
    parentFolderId: process.env.GOOGLE_PARENT_FOLDER_ID || '',
    get configured() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  // Limite (px) do maior lado das fotos antes do upload.
  maxImageDimension: Number(process.env.MAX_IMAGE_DIMENSION) || 2000,
  imageQuality: Number(process.env.IMAGE_QUALITY) || 82,
};

// Fator de conversão kW -> CV (CV = kW / 0,7355).
export const KW_TO_CV = 0.7355;
