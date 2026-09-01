import { checkFuneralCedulaPoliza } from './api';

const BLOCK_MSG = 'Ya existe una póliza funeraria vigente para esta cédula.';

/**
 * Consulta Sis2000: ¿esta cédula ya tiene póliza funeraria vigente?
 * Si tiene menos de 6 dígitos no consulta (aún incompleta).
 */
export async function cedulaTienePolizaVigente(identificacion: string): Promise<{
  blocked: boolean;
  message: string;
  cnpoliza?: string;
}> {
  const digits = String(identificacion || '').replace(/\D/g, '');
  if (digits.length < 6) return { blocked: false, message: '' };
  const res = await checkFuneralCedulaPoliza(digits);
  if (res.blocked) {
    return {
      blocked: true,
      message: res.message || BLOCK_MSG,
      cnpoliza: res.cnpoliza,
    };
  }
  return { blocked: false, message: '' };
}
