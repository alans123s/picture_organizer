import { GoogleGenAI } from '@google/genai';
import { config, KW_TO_CV } from '../config.js';

const ai = config.gemini.enabled
  ? new GoogleGenAI({ apiKey: config.gemini.apiKey })
  : null;

// Campos que tentamos extrair da placa. Strings com sentinela "N/D" quando ilegível.
const CAMPOS = [
  'fabricante',
  'modelo',
  'rotacaoRPM',
  'potenciaCV',
  'potenciaKW',
  'rendimento',
  'numeroSerie',
  'anoFabricacao',
  'tensao',
  'corrente',
  'frequencia',
  'carcaca',
  'grauProtecaoIP',
  'fatorServico',
];

const SYSTEM = `Você é um especialista em ler placas de identificação de motores elétricos.
Extraia SOMENTE o que estiver claramente legível na imagem da placa.

REGRA CRÍTICA: nunca invente, estime ou complete dados ilegíveis. Se um campo estiver
apagado, sujo, coberto ou fora do enquadramento, preencha-o com "N/D" e adicione o nome
do campo (a chave JSON) na lista "naoLegiveis".

Potência: se a placa trouxer kW, calcule também CV (CV = kW ÷ ${KW_TO_CV}) e preencha
"potenciaCV" e "potenciaKW". Se trouxer apenas CV, preencha "potenciaCV". Use ponto como
separador decimal e não inclua a unidade nos números (ex.: "30", não "30 CV").

Responda APENAS com um objeto JSON válido (sem markdown), com exatamente estas chaves:
${CAMPOS.map((c) => `"${c}"`).join(', ')} (todas string, use "N/D" quando não houver dado)
e "naoLegiveis" (array de strings com as chaves que não pôde ler).`;

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function clean(value) {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  return s.toUpperCase() === 'N/D' ? '' : s;
}

/** Garante CV e kW coerentes: deriva um a partir do outro quando faltar. */
function reconcilePotencia(dados) {
  const cv = clean(dados.potenciaCV);
  const kw = clean(dados.potenciaKW);
  const cvNum = Number(cv.replace(',', '.'));
  const kwNum = Number(kw.replace(',', '.'));

  if (!cv && kw && Number.isFinite(kwNum)) {
    dados.potenciaCV = (kwNum / KW_TO_CV).toFixed(2);
  } else if (cv && !kw && Number.isFinite(cvNum)) {
    dados.potenciaKW = (cvNum * KW_TO_CV).toFixed(2);
  }
  return dados;
}

/**
 * Lê a placa de um motor a partir do buffer de imagem (JPEG) usando Gemini.
 * Retorna { aiEnabled, dados, naoLegiveis }.
 */
export async function lerPlaca(jpegBuffer) {
  if (!ai) {
    return { aiEnabled: false, dados: emptyDados(), naoLegiveis: [] };
  }

  const response = await ai.models.generateContent({
    model: config.gemini.model,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: jpegBuffer.toString('base64') } },
          { text: 'Leia esta placa de identificação e extraia os dados do motor.' },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      temperature: 0,
    },
  });

  const parsed = extractJson(response.text) || {};

  const dados = emptyDados();
  for (const campo of CAMPOS) {
    dados[campo] = clean(parsed[campo]);
  }
  reconcilePotencia(dados);

  const naoLegiveis = Array.isArray(parsed.naoLegiveis)
    ? parsed.naoLegiveis.filter((x) => typeof x === 'string')
    : [];

  return { aiEnabled: true, dados, naoLegiveis };
}

export function emptyDados() {
  return Object.fromEntries(CAMPOS.map((c) => [c, '']));
}
