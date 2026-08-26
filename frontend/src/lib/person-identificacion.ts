import { PERSON_FIELD_LIMITS } from './field-limits';

const { venezuelanCedulaDigitsMin, venezuelanCedulaDigitsMax } = PERSON_FIELD_LIMITS;

export function countIdentificacionDigits(value?: string): number {
  return (value ?? '').replace(/\D/g, '').length;
}

/** Validación de cédula para asegurado, beneficiario y conductor (no tomador). */
export function validateSecondaryPersonIdentificacion(
  identificacion?: string,
): string | undefined {
  const digits = countIdentificacionDigits(identificacion);
  if (!String(identificacion ?? '').trim() || digits === 0) {
    return 'La identificación es obligatoria';
  }
  if (digits < venezuelanCedulaDigitsMin) {
    return `La identificación debe tener al menos ${venezuelanCedulaDigitsMin} dígitos`;
  }
  if (digits > venezuelanCedulaDigitsMax) {
    return `La identificación no puede tener más de ${venezuelanCedulaDigitsMax} dígitos`;
  }
  return undefined;
}

export const SECONDARY_IDENTIFICACION_MAX_LENGTH = venezuelanCedulaDigitsMax;
