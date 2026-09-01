import type { InmaMarca } from './api';

function normText(s: string) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VIN_WMI_BRAND: Record<string, string> = {
  WBA: 'BMW',
  WBS: 'BMW',
  WBY: 'BMW',
  WBX: 'BMW',
  WMW: 'BMW',
  MER: 'MERCEDES BENZ',
  WDB: 'MERCEDES BENZ',
  WDC: 'MERCEDES BENZ',
  WVW: 'VOLKSWAGEN',
  WVG: 'VOLKSWAGEN',
};

const OCR_BRAND_ALIASES: Record<string, string[]> = {
  BMW: ['BMW', 'B M W', 'B.M.W'],
  'MERCEDES BENZ': ['MERCEDES', 'MERCEDES BENZ', 'MERCEDES-BENZ', 'BENZ'],
  VOLKSWAGEN: ['VOLKSWAGEN', 'VW'],
};

function expandAliasTerms(normalized: string): string[] {
  for (const [key, variants] of Object.entries(OCR_BRAND_ALIASES)) {
    if (variants.some((v) => normText(v) === normalized)) {
      return variants.map((v) => normText(v));
    }
    if (normalized === normText(key)) {
      return variants.map((v) => normText(v));
    }
  }
  return [normalized];
}

export function extractMarcaSearchTerms(ocrMarca?: string | null, serial?: string | null): string[] {
  const raw: string[] = [];
  if (ocrMarca) raw.push(ocrMarca);

  const vin = String(serial ?? '').trim().toUpperCase();
  if (vin.length >= 3) {
    const wmi = vin.slice(0, 3);
    if (VIN_WMI_BRAND[wmi]) raw.push(VIN_WMI_BRAND[wmi]);
  }

  const terms = new Set<string>();
  for (const item of raw) {
    const n = normText(item);
    if (!n) continue;
    for (const t of expandAliasTerms(n)) terms.add(t);
  }
  return [...terms];
}

export function findBestInmaMarca(
  list: InmaMarca[],
  ocrMarca: string | undefined | null,
  serial?: string | null,
): InmaMarca | undefined {
  if (!list.length) return undefined;

  const terms = extractMarcaSearchTerms(ocrMarca, serial);
  const val = (i: InmaMarca) => normText(String(i.xmarca ?? ''));

  for (const n of terms) {
    const exact = list.find((i) => val(i) === n);
    if (exact) return exact;

    const isShortPrefix = /^[A-Z]{1,4}$/.test(n) && !/\d/.test(n);
    if (isShortPrefix) {
      const byPrefix = list.filter((i) => val(i).startsWith(n));
      if (byPrefix.length) {
        return byPrefix.reduce((best, cur) => (val(cur).length > val(best).length ? cur : best));
      }
    }

    const partial = list.filter((i) => {
      const v = val(i);
      if (!v) return false;
      return v.startsWith(n) || n.startsWith(v) || n.includes(v) || v.includes(n);
    });
    if (partial.length) {
      return partial.reduce((best, cur) => (val(cur).length > val(best).length ? cur : best));
    }
  }

  return undefined;
}
