import { StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FormularioConfigPanel } from './config/FormularioConfigPanel.tsx'
import './lib/bridge'
import { NexusGuard } from './nexus/NexusGuard'
import { applyExelixiOcrHandoff } from './lib/exelixi-catalog'
import { applyOcrPersonRolesFromDocuments } from './lib/ocr-person-roles'
import { isCotizadorFlow } from './lib/cotizador-flow'
import { applyExelixiBranding } from './lib/exelixi-branding'
import { useWizardStore } from './store/wizardStore'
import { isRcv } from './lib/product'

// Identidad Exélixi (colores + favicon) solo si el flujo activo es el catálogo.
applyExelixiBranding('Formulario');

function ExelixiHandoffBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
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
        documents,
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
        const hasOcr =
          documents.cedula?.ocr
          || documents.licencia?.ocr
          || documents.certificado?.ocr;
        if (hasOcr) {
          applyOcrPersonRolesFromDocuments(documents, {
            setSameInsured,
            setAsegurado,
            setHasDriver,
            setConductor,
          });
        }
      }
    };

    const sid = new URLSearchParams(window.location.search).get('sid');
    if (sid && window.__bridge?.ready) {
      void window.__bridge.ready.then(runBootstrap);
      return;
    }
    runBootstrap();
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
