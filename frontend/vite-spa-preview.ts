import type { Plugin } from 'vite';
import { isBackendProxyPath } from './vite-paths';

/** Fallback SPA para `vite preview` bajo subpath (/formulario/, /pagos/, etc.). */
export function spaPreviewFallback(base: string, deployPrefix = ''): Plugin {
  const normalizedBase = base === './' ? '/' : base.endsWith('/') ? base : `${base}/`;
  const basePath = normalizedBase.replace(/\/$/, '');
  const publicPrefix = deployPrefix.replace(/\/$/, '');

  return {
    name: 'spa-preview-fallback',
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next();
          return;
        }

        const raw = req.url ?? '/';
        const [pathname, search = ''] = raw.split('?');
        const qs = search ? `?${search}` : '';

        if (isBackendProxyPath(pathname)) {
          next();
          return;
        }

        if (
          base === './'
          && publicPrefix
          && (pathname === publicPrefix
            || pathname === `${publicPrefix}/`
            || pathname.startsWith(`${publicPrefix}/`))
          && !pathname.includes('.')
        ) {
          req.url = `/index.html${qs}`;
          next();
          return;
        }

        const isUnderBase =
          pathname === basePath
          || pathname === normalizedBase.slice(0, -1)
          || pathname.startsWith(`${basePath}/`);

        if (isUnderBase && !pathname.includes('.') && pathname !== `${basePath}/index.html`) {
          req.url = `${normalizedBase}index.html${qs}`;
        }

        next();
      });
    },
  };
}
