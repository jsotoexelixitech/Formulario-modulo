import { mergeExelixiWizardHandoff, type ExelixiWizardHandoff } from './exelixi-wizard-handoff';
import type { DocType, DocumentState, TomadorData, VehicleData } from '../types';
import {
  EXELIXI_OCR_HANDOFF_KEY,
  type ExelixiOcrHandoff,
  type OcrDocType,
} from './exelixi-handoff-types';
import { resolveOcrModelo, resolveOcrTipoPlaca, sanitizeOcrField } from './vehicle-carnet-labels';
import { extractTomadorFromCertificado } from './carnet-propietario';
import { applyOcrPersonRoles } from './ocr-person-roles';
import type { PersonData } from '../types';

export type BuilderProductBranch =
  | 'AUTOMOVIL'
  | 'SALUD'
  | 'VIDA'
  | 'PATRIMONIAL'
  | 'INCLUSIVO'
  | 'RCV_OBLIGATORIO';

export interface BuilderCatalogProduct {
  id: string;
  commercialName: string;
  internalCode: string;
  branch: BuilderProductBranch;
  status: string;
  productPlans?: { id?: string; name: string; isActive?: boolean }[];
}

export const BUILDER_PRODUCT_STORAGE_KEY = 'exelixi_builder_product';

/** Ruta dedicada Exélixi: /ocr/exelixi/ (distinta de /ocr/?product=rcv La Mundial). */
export function isExelixiCatalogEntryPath(pathname?: string): boolean {
  const path = (pathname ?? window.location.pathname).replace(/\/$/, '') || '/';
  return path.endsWith('/exelixi') || path.includes('/ocr/exelixi');
}

/**
 * Detecta flujo Exélixi catálogo desde metadata Nexus (URL del submódulo / nombres).
 * Mismo patrón que rcv/funerario en persistProductFromHints.
 */
export function isExelixiCatalogFlowHint(hints?: {
  url?: string | null;
  nombre?: string | null;
  moduloNombre?: string | null;
}): boolean {
  if (hints?.url) {
    try {
      const parsed = new URL(hints.url, window.location.origin);
      if (parsed.searchParams.get('product') === 'rcv' || parsed.searchParams.get('product') === 'funerario') {
        return false;
      }
      const flow = parsed.searchParams.get('flow');
      if (flow === 'exelixi-catalog' || flow === 'exelixi') return true;
      if (isExelixiCatalogEntryPath(parsed.pathname)) return true;
    } catch {
      /* ignore */
    }
  }
  const label = `${hints?.nombre ?? ''} ${hints?.moduloNombre ?? ''}`.toLowerCase();
  return (
    label.includes('exelixi')
    && (
      label.includes('catalogo')
      || label.includes('catálogo')
      || label.includes('generica')
      || label.includes('genérica')
    )
  );
}

/**
 * Flujo Exélixi catálogo — solo URL actual (como ?product=rcv|funerario para La Mundial).
 * Sin flags en sessionStorage.
 */
export function isExelixiCatalogFlow(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    // ?flow=exelixi-catalog manda — igual que ?product=rcv para La Mundial.
    const flow = params.get('flow');
    if (flow === 'exelixi-catalog' || flow === 'exelixi') return true;
    const product = params.get('product');
    if (product === 'rcv' || product === 'funerario') return false;
    if (isExelixiCatalogEntryPath()) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Sincroniza ?flow=exelixi-catalog en la URL — nunca sobre URLs La Mundial (?product=). */
export function ensureExelixiFlowQueryParam(active: boolean): void {
  if (!active || isExelixiCatalogFlow()) return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('product') === 'rcv' || url.searchParams.get('product') === 'funerario') {
      return;
    }
    url.searchParams.set('flow', 'exelixi-catalog');
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* ignore */
  }
}

export function readStoredBuilderProduct(): BuilderCatalogProduct | null {
  try {
    const raw = sessionStorage.getItem(BUILDER_PRODUCT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BuilderCatalogProduct;
  } catch {
    return null;
  }
}

export function branchHasVehicle(branch: BuilderProductBranch): boolean {
  return branch === 'AUTOMOVIL' || branch === 'RCV_OBLIGATORIO';
}

export function isFunerarioLikeProduct(product: BuilderCatalogProduct): boolean {
  const name = product.commercialName.toLowerCase();
  return name.includes('funerar') || name.includes('funeral');
}

export interface ExelixiCatalogProductView {
  label: string;
  fullLabel: string;
  hasVehicle: boolean;
  useFuneralStep: boolean;
  skipPersonasStep: boolean;
  builderProductId: string;
}

export function getExelixiCatalogProductView(): ExelixiCatalogProductView | null {
  const builder = readStoredBuilderProduct() ?? readOcrHandoff()?.product ?? null;
  if (!builder) return null;

  const hasVehicle = branchHasVehicle(builder.branch);
  const funeralStep = !hasVehicle && isFunerarioLikeProduct(builder);

  return {
    label: builder.commercialName,
    fullLabel: builder.commercialName,
    hasVehicle,
    useFuneralStep: funeralStep,
    skipPersonasStep: !hasVehicle && !funeralStep,
    builderProductId: builder.id,
  };
}

export function readOcrHandoff(): ExelixiOcrHandoff | null {
  try {
    // Preferir query (cross-port local OCR→Formulario) y luego sessionStorage (mismo origen).
    const fromUrl = new URLSearchParams(window.location.search).get('ocr_handoff');
    if (fromUrl) {
      const b64 = fromUrl.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
      const binary = atob(b64 + pad);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(json) as ExelixiOcrHandoff;
      try {
        sessionStorage.setItem(EXELIXI_OCR_HANDOFF_KEY, json);
      } catch { /* ignore */ }
      // Limpiar el param de la URL para no rehidratar en cada refresh.
      const url = new URL(window.location.href);
      url.searchParams.delete('ocr_handoff');
      window.history.replaceState({}, '', url.toString());
      return parsed;
    }

    const raw = sessionStorage.getItem(EXELIXI_OCR_HANDOFF_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExelixiOcrHandoff;
  } catch {
    return null;
  }
}

function defaultDoc(status: DocumentState['status'] = 'done'): DocumentState {
  return { status, progress: status === 'done' ? 100 : 0 };
}

export function applyExelixiOcrHandoff(
  setters: {
    setDocState: (doc: DocType, state: Partial<DocumentState>) => void;
    setTomador: (data: Partial<TomadorData>) => void;
    setVehicle: (data: Partial<VehicleData>) => void;
    setOcrDone: (done: boolean) => void;
    setDiligencia?: (data: import('./diligencia').DiligenciaState | Partial<import('./diligencia').DiligenciaState> | null) => void;
    setSameInsured?: (v: boolean) => void;
    setAsegurado?: (data: Partial<PersonData>) => void;
    setHasDriver?: (v: boolean) => void;
    setConductor?: (data: Partial<PersonData>) => void;
    goTo: (step: number) => void;
  },
): boolean {
  const handoff = readOcrHandoff();
  if (!handoff) return false;
  // Local OCR→Formulario (?ocr_handoff) también aplica en La Mundial (?product=rcv).

  if (handoff.product) {
    try {
      sessionStorage.setItem(BUILDER_PRODUCT_STORAGE_KEY, JSON.stringify(handoff.product));
    } catch {
      /* ignore */
    }
  }

  const docTypes: OcrDocType[] = ['cedula', 'licencia', 'certificado', 'rif', 'pasaporte'];
  for (const type of docTypes) {
    const fields = handoff.ocrData[type];
    const hash = handoff.documentHashes?.[type];
    if (fields) {
      setters.setDocState(type, { status: 'done', progress: 100, ocr: fields, hash });
    } else {
      setters.setDocState(type, defaultDoc('idle'));
    }
  }

  if (handoff.diligencia && setters.setDiligencia) {
    setters.setDiligencia(handoff.diligencia);
  } else if (handoff.itipoDiligencia && setters.setDiligencia) {
    setters.setDiligencia({
      itipoDiligencia: handoff.itipoDiligencia,
      documentosRequeridos: (handoff.documentosRequeridos ?? []) as DocType[],
      documentHashes: handoff.documentHashes as Partial<Record<DocType, string>>,
      clasificadoEn: 'ocr',
      camposObligatorios: ['direccion'],
    });
  }

  const cedula = handoff.ocrData.cedula;
  if (cedula?.nombre || cedula?.identificacion) {
    setters.setTomador({
      nombre: cedula.nombre ?? '',
      apellido: cedula.apellido ?? '',
      identificacion: cedula.identificacion ?? '',
      tipoDoc: cedula.tipoDoc ?? 'V',
      fechaNac: cedula.fechaNacimiento ?? '',
      sexo: cedula.sexo ?? '',
      estadoCivil: cedula.estadoCivil ?? '',
    });
  }

  const cert = handoff.ocrData.certificado;
  if (cert) {
    if (!cedula?.identificacion && !cedula?.nombre) {
      const tomadorFromCert = extractTomadorFromCertificado(cert);
      if (tomadorFromCert) setters.setTomador(tomadorFromCert);
    }
    const rcvHandoff = !isExelixiCatalogFlow();
    setters.setVehicle({
      placa: cert.placa ?? '',
      marca: cert.marca ?? '',
      modelo: resolveOcrModelo(cert),
      año: cert.año ?? cert.anio ?? '',
      color: cert.color ?? '',
      serial: sanitizeOcrField(cert.serial),
      serialMotor: sanitizeOcrField(cert.serialMotor),
      cilindrada: rcvHandoff ? cert.cilindrada ?? '' : '',
      tipoCarnet: rcvHandoff ? cert.tipoCarnet : undefined,
      tipoPlaca: resolveOcrTipoPlaca(cert),
    });
  }

  if (
    setters.setSameInsured
    && setters.setAsegurado
    && setters.setHasDriver
    && setters.setConductor
  ) {
    applyOcrPersonRoles(
      handoff.ocrData.cedula,
      handoff.ocrData.certificado,
      handoff.ocrData.licencia,
      {
        setSameInsured: setters.setSameInsured,
        setAsegurado: setters.setAsegurado,
        setHasDriver: setters.setHasDriver,
        setConductor: setters.setConductor,
      },
    );
  }

  setters.setOcrDone(true);
  setters.goTo(2);
  return true;
}

/** Siguiente paso: módulo emisión (planes product-emission). */
export function getEmisionContinueUrl(): string {
  const configured = import.meta.env.VITE_EMISION_CONTINUE_BASE as string | undefined;
  const base = (configured?.replace(/\/$/, '') || '/emision').replace(/\/$/, '');
  const params = new URLSearchParams({ flow: 'exelixi-catalog', wizardStep: '4' });

  try {
    const current = new URL(window.location.href);
    const sid = current.searchParams.get('sid');
    const nexusToken =
      current.searchParams.get('nexus_token')
      || sessionStorage.getItem('nexus_access_token_formulario');
    if (sid) params.set('sid', sid);
    if (nexusToken) params.set('nexus_token', nexusToken);
  } catch {
    /* ignore */
  }

  return `${base}/?${params.toString()}`;
}

/** Avanza al módulo emisión en flujo Exélixi (bridge o redirect con ?flow=exelixi-catalog). */
export function continueToEmisionModule(snapshot?: Partial<ExelixiWizardHandoff>): void {
  if (snapshot) {
    mergeExelixiWizardHandoff(snapshot);
  }

  if (typeof window.__bridgeAdvance === 'function') {
    void window.__bridgeAdvance({ exelixiCatalogFlow: true });
    return;
  }

  window.location.href = getEmisionContinueUrl();
}
