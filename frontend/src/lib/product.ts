/**
 * Producto activo del flujo de suscripción.
 *
 * El flujo modular (OCR → Formulario → Plan → Pago → Emisión) se reusa para
 * varios productos. El producto se determina por el parámetro `?product=` de la
 * URL (configurado por el admin de Nexus en la URL de cada submódulo) y se
 * conserva en sessionStorage para sobrevivir a la navegación entre módulos.
 *
 * Si no se especifica, el producto por defecto es `rcv` (comportamiento previo).
 */
import type { ProductId } from '../types';
import { isCotizadorFlow } from './cotizador-flow';
import { getExelixiCatalogProductView, isExelixiCatalogFlow } from './exelixi-catalog';

export interface ProductConfig {
  id: ProductId;
  /** Etiqueta corta para badges/títulos (ej. "RCV"). */
  label: string;
  /** Nombre completo del producto (ej. "Seguro Funerario"). */
  fullLabel: string;
  /** Ramo La Mundial asociado (RCV=18, Funerario=9). 0 en flujo Exélixi genérico. */
  cramo: number;
  /** True si el flujo incluye datos de vehículo (RCV). */
  hasVehicle: boolean;
  /** Flujo genérico Exélixi (catálogo product-builder + product-emission). */
  exelixiCatalog?: boolean;
  builderProductId?: string;
  useFuneralStep?: boolean;
  skipPersonasStep?: boolean;
}

export const PRODUCTS: Record<ProductId, ProductConfig> = {
  rcv: {
    id: 'rcv',
    label: 'RCV',
    fullLabel: 'Suscripción RCV',
    cramo: 18,
    hasVehicle: true,
  },
  funerario: {
    id: 'funerario',
    label: 'Funerario',
    fullLabel: 'Seguro Funerario',
    cramo: 9,
    hasVehicle: false,
  },
};

const VALID_PRODUCTS: ProductId[] = ['rcv', 'funerario'];
const STORAGE_KEY = 'exelixi_product';

export interface ProductDetectHints {
  url?: string | null;
  nombre?: string | null;
  moduloNombre?: string | null;
  product?: string | null;
}

/**
 * Detecta rcv|funerario y lo persiste en sessionStorage (Nexus verify / bridge).
 * @param {ProductDetectHints} [hints]
 * @returns {ProductId | null}
 */
export function persistProductFromHints(hints?: ProductDetectHints): ProductId | null {
  if (hints?.product === 'funerario') {
    try { sessionStorage.setItem(STORAGE_KEY, 'funerario'); } catch { /* ignore */ }
    return 'funerario';
  }
  if (hints?.product === 'rcv') {
    try { sessionStorage.setItem(STORAGE_KEY, 'rcv'); } catch { /* ignore */ }
    return 'rcv';
  }
  if (hints?.url) {
    try {
      const fromUrl = new URL(hints.url, window.location.origin).searchParams.get('product');
      if (fromUrl === 'funerario' || fromUrl === 'rcv') {
        sessionStorage.setItem(STORAGE_KEY, fromUrl);
        return fromUrl as ProductId;
      }
    } catch { /* ignore */ }
  }
  const label = `${hints?.nombre ?? ''} ${hints?.moduloNombre ?? ''}`.toLowerCase();
  if (label.includes('funerar')) {
    try { sessionStorage.setItem(STORAGE_KEY, 'funerario'); } catch { /* ignore */ }
    return 'funerario';
  }
  return null;
}

/** Lee el producto activo: URL `?product=` → sessionStorage → 'rcv'. */
export function getProductId(): ProductId {
  try {
    const fromUrl = new URL(window.location.href).searchParams.get('product');
    if (fromUrl && VALID_PRODUCTS.includes(fromUrl as ProductId)) {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl as ProductId;
    }
  } catch { /* ignore */ }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && VALID_PRODUCTS.includes(stored as ProductId)) {
      return stored as ProductId;
    }
  } catch { /* ignore */ }

  return 'rcv';
}

/** Config efectiva: Exélixi catálogo → product-builder; si no, rcv/funerario La Mundial. */
export function getProductConfig(): ProductConfig {
  if (isExelixiCatalogFlow()) {
    const catalog = getExelixiCatalogProductView();
    if (catalog) {
      return {
        id: 'rcv',
        label: catalog.label,
        fullLabel: catalog.fullLabel,
        cramo: 0,
        hasVehicle: catalog.hasVehicle,
        exelixiCatalog: true,
        builderProductId: catalog.builderProductId,
        useFuneralStep: catalog.useFuneralStep,
        skipPersonasStep: catalog.skipPersonasStep,
      };
    }
  }
  return PRODUCTS[getProductId()];
}

export function usesFuneralStep(): boolean {
  const cfg = getProductConfig();
  if (cfg.exelixiCatalog) return Boolean(cfg.useFuneralStep);
  // Funerario La Mundial: el titular es el único asegurado (paso 2). No hay paso de más asegurados.
  return false;
}

export function usesVehicleStep(): boolean {
  return getProductConfig().hasVehicle;
}

export function skipsPersonasStep(): boolean {
  const cfg = getProductConfig();
  if (cfg.exelixiCatalog) return Boolean(cfg.skipPersonasStep);
  return isFunerario();
}

export function isFunerario(): boolean {
  return getProductId() === 'funerario';
}

export function isRcv(): boolean {
  return getProductId() === 'rcv';
}

/** RCV La Mundial (emisión o cotizador). Excluye catálogo genérico Exélixi. */
export function isRcvLaMundialFlow(): boolean {
  if (isExelixiCatalogFlow()) return false;
  return isRcv() || isCotizadorFlow();
}
