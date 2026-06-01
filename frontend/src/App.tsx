import { useState, useEffect } from 'react';
import { useWizardStore } from './store/wizardStore';
import { SidebarNav } from './components/SidebarNav';
import { TopProgressBar } from './components/TopProgressBar';
import { AuroraBackground } from './components/AuroraBackground';
import { Toaster } from './components/Toaster';
import { WelcomeSplash } from './components/WelcomeSplash';
import { Button } from './components/ui/Button';
import { EmissionStep } from './features/emission/EmissionStep';
import { VehicleStep } from './features/vehicle/VehicleStep';
import { FuneralStep } from './features/funeral/FuneralStep';
import { getProductConfig } from './lib/product';
import { toast } from './store/toastStore';
import { ChevronLeft, ChevronRight, Sparkles, ShieldCheck, HelpCircle } from 'lucide-react';

type StepMeta = { eyebrow: string; title: string; sub: string };

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

export default function App() {
  const { goTo } = useWizardStore();
  const [localStep, setLocalStep] = useState<2 | 3>(2);
  const product = getProductConfig();

  // Inicializa el store en el paso 2 para que el sidebar lo resalte correctamente
  useEffect(() => { goTo(2); }, [goTo]);

  function navigate(to: 2 | 3) {
    setLocalStep(to);
    goTo(to);
  }

  function handleNext() {
    if (localStep === 2) {
      const validate = (window as unknown as Record<string, unknown>).__validateStep2 as (() => boolean) | undefined;
      if (validate && !validate()) {
        toast.warning(
          'Campos obligatorios incompletos',
          'Completa nombre, apellido, teléfono, correo, fecha de nacimiento, sexo, estado y ciudad para continuar.',
        );
        return;
      }
      navigate(3);
    } else {
      const validate = (window as unknown as Record<string, unknown>).__validateStep3 as (() => boolean) | undefined;
      if (validate && !validate()) {
        toast.warning(
          product.hasVehicle ? 'Datos del vehículo incompletos' : 'Datos de las personas incompletos',
          product.hasVehicle
            ? 'Completa placa, marca y modelo.'
            : 'Completa los datos de los asegurados, la frecuencia y acepta los términos.',
        );
        return;
      }
      toast.success(
        '¡Formulario completado!',
        product.hasVehicle
          ? 'Datos del cliente y vehículo guardados correctamente.'
          : 'Datos del cliente y las personas guardados correctamente.',
      );
      // Si el bridge está activo (flujo completo en cadena), avanzar al siguiente módulo
      window.__bridgeAdvance?.();
    }
  }

  const meta = STEP_META_BY_PRODUCT[product.id][localStep];

  return (
    <div className="min-h-screen relative">
      <WelcomeSplash />
      <Toaster />
      <AuroraBackground />
      <TopProgressBar />

      <div className="lg:flex">
        <SidebarNav />

        <main className="flex-1 lg:ml-[300px] min-h-screen pt-[72px] lg:pt-20 px-4 sm:px-6 lg:px-10 pb-32 lg:pb-12">
          <div className="max-w-5xl mx-auto">

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
                <a
                  href="mailto:soporte@lamundialdeseguros.com?subject=Suscripci%C3%B3n%20RCV%20-%20Soporte"
                  className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full glass-light text-slate-600 hover:text-indigo-600 text-xs font-bold transition-all hover:-translate-y-0.5"
                >
                  <HelpCircle size={13} />
                  ¿Necesitas ayuda?
                </a>
              </div>
            </header>

            <section key={localStep} className="surface-card overflow-hidden step-enter">
              <div className="p-6 sm:p-8 lg:p-10">
                {localStep === 2 && <EmissionStep />}
                {localStep === 3 && (product.hasVehicle ? <VehicleStep /> : <FuneralStep />)}
              </div>

              <div className="hidden md:flex items-center justify-between gap-4 px-8 lg:px-10 py-5 border-t border-slate-100/80 bg-gradient-to-b from-slate-50/50 to-white/40 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  <span className="font-medium">Cifrado de extremo a extremo · TLS 1.3</span>
                </div>
                <div className="flex gap-3">
                  {localStep === 3 && (
                    <Button variant="secondary" onClick={() => navigate(2)}>
                      <ChevronLeft size={15} />
                      Atrás
                    </Button>
                  )}
                  <Button variant="primary" onClick={handleNext} className="min-w-[180px]">
                    {localStep === 3 ? 'Guardar datos' : 'Continuar'}
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
          {localStep === 3 && (
            <Button variant="secondary" className="flex-1" onClick={() => navigate(2)}>
              <ChevronLeft size={15} />
              Atrás
            </Button>
          )}
          <Button variant="primary" className="flex-1" onClick={handleNext}>
            {localStep === 3 ? 'Guardar' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
