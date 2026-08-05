import { StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FormularioConfigPanel } from './config/FormularioConfigPanel.tsx'
import './lib/bridge'
import { NexusGuard } from './nexus/NexusGuard'
import { applyExelixiOcrHandoff } from './lib/exelixi-catalog'
import { applyExelixiBranding } from './lib/exelixi-branding'
import { useWizardStore } from './store/wizardStore'

// Identidad Exélixi (colores + favicon) solo si el flujo activo es el catálogo.
applyExelixiBranding('Formulario');

function ExelixiHandoffBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    const { setDocState, setTomador, setVehicle, setOcrDone, goTo } = useWizardStore.getState();
    applyExelixiOcrHandoff({ setDocState, setTomador, setVehicle, setOcrDone, goTo });
  }, []);
  return children;
}

// Enrutamiento simple: /config → panel de configuración, resto → app normal.
const isConfigRoute = window.location.pathname === '/config';

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
