import type { DocType, DocumentState, TomadorData, VehicleData } from '../types';
import {
  EXELIXI_OCR_HANDOFF_KEY,
  type ExelixiOcrHandoff,
  type OcrDocType,
} from './exelixi-handoff-types';

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
const CATALOG_FLOW_STORAGE_KEY = 'exelixi_catalog_flow';

export function isExelixiCatalogEntryPath(pathname?: string): boolean {
  const path = (pathname ?? window.location.pathname).replace(/\/$/, '') || '/';
  return path.endsWith('/exelixi') || path.includes('/ocr/exelixi');
}

export function persistExelixiCatalogFlow(): void {
  try {
    sessionStorage.setItem(CATALOG_FLOW_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function isExelixiCatalogFlowHint(hints?: {
  url?: string | null;
  nombre?: string | null;
  moduloNombre?: string | null;
}): boolean {
  if (hints?.url) {
    try {
      const parsed = new URL(hints.url, window.location.origin);
      if (parsed.searchParams.get('flow') === 'exelixi-catalog') return true;
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
      || label.includes('emision')
      || label.includes('emisión')
    )
  );
}

export function isExelixiCatalogFlow(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('flow') === 'exelixi-catalog') {
      persistExelixiCatalogFlow();
      return true;
    }
    if (sessionStorage.getItem(CATALOG_FLOW_STORAGE_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
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
  const builder = readStoredBuilderProduct();
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

/** Hidrata wizardStore con datos del OCR Exélixi (sessionStorage handoff). */
export function applyExelixiOcrHandoff(
  setters: {
    setDocState: (doc: DocType, state: Partial<DocumentState>) => void;
    setTomador: (data: Partial<TomadorData>) => void;
    setVehicle: (data: Partial<VehicleData>) => void;
    setOcrDone: (done: boolean) => void;
    goTo: (step: number) => void;
  },
): boolean {
  if (!isExelixiCatalogFlow()) return false;

  const handoff = readOcrHandoff();
  if (!handoff) return false;

  if (handoff.product) {
    try {
      sessionStorage.setItem(BUILDER_PRODUCT_STORAGE_KEY, JSON.stringify(handoff.product));
    } catch {
      /* ignore */
    }
  }

  const docTypes: OcrDocType[] = ['cedula', 'licencia', 'certificado', 'rif'];
  for (const type of docTypes) {
    const fields = handoff.ocrData[type];
    if (fields) {
      setters.setDocState(type, { status: 'done', progress: 100, ocr: fields });
    } else {
      setters.setDocState(type, defaultDoc('idle'));
    }
  }

  const cedula = handoff.ocrData.cedula;
  if (cedula) {
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
    setters.setVehicle({
      placa: cert.placa ?? '',
      marca: cert.marca ?? '',
      modelo: cert.modelo ?? '',
      año: cert.año ?? cert.anio ?? '',
      color: cert.color ?? '',
      serial: cert.serial ?? '',
    });
  }

  setters.setOcrDone(true);
  setters.goTo(2);
  return true;
}
