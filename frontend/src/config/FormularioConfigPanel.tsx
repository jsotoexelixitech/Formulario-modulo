import { useState, useEffect } from 'react';
import { useProductConfig } from '../hooks/useProductConfig';
import {
  Settings2, RotateCcw, Save, CheckCircle2,
  AlertTriangle, Loader2,
  User, Users
} from 'lucide-react';

const EMPRESA_ID = Number(import.meta.env.VITE_EMPRESA_ID ?? 1);

// Metadata legible de cada campo del formulario
const CAMPO_META: Record<string, { label: string; grupo: string }> = {
  nombre:         { label: 'Nombre',                grupo: 'Tomador' },
  apellido:       { label: 'Apellido',              grupo: 'Tomador' },
  identificacion: { label: 'Cédula / Pasaporte',    grupo: 'Tomador' },
  sexo:           { label: 'Sexo',                  grupo: 'Tomador' },
  estadoCivil:    { label: 'Estado Civil',           grupo: 'Tomador' },
  telefono:       { label: 'Teléfono',              grupo: 'Tomador' },
  email:          { label: 'Correo electrónico',    grupo: 'Tomador' },
  email2:         { label: 'Confirmar correo',       grupo: 'Tomador' },
  fechaNac:       { label: 'Fecha de Nacimiento',   grupo: 'Tomador' },
  estado:         { label: 'Estado',                grupo: 'Tomador' },
  ciudad:         { label: 'Ciudad',                grupo: 'Tomador' },
  direccion:      { label: 'Dirección',             grupo: 'Tomador' },
};

const SECCION_META: Record<string, { label: string; description: string }> = {
  asegurado:    { label: 'Asegurado diferente al tomador', description: 'Permite indicar que el asegurado no es quien firma' },
  pagador:      { label: 'Pagador diferente al tomador',   description: 'Permite indicar un tercero que realizará el pago' },
  beneficiario: { label: 'Beneficiario',                    description: 'Añade un beneficiario a la póliza' },
  conductor:    { label: 'Conductor habitual',              description: 'Datos del conductor habitual del vehículo (solo RCV)' },
  // Funerario
  asegurados:   { label: 'Personas aseguradas',            description: 'Lista de personas cubiertas en el plan funerario' },
  frecuencia:   { label: 'Frecuencia de pago',             description: 'Permite elegir periodicidad del pago' },
};

function Toggle({ on, onToggle, disabled = false, color = 'indigo' }: {
  on: boolean; onToggle: () => void; disabled?: boolean; color?: 'indigo' | 'emerald';
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative rounded-full transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
        on ? (color === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500') : 'bg-slate-300'
      }`}
      style={{ width: 40, height: 22 }}
    >
      <span
        className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-[18px]' : ''}`}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}

export function FormularioConfigPanel() {
  const producto = new URLSearchParams(window.location.search).get('product') as 'rcv' | 'funerario' ?? 'rcv';
  const { config, loadState, saving, saveError, saveConfig, resetConfig } = useProductConfig(EMPRESA_ID, producto, 'formulario');
  const [local, setLocal] = useState<Record<string, any> | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) setLocal(JSON.parse(JSON.stringify(config)));
  }, [config]);

  function toggleCampo(campo: string, field: 'activo' | 'obligatorio', val: boolean) {
    setLocal((prev) => {
      if (!prev) return prev;
      const next = { ...prev, campos: { ...prev.campos, [campo]: { ...prev.campos[campo], [field]: val } } };
      if (field === 'activo' && !val) next.campos[campo].obligatorio = false;
      if (field === 'obligatorio' && val) next.campos[campo].activo = true;
      return next;
    });
    setSaved(false);
  }

  function toggleSeccion(seccion: string, val: boolean) {
    setLocal((prev) => {
      if (!prev) return prev;
      return { ...prev, secciones: { ...prev.secciones, [seccion]: { ...prev.secciones[seccion], activo: val } } };
    });
    setSaved(false);
  }

  async function handleSave() {
    if (!local) return;
    await saveConfig(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleReset() {
    if (!confirm('¿Restaurar la configuración a los valores por defecto?')) return;
    await resetConfig();
    setSaved(false);
  }

  const campos = local?.campos ?? {};
  const secciones = local?.secciones ?? {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-6 lg:p-10">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 grid place-items-center shadow-lg">
                <Settings2 size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[0.65rem] font-black tracking-widest text-violet-600 uppercase">Parametrizador</p>
                <h1 className="font-bold text-slate-900 text-xl leading-tight">Módulo Formulario</h1>
              </div>
            </div>
            <p className="text-sm text-slate-500 ml-12.5">
              Configura campos y secciones del formulario de <strong className="text-slate-700 capitalize">{producto}</strong>.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold capitalize border border-violet-200">
            {producto}
          </span>
        </div>

        {loadState === 'loading' && (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Cargando configuración...</span>
          </div>
        )}

        {loadState === 'error' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm">No se pudo conectar a Nexus</p>
              <p className="text-amber-700 text-xs mt-1">Se está usando la configuración por defecto. Verifica que el servidor Nexus esté activo.</p>
            </div>
          </div>
        )}

        {local && (
          <div className="space-y-8">

            {/* Campos */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <User size={14} className="text-slate-400" />
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Campos del formulario</span>
              </div>
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                {/* Header de tabla */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="text-[0.7rem] font-black text-slate-500 uppercase tracking-wider">Campo</span>
                  <span className="text-[0.7rem] font-black text-slate-500 uppercase tracking-wider w-24 text-center">Visible</span>
                  <span className="text-[0.7rem] font-black text-slate-500 uppercase tracking-wider w-28 text-center">Obligatorio</span>
                </div>

                {Object.entries(campos).map(([key, val]: [string, any], idx) => {
                  const meta = CAMPO_META[key] ?? { label: key, grupo: 'Otros' };
                  return (
                    <div
                      key={key}
                      className={`grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-3.5 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      } ${!val.activo ? 'opacity-50' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{val.label ?? meta.label}</p>
                        <p className="text-xs text-slate-400">{key}</p>
                      </div>
                      <div className="w-24 flex justify-center">
                        <Toggle on={val.activo} onToggle={() => toggleCampo(key, 'activo', !val.activo)} />
                      </div>
                      <div className="w-28 flex justify-center">
                        <Toggle
                          on={val.obligatorio}
                          onToggle={() => toggleCampo(key, 'obligatorio', !val.obligatorio)}
                          disabled={!val.activo}
                          color="emerald"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Secciones */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Users size={14} className="text-slate-400" />
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Secciones</span>
              </div>
              <div className="space-y-3">
                {Object.entries(secciones).map(([key, val]: [string, any]) => {
                  const meta = SECCION_META[key] ?? { label: key, description: '' };
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        val.activo ? 'border-indigo-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50 opacity-60'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">{meta.label}</p>
                        <p className="text-xs text-slate-500">{meta.description}</p>
                      </div>
                      <Toggle on={val.activo} onToggle={() => toggleSeccion(key, !val.activo)} />
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Error */}
            {saveError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-center gap-2 text-xs text-rose-700">
                <AlertTriangle size={14} />
                {saveError}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-slate-300 transition-colors disabled:opacity-50"
              >
                <RotateCcw size={14} />
                Restaurar defaults
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {saving
                  ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
                  : saved
                  ? <><CheckCircle2 size={15} /> ¡Guardado!</>
                  : <><Save size={15} /> Guardar configuración</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
