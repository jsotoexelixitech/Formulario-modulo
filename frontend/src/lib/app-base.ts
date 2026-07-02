/** Base normalizada del módulo (Vite `base`). Ej. `/` o `/formulario/`. */
function normalizedBase(): string {
  return (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
}

/** Base URL del módulo (Vite `base`). Ej. `/formulario/` → API en `/formulario/api`. */
export function moduleApiBase(): string {
  return `${normalizedBase()}api`;
}

/**
 * Ruta de un archivo en `public/` respetando el prefijo de despliegue.
 * Ej. publicAsset('logo.png') → `/formulario/logo.png` cuando base es `/formulario/`.
 */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${normalizedBase()}${clean}`;
}
