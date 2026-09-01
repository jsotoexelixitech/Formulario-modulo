import type { CatalogItem } from './api';
import { formatTelefono } from './phone';
import { PERSON_FIELD_LIMITS, clipPersonField } from './field-limits';

/** Respuesta de nest-api / emissions/propietary (maclient + joins). */
export interface ProprietaryInfo {
  xnombre?: string;
  xapellido?: string;
  fnacimiento?: string | Date;
  isexo?: string;
  ipersona?: string;
  iestado_civil?: string;
  cestado?: number | string;
  xestado?: string;
  cciudad?: number | string;
  cci_rif?: string;
  cid?: string;
  xciudad?: string;
  xavecalle?: string;
  xcorreo?: string;
  xtelefono?: string;
  cliente?: string;
  es_mayor_de_edad?: number;
  xprofesion?: string;
  xocupacion?: string;
  xactividad?: string;
  npeso?: number;
  nestatura?: number;
}

export interface PersonFormPatch {
  tipoDoc?: string;
  identificacion?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  email?: string;
  fechaNac?: string;
  sexo?: string;
  estadoCivil?: string;
  estado?: string;
  cestado?: number;
  ciudad?: string;
  cciudad?: number;
  direccion?: string;
  xprofesion?: string;
  xactividad?: string;
}

function labelFromCatalog(
  items: CatalogItem[],
  code: string | undefined,
  fallbacks: Record<string, string>,
): string {
  const key = String(code ?? '').trim().toUpperCase();
  if (!key) return '';
  const found = items.find((i) => String(i.code).toUpperCase() === key);
  if (found?.label) return found.label;
  return fallbacks[key] ?? '';
}

function toDateInputValue(raw: string | Date | undefined): string {
  if (!raw) return '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

const SEXO_FALLBACK: Record<string, string> = {
  M: 'Masculino',
  F: 'Femenino',
};

const EDOCIVIL_FALLBACK: Record<string, string> = {
  S: 'Soltero(a)',
  C: 'Casado(a)',
  D: 'Divorciado(a)',
  V: 'Viudo(a)',
};

/**
 * Mapea la fila de propietario Sis2000 a los campos del formulario RCV.
 */
export function mapProprietaryToPerson(
  info: ProprietaryInfo,
  catalogs?: {
    sexos?: CatalogItem[];
    estadosCivil?: CatalogItem[];
    estados?: CatalogItem[];
  },
): PersonFormPatch {
  const tipoDoc = String(info.ipersona ?? '').trim().toUpperCase() || undefined;
  const cestado =
    info.cestado != null && String(info.cestado).trim() !== ''
      ? Number(info.cestado)
      : undefined;
  const cciudad =
    info.cciudad != null && String(info.cciudad).trim() !== ''
      ? Number(info.cciudad)
      : undefined;

  let estadoLabel = String(info.xestado ?? '').trim();
  if (!estadoLabel && cestado != null && catalogs?.estados?.length) {
    const found = catalogs.estados.find((s) => Number(s.code) === cestado);
    if (found?.label) estadoLabel = found.label;
  }

  const patch: PersonFormPatch = {
    nombre: clipPersonField('nombre', String(info.xnombre ?? '').trim()),
    apellido: clipPersonField('apellido', String(info.xapellido ?? '').trim()),
    telefono: formatTelefono(String(info.xtelefono ?? '')),
    email: clipPersonField('email', String(info.xcorreo ?? '').trim()),
    fechaNac: toDateInputValue(info.fnacimiento),
    sexo: labelFromCatalog(catalogs?.sexos ?? [], info.isexo, SEXO_FALLBACK),
    estadoCivil: labelFromCatalog(
      catalogs?.estadosCivil ?? [],
      info.iestado_civil,
      EDOCIVIL_FALLBACK,
    ),
    estado: estadoLabel,
    ciudad: clipPersonField('ciudad', String(info.xciudad ?? '').trim()),
    direccion: clipPersonField('direccion', String(info.xavecalle ?? '').trim()),
    xprofesion: clipPersonField('nombre', String(info.xprofesion ?? info.xocupacion ?? '').trim()) || undefined,
    xactividad: clipPersonField('nombre', String(info.xactividad ?? '').trim()) || undefined,
  };

  if (tipoDoc) patch.tipoDoc = tipoDoc.slice(0, PERSON_FIELD_LIMITS.tipoDoc);
  if (Number.isFinite(cestado)) patch.cestado = cestado;
  if (Number.isFinite(cciudad)) patch.cciudad = cciudad;

  const rifDigits = String(info.cci_rif ?? '').replace(/\D/g, '');
  if (rifDigits) patch.identificacion = clipPersonField('identificacion', rifDigits);

  return patch;
}

/**
 * Fusiona autofill Sis2000 sin pisar datos ya ingresados por el usuario.
 * Solo aplica valores no vacíos del patch entrante.
 */
export function mergeNonEmptyPersonPatch(
  current: PersonFormPatch,
  incoming: PersonFormPatch,
): PersonFormPatch {
  const out: PersonFormPatch = { ...current };
  for (const [key, val] of Object.entries(incoming) as Array<[keyof PersonFormPatch, unknown]>) {
    if (val == null) continue;
    if (typeof val === 'string' && val.trim() === '') continue;
    if (typeof val === 'number' && !Number.isFinite(val)) continue;
    (out as Record<string, unknown>)[key] = val;
  }
  return out;
}

/** CID Sis2000 típico: letra de documento + número (ej. V18456329). */
export function buildProprietaryCid(tipoDoc: string, identificacion: string): string {
  const letter = String(tipoDoc || 'V').trim().toUpperCase() || 'V';
  const digits = String(identificacion || '').replace(/\D/g, '');
  return `${letter}${digits}`;
}
