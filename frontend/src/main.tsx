import { StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FormularioConfigPanel } from './config/FormularioConfigPanel.tsx'
import bridgeReady from './lib/bridge'
import { NexusGuard } from './nexus/NexusGuard'
import { applyExelixiOcrHandoff } from './lib/exelixi-catalog'
import { applyOcrPersonRolesFromDocuments } from './lib/ocr-person-roles'
import { isCotizadorFlow } from './lib/cotizador-flow'
import { applyExelixiBranding } from './lib/exelixi-branding'
import { useWizardStore } from './store/wizardStore'
import { isRcv } from './lib/product'
import { applyMetadataFromNexusToken, getNexusTokenFromUrl } from './lib/nexus-token-client'
import { mergeMarketplaceActorMetadata, rememberMarketplaceActorFromToken } from './lib/sso-metadata'

// Identidad Exélixi (colores + favicon) solo si el flujo activo es el catálogo.
applyExelixiBranding('Formulario');

rememberMarketplaceActorFromToken(getNexusTokenFromUrl());

applyMetadataFromNexusToken('nexus_access_token_formulario', (metadata) => {
  const store = useWizardStore.getState();
  store.setMetadataCanal(
    mergeMarketplaceActorMetadata({ ...(store.metadataCanal || {}), ...metadata }),
  );
});

function ExelixiHandoffBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    const runBootstrap = () => {
      const {
        setDocState,
        setTomador,
        setVehicle,
        setOcrDone,
        setDiligencia,
        goTo,
        setSameInsured,
        setAsegurado,
        setHasDriver,
        setConductor,
      } = useWizardStore.getState();

      if (isCotizadorFlow() && isRcv()) {
        setOcrDone(true);
        if (!useWizardStore.getState().vehicle.tipoPlaca) {
          useWizardStore.getState().setVehicle({ tipoPlaca: 'nacional' });
        }
        goTo(3);
        return;
      }

      const handoffApplied = applyExelixiOcrHandoff({
        setDocState,
        setTomador,
        setVehicle,
        setOcrDone,
        setDiligencia,
        goTo,
        setSameInsured,
        setAsegurado,
        setHasDriver,
        setConductor,
      });

      if (!handoffApplied && isRcv()) {
        const latest = useWizardStore.getState().documents;
        const hasOcr =
          latest.cedula?.ocr
          || latest.licencia?.ocr
          || latest.certificado?.ocr;
        if (hasOcr) {
          applyOcrPersonRolesFromDocuments(latest, {
            setSameInsured,
            setAsegurado,
            setHasDriver,
            setConductor,
          });
        }
      }
    };

    void (async () => {
      const sid = new URLSearchParams(window.location.search).get('sid');
      if (sid) {
        await bridgeReady;
        if (window.__bridge?.ready) await window.__bridge.ready;
      }
      if (cancelled) return;
      runBootstrap();
    })();

    return () => { cancelled = true; };
  }, []);
  return children;
}

// /config (dev) o /formulario/config (prod con prefijo Apache)
const isConfigRoute = /\/config\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConfigRoute
      ? <FormularioConfigPanel />
      : (
        <NexusGuard recheckInterval={30}>
          <ExelixiHandoffBootstrap>
            <App />
          </ExelixiHandoffBootstrap>
        </NexusGuard>
      )
    }
  </StrictMode>,
)
