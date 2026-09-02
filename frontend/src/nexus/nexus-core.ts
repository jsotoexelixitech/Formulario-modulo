/**
 * nexus-core.ts — NexusGuard core para modulo-formulario (Pasos 2-3: Formulario)
 */

import { getNexusToken, persistNexusToken } from '../lib/nexus-token-client';

const STORAGE_KEY = 'nexus_access_token_formulario';

const INTERNAL_HTTP_RE = /^http:\/\/(192\.168\.|10\.|127\.0\.0\.1|localhost)(:\d+)?/i;

const MODULE_NEXUS_API: [string, string][] = [
  ['/ocr', '/ocr/nexus-api'],
  ['/formulario', '/formulario/nexus-api'],
  ['/emision', '/emision/nexus-api'],
  ['/pagos', '/pagos/nexus-api'],
];

/** Producción GCIA — subdominios (paridad con nexusqa en QA). */
const PRODUCTION_GCIA_NEXUS_API = 'https://nexus-api.exelixitech.com';
const PRODUCTION_GCIA_FRONT_HOSTS = new Set([
  'ocr.exelixitech.com',
  'formulario.exelixitech.com',
  'emision.exelixitech.com',
  'pagos.exelixitech.com',
]);

function resolveProductionGciaNexusApi(): string | null {
  if (typeof window === 'undefined') return null;
  if (PRODUCTION_GCIA_FRONT_HOSTS.has(window.location.hostname)) {
    return PRODUCTION_GCIA_NEXUS_API;
  }
  return null;
}

function resolveModuleNexusApiOnHttps(): string | null {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
    return null;
  }
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  for (const [prefix, apiPath] of MODULE_NEXUS_API) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return `${window.location.origin}${apiPath}`;
    }
  }
  return null;
}

function useModuleProxyBuild(): boolean {
  const flag = import.meta.env.VITE_NEXUS_USE_MODULE_PROXY;
  return flag === '1' || flag === 'true';
}

/** QA/dev: si el build trae cierrelmds pero la página es nexusqa, usar /nexus-api del host actual. */
function resolveSameOriginNexusApi(
  trimmed: string,
  moduleOnHttps: string | null,
): string | null {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
    return null;
  }
  let configuredHost = '';
  try {
    if (trimmed && !INTERNAL_HTTP_RE.test(trimmed)) {
      configuredHost = new URL(trimmed).hostname;
    }
  } catch {
    /* ignore */
  }
  const pageHost = window.location.hostname;
  if (!configuredHost || configuredHost !== pageHost) {
    return moduleOnHttps ?? `${window.location.origin}/nexus-api`;
  }
  return null;
}

/** QA: .env.production puede traer cierrelmds/nexus-api; prioriza host actual en HTTPS. */
export function resolveNexusApiUrl(configured?: string): string {
  const productionGcia = resolveProductionGciaNexusApi();
  if (productionGcia) return productionGcia;

  const moduleOnHttps = resolveModuleNexusApiOnHttps();
  if (moduleOnHttps && useModuleProxyBuild()) {
    return moduleOnHttps;
  }

  const trimmed = configured?.trim().replace(/\/$/, '') ?? '';
  const sameOrigin = resolveSameOriginNexusApi(trimmed, moduleOnHttps);
  if (sameOrigin) return sameOrigin;

  if (trimmed && !INTERNAL_HTTP_RE.test(trimmed)) {
    return trimmed;
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return moduleOnHttps ?? `${window.location.origin}/nexus-api`;
  }
  if (trimmed) return trimmed;
  return 'http://localhost:3092';
}

export interface NexusVerifyResult {
  active: boolean;
  product?: 'rcv' | 'funerario';
  empresa?: { id: number; nombre: string; rif: string };
  submodulo?: {
    id: number;
    nombre: string;
    url: string | null;
    moduloNombre?: string | null;
    accessUrl: string | null;
  };
  reason?: string;
}

function nexusApiCandidates(primary: string): string[] {
  const out: string[] = [];
  const push = (raw?: string | null) => {
    const t = raw?.trim().replace(/\/$/, '');
    if (t && !out.includes(t)) out.push(t);
  };
  push(primary);
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    const origin = window.location.origin;
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    for (const [prefix, apiPath] of MODULE_NEXUS_API) {
      if (path === prefix || path.startsWith(`${prefix}/`)) {
        push(`${origin}${apiPath}`);
      }
    }
    push(`${origin}/nexus-api`);
  }
  return out;
}

export async function verifyNexusAccess(nexusApiUrl: string): Promise<NexusVerifyResult> {
  const token = getNexusToken(STORAGE_KEY);

  if (!token) {
    return {
      active: false,
      reason: 'No se proporcionó token de acceso. Contacte a su administrador.',
    };
  }

  let lastReason = 'No se pudo conectar con el servidor de autorización.';

  for (const base of nexusApiCandidates(nexusApiUrl)) {
    try {
      const res = await fetch(`${base}/api/access/verify`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const text = await res.text();
      let data: {
        active?: boolean;
        access_token?: string;
        product?: NexusVerifyResult['product'];
        empresa?: NexusVerifyResult['empresa'];
        submodulo?: NexusVerifyResult['submodulo'];
        reason?: string;
      };
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        lastReason = `El servidor de autorización no respondió JSON (${res.status} en ${base}).`;
        continue;
      }

      if (data.active) {
        if (data.access_token) {
          persistNexusToken(STORAGE_KEY, data.access_token);
        }
        return {
          active: true,
          product: data.product,
          empresa: data.empresa,
          submodulo: data.submodulo,
        };
      }

      lastReason = data.reason ?? 'Servicio no disponible para esta empresa.';
    } catch {
      /* probar siguiente candidato */
    }
  }

  return { active: false, reason: lastReason };
}
