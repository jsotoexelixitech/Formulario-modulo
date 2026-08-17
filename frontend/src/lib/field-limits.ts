/**
 * Límites de longitud alineados con columnas Sis2000 (`maclient*`).
 * Fuente: SysIP-backend/src/model/maclient.js (+ _tel, _correo, _dir).
 */
export const PERSON_FIELD_LIMITS = {
  /** maclient.cci_rif DECIMAL(13,0) */
  identificacion: 13,
  /** maclient.cid CHAR(30) — letra + número */
  cid: 30,
  /** maclient.ipersona CHAR(1) */
  tipoDoc: 1,
  /**
   * maclient.xnombre_1 / xapellido_1 STRING(60).
   * (xnombre/xapellido completos permiten 120; el flujo RCV usa los campos _1.)
   */
  nombre: 60,
  apellido: 60,
  /** maclient_tel.xtelefono CHAR(20) — dígitos sin máscara */
  telefonoDigits: 20,
  /**
   * Máscara visual `(0412) 123-4567` a partir de hasta 11 dígitos de negocio.
   * No supera CHAR(20) al persistir solo dígitos.
   */
  telefonoDisplay: 15,
  /** maclient_correo.xcorreo CHAR(60) */
  email: 60,
  /** maclient_dir.xavecalle CHAR(60) */
  direccion: 60,
  /** Texto libre de ciudad (flujo Exélixi) — acotado a 60 como xavecalle */
  ciudad: 60,
} as const;

export type PersonFieldLimitKey = keyof typeof PERSON_FIELD_LIMITS;

/** Recorta un string al máximo de columna Sis2000. */
export function clipPersonField(
  key: PersonFieldLimitKey,
  value: string,
): string {
  const max = PERSON_FIELD_LIMITS[key];
  return value.length <= max ? value : value.slice(0, max);
}
