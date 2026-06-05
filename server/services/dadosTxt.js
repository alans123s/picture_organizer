import { KW_TO_CV } from '../config.js';

const ND = 'N/D';

function nd(value) {
  if (value === undefined || value === null) return ND;
  const s = String(value).trim();
  return s === '' ? ND : s;
}

function isFilled(value) {
  return nd(value) !== ND;
}

/** Combina fabricante e modelo em "FABRICANTE / MODELO". */
function fabricanteModelo(dados) {
  const fab = isFilled(dados.fabricante) ? String(dados.fabricante).trim() : '';
  const mod = isFilled(dados.modelo) ? String(dados.modelo).trim() : '';
  if (fab && mod) return `${fab} / ${mod}`;
  return fab || mod || ND;
}

/** Mostra a potência em CV e, quando disponível, também em kW. */
function potencia(dados) {
  const cv = isFilled(dados.potenciaCV) ? String(dados.potenciaCV).trim() : '';
  const kw = isFilled(dados.potenciaKW) ? String(dados.potenciaKW).trim() : '';
  if (cv && kw) return `${cv} CV (${kw} kW)`;
  if (cv) return `${cv} CV`;
  if (kw) return `${(Number(kw) / KW_TO_CV).toFixed(2)} CV (${kw} kW)`;
  return ND;
}

/**
 * Gera o conteúdo do arquivo dados.txt no formato padronizado exigido.
 * Campos sem informação ficam como "N/D".
 */
export function buildDadosTxt({
  cliente,
  motor,
  dataCadastro,
  dados = {},
  vezesRebobinado,
  fotosAdicionais = [],
  observacoes,
}) {
  const fotos =
    fotosAdicionais.length > 0 ? fotosAdicionais.join(', ') : ND;

  const linhas = [
    `CLIENTE: ${nd(cliente)}`,
    `MOTOR: ${nd(motor)}`,
    `DATA DO CADASTRO: ${nd(dataCadastro)}`,
    `FABRICANTE / MODELO: ${fabricanteModelo(dados)}`,
    `ROTAÇÃO (RPM): ${nd(dados.rotacaoRPM)}`,
    `POTÊNCIA (CV): ${potencia(dados)}`,
    `RENDIMENTO (%): ${nd(dados.rendimento)}`,
    `NÚMERO DE SÉRIE: ${nd(dados.numeroSerie)}`,
    `ANO DE FABRICAÇÃO: ${nd(dados.anoFabricacao)}`,
    `VEZES REBOBINADO: ${nd(vezesRebobinado)}`,
    `TENSÃO (V): ${nd(dados.tensao)}`,
    `CORRENTE (A): ${nd(dados.corrente)}`,
    `FREQUÊNCIA (Hz): ${nd(dados.frequencia)}`,
    `CARCAÇA: ${nd(dados.carcaca)}`,
    `GRAU DE PROTEÇÃO (IP): ${nd(dados.grauProtecaoIP)}`,
    `FATOR DE SERVIÇO: ${nd(dados.fatorServico)}`,
    `FOTOS ADICIONAIS: ${fotos}`,
    `OBSERVAÇÕES: ${nd(observacoes)}`,
  ];

  return linhas.join('\n') + '\n';
}
