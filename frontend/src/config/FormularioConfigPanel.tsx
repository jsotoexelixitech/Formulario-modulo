import { useState, useEffect, useCallback } from 'react';
import { useProductConfig } from '../hooks/useProductConfig';
import { getProductId } from '../lib/product';
import {
  Settings2, RotateCcw, Save, CheckCircle2, AlertTriangle,
  Loader2, ShieldCheck, Plus, Trash2, ArrowLeftRight,
  LayoutList, Layers, ChevronUp,
} from 'lucide-react';

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

  useEffect(() => {
    if (!config) return;
    // Normalizar campos: admite array o objeto legacy
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
  }, [config]);

  // ── campos handlers ─────────────────────────────────────────────
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

  // ── secciones handlers ──────────────────────────────────────────
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

  // ── api map handlers ───────────────────────────────────────────
  const addMapEntry = () => { setApiMap(p => [...p, { internalKey: '', externalKey: '', transform: 'none' }]); setSaved(false); };
  const updateMapEntry = (idx: number, field: keyof ApiMapEntry, val: string) => {
    setApiMap(p => p.map((e, i) => i === idx ? { ...e, [field]: val } : e));
    setSaved(false);
  };
  const removeMapEntry = (idx: number) => { setApiMap(p => p.filter((_, i) => i !== idx)); setSaved(false); };

  // ── save ───────────────────────────────────────────────────────
  async function handleSave() {
    await saveConfig({ campos, secciones, apiMap });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const allCampoKeys = [...new Set([...campos.map(c => c.key), ...secciones.map(s => s.key)])];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 p-6 lg:p-10">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 grid place-items-center shadow-lg">
              <Settings2 size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[0.65rem] font-black tracking-widest text-violet-600 uppercase">Parametrizador</p>
              <h1 className="font-bold text-slate-900 text-xl leading-tight">Módulo Formulario</h1>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold capitalize border border-violet-200">{producto}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
          {([['campos', 'Campos', LayoutList], ['secciones', 'Secciones', Layers], ['mapeador', 'Mapeador API', ArrowLeftRight]] as const).map(([t, label, Icon]) => (
            <button
              key={t}
              onClick={() => setTab(t as Tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-white shadow text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {loadState === 'loading' && (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
            <Loader2 size={20} className="animate-spin" /><span className="text-sm">Cargando...</span>
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
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Campos del formulario</p>
                  <button onClick={() => setAddingCampo(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors">
                    {addingCampo ? <ChevronUp size={13} /> : <Plus size={13} />}{addingCampo ? 'Cancelar' : 'Agregar campo'}
                  </button>
                </div>

                {addingCampo && (
                  <div className="rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/60 p-4 space-y-2 mb-3">
                    <p className="text-xs font-bold text-violet-700">Nuevo campo</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">Clave *</label>
                        <input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 font-mono outline-none focus:border-violet-400" placeholder="ej: profesion" value={newCampo.key} onChange={e => setNewCampo(p => ({ ...p, key: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">Etiqueta *</label>
                        <input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400" placeholder="ej: Profesión" value={newCampo.label} onChange={e => setNewCampo(p => ({ ...p, label: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">Tipo</label>
                        <select className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400 bg-white" value={newCampo.tipo} onChange={e => setNewCampo(p => ({ ...p, tipo: e.target.value }))}>
                          {TIPOS_CAMPO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={newCampo.obligatorio} onChange={e => setNewCampo(p => ({ ...p, obligatorio: e.target.checked }))} className="rounded" />
                      <span className="text-xs text-slate-600 font-medium">Obligatorio</span>
                    </label>
                    <button onClick={addCampo} className="w-full py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors">✓ Agregar</button>
                  </div>
                )}

                {campos.map(campo => (
                  <div key={campo.key} className={`rounded-xl border p-3 flex items-center gap-3 transition-all ${campo.activo ? 'border-violet-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <input
                        className="font-semibold text-slate-900 text-sm bg-transparent border-b border-transparent hover:border-slate-200 focus:border-violet-400 outline-none w-full"
                        value={campo.label}
                        onChange={e => updateCampo(campo.key, 'label', e.target.value)}
                      />
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">{campo.key}</span>
                        <select
                          className="text-[10px] text-slate-500 bg-transparent border-none outline-none cursor-pointer"
                          value={campo.tipo}
                          onChange={e => updateCampo(campo.key, 'tipo', e.target.value)}
                        >
                          {TIPOS_CAMPO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-500">
                        <Toggle on={campo.activo} onChange={v => updateCampo(campo.key, 'activo', v)} />
                        Activo
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-500">
                        <Toggle on={campo.obligatorio} onChange={v => updateCampo(campo.key, 'obligatorio', v)} disabled={!campo.activo} />
                        <ShieldCheck size={10} className={campo.obligatorio ? 'text-emerald-500' : ''} />
                      </label>
                      <button onClick={() => removeCampo(campo.key)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── TAB SECCIONES ── */}
            {tab === 'secciones' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Secciones del flujo</p>
                  <button onClick={() => setAddingSeccion(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors">
                    {addingSeccion ? <ChevronUp size={13} /> : <Plus size={13} />}{addingSeccion ? 'Cancelar' : 'Agregar sección'}
                  </button>
                </div>

                {addingSeccion && (
                  <div className="rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/60 p-4 space-y-2 mb-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">Clave *</label>
                        <input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 font-mono outline-none focus:border-violet-400" placeholder="ej: referencias" value={newSeccion.key} onChange={e => setNewSeccion(p => ({ ...p, key: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">Etiqueta *</label>
                        <input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-violet-400" placeholder="ej: Referencias personales" value={newSeccion.label} onChange={e => setNewSeccion(p => ({ ...p, label: e.target.value }))} />
                      </div>
                    </div>
                    <button onClick={addSeccion} className="w-full py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors">✓ Agregar</button>
                  </div>
                )}

                {secciones.map(sec => (
                  <div key={sec.key} className={`rounded-xl border p-3 flex items-center gap-3 transition-all ${sec.activo ? 'border-violet-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <input
                        className="font-semibold text-slate-900 text-sm bg-transparent border-b border-transparent hover:border-slate-200 focus:border-violet-400 outline-none w-full"
                        value={sec.label}
                        onChange={e => updateSeccion(sec.key, 'label', e.target.value)}
                      />
                      <span className="text-[10px] text-slate-400 font-mono">{sec.key}</span>
                      {sec.maxPersonas !== undefined && (
                        <div className="mt-1 flex items-center gap-2">
                          <label className="text-[10px] text-slate-500">Máx. personas:</label>
                          <input
                            type="number" min={1} max={20}
                            className="w-12 text-xs border border-slate-200 rounded px-1 py-0.5 outline-none"
                            value={sec.maxPersonas}
                            onChange={e => updateSeccion(sec.key, 'maxPersonas', Number(e.target.value))}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-500">
                        <Toggle on={sec.activo} onChange={v => updateSeccion(sec.key, 'activo', v)} />
                        Activo
                      </label>
                      <button onClick={() => removeSeccion(sec.key)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── TAB MAPEADOR ── */}
            {tab === 'mapeador' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mapeador de campos API</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Traduce los campos del formulario al formato de la API destino.</p>
                  </div>
                  <button onClick={addMapEntry} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors">
                    <Plus size={13} /> Agregar
                  </button>
                </div>

                {apiMap.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-sm rounded-xl border-2 border-dashed border-slate-200">
                    Sin mapeos. Los campos se enviarán con el nombre interno.
                  </div>
                )}

                {apiMap.map((entry, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end shadow-sm">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Campo interno</label>
                      <select className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white font-mono outline-none focus:border-violet-400" value={entry.internalKey} onChange={e => updateMapEntry(idx, 'internalKey', e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {allCampoKeys.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Campo destino</label>
                      <input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 font-mono outline-none focus:border-violet-400" placeholder="ej: xnombre" value={entry.externalKey} onChange={e => updateMapEntry(idx, 'externalKey', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Transform.</label>
                      <select className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none" value={entry.transform ?? 'none'} onChange={e => updateMapEntry(idx, 'transform', e.target.value)}>
                        <option value="none">Ninguna</option>
                        <option value="date_ddmmyyyy">DD/MM/YYYY</option>
                        <option value="date_yyyymmdd">YYYY-MM-DD</option>
                        <option value="strip_prefix">Quitar +58</option>
                        <option value="uppercase">MAYÚSCULAS</option>
                        <option value="lowercase">minúsculas</option>
                      </select>
                    </div>
                    <button onClick={() => removeMapEntry(idx)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors self-end">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {saveError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-center gap-2 text-xs text-rose-700 mt-4">
                <AlertTriangle size={14} />{saveError}
              </div>
            )}
            <div className="flex gap-3 pt-5 mt-5 border-t border-slate-100">
              <button onClick={() => { if (confirm('¿Restaurar valores por defecto?')) resetConfig(); }} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-slate-300 transition-colors disabled:opacity-50">
                <RotateCcw size={14} /> Defaults
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : saved ? <><CheckCircle2 size={15} /> ¡Guardado!</> : <><Save size={15} /> Guardar configuración</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
