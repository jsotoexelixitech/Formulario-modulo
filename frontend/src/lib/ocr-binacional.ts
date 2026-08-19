import type { DocType, DocumentState } from '../types';

type CertOcr = {
  tipoCarnet?: string;
  tipoPlaca?: string;
};

export function isBinacionalCarnet(cert?: CertOcr | null): boolean {
  if (!cert) return false;
  return cert.tipoCarnet === 'binacional' || cert.tipoPlaca === 'binacional';
}

export function adjustDocsForBinacionalCarnet(
  requiredDocs: DocType[],
  optionalDocs: DocType[],
  documents: Record<DocType, DocumentState>,
): { requiredDocs: DocType[]; optionalDocs: DocType[] } {
  const cert = documents.certificado?.ocr as CertOcr | undefined;
  if (!isBinacionalCarnet(cert)) {
    return { requiredDocs: [...requiredDocs], optionalDocs: [...optionalDocs] };
  }

  const required = requiredDocs.filter((d) => d !== 'cedula' && d !== 'licencia');
  if (!required.includes('certificado')) required.push('certificado');

  const optionalSet = new Set(optionalDocs);
  if (requiredDocs.includes('cedula')) optionalSet.add('cedula');
  if (requiredDocs.includes('licencia')) optionalSet.add('licencia');

  return { requiredDocs: required, optionalDocs: [...optionalSet] };
}
