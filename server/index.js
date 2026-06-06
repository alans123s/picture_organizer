import express from 'express';
import multer from 'multer';
import { createReadStream } from 'node:fs';
import { config, PUBLIC_DIR } from './config.js';
import { processImage } from './services/image.js';
import { lerPlaca } from './services/gemini.js';
import * as drive from './services/googleDrive.js';
import * as local from './services/localStore.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 25 },
});

// Escolhe o backend de gravação: Drive (se conectado) ou armazenamento local.
async function pickBackend() {
  if (await drive.connected()) return drive;
  return local;
}

function asyncRoute(fn) {
  return (req, res) => fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro interno.' });
  });
}

// --- Status / capacidades ---
app.get(
  '/api/config',
  asyncRoute(async (_req, res) => {
    res.json({
      aiEnabled: config.gemini.enabled,
      driveConfigured: drive.configured(),
      driveConnected: await drive.connected(),
      rootFolderName: config.rootFolderName,
    });
  }),
);

// --- Leitura da placa pela IA ---
app.post(
  '/api/plate/read',
  upload.single('placa'),
  asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Envie a foto da placa.' });
    const { buffer } = await processImage(req.file.buffer);
    const result = await lerPlaca(buffer);
    res.json(result);
  }),
);

// --- Verifica se o motor já existe ---
app.post(
  '/api/motor/check',
  asyncRoute(async (req, res) => {
    const { cliente, motor } = req.body || {};
    if (!cliente || !motor) {
      return res.status(400).json({ error: 'Informe cliente e motor.' });
    }
    const backend = await pickBackend();
    const exists = await backend.motorExiste(cliente, motor);
    res.json({ exists });
  }),
);

// --- Gravação do cadastro ---
app.post(
  '/api/motor/save',
  upload.fields([
    { name: 'placa', maxCount: 1 },
    { name: 'panoramica', maxCount: 1 },
    { name: 'extras', maxCount: 20 },
  ]),
  asyncRoute(async (req, res) => {
    const meta = JSON.parse(req.body.meta || '{}');
    const { cliente, motor } = meta;
    if (!cliente || !motor) {
      return res.status(400).json({ error: 'Informe cliente e motor.' });
    }

    const files = req.files || {};
    const placaFile = files.placa?.[0];
    const panoramicaFile = files.panoramica?.[0];
    const extraFiles = files.extras || [];
    const extrasNames = meta.extrasNames || [];

    const placa = placaFile ? await processImage(placaFile.buffer) : null;
    const panoramica = panoramicaFile ? await processImage(panoramicaFile.buffer) : null;

    const extras = [];
    for (let i = 0; i < extraFiles.length; i++) {
      const processed = await processImage(extraFiles[i].buffer);
      extras.push({ ...processed, name: extrasNames[i] || `Foto adicional ${i + 1}` });
    }

    // Leitura adiada da placa: quando o cadastro foi feito offline (autoLerPlaca),
    // a IA preenche aqui, na sincronização, apenas os campos que ficaram em branco.
    let dados = meta.dados || {};
    if (meta.autoLerPlaca && placa && config.gemini.enabled) {
      try {
        const r = await lerPlaca(placa.buffer);
        for (const k of Object.keys(r.dados)) {
          if (!dados[k] || String(dados[k]).trim() === '') dados[k] = r.dados[k];
        }
      } catch (e) {
        console.error('Leitura adiada da placa falhou:', e.message);
      }
    }

    const backend = await pickBackend();
    const result = await backend.salvarMotor({
      cliente,
      motor,
      dados,
      vezesRebobinado: meta.vezesRebobinado,
      observacoes: meta.observacoes,
      placa,
      panoramica,
      extras,
      mode: meta.mode || 'create',
    });

    res.json(result);
  }),
);

// --- Download do .zip (fallback local) ---
app.get('/api/download/:id', (req, res) => {
  const zipPath = local.getDownloadPath(req.params.id);
  if (!zipPath) return res.status(404).send('Arquivo não encontrado.');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="cadastro-motor.zip"');
  createReadStream(zipPath).pipe(res);
});

// --- OAuth Google Drive ---
app.get('/auth/google', (req, res) => {
  if (!drive.configured()) {
    return res.status(400).send('Google Drive não está configurado no servidor.');
  }
  res.redirect(drive.getAuthUrl());
});

app.get(
  '/auth/google/callback',
  asyncRoute(async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/?drive=error');
    await drive.handleCallback(String(code));
    res.redirect('/?drive=connected');
  }),
);

app.listen(config.port, () => {
  console.log(`\n  Cadastro de Motores rodando em http://localhost:${config.port}`);
  console.log(`  IA (leitura de placa - Gemini): ${config.gemini.enabled ? 'ativa' : 'desativada (entrada manual)'}`);
  console.log(`  Google Drive: ${drive.configured() ? 'configurado' : 'não configurado (salvando local + ZIP)'}\n`);
});
