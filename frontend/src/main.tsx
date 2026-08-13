import { StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FormularioConfigPanel } from './config/FormularioConfigPanel.tsx'
import './lib/bridge'
import { NexusGuard } from './nexus/NexusGuard'
import { applyExelixiOcrHandoff } from './lib/exelixi-catalog'
import { isCotizadorFlow } from './lib/cotizador-flow'
import { applyExelixiBranding } from './lib/exelixi-branding'
import { useWizardStore } from './store/wizardStore'
import { isRcv } from './lib/product'

// Identidad Exélixi (colores + favicon) solo si el flujo activo es el catálogo.
applyExelixiBranding('Formulario');

function ExelixiHandoffBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    const { setDocState, setTomador, setVehicle, setOcrDone, goTo } = useWizardStore.getState();
    if (isCotizadorFlow() && isRcv()) {
      setOcrDone(true);
      if (!useWizardStore.getState().vehicle.tipoPlaca) {
        useWizardStore.getState().setVehicle({ tipoPlaca: 'nacional' });
      }
      goTo(3);
      return;
    }
    applyExelixiOcrHandoff({ setDocState, setTomador, setVehicle, setOcrDone, goTo });
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
