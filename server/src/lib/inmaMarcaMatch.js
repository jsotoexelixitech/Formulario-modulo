/**
 * Match de marcas OCR/VIN contra catálogo INMA (xmarca).
 */

function normCatalogText(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** WMI (3 chars) → marca habitual en carnets binacionales / importados. */
const VIN_WMI_BRAND = {
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
  JTD: 'TOYOTA',
  JTE: 'TOYOTA',
  JTH: 'LEXUS',
  KNA: 'KIA',
  KND: 'KIA',
  KMH: 'HYUNDAI',
  JN1: 'NISSAN',
  JN8: 'NISSAN',
  JNK: 'INFINITI',
};

/** Sinónimos OCR frecuentes → términos de búsqueda en xmarca. */
const OCR_BRAND_ALIASES = {
  BMW: ['BMW', 'B M W', 'B.M.W'],
  'MERCEDES BENZ': ['MERCEDES', 'MERCEDES BENZ', 'MERCEDES-BENZ', 'BENZ'],
  VOLKSWAGEN: ['VOLKSWAGEN', 'VW'],
  CHEVROLET: ['CHEVROLET', 'CHEVY', 'GM'],
};

function expandAliasTerms(normalized) {
  for (const [key, variants] of Object.entries(OCR_BRAND_ALIASES)) {
    if (variants.some((v) => normCatalogText(v) === normalized)) {
      return variants.map((v) => normCatalogText(v));
    }
    if (normalized === normCatalogText(key)) {
      return variants.map((v) => normCatalogText(v));
    }
  }
  return [normalized];
}

function extractMarcaSearchTerms(ocrMarca, serial) {
  const raw = [];
  if (ocrMarca) raw.push(String(ocrMarca));

  const vin = String(serial ?? '').trim().toUpperCase();
  if (vin.length >= 3) {
    const wmi = vin.slice(0, 3);
    if (VIN_WMI_BRAND[wmi]) raw.push(VIN_WMI_BRAND[wmi]);
  }

  const terms = new Set();
  for (const item of raw) {
    const n = normCatalogText(item);
    if (!n) continue;
    for (const t of expandAliasTerms(n)) terms.add(t);
  }
  return [...terms];
}

function findMarcaInList(marcas, searchText, serial) {
  if (!marcas?.length) return null;
  const terms = searchText ? extractMarcaSearchTerms(searchText, serial) : [];
  const label = (m) => normCatalogText(m.xmarca);

  for (const term of terms) {
    const exact = marcas.find((m) => label(m) === term);
    if (exact) return exact;

    const isShortPrefix = /^[A-Z]{1,4}$/.test(term) && !/\d/.test(term);
    if (isShortPrefix) {
      const byPrefix = marcas.filter((m) => label(m).startsWith(term));
      if (byPrefix.length) {
        return byPrefix.reduce((best, cur) => (label(cur).length > label(best).length ? cur : best));
      }
    }

    const partial = marcas.filter((m) => {
      const v = label(m);
      if (!v) return false;
      return v.startsWith(term) || term.startsWith(v) || v.includes(term) || term.includes(v);
    });
    if (partial.length) {
      return partial.reduce((best, cur) => (label(cur).length > label(best).length ? cur : best));
    }
  }

  return null;
}

module.exports = {
  normCatalogText,
  extractMarcaSearchTerms,
  findMarcaInList,
  VIN_WMI_BRAND,
};
