import { useState, useEffect, useCallback } from 'react';
import { useProductConfig } from '../hooks/useProductConfig';
import { getProductId } from '../lib/product';
import {
  Settings2, RotateCcw, Save, CheckCircle2, AlertTriangle,
  Loader2, Plus, Trash2, ArrowLeftRight,
  LayoutList, Layers, ChevronUp, Sparkles, GripVertical
} from 'lucide-react';
import { AuroraBackground } from '../components/AuroraBackground';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const EMPRESA_ID = Number(import.meta.env.VITE_EMPRESA_ID ?? 1);

interface CampoField {
  key: string;
  label: string;
  activo: boolean;
  obligatorio: boolean;
  tipo: string; // 'text' | 'email' | 'date' | 'select' | 'phone' | 'number'
}

interface SeccionField {
  key: string;
  label: string;
  activo: boolean;
  maxPersonas?: number;
  valores?: string[];
}

interface ApiMapEntry {
  internalKey: string;
  externalKey: string;
  transform?: string;
}

type Tab = 'campos' | 'secciones' | 'mapeador';

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'bg-indigo-500' : 'bg-slate-300'}`}
      style={{ width: 40, height: 22 }}
    >
      <span className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : ''}`} style={{ width: 18, height: 18 }} />
    </button>
  );
}

const TIPOS_CAMPO = ['text', 'email', 'date', 'select', 'phone', 'number', 'textarea'];

// ── COMPONENTE SORTABLE ROW ──
function SortableRow({ id, children, active }: { id: string; children: React.ReactNode; active: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col md:flex-row md:items-center gap-3 md:gap-5 transition-all duration-300 rounded-2xl border p-5 group
        ${isDragging ? 'shadow-2xl shadow-indigo-500/20 border-indigo-400 bg-white scale-[1.02] ring-2 ring-indigo-500/20' : ''}
        ${!isDragging && active ? 'border-indigo-100 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-md hover:bg-white' : ''}
        ${!isDragging && !active ? 'border-slate-200/50 bg-slate-50/50 opacity-60 grayscale-[50%]' : ''}`}
    >
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors hidden md:block outline-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </div>
      <div className="md:ml-6 flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-5 w-full">
        {children}
      </div>
      
      {/* Mobile drag handle */}
      <div
        className="absolute right-2 top-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 p-2 rounded-lg hover:bg-indigo-50 transition-colors md:hidden outline-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </div>
    </div>
  );
}

export function FormularioConfigPanel() {
  const producto = getProductId();
  const { config, loadState, saving, saveError, saveConfig, resetConfig } =
    useProductConfig(EMPRESA_ID, producto, 'formulario');

  const [campos, setCampos] = useState<CampoField[]>([]);
  const [secciones, setSecciones] = useState<SeccionField[]>([]);
  const [apiMap, setApiMap] = useState<ApiMapEntry[]>([]);
  const [tab, setTab] = useState<Tab>('campos');
  const [saved, setSaved] = useState(false);
  const [addingCampo, setAddingCampo] = useState(false);
  const [addingSeccion, setAddingSeccion] = useState(false);
  const [newCampo, setNewCampo] = useState({ key: '', label: '', tipo: 'text', obligatorio: true });
  const [newSeccion, setNewSeccion] = useState({ key: '', label: '' });
  const [autocompletarConductor, setAutocompletarConductor] = useState(false);
  const [validacionParentesco, setValidacionParentesco] = useState(false);

  // Sensores DND
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!config) return;
    const rawCampos = config.campos;
    if (Array.isArray(rawCampos)) {
      setCampos(rawCampos as CampoField[]);
    } else if (rawCampos && typeof rawCampos === 'object') {
      setCampos(
        Object.entries(rawCampos as Record<string, any>).map(([key, v]) => ({
          key, label: v.label ?? key, activo: !!v.activo,
          obligatorio: !!v.obligatorio, tipo: v.tipo ?? 'text',
        })),
      );
    }
    const rawSec = config.secciones;
    if (Array.isArray(rawSec)) {
      setSecciones(rawSec as SeccionField[]);
    } else if (rawSec && typeof rawSec === 'object') {
      setSecciones(
        Object.entries(rawSec as Record<string, any>).map(([key, v]) => ({
          key, label: v.label ?? key, activo: !!v.activo,
          maxPersonas: v.maxPersonas, valores: v.valores,
        })),
      );
    }
    setApiMap((config.apiMap as ApiMapEntry[]) ?? []);
    setAutocompletarConductor(config.autocompletarConductor ?? false);
    setValidacionParentesco(config.validacionParentesco ?? false);
  }, [config]);

  // ── handlers ─────────────────────────────────────────────
  const updateCampo = useCallback((key: string, field: keyof CampoField, val: any) => {
    setCampos(prev => prev.map(c => {
      if (c.key !== key) return c;
      const next = { ...c, [field]: val };
      if (field === 'activo' && !val) next.obligatorio = false;
      if (field === 'obligatorio' && val) next.activo = true;
      return next;
    }));
    setSaved(false);
  }, []);

  const removeCampo = (key: string) => { setCampos(p => p.filter(c => c.key !== key)); setSaved(false); };

  const addCampo = () => {
    const key = newCampo.key.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key || !newCampo.label.trim() || campos.find(c => c.key === key)) return;
    setCampos(p => [...p, { key, label: newCampo.label.trim(), activo: true, obligatorio: newCampo.obligatorio, tipo: newCampo.tipo }]);
    setNewCampo({ key: '', label: '', tipo: 'text', obligatorio: true });
    setAddingCampo(false);
    setSaved(false);
  };

  const updateSeccion = (key: string, field: keyof SeccionField, val: any) => {
    setSecciones(prev => prev.map(s => s.key !== key ? s : { ...s, [field]: val }));
    setSaved(false);
  };
  const removeSeccion = (key: string) => { setSecciones(p => p.filter(s => s.key !== key)); setSaved(false); };
  const addSeccion = () => {
    const key = newSeccion.key.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key || !newSeccion.label.trim() || secciones.find(s => s.key === key)) return;
    setSecciones(p => [...p, { key, label: newSeccion.label.trim(), activo: true }]);
    setNewSeccion({ key: '', label: '' });
    setAddingSeccion(false);
    setSaved(false);
  };

  const addMapEntry = () => { setApiMap(p => [...p, { internalKey: '', externalKey: '', transform: 'none' }]); setSaved(false); };
  const updateMapEntry = (idx: number, field: keyof ApiMapEntry, val: string) => {
    setApiMap(p => p.map((e, i) => i === idx ? { ...e, [field]: val } : e));
    setSaved(false);
  };
  const removeMapEntry = (idx: number) => { setApiMap(p => p.filter((_, i) => i !== idx)); setSaved(false); };

  // ── drag and drop handlers ──────────────────────────────────────
  function handleDragEndCampos(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCampos((items) => {
        const oldIndex = items.findIndex((item) => item.key === active.id);
        const newIndex = items.findIndex((item) => item.key === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      setSaved(false);
    }
  }

  function handleDragEndSecciones(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSecciones((items) => {
        const oldIndex = items.findIndex((item) => item.key === active.id);
        const newIndex = items.findIndex((item) => item.key === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      setSaved(false);
    }
  }

  // ── save ───────────────────────────────────────────────────────
  async function handleSave() {
    await saveConfig({ campos, secciones, apiMap, autocompletarConductor, validacionParentesco });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const allCampoKeys = [...new Set([...campos.map(c => c.key), ...secciones.map(s => s.key)])];

  return (
    <div className="min-h-screen relative">
      <AuroraBackground />

      {/* Título flotante como en App.tsx */}
      <div className="pt-[40px] px-6 lg:px-10 pb-12 max-w-4xl mx-auto relative z-10">
        <header className="mb-8 animate-fade-in">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black tracking-[0.22em] text-indigo-500 uppercase mb-2 inline-flex items-center gap-1.5">
                <Sparkles size={11} className="text-indigo-500" />
                PARAMETRIZADOR · {producto}
              </p>
              <h1 className="font-display text-3xl sm:text-[2.5rem] font-black text-slate-900 tracking-tight leading-tight">
                Módulo Formulario
              </h1>
              <p className="text-slate-500 text-sm mt-2 max-w-xl leading-relaxed">
                Personaliza y reordena los campos de entrada de datos, secciones dinámicas y el mapeador a la API.
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center shadow-lg shadow-indigo-500/20">
              <Settings2 size={24} className="text-white" />
            </div>
          </div>
        </header>

        <section className="bg-white/80 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl overflow-hidden animate-fade-in">
          <div className="p-6 sm:p-8 lg:p-10">
            {/* Tabs */}
            <div className="flex flex-col sm:flex-row gap-2 mb-8 bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/50 backdrop-blur-sm">
              {([['campos', 'Campos', LayoutList], ['secciones', 'Secciones', Layers], ['mapeador', 'Mapeador API', ArrowLeftRight]] as const).map(([t, label, Icon]) => (
                <button
                  key={t}
                  onClick={() => setTab(t as Tab)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                  <Icon size={15} />{label}
                </button>
              ))}
            </div>

            {loadState === 'loading' && (
              <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
                <Loader2 size={20} className="animate-spin" /><span className="text-sm">Cargando configuración...</span>
              </div>
            )}

            {loadState === 'error' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-3 mb-4">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-amber-700 text-sm font-medium">No se pudo cargar la configuración. Se usan los valores por defecto.</p>
              </div>
            )}

            {loadState !== 'loading' && (
              <>
                {/* ── TAB CAMPOS ── */}
                {tab === 'campos' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 mb-6">
                      {producto === 'rcv' && (
                        <label className="flex items-start gap-3 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-colors">
                          <input type="checkbox" checked={autocompletarConductor} onChange={e => { setAutocompletarConductor(e.target.checked); setSaved(false); }} className="rounded w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5" />
                          <div>
                            <span className="text-sm text-slate-800 font-bold block mb-1">Omitir Conductor (Autocompletar)</span>
                            <span className="text-xs text-slate-500">Ofrecer un checkbox en el formulario para autocompletar los datos del conductor si es el mismo que el tomador.</span>
                          </div>
                        </label>
                      )}
                      {producto === 'funerario' && (
                        <label className="flex items-start gap-3 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-colors">
                          <input type="checkbox" checked={validacionParentesco} onChange={e => { setValidacionParentesco(e.target.checked); setSaved(false); }} className="rounded w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5" />
                          <div>
                            <span className="text-sm text-slate-800 font-bold block mb-1">Validación de Parentesco</span>
                            <span className="text-xs text-slate-500">Exigir obligatoriamente declarar la relación o parentesco para cada beneficiario agregado.</span>
                          </div>
                        </label>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Campos del formulario</p>
                      <button onClick={() => setAddingCampo(v => !v)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600/10 text-indigo-700 text-xs font-bold hover:bg-indigo-600/20 transition-colors">
                        {addingCampo ? <ChevronUp size={14} /> : <Plus size={14} />}{addingCampo ? 'Cancelar' : 'Agregar campo'}
                      </button>
                    </div>

                    {addingCampo && (
                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 space-y-4 mb-4 animate-fade-in shadow-inner">
                        <p className="text-xs font-black text-indigo-800 uppercase tracking-wider">Nuevo campo</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Clave *</label>
                            <input className="w-full text-sm border border-indigo-100 rounded-xl px-3 py-2 font-mono outline-none focus:border-indigo-400 bg-white" placeholder="ej: profesion" value={newCampo.key} onChange={e => setNewCampo(p => ({ ...p, key: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Etiqueta visible *</label>
                            <input className="w-full text-sm border border-indigo-100 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 bg-white" placeholder="ej: Profesión" value={newCampo.label} onChange={e => setNewCampo(p => ({ ...p, label: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Tipo de entrada</label>
                            <select className="w-full text-sm border border-indigo-100 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 bg-white" value={newCampo.tipo} onChange={e => setNewCampo(p => ({ ...p, tipo: e.target.value }))}>
                              {TIPOS_CAMPO.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={newCampo.obligatorio} onChange={e => setNewCampo(p => ({ ...p, obligatorio: e.target.checked }))} className="rounded w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                            <span className="text-sm text-slate-700 font-medium">Es un campo obligatorio</span>
                          </label>
                          <button onClick={addCampo} className="w-full sm:w-auto px-6 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all">✓ Guardar campo</button>
                        </div>
                      </div>
                    )}

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCampos}>
                      <SortableContext items={campos.map(c => c.key)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">
                          {campos.map(campo => (
                            <SortableRow key={campo.key} id={campo.key} active={campo.activo}>
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 hidden md:flex">
                                <LayoutList size={18} className={campo.activo ? 'text-indigo-500' : 'text-slate-400'} />
                              </div>
                              <div className="flex-1 min-w-0 pr-8 md:pr-0">
                                <input
                                  className="font-bold text-slate-800 text-base bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none w-full pb-0.5"
                                  value={campo.label}
                                  onChange={e => updateCampo(campo.key, 'label', e.target.value)}
                                />
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-slate-400 font-mono truncate">{campo.key}</span>
                                  <span className="text-slate-300">•</span>
                                  <select
                                    className="text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md px-1.5 py-0.5 border-none outline-none cursor-pointer transition-colors"
                                    value={campo.tipo}
                                    onChange={e => updateCampo(campo.key, 'tipo', e.target.value)}
                                  >
                                    {TIPOS_CAMPO.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-full md:w-auto overflow-x-auto justify-between md:justify-end mt-2 md:mt-0">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Activo</span>
                                  <Toggle on={campo.activo} onChange={v => updateCampo(campo.key, 'activo', v)} />
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Oblig.</span>
                                  <Toggle on={campo.obligatorio} onChange={v => updateCampo(campo.key, 'obligatorio', v)} disabled={!campo.activo} />
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <button onClick={() => removeCampo(campo.key)} className="p-2 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </SortableRow>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}

                {/* ── TAB SECCIONES ── */}
                {tab === 'secciones' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Secciones del flujo</p>
                      <button onClick={() => setAddingSeccion(v => !v)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600/10 text-indigo-700 text-xs font-bold hover:bg-indigo-600/20 transition-colors">
                        {addingSeccion ? <ChevronUp size={14} /> : <Plus size={14} />}{addingSeccion ? 'Cancelar' : 'Agregar sección'}
                      </button>
                    </div>

                    {addingSeccion && (
                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 space-y-4 mb-4 animate-fade-in shadow-inner">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Clave *</label>
                            <input className="w-full text-sm border border-indigo-100 rounded-xl px-3 py-2 font-mono outline-none focus:border-indigo-400 bg-white" placeholder="ej: referencias" value={newSeccion.key} onChange={e => setNewSeccion(p => ({ ...p, key: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Etiqueta visible *</label>
                            <input className="w-full text-sm border border-indigo-100 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 bg-white" placeholder="ej: Referencias personales" value={newSeccion.label} onChange={e => setNewSeccion(p => ({ ...p, label: e.target.value }))} />
                          </div>
                        </div>
                        <button onClick={addSeccion} className="w-full py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">✓ Crear sección</button>
                      </div>
                    )}

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndSecciones}>
                      <SortableContext items={secciones.map(s => s.key)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">
                          {secciones.map(sec => (
                            <SortableRow key={sec.key} id={sec.key} active={sec.activo}>
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 hidden md:flex">
                                <Layers size={18} className={sec.activo ? 'text-indigo-500' : 'text-slate-400'} />
                              </div>
                              <div className="flex-1 min-w-0 pr-8 md:pr-0">
                                <input
                                  className="font-bold text-slate-800 text-base bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none w-full pb-0.5"
                                  value={sec.label}
                                  onChange={e => updateSeccion(sec.key, 'label', e.target.value)}
                                />
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-slate-400 font-mono truncate">{sec.key}</span>
                                  {sec.maxPersonas !== undefined && (
                                    <>
                                      <span className="text-slate-300">•</span>
                                      <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Máx. registros:</label>
                                        <input
                                          type="number" min={1} max={20}
                                          className="w-14 text-xs font-semibold border border-slate-200 bg-slate-50 rounded-lg px-2 py-1 outline-none focus:border-indigo-400"
                                          value={sec.maxPersonas}
                                          onChange={e => updateSeccion(sec.key, 'maxPersonas', Number(e.target.value))}
                                        />
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-full md:w-auto justify-between md:justify-end mt-2 md:mt-0">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Activo</span>
                                  <Toggle on={sec.activo} onChange={v => updateSeccion(sec.key, 'activo', v)} />
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <button onClick={() => removeSeccion(sec.key)} className="p-2 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </SortableRow>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}

                {/* ── TAB MAPEADOR ── */}
                {tab === 'mapeador' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Mapeador de campos API</p>
                        <p className="text-xs text-slate-400 mt-1">Traduce los campos del formulario al formato de la API destino.</p>
                      </div>
                      <button onClick={addMapEntry} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600/10 text-indigo-700 text-xs font-bold hover:bg-indigo-600/20 transition-colors">
                        <Plus size={14} /> Nueva regla
                      </button>
                    </div>

                    {apiMap.length === 0 && (
                      <div className="text-center py-12 text-slate-400 text-sm rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
                        No hay mapeos. Los campos se enviarán con el nombre interno.<br/><span className="text-xs">Agrega reglas para transformar datos antes de enviarlos.</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      {apiMap.map((entry, idx) => (
                        <div key={idx} className="rounded-2xl border border-indigo-100 bg-white/50 backdrop-blur-sm p-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-5 items-end shadow-sm hover:shadow-md hover:bg-white transition-all group">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Campo origen (Formulario)</label>
                            <select className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-mono outline-none focus:border-indigo-400" value={entry.internalKey} onChange={e => updateMapEntry(idx, 'internalKey', e.target.value)}>
                              <option value="">— Seleccionar campo —</option>
                              {allCampoKeys.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Campo destino (API)</label>
                            <input className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 font-mono outline-none focus:border-indigo-400" placeholder="ej: xnombre" value={entry.externalKey} onChange={e => updateMapEntry(idx, 'externalKey', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Transformación</label>
                            <select className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-indigo-400" value={entry.transform ?? 'none'} onChange={e => updateMapEntry(idx, 'transform', e.target.value)}>
                              <option value="none">Ninguna</option>
                              <option value="date_ddmmyyyy">Fecha DD/MM/YYYY</option>
                              <option value="date_yyyymmdd">Fecha YYYY-MM-DD</option>
                              <option value="strip_prefix">Quitar prefijos (V-)</option>
                              <option value="uppercase">MAYÚSCULAS</option>
                              <option value="lowercase">minúsculas</option>
                            </select>
                          </div>
                          <button onClick={() => removeMapEntry(idx)} className="p-2.5 rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          {loadState !== 'loading' && (
            <div className="px-6 sm:px-8 lg:px-10 py-5 bg-slate-50/80 border-t border-slate-100 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              {saveError && (
                <div className="w-full sm:w-auto flex items-center gap-2 text-xs text-rose-600 bg-rose-50 px-4 py-2 rounded-xl">
                  <AlertTriangle size={14} />{saveError}
                </div>
              )}
              <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
                <button onClick={() => { if (confirm('¿Restaurar configuración original?')) resetConfig(); }} disabled={saving} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-50 shadow-sm">
                  <RotateCcw size={15} /> Restaurar defaults
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-8 rounded-xl font-bold text-sm bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all disabled:opacity-50">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : saved ? <><CheckCircle2 size={16} /> ¡Guardado!</> : <><Save size={16} /> Guardar cambios</>}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
