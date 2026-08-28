import type { PersonData } from '../types';
import type { OcrFields } from './exelixi-handoff-types';
import { extractTomadorFromCertificado } from './carnet-propietario';

function normalizeIdentificacionDigits(raw?: string | null): string {
  return String(raw ?? '').replace(/\D/g, '');
}

function inferTipoDocFromRaw(raw?: string | null): string | null {
  const m = String(raw ?? '').trim().toUpperCase().match(/^([VEJGP])[-\s.]*\d/);
  if (!m) return null;
  return m[1] === 'G' ? 'J' : m[1];
}

function extractPersonFromOcrFields(ocr?: OcrFields | null): Partial<PersonData> | null {
  if (!ocr) return null;

  const identificacion = normalizeIdentificacionDigits(ocr.identificacion);
  const nombre = ocr.nombre ?? '';
  const apellido = ocr.apellido ?? '';

  if (!identificacion && !nombre && !apellido) return null;

  return {
    nombre,
    apellido,
    identificacion,
    tipoDoc: ocr.tipoDoc ?? inferTipoDocFromRaw(ocr.identificacion) ?? 'V',
    licencia: ocr.numeroLicencia ?? '',
    fechaNac: ocr.fechaNacimiento ?? '',
  };
}

function resolveCarnetId(cert?: OcrFields | null): string {
  if (!cert) return '';
  return normalizeIdentificacionDigits(
    cert.identificacion
    || cert.identificacionPropietario
    || cert.propietarioIdentificacion,
  );
}

export interface OcrPersonRolesResult {
  sameInsured: boolean;
  asegurado?: Partial<PersonData>;
  hasDriver: boolean;
  conductor?: Partial<PersonData>;
}

/** Titular del carnet + conductor habitual según discrepancias OCR (RCV). */
export function resolveOcrPersonRoles(
  cedula?: OcrFields | null,
  certificado?: OcrFields | null,
  licencia?: OcrFields | null,
): OcrPersonRolesResult {
  const cedulaId = normalizeIdentificacionDigits(cedula?.identificacion);
  const carnetId = resolveCarnetId(certificado);
  const licenciaId = normalizeIdentificacionDigits(licencia?.identificacion);

  let sameInsured = true;
  let asegurado: Partial<PersonData> | undefined;

  const hayDiscrepanciaCarnet = !!cedulaId && !!carnetId && cedulaId !== carnetId;
  if (hayDiscrepanciaCarnet && certificado) {
    const titularCarnet = extractTomadorFromCertificado(certificado);
    sameInsured = false;
    asegurado = {
      identificacion: titularCarnet?.identificacion ?? carnetId,
      tipoDoc: titularCarnet?.tipoDoc ?? 'V',
      nombre: titularCarnet?.nombre ?? '',
      apellido: titularCarnet?.apellido ?? '',
      fechaNac: '',
    };
  }

  const licenciaDistinta =
    !!licencia
    && !!licenciaId
    && licenciaId !== cedulaId
    && (!carnetId || licenciaId !== carnetId);

  if (licenciaDistinta) {
    const fromLicencia = extractPersonFromOcrFields(licencia);
    if (fromLicencia) {
      return {
        sameInsured,
        asegurado,
        hasDriver: true,
        conductor: fromLicencia,
      };
    }
  }

  return { sameInsured, asegurado, hasDriver: false };
}

export interface OcrPersonRoleSetters {
  setSameInsured: (v: boolean) => void;
  setAsegurado: (data: Partial<PersonData>) => void;
  setHasDriver: (v: boolean) => void;
  setConductor: (data: Partial<PersonData>) => void;
}

export function applyOcrPersonRoles(
  cedula: OcrFields | undefined,
  certificado: OcrFields | undefined,
  licencia: OcrFields | undefined,
  setters: OcrPersonRoleSetters,
): void {
  const roles = resolveOcrPersonRoles(cedula, certificado, licencia);

  setters.setSameInsured(roles.sameInsured);
  if (roles.asegurado) {
    setters.setAsegurado(roles.asegurado);
  }

  setters.setHasDriver(roles.hasDriver);
  if (roles.hasDriver && roles.conductor) {
    setters.setConductor(roles.conductor);
  }
}

export function applyOcrPersonRolesFromDocuments(
  documents: Partial<Record<'cedula' | 'licencia' | 'certificado', { ocr?: OcrFields }>>,
  setters: OcrPersonRoleSetters,
): void {
  applyOcrPersonRoles(
    documents.cedula?.ocr,
    documents.certificado?.ocr,
    documents.licencia?.ocr,
    setters,
  );
}
