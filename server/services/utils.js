/** Remove caracteres inválidos para nomes de arquivo/pasta, preservando acentos. */
export function sanitizeName(name) {
  return String(name || '')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/** Data no formato YYYY-MM-DD (data local). */
export function dateISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Data legível em pt-BR (dd/mm/yyyy). */
export function dateBR(d = new Date()) {
  const [y, m, day] = dateISO(d).split('-');
  return `${day}/${m}/${y}`;
}

export const NOME_PLACA = 'Placa do motor antigo';
export const NOME_PANORAMICA = 'Motor antigo instalado';
