/** Base normalizada del módulo (Vite `base`). Ej. `/` o `/formulario/`. */
function normalizedBase(): string {
  return (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
}

/** Base URL del módulo (Vite `base`). Ej. `/formulario/` → API en `/formulario/api`. */
export function moduleApiBase(): string {
  const base = normalizedBase();
  if (base === './' && typeof window !== 'undefined') {
    let path = window.location.pathname;
    if (path.endsWith('/index.html')) path = path.slice(0, -'/index.html'.length);
    if (!path.endsWith('/')) path += '/';
    return `${path}api`;
  }
  return `${base}api`;
}

/**
 * Ruta de un archivo en `public/` respetando el prefijo de despliegue.
 * Ej. publicAsset('logo.png') → `/formulario/logo.png` cuando base es `/formulario/`.
 */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${normalizedBase()}${clean}`;
}
