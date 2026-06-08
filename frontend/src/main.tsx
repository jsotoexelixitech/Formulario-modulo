import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FormularioConfigPanel } from './config/FormularioConfigPanel.tsx'
import './lib/bridge'
import { NexusGuard } from './nexus/NexusGuard'

// Enrutamiento simple: /config → panel de configuración, resto → app normal.
const isConfigRoute = window.location.pathname === '/config';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConfigRoute
      ? <FormularioConfigPanel />
      : (
        <NexusGuard recheckInterval={30}>
          <App />
        </NexusGuard>
      )
    }
  </StrictMode>,
)
