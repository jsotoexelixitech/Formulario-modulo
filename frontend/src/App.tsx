import { useState, useEffect } from 'react';
import { useWizardStore } from './store/wizardStore';
import { TopStepper } from './components/TopStepper';
import { TopProgressBar } from './components/TopProgressBar';
import { AuroraBackground } from './components/AuroraBackground';
import { Toaster } from './components/Toaster';
import { WelcomeSplash } from './components/WelcomeSplash';
import { Button } from './components/ui/Button';
import { EmissionStep } from './features/emission/EmissionStep';
import { VehicleStep } from './features/vehicle/VehicleStep';
import { FuneralStep } from './features/funeral/FuneralStep';
import { getProductConfig, isFunerario, isRcv, skipsPersonasStep, usesFuneralStep, usesVehicleStep } from './lib/product';
import { continueToEmisionModule } from './lib/exelixi-catalog';
import { continueToEmisionCotizador, isCotizadorFlow } from './lib/cotizador-flow';
import type { ExelixiWizardHandoff } from './lib/exelixi-wizard-handoff';
import { syncTitularFromTomador } from './lib/funeral-sync';
import { toast } from './store/toastStore';
import { ChevronLeft, ChevronRight, Sparkles, ShieldCheck } from 'lucide-react';

type StepMeta = { eyebrow: string; title: string; sub: string };

function buildExelixiWizardSnapshot(): Partial<ExelixiWizardHandoff> {
  const snap = useWizardStore.getState();
  return {
    tomador: snap.tomador,
    sameInsured: snap.sameInsured,
    asegurado: snap.asegurado,
    hasBeneficiary: snap.hasBeneficiary,
    beneficiario: snap.beneficiario,
    vehicle: snap.vehicle,
    funeral: snap.funeral,
    ocrDone: snap.ocrDone,
    diligencia: snap.diligencia,
  };
}

function buildCotizadorSnapshot(): Partial<ExelixiWizardHandoff> {
  const snap = useWizardStore.getState();
  return { vehicle: snap.vehicle, ocrDone: true };
}

const STEP_META_BY_PRODUCT: Record<'rcv' | 'funerario', Record<2 | 3, StepMeta>> = {
  rcv: {
    2: {
      eyebrow: 'Paso 02 · Emisión',
      title: 'Información del cliente',
      sub: 'Verifica los datos detectados y completa lo que falte.',
    },
    3: {
      eyebrow: 'Paso 03 · Vehículo',
      title: 'Datos del vehículo',
      sub: 'Información del vehículo a asegurar y conductor habitual.',
    },
  },
  funerario: {
    2: {
      eyebrow: 'Paso 02 · Tomador',
      title: 'Información del cliente',
      sub: 'Verifica los datos detectados y completa lo que falte.',
    },
    3: {
      eyebrow: 'Paso 03 · Personas',
      title: 'Asegurados y beneficiarios',
      sub: 'Indica las personas cubiertas y los beneficiarios de la póliza funeraria.',
    },
  },
};

function getStepMeta(product: ReturnType<typeof getProductConfig>, localStep: 2 | 3): StepMeta {
  if (product.exelixiCatalog) {
    if (localStep === 2) {
      return {
        eyebrow: 'Paso 02 · Cliente',
        title: 'Información del cliente',
        sub: 'Verifica los datos del OCR y completa lo que falte.',
      };
    }
    if (product.hasVehicle) {
      return {
        eyebrow: 'Paso 03 · Vehículo',
        title: 'Datos del vehículo',
        sub: 'Información del vehículo a asegurar.',
      };
    }
    if (product.useFuneralStep) {
      return STEP_META_BY_PRODUCT.funerario[3];
    }
    return STEP_META_BY_PRODUCT.rcv[2];
  }
  return STEP_META_BY_PRODUCT[product.id][localStep];
}

import { FormularioConfigPanel } from './config/FormularioConfigPanel';

export default function App() {
  if (window.location.pathname === '/config') {
    return <FormularioConfigPanel />;
  }

  const { goTo } = useWizardStore();
  const step = useWizardStore((s) => s.step);
  const cotizadorRcv = isCotizadorFlow() && isRcv();
  const [localStep, setLocalStep] = useState<2 | 3>(() => (cotizadorRcv || step === 3 ? 3 : 2));
  const product = getProductConfig();

  useEffect(() => {
    if (step === 2 || step === 3) setLocalStep(step);
  }, [step]);

  function navigate(to: 2 | 3) {
    setLocalStep(to);
    goTo(to);
  }

  async function handleNext() {
    if (cotizadorRcv) {
      const validate = (window as unknown as Record<string, unknown>).__validateStep3 as (() => boolean | Promise<boolean>) | undefined;
      if (validate) {
        const isValid = await validate();
        if (!isValid) return;
      }
      toast.success('Datos del vehículo guardados', 'Consultando planes RCV disponibles…');
      continueToEmisionCotizador(buildCotizadorSnapshot());
      return;
    }

    if (localStep === 2) {
      const validate = (window as unknown as Record<string, unknown>).__validateStep2 as (() => boolean) | undefined;
      if (validate && !validate()) {
        toast.warning(
          'Campos obligatorios incompletos',
          'Completa nombre, apellido, teléfono, correo, fecha de nacimiento, sexo, estado y ciudad para continuar.',
        );
        return;
      }
      if (!isFunerario() && !usesFuneralStep()) {
        syncTitularFromTomador();
      }
      if (skipsPersonasStep()) {
        toast.success(
          '¡Formulario completado!',
          'Datos del cliente guardados correctamente.',
        );
        continueToEmisionModule(buildExelixiWizardSnapshot());
        return;
      }
      navigate(3);
    } else {
      const validate = (window as unknown as Record<string, unknown>).__validateStep3 as (() => boolean | Promise<boolean>) | undefined;
      if (validate) {
        const isValid = await validate();
        if (!isValid) {
          // El propio validateStep3 muestra los errores/toasts pertinentes
          return;
        }
      }
      toast.success(
        '¡Formulario completado!',
        product.hasVehicle
          ? 'Datos del cliente y vehículo guardados correctamente.'
          : 'Datos del cliente y las personas guardados correctamente.',
      );
      if (product.exelixiCatalog) {
        continueToEmisionModule(buildExelixiWizardSnapshot());
      } else {
        window.__bridgeAdvance?.();
      }
    }
  }

  const meta = cotizadorRcv
    ? {
        eyebrow: 'Paso 01 · Vehículo',
        title: 'Datos del vehículo',
        sub: 'Ingresa año, marca, modelo, versión y uso del vehículo para ver los planes RCV.',
      }
    : getStepMeta(product, localStep);

  return (
    <div className="min-h-screen relative">
      <WelcomeSplash />
      <Toaster />
      <AuroraBackground />
      <div className="lg:hidden">
        <TopProgressBar />
      </div>

      <div>
        <main className="flex-1 min-h-screen pt-[72px] lg:pt-10 px-4 sm:px-6 lg:px-10 pb-32 lg:pb-12">
          <div className="max-w-5xl mx-auto">
            <TopStepper />

            <header className="mb-8 animate-fade-in">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-black tracking-[0.22em] gradient-text-indigo uppercase mb-2 inline-flex items-center gap-1.5">
                    <Sparkles size={11} className="text-indigo-500" />
                    {meta.eyebrow}
                  </p>
                  <h1 className="font-display text-3xl sm:text-[2.5rem] font-black text-slate-900 tracking-tight leading-tight">
                    {meta.title}
                  </h1>
                  <p className="text-slate-500 text-sm mt-2 max-w-xl leading-relaxed">
                    {meta.sub}
                  </p>
                </div>
              </div>
            </header>

            <section key={localStep} className="surface-card overflow-hidden step-enter">
              <div className="p-6 sm:p-8 lg:p-10">
                {!cotizadorRcv && localStep === 2 && <EmissionStep />}
                {(cotizadorRcv || localStep === 3) && (usesFuneralStep() ? <FuneralStep /> : usesVehicleStep() ? <VehicleStep /> : null)}
              </div>

              <div className="hidden md:flex items-center justify-between gap-4 px-8 lg:px-10 py-5 border-t border-slate-100/80 bg-gradient-to-b from-slate-50/50 to-white/40 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  <span className="font-medium">Cifrado de extremo a extremo · TLS 1.3</span>
                </div>
                <div className="flex gap-3">
                  {!cotizadorRcv && localStep === 3 && (
                    <Button variant="secondary" onClick={() => navigate(2)}>
                      <ChevronLeft size={15} />
                      Atrás
                    </Button>
                  )}
                  <Button variant="primary" onClick={handleNext} className="min-w-[180px]">
                    {cotizadorRcv ? 'Ver planes' : localStep === 3 ? 'Guardar datos' : 'Continuar'}
                    <ChevronRight size={15} />
                  </Button>
                </div>
              </div>
            </section>

          </div>
        </main>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 py-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="flex gap-2">
          {!cotizadorRcv && localStep === 3 && (
            <Button variant="secondary" className="flex-1" onClick={() => navigate(2)}>
              <ChevronLeft size={15} />
              Atrás
            </Button>
          )}
          <Button variant="primary" className="flex-1" onClick={handleNext}>
            {cotizadorRcv ? 'Ver planes' : localStep === 3 ? 'Guardar' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
