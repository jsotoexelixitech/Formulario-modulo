/** @deprecated Usar módulo standalone `modulo-cotizador` en Escritorio (/cotizador/). */
export function isCotizadorFlow(): boolean {
  return false;
}

export function persistCotizadorFromHints(_hints?: {
  url?: string | null;
  nombre?: string | null;
  moduloNombre?: string | null;
}): boolean {
  return false;
}

export function ensureCotizadorFlowQueryParam(_active: boolean): void {
  /* noop */
}

export function getEmisionCotizadorContinueUrl(): string {
  return '/cotizador/?product=rcv';
}

export function continueToEmisionCotizador(_snapshot?: unknown): void {
  window.location.href = getEmisionCotizadorContinueUrl();
}

export function applyCotizadorWizardHandoff(): boolean {
  return false;
}

export function mergeCotizadorHandoff(): void {
  /* noop */
}
