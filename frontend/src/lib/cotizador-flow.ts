import { mergeExelixiWizardHandoff, type ExelixiWizardHandoff } from './exelixi-wizard-handoff';

const COTIZADOR_FLOW_KEY = 'exelixi_cotizador_flow';

/** Flujo cotizador RCV: solo vehículo → planes (sin OCR, tomador ni pagos). */
export function isCotizadorFlow(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const flow = params.get('flow');
    const product = params.get('product');
    if (flow === 'cotizador' && product === 'rcv') {
      sessionStorage.setItem(COTIZADOR_FLOW_KEY, '1');
      return true;
    }
    if (flow && flow !== 'cotizador') {
      sessionStorage.removeItem(COTIZADOR_FLOW_KEY);
      return false;
    }
    return sessionStorage.getItem(COTIZADOR_FLOW_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistCotizadorFromHints(hints?: {
  url?: string | null;
  nombre?: string | null;
  moduloNombre?: string | null;
}): boolean {
  if (hints?.url) {
    try {
      const parsed = new URL(hints.url, window.location.origin);
      if (parsed.searchParams.get('flow') === 'cotizador' && parsed.searchParams.get('product') === 'rcv') {
        sessionStorage.setItem(COTIZADOR_FLOW_KEY, '1');
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  const label = `${hints?.nombre ?? ''} ${hints?.moduloNombre ?? ''}`.toLowerCase();
  if (label.includes('cotizador') && label.includes('rcv')) {
    sessionStorage.setItem(COTIZADOR_FLOW_KEY, '1');
    return true;
  }
  return false;
}

export function ensureCotizadorFlowQueryParam(active: boolean): void {
  if (!active || isCotizadorFlow()) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('flow', 'cotizador');
    url.searchParams.set('product', 'rcv');
    window.history.replaceState({}, '', url.toString());
    sessionStorage.setItem(COTIZADOR_FLOW_KEY, '1');
  } catch {
    /* ignore */
  }
}

function getModuleTokenKey(): string {
  return 'nexus_access_token_formulario';
}

/** Redirect standalone formulario → emisión (cotizador). */
export function getEmisionCotizadorContinueUrl(): string {
  const configured = import.meta.env.VITE_EMISION_CONTINUE_BASE as string | undefined;
  const base = (configured?.replace(/\/$/, '') || '/emision').replace(/\/$/, '');
  const params = new URLSearchParams({
    flow: 'cotizador',
    product: 'rcv',
    wizardStep: '4',
  });

  try {
    const current = new URL(window.location.href);
    const sid = current.searchParams.get('sid');
    const nexusToken =
      current.searchParams.get('nexus_token')
      || sessionStorage.getItem(getModuleTokenKey());
    if (sid) params.set('sid', sid);
    if (nexusToken) params.set('nexus_token', nexusToken);
  } catch {
    /* ignore */
  }

  return `${base}/?${params.toString()}`;
}

/** Avanza al módulo emisión en flujo cotizador (bridge o redirect). */
export function continueToEmisionCotizador(snapshot?: Partial<ExelixiWizardHandoff>): void {
  if (snapshot) {
    mergeExelixiWizardHandoff(snapshot);
  }

  if (typeof window.__bridgeAdvance === 'function') {
    void window.__bridgeAdvance({ cotizadorFlow: true, product: 'rcv' });
    return;
  }

  window.location.href = getEmisionCotizadorContinueUrl();
}
