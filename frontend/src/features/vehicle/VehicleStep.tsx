import { useState, useEffect, useCallback, useRef } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { Field, Input, Select, Textarea } from '../../components/ui/FormField';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { SectionCard } from '../emission/EmissionStep';
import { useCatalogs, useCiudades } from '../../hooks/useCatalogs';
import { PersonLocationFields } from '../../components/PersonLocationFields';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { IdentityInput } from '../../components/ui/IdentityInput';
import { formatTelefono, isValidPhonePrefix } from '../../lib/phone';
import { resolveOcrModelo } from '../../lib/vehicle-carnet-labels';
import { PERSON_FIELD_LIMITS, clipPersonField } from '../../lib/field-limits';
import {
  Car, UserCog, Sparkles, ScanLine, ShieldCheck,
  Loader2, AlertTriangle,
} from 'lucide-react';
import { toast } from '../../store/toastStore';
import { catalogoApi, searchProprietary, validatePlaca, validateSerial, type InmaMarca, type InmaModelo, type InmaVersion, type CategoriaUso, type RecargoRcvItem } from '../../lib/api';
import {
  buildProprietaryCid,
  mapProprietaryToPerson,
  type ProprietaryInfo,
} from '../../lib/map-proprietary';
import { isExelixiCatalogFlow } from '../../lib/exelixi-catalog';
import { isCotizadorFlow } from '../../lib/cotizador-flow';
import { isRcvLaMundialFlow } from '../../lib/product';
import { TipoPlacaSelector } from '../../components/TipoPlacaSelector';
import { placaMaxLength, placaPlaceholder, validatePlacaMessage } from '../../lib/placa-tipo';
import { isQaDeploy } from '../../lib/deploy-env';
import { findBestInmaMarca } from '../../lib/inma-marca-match';
import {
  isCategoriaToneladas,
  normalizeToneladasForCategoria,
} from '../../lib/rcv-cargo-toneladas';
import {
  normalizeVehicleSerial,
  validateVehicleSerialMessage,
  VEHICLE_SERIAL_MAX_LEN,
} from '../../lib/vehicle-serial';
import {
  SECONDARY_IDENTIFICACION_MAX_LENGTH,
  validateSecondaryPersonIdentificacion,
} from '../../lib/person-identificacion';
import type { VehicleData } from '../../types';

const COLOR_SWATCHES: Record<string, string> = {
  blanco: '#F8FAFC', negro: '#0F172A', gris: '#94A3B8', plateado: '#CBD5E1',
  rojo: '#EF4444', azul: '#3B82F6', verde: '#10B981', amarillo: '#F59E0B',
  marrón: '#92400E', beige: '#F5DEB3',
};

function getColorSwatch(name: string): string {
  if (!name) return '#E2E8F0';
  return COLOR_SWATCHES[name.toLowerCase().trim()] ?? '#94A3B8';
}

function normText(s: string) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function findBestMatch<T>(
  list: T[], text: string, key: keyof T
): T | undefined {
  if (!text || !list.length) return undefined;
  const n = normText(text);
  const val = (i: T) => normText(String(i[key] ?? ''));

  const exact = list.find((i) => val(i) === n);
  if (exact) return exact;

  const isShortPrefix = /^[A-Z]{1,4}$/.test(n) && !/\d/.test(n);
  if (isShortPrefix) {
    const byPrefix = list.filter((i) => val(i).startsWith(n));
    if (byPrefix.length) {
      return byPrefix.reduce((best, cur) =>
        val(cur).length > val(best).length ? cur : best,
      );
    }
  }

  const partial = list.filter((i) => {
    const v = val(i);
    if (!v) return false;
    if (v.startsWith(n) || n.startsWith(v)) return true;
    return n.includes(v) || v.includes(n);
  });
  if (!partial.length) return undefined;

  return partial.reduce((best, cur) => (val(cur).length > val(best).length ? cur : best));
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface VehicleErrors {
  placa?: string;
  año?: string;
  marca?: string;
  modelo?: string;
  uso?: string;
  color?: string;
  serial?: string;
  cond_nombre?: string;
  cond_apellido?: string;
  cond_licencia?: string;
  cond_identificacion?: string;
  cond_telefono?: string;
  cond_email?: string;
  cond_sexo?: string;
  cond_estadoCivil?: string;
  cond_estado?: string;
  cond_ciudad?: string;
  cond_direccion?: string;
  toneladas?: string;
  recargoRcv?: string;
}

// ── Hook catálogo INMA ────────────────────────────────────────────────────────
function useInmaCatalog(binacional: boolean) {
  const [marcas,    setMarcas]    = useState<InmaMarca[]>([]);
  const [modelos,   setModelos]   = useState<InmaModelo[]>([]);
  const [versiones, setVersiones] = useState<InmaVersion[]>([]);
  const [categoriasUso, setCategoriasUso] = useState<CategoriaUso[]>([]);
  const [loadM,  setLoadM]  = useState(false);
  const [loadMo, setLoadMo] = useState(false);
  const [loadV,  setLoadV]  = useState(false);
  const [loadCu, setLoadCu] = useState(false);

  const loadMarcas = useCallback(async (y: number) => {
    if (!y || y < 1990) return;
    setLoadM(true); setMarcas([]); setModelos([]); setVersiones([]); setCategoriasUso([]);
    try { setMarcas((await catalogoApi.marcas(y, binacional)).data.data ?? []); } catch { /* silencioso */ }
    finally { setLoadM(false); }
  }, [binacional]);

  const loadModelos = useCallback(async (y: number, cmarca: string) => {
    if (!y || !cmarca) return;
    setLoadMo(true); setModelos([]); setVersiones([]); setCategoriasUso([]);
    try { setModelos((await catalogoApi.modelos(y, cmarca, binacional)).data.data ?? []); } catch { }
    finally { setLoadMo(false); }
  }, [binacional]);

  const loadVersiones = useCallback(async (y: number, cmarca: string, cmodelo: string) => {
    if (!y || !cmarca || !cmodelo) return;
    setLoadV(true); setVersiones([]); setCategoriasUso([]);
    try { setVersiones((await catalogoApi.versiones(y, cmarca, cmodelo, binacional)).data.data ?? []); } catch { }
    finally { setLoadV(false); }
  }, [binacional]);

  const loadCategoriasUso = useCallback(async (y: number, cmarca: string, cmodelo: string, cversion: string) => {
    if (!y || !cmarca || !cmodelo || !cversion) return;
    setLoadCu(true); setCategoriasUso([]);
    try { setCategoriasUso((await catalogoApi.categoriasUso(y, cmarca, cmodelo, cversion, binacional)).data.data ?? []); }
    catch { /* fallback: el formulario muestra opciones genéricas si la lista queda vacía */ }
    finally { setLoadCu(false); }
  }, [binacional]);

  const resetModelos  = useCallback(() => { setModelos([]); setVersiones([]); setCategoriasUso([]); }, []);
  const resetVersiones = useCallback(() => { setVersiones([]); setCategoriasUso([]); }, []);
  const resetCategoriasUso = useCallback(() => setCategoriasUso([]), []);

  return {
    marcas, modelos, versiones, categoriasUso,
    loadM, loadMo, loadV, loadCu,
    loadMarcas, loadModelos, loadVersiones, loadCategoriasUso,
    resetModelos, resetVersiones, resetCategoriasUso,
  };
}

// ── Componente principal ──────────────────────────────────────────────────────
export function VehicleStep() {
  const {
    vehicle, setVehicle,
    hasDriver, setHasDriver,
    conductor, setConductor,
    documents,
    selectedPlan,
  } = useWizardStore();

  const [errors, setErrors] = useState<VehicleErrors>({});
  const [verified, setVerified] = useState(false);
  const [placaValidating, setPlacaValidating] = useState(false);
  const [serialValidating, setSerialValidating] = useState(false);
  const [conductorLookupLoading, setConductorLookupLoading] = useState(false);
  const [recargosRcv, setRecargosRcv] = useState<RecargoRcvItem[]>([]);
  const [recargosLoad, setRecargosLoad] = useState(false);
  const recargosInitDone = useRef(false);
  const lastValidatedPlaca = useRef('');
  const lastValidatedSerial = useRef('');
  const lastConductorLookupCid = useRef('');
  const catalogs = useCatalogs();
  const exelixiFlow = isExelixiCatalogFlow();
  const cotizadorRcv = isCotizadorFlow();
  const rcvLaMundial = isRcvLaMundialFlow();
  const isRcvEmision = rcvLaMundial && !cotizadorRcv;
  const conductorCiudades = useCiudades(conductor.cestado);
  const isBinacional = rcvLaMundial && vehicle.tipoPlaca === 'binacional';
  const showToneladas = rcvLaMundial && isCategoriaToneladas(vehicle.ccategoria_uso);

  useEffect(() => {
    if (!rcvLaMundial) return;
    let cancelled = false;
    setRecargosLoad(true);
    catalogoApi.recargosRcv()
      .then((res) => {
        if (cancelled) return;
        const list = res.data.data ?? [];
        setRecargosRcv(list);
        if (!recargosInitDone.current && list.length > 0) {
          recargosInitDone.current = true;
          if (!vehicle.csustanc_rcv) {
            const targetPct = vehicle.precargorcv ?? 0;
            const match =
              list.find((r) => Number(r.porcenta) === Number(targetPct))
              ?? list.find((r) => Number(r.porcenta) === 0)
              ?? list[0];
            setVehicle({
              precargorcv: Number(match.porcenta),
              csustanc_rcv: match.csustanc,
              xsustanc_rcv: match.xsustanc,
            });
          }
        }
      })
      .catch(() => {
        if (!cancelled) setRecargosRcv([]);
      })
      .finally(() => {
        if (!cancelled) setRecargosLoad(false);
      });
    return () => { cancelled = true; };
  }, [rcvLaMundial, setVehicle]);

  const setTipoPlaca = useCallback((tipoPlaca: VehicleData['tipoPlaca']) => {
    if (tipoPlaca === 'binacional' && !rcvLaMundial) return;
    const nextBi = tipoPlaca === 'binacional';
    const prevBi = vehicle.tipoPlaca === 'binacional';
    if (nextBi === prevBi && vehicle.tipoPlaca === tipoPlaca) return;
    // Al cruzar nacional/extranjera ↔ binacional el catálogo cambia (ctarifabi).
    if (nextBi !== prevBi) {
      setVehicle({
        tipoPlaca,
        cmarca: '',
        marca: '',
        cmodelo: '',
        modelo: '',
        cversion: '',
        ccategoria_uso: undefined,
        xcategoria_uso: '',
        ccategotr: undefined,
      });
      return;
    }
    setVehicle({ tipoPlaca });
  }, [rcvLaMundial, vehicle.tipoPlaca, setVehicle]);

  useEffect(() => {
    if (rcvLaMundial || vehicle.tipoPlaca !== 'binacional') return;
    setVehicle({
      tipoPlaca: 'nacional',
      cmarca: '',
      marca: '',
      cmodelo: '',
      modelo: '',
      cversion: '',
      ccategoria_uso: undefined,
      xcategoria_uso: '',
      ccategotr: undefined,
      cilindrada: '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rcvLaMundial]);

  // Rango de años del catálogo INMA
  const [anios, setAnios] = useState<number[]>([]);

  // Refs para controlar el auto-select por OCR (no sobrescribir selección manual)
  const autoSelectedMarca  = useRef(false);
  const autoSelectedModelo = useRef(false);

  const {
    marcas, modelos, versiones, categoriasUso,
    loadM, loadMo, loadV, loadCu,
    loadMarcas, loadModelos, loadVersiones, loadCategoriasUso,
    resetModelos, resetVersiones,
  } = useInmaCatalog(isBinacional);

  const ocrCert     = documents.certificado.ocr;
  const hasOcr      = !!(ocrCert?.marca || ocrCert?.modelo || ocrCert?.placa);
  const hasOcrCodes = !!(vehicle.cmarca && vehicle.cmodelo);
  /** QA: placa/serial editables para pruebas; solo INMA base fijo si OCR matcheó códigos. */
  const qaOcrLock = isQaDeploy() && hasOcr;
  const qaIdentLock = qaOcrLock && !isQaDeploy();
  const inmaBasicsLocked = qaOcrLock ? hasOcrCodes : verified;
  /** Versión y uso no vienen del OCR — en QA deben seguir editables (commit 33a41cb bloqueaba todo). */
  const versionLocked = !isQaDeploy() && verified;

  // ── Cargar rango de años (nacional vs binacional) ─────────────────────────
  useEffect(() => {
    catalogoApi.anios(isBinacional)
      .then(r => {
        const { min = 2000, max = new Date().getFullYear() + 1 } = r.data as { min?: number; max?: number };
        const y: number[] = [];
        for (let yr = max; yr >= min; yr--) y.push(yr);
        setAnios(y);
        // Si el OCR trajo año pero no está seteado, usarlo
        if (!vehicle.año && ocrCert?.año) {
          setVehicle({ año: String(ocrCert.año) });
        }
      })
      .catch(() => {
        const y: number[] = [];
        for (let yr = new Date().getFullYear() + 1; yr >= 1990; yr--) y.push(yr);
        setAnios(y);
      });
  // Recargar al cambiar nacional ↔ binacional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBinacional]);

  // ── Cuando cambia el año o el modo binacional: cargar marcas ──────────────
  useEffect(() => {
    const y = parseInt(vehicle.año, 10);
    if (!y || y < 1990) return;
    autoSelectedMarca.current  = false;
    autoSelectedModelo.current = false;
    resetModelos();
    loadMarcas(y);
  }, [vehicle.año, isBinacional, loadMarcas, resetModelos]);

  // ── Cuando cargan las marcas: auto-seleccionar OCR marca ─────────────────
  useEffect(() => {
    if (!marcas.length) return;
    if (autoSelectedMarca.current) return;
    if (vehicle.cmarca) return; // usuario ya eligió
    if (!ocrCert?.marca) return;

    const serialHint = ocrCert.serial || vehicle.serial;
    const match = findBestInmaMarca(marcas, ocrCert.marca, serialHint);
    if (match) {
      autoSelectedMarca.current = true;
      setVehicle({ cmarca: match.cmarca, marca: match.xmarca, cmodelo: '', modelo: '', cversion: '', ccategoria_uso: undefined, xcategoria_uso: '' });
    } else if (isRcvEmision) {
      autoSelectedMarca.current = true;
      const y = parseInt(vehicle.año, 10) || parseInt(String(ocrCert.año ?? ''), 10);
      const ocrMarca = ocrCert.marca ?? '';

      const warnMarca = (title: string, message: string) => {
        toast.warning(title, message, isBinacional ? 8000 : 7000);
      };

      if (isBinacional && y >= 1990 && ocrMarca) {
        void catalogoApi.marcaDisponibilidad(y, ocrMarca, serialHint)
          .then(({ data }) => {
            if (data.inBinacionalCatalog) return;
            if (data.inGeneralCatalog) {
              warnMarca(
                'Marca sin tarifa binacional',
                `"${ocrMarca}" está en catálogo La Mundial pero no habilitada para plan binacional (${y}). Selecciona otra marca del listado o solicita el alta a La Mundial.`,
              );
              return;
            }
            warnMarca(
              'Marca no encontrada',
              `No encontramos "${ocrMarca}" en el catálogo INMA. Selecciona la marca manualmente en el listado.`,
            );
          })
          .catch(() => {
            warnMarca(
              'Marca no encontrada',
              `No encontramos "${ocrMarca}" en el catálogo binacional. Selecciona la marca manualmente.`,
            );
          });
      } else {
        warnMarca(
          'Marca no encontrada',
          isBinacional
            ? `No encontramos "${ocrMarca}" en el catálogo binacional. Selecciona la marca manualmente.`
            : `No encontramos "${ocrMarca}" en el catálogo. Comunícate con soporte para continuar.`,
        );
      }
    }
  // Solo cuando marcas cambia
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcas]);

  // ── Cuando cambia cmarca: cargar modelos ─────────────────────────────────
  useEffect(() => {
    const y = parseInt(vehicle.año, 10);
    if (!vehicle.cmarca || !y) return;
    autoSelectedModelo.current = false;
    resetVersiones();
    loadModelos(y, vehicle.cmarca);
  }, [vehicle.cmarca, vehicle.año, loadModelos, resetVersiones]);

  // ── Cuando cargan los modelos: auto-seleccionar OCR modelo ───────────────
  useEffect(() => {
    if (!modelos.length) return;
    if (autoSelectedModelo.current) return;
    if (vehicle.cmodelo) return;
    const ocrModelText = resolveOcrModelo(ocrCert);
    if (!ocrModelText) return;

    const match = findBestMatch(modelos, ocrModelText, 'xmodelo' as keyof InmaModelo);
    if (match) {
      autoSelectedModelo.current = true;
      setVehicle({ cmodelo: match.cmodelo, modelo: match.xmodelo, cversion: '', ccategoria_uso: undefined, xcategoria_uso: '' });
    } else {
      autoSelectedModelo.current = true;
      if (isRcvEmision && !isBinacional) {
        toast.warning(
          'Modelo no encontrado',
          `No encontramos "${ocrModelText}" en el catálogo. Comunícate con soporte para continuar.`,
          7000,
        );
      } else {
        toast.warning(
          'Modelo no encontrado',
          `No encontramos "${ocrModelText}" en el catálogo. Selecciónalo manualmente.`,
          5000,
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelos]);

  // ── Resolver por texto (marca/modelo) si tenemos valores pero no códigos INMA ──
  useEffect(() => {
    const y = parseInt(vehicle.año, 10);
    if (!y || y < 1990) return;
    if (!vehicle.marca || !vehicle.modelo) return;
    if (vehicle.cmarca && vehicle.cmodelo) return; // ya tenemos códigos

    let cancelled = false;
    catalogoApi.resolver(y, vehicle.marca, vehicle.modelo, isBinacional, vehicle.serial || ocrCert?.serial || '')
      .then(({ data }) => {
        if (cancelled) return;
        if (!data?.success) return;
        const updates: Partial<VehicleData> = {};
        if (data.cmarca) {
          updates.cmarca = data.cmarca;
          updates.marca = data.xmarca ?? vehicle.marca;
        }
        if (data.cmodelo) {
          updates.cmodelo = data.cmodelo;
          updates.modelo = data.xmodelo ?? vehicle.modelo;
        }
        if (Object.keys(updates).length > 0) {
          // Limpia selección dependiente para forzar carga de modelos/versiones con códigos reales
          setVehicle({
            ...updates,
            cversion: '',
            ccategoria_uso: undefined,
            xcategoria_uso: '',
            uso: vehicle.uso,
          });
        }
      })
      .catch(() => {})
      .finally(() => {});

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.año, vehicle.marca, vehicle.modelo, isBinacional]);

  // ── Cuando cambia cmodelo: cargar versiones ───────────────────────────────
  useEffect(() => {
    const y = parseInt(vehicle.año, 10);
    if (!vehicle.cmarca || !vehicle.cmodelo || !y) return;
    loadVersiones(y, vehicle.cmarca, vehicle.cmodelo);
  }, [vehicle.cmodelo, vehicle.cmarca, vehicle.año, loadVersiones]);

  // ── Cuando cambia cversion: cargar categorías de uso (depende de la versión)
  useEffect(() => {
    const y = parseInt(vehicle.año, 10);
    if (!vehicle.cmarca || !vehicle.cmodelo || !vehicle.cversion || !y) return;
    loadCategoriasUso(y, vehicle.cmarca, vehicle.cmodelo, vehicle.cversion);
  }, [vehicle.cversion, vehicle.cmodelo, vehicle.cmarca, vehicle.año, loadCategoriasUso]);

  /**
   * Match versión.ccategotr → categoría.ccategoria_uso.
   * Preselecciona el uso y deja el campo bloqueado (mismo valor va a planes).
   */
  useEffect(() => {
    if (loadCu || !vehicle.cversion || categoriasUso.length === 0) return;

    const ver = versiones.find((v) => String(v.cversion) === String(vehicle.cversion));
    const target = ver?.ccategotr ?? vehicle.ccategotr;

    if (target == null || target === '') {
      if (categoriasUso.length === 1 && vehicle.ccategoria_uso == null) {
        const c = categoriasUso[0];
        setVehicle({
          ccategoria_uso: c.ccategoria_uso,
          xcategoria_uso: c.xcategoria_uso,
          uso: c.xcategoria_uso,
        });
      }
      return;
    }

    const match = categoriasUso.find(
      (c) => Number(c.ccategoria_uso) === Number(target),
    );
    if (!match) return;
    if (String(vehicle.ccategoria_uso) === String(match.ccategoria_uso)) return;

    setVehicle({
      ccategoria_uso: match.ccategoria_uso,
      xcategoria_uso: match.xcategoria_uso,
      uso: match.xcategoria_uso,
      ccategotr: target,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriasUso, vehicle.cversion, vehicle.ccategotr, versiones, loadCu]);

  const usoLockedByCcategotr = (() => {
    if (!vehicle.cversion || categoriasUso.length === 0) return false;
    const ver = versiones.find((v) => String(v.cversion) === String(vehicle.cversion));
    const target = ver?.ccategotr ?? vehicle.ccategotr;
    if (target == null || target === '') return false;
    return categoriasUso.some((c) => Number(c.ccategoria_uso) === Number(target));
  })();

  // ── Validación remota de placa (fn_validar_placa vía nest-api) ────────────
  const validatePlacaRemote = useCallback(async (rawPlaca: string) => {
    if (!isRcvEmision) return;

    const placa = String(rawPlaca || '').trim().toUpperCase();
    if (placa.length < 6) return;
    if (lastValidatedPlaca.current === placa) return;

    setPlacaValidating(true);
    try {
      const res = await validatePlaca(placa, { type: 'warning' });
      lastValidatedPlaca.current = placa;

      if (res.blocked || res.is_active) {
        const msg =
          res.message ||
          'La placa ya se encuentra registrada y activa en el sistema.';
        setErrors((prev) => ({ ...prev, placa: msg }));
        toast.warning('Placa no disponible', msg, 5000);
        return;
      }

      setErrors((prev) => {
        if (!prev.placa) return prev;
        const { placa: _removed, ...rest } = prev;
        return rest;
      });
      toast.success('Placa disponible', 'No hay póliza vigente que bloquee esta placa.', 2500);
    } catch {
      toast.warning(
        'No se pudo validar la placa',
        'Inténtalo de nuevo o continúa y se validará al guardar.',
        4000,
      );
    } finally {
      setPlacaValidating(false);
    }
  }, [isRcvEmision]);

  // ── Validación remota de serial (fn_validar_serialCar vía nest-api) ───────
  const validateSerialRemote = useCallback(async (rawSerial: string) => {
    if (!isRcvEmision) return;

    const serial = String(rawSerial || '').trim().toUpperCase();
    if (!serial) return;
    if (lastValidatedSerial.current === serial) return;

    setSerialValidating(true);
    try {
      const res = await validateSerial(serial, { type: 'warning' });
      lastValidatedSerial.current = serial;

      if (res.blocked || res.is_active) {
        const msg =
          res.message ||
          'El serial de carrocería ya se encuentra registrado y activo en el sistema.';
        setErrors((prev) => ({ ...prev, serial: msg }));
        toast.warning('Serial no disponible', msg, 5000);
        return;
      }

      setErrors((prev) => {
        if (!prev.serial) return prev;
        const { serial: _removed, ...rest } = prev;
        return rest;
      });
      toast.success('Serial disponible', 'No hay póliza vigente que bloquee este serial.', 2500);
    } catch {
      toast.warning(
        'No se pudo validar el serial',
        'Inténtalo de nuevo o continúa y se validará al guardar.',
        4000,
      );
    } finally {
      setSerialValidating(false);
    }
  }, [isRcvEmision]);

  // ── Autocompletar conductor por cédula (mismo flujo que EmissionStep) ────
  const lookupConductorByCedula = useCallback(
    async (tipoDoc: string, identificacion: string) => {
      const digits = String(identificacion || '').replace(/\D/g, '');
      if (digits.length < 1) return;

      const cid = buildProprietaryCid(tipoDoc || 'V', digits);
      if (lastConductorLookupCid.current === cid) return;

      setConductorLookupLoading(true);
      try {
        const tryCids = [digits, cid].filter((v, i, arr) => v && arr.indexOf(v) === i);

        let row: ProprietaryInfo | undefined;
        let matchedCid = cid;

        for (const candidate of tryCids) {
          const result = await searchProprietary(candidate);
          const found = (result.data ?? result.info) as ProprietaryInfo | undefined;
          if (result.success && found) {
            row = found;
            matchedCid = candidate;
            break;
          }
        }

        if (!row) {
          lastConductorLookupCid.current = cid;
          toast.info(
            'Sin datos en Sis2000',
            'No encontramos ese documento. Complete el formulario manualmente.',
            3500,
          );
          return;
        }

        const patch = mapProprietaryToPerson(row, {
          sexos: catalogs.sexos,
          estadosCivil: catalogs.estadosCivil,
          estados: catalogs.estados,
        });
        if (!patch.identificacion) patch.identificacion = digits;

        setConductor(patch);
        lastConductorLookupCid.current = matchedCid;
        toast.success('Datos cargados', 'Se completó el conductor con la información del cliente.', 2800);
      } catch {
        toast.warning(
          'Consulta no disponible',
          'No se pudo buscar el documento. Complete el formulario manualmente.',
          4000,
        );
      } finally {
        setConductorLookupLoading(false);
      }
    },
    [catalogs.sexos, catalogs.estadosCivil, catalogs.estados, setConductor],
  );

  // ── Validación ────────────────────────────────────────────────────────────
  const validate = async () => {
    const e: VehicleErrors = {};
    const req  = (v?: string) => !(v ?? '').trim();
    const len  = (v?: string) => (v ?? '').trim().length;
    const digs = (v?: string) => (v ?? '').replace(/\D/g, '').length;

    if (cotizadorRcv) {
      if (req(vehicle.año)) e.año = 'Selecciona el año del vehículo';
      if (req(vehicle.cmarca)) e.marca = 'La marca es obligatoria';
      if (req(vehicle.cmodelo)) e.modelo = 'Selecciona el modelo del catálogo';
      else if (req(vehicle.modelo)) e.modelo = 'El modelo es obligatorio';
      if (req(vehicle.cversion)) e.uso = 'Debes seleccionar la versión exacta del vehículo';
      else if (!vehicle.ccategoria_uso && req(vehicle.uso)) e.uso = 'Selecciona el uso del vehículo';
      if (rcvLaMundial && showToneladas && (vehicle.ntoneladas == null || Number.isNaN(Number(vehicle.ntoneladas)))) {
        e.toneladas = 'Indica las toneladas totales (mín. 13 TM)';
      }

      setErrors(e);
      return Object.keys(e).length === 0;
    }

    const placaErr = validatePlacaMessage(vehicle.placa, vehicle.tipoPlaca ?? 'nacional');
    if (placaErr) e.placa = placaErr;

    if (req(vehicle.año)) e.año = 'Selecciona el año del vehículo';
    if (req(vehicle.marca))  e.marca  = 'La marca es obligatoria';
    if (req(vehicle.cmodelo)) e.modelo = 'Selecciona el modelo del catálogo';
    else if (req(vehicle.modelo)) e.modelo = 'El modelo es obligatorio';

    if (req(vehicle.cversion)) e.uso = 'Debes seleccionar la versión exacta del vehículo';
    else if (!vehicle.ccategoria_uso && req(vehicle.uso)) e.uso = 'Selecciona el uso del vehículo';

    if (rcvLaMundial && showToneladas && (vehicle.ntoneladas == null || Number.isNaN(Number(vehicle.ntoneladas)))) {
      e.toneladas = 'Indica las toneladas totales (mín. 13 TM)';
    }

    if (req(vehicle.color)) {
      e.color = 'El color es obligatorio';
    } else if (len(vehicle.color) < 2) {
      e.color = 'El color debe tener al menos 2 caracteres';
    } else if (len(vehicle.color) > 15) {
      e.color = 'El color no puede superar 15 caracteres';
    }

    const serialErr = validateVehicleSerialMessage(vehicle.serial);
    if (serialErr) e.serial = serialErr;

    if (hasDriver && !cotizadorRcv) {
      const nombre   = (conductor.nombre   ?? '').trim();
      const apellido = (conductor.apellido ?? '').trim();
      const licencia = (conductor.licencia ?? '').trim();

      if (!nombre) {
        e.cond_nombre = 'El nombre del conductor es obligatorio';
      } else if (nombre.length < 2) {
        e.cond_nombre = 'El nombre debe tener al menos 2 caracteres';
      } else if (nombre.length > PERSON_FIELD_LIMITS.nombre) {
        e.cond_nombre = `El nombre no puede superar ${PERSON_FIELD_LIMITS.nombre} caracteres`;
      }

      if (!apellido) {
        e.cond_apellido = 'El apellido del conductor es obligatorio';
      } else if (apellido.length < 2) {
        e.cond_apellido = 'El apellido debe tener al menos 2 caracteres';
      } else if (apellido.length > PERSON_FIELD_LIMITS.apellido) {
        e.cond_apellido = `El apellido no puede superar ${PERSON_FIELD_LIMITS.apellido} caracteres`;
      }

      if (!licencia) {
        e.cond_licencia = 'El número de licencia es obligatorio';
      } else if (licencia.length < 5) {
        e.cond_licencia = 'La licencia debe tener al menos 5 caracteres';
      } else if (licencia.length > 20) {
        e.cond_licencia = 'La licencia no puede superar 20 caracteres';
      }
      const condIdErr = validateSecondaryPersonIdentificacion(conductor.identificacion);
      if (condIdErr) e.cond_identificacion = condIdErr;

      if (req(conductor.telefono)) {
        e.cond_telefono = 'El teléfono es obligatorio';
      } else if (digs(conductor.telefono) !== 11) {
        e.cond_telefono = 'El teléfono debe tener exactamente 11 dígitos';
      } else if (!isValidPhonePrefix(conductor.telefono || '')) {
        e.cond_telefono = 'El prefijo no es válido (Digitel 0412/0422 · Movistar 0414/0424 · Movilnet 0416/0426 · fijos 02XX)';
      }

      if (req(conductor.email)) {
        e.cond_email = 'El correo electrónico es obligatorio';
      } else if (!emailRe.test((conductor.email || '').trim())) {
        e.cond_email = 'Ingresa un correo válido';
      } else if ((conductor.email || '').trim().length > PERSON_FIELD_LIMITS.email) {
        e.cond_email = `El correo no puede superar ${PERSON_FIELD_LIMITS.email} caracteres`;
      }

      if (req(conductor.sexo))           e.cond_sexo           = 'El sexo es obligatorio';
      if (req(conductor.estadoCivil))    e.cond_estadoCivil    = 'El estado civil es obligatorio';
      const hasEstado =
        !req(conductor.estado) ||
        (conductor.cestado != null && Number.isFinite(Number(conductor.cestado)));
      const hasCiudad =
        !req(conductor.ciudad) ||
        (conductor.cciudad != null && Number.isFinite(Number(conductor.cciudad)));
      if (!hasEstado) e.cond_estado = 'El estado es obligatorio';
      if (!hasCiudad) e.cond_ciudad = 'La ciudad es obligatoria';
      if (req(conductor.direccion))      e.cond_direccion      = 'La dirección es obligatoria';
      else if ((conductor.direccion || '').trim().length > PERSON_FIELD_LIMITS.direccion) {
        e.cond_direccion = `La dirección no puede superar ${PERSON_FIELD_LIMITS.direccion} caracteres`;
      }

      void digs; // usado en validaciones adicionales si se requieren
    }

    setErrors(e);
    
    if (Object.keys(e).length > 0) {
      return false;
    }

    // Validación remota La Mundial — solo emisión RCV completa
    if (isRcvEmision) {
      try {
        const { validateVehicle } = await import('../../lib/api');
        toast.info('Validando vehículo', 'Verificando placa y serial...', 2000);
        const res = await validateVehicle(vehicle.placa || '', vehicle.serial || '', {
          plan: selectedPlan?.cplan,
        });
        if (!res.success) {
          const msg = res.message || res.error || 'El vehículo no puede ser asegurado.';
          toast.error('Atención', msg, 6000);
          setErrors({ ...e, placa: msg, serial: msg });
          return false;
        }
      } catch (err) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'No se pudo validar el vehículo. Inténtalo de nuevo.';
        toast.error('Error', msg, 6000);
        setErrors({ ...e, placa: msg, serial: msg });
        return false;
      }
    }

    return true;
  };
  (window as unknown as Record<string, unknown>).__validateStep3 = validate;

  const codesReady = !!(vehicle.cmarca && vehicle.cmodelo && vehicle.cversion);

  return (
    <div className="animate-fade-in space-y-5">

      {/* ── Banner OCR ────────────────────────────────────────────────────────── */}
      {hasOcr && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white p-4 sm:p-5 shadow-[0_18px_40px_-12px_rgba(15,26,90,0.32)] relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-fuchsia-300/15 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md grid place-items-center flex-shrink-0 ring-1 ring-white/20">
                {(loadM || loadMo) ? (
                  <Loader2 size={18} className="animate-spin text-white" />
                ) : (
                  <ScanLine size={18} className="text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-black text-sm flex items-center gap-2 flex-wrap">
                  Datos precargados del documento
                  {(loadM || loadMo) && (
                    <span className="text-[0.6rem] font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                      Cargando catálogo…
                    </span>
                  )}
                  {!loadM && !loadMo && hasOcrCodes && (
                    <span className="text-[0.6rem] font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider">
                      IA ✓
                    </span>
                  )}
                </p>
                <p className="text-xs text-indigo-100 mt-0.5 leading-relaxed">
                  {qaOcrLock
                    ? 'Entorno QA: marca/modelo INMA fijos si el OCR los identificó. Placa, serial y versión puedes ajustarlos para pruebas.'
                    : hasOcrCodes
                      ? 'Marca y modelo identificados en el catálogo. Solo confirma la versión.'
                      : 'Revisa los campos y completa lo que falte. Puedes cambiar cualquier valor.'}
                </p>
              </div>
            </div>
            {hasOcrCodes && !verified && !qaOcrLock && (
              <button
                type="button"
                onClick={() => {
                  setVerified(true);
                  toast.success(
                    'Datos confirmados',
                    'Marca, modelo y año quedan bloqueados. Pulsa "Editar" si necesitas cambiarlos.',
                    3500,
                  );
                }}
                className="self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/95 hover:bg-white text-indigo-700 text-xs font-bold shadow-[0_6px_16px_rgba(0,0,0,0.15)] transition-all active:scale-95"
              >
                <ShieldCheck size={14} /> Confirmar datos
              </button>
            )}
            {verified && !qaOcrLock && (
              <div className="self-start sm:self-auto flex-shrink-0 flex items-center gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-400/95 text-emerald-950 text-xs font-bold ring-1 ring-emerald-300">
                  <ShieldCheck size={14} /> Verificado
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setVerified(false);
                    toast.info('Datos desbloqueados', 'Ya puedes modificar marca, modelo y año.', 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold ring-1 ring-white/30 transition-all active:scale-95"
                  title="Desbloquear y editar"
                >
                  Editar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Formulario del vehículo ────────────────────────────────────────────── */}
      <SectionCard
        Icon={Car}
        title="¿Cuál es tu vehículo?"
        description={
          cotizadorRcv
            ? 'Datos mínimos para obtener la tarifa RCV: origen de placa, año, marca, modelo, versión y uso.'
            : 'Cuéntanos sobre el vehículo que deseas asegurar'
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {(cotizadorRcv || isRcvEmision) && (
            <TipoPlacaSelector
              value={vehicle.tipoPlaca}
              placa={vehicle.placa}
              certOcr={ocrCert}
              onChange={setTipoPlaca}
              showBinacional={rcvLaMundial}
              disabled={qaIdentLock}
            />
          )}

          <Field
            label={cotizadorRcv ? 'Placa *' : 'Placa'}
            error={errors.placa}
            hint={placaValidating ? 'Validando placa en Sis2000…' : 'Al salir del campo se valida si la placa está activa'}
          >
            <div className="relative">
              <Input
                value={vehicle.placa}
                onChange={(e) => {
                  lastValidatedPlaca.current = '';
                  setVehicle({ placa: e.target.value.toUpperCase() });
                }}
                onBlur={(e) => {
                  void validatePlacaRemote(e.target.value);
                }}
                placeholder={placaPlaceholder(vehicle.tipoPlaca)}
                className="uppercase font-mono tracking-wider"
                maxLength={placaMaxLength(vehicle.tipoPlaca)}
                disabled={placaValidating || qaIdentLock}
              />
              {placaValidating && (
                <Loader2
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-500"
                />
              )}
            </div>
          </Field>

          {/* Año — selector del catálogo INMA */}
          <Field label="Año del vehículo *" error={errors.año}>
            {anios.length > 0 ? (
              <Select
                value={vehicle.año}
                disabled={inmaBasicsLocked}
                onChange={(e) => {
                  setVehicle({ año: e.target.value, cmarca: '', marca: '', cmodelo: '', modelo: '', cversion: '', ccategoria_uso: undefined, xcategoria_uso: '' });
                }}
              >
                <option value="">— Selecciona año —</option>
                {anios.map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </Select>
            ) : (
              <div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-500 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin shrink-0" />
                Cargando años…
              </div>
            )}
          </Field>

          {/* Marca */}
          <Field
            label={
              <span className="flex items-center gap-1.5">
                Marca
                {loadM && <Loader2 size={11} className="animate-spin text-indigo-400" />}
                {vehicle.cmarca && !loadM && <span className="text-[0.6rem] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">✓</span>}
              </span> as unknown as string
            }
            error={errors.marca}
          >
            {marcas.length > 0 ? (
              <Select
                value={vehicle.cmarca ?? ''}
                disabled={inmaBasicsLocked}
                onChange={(e) => {
                  const cmarca = e.target.value;
                  const xmarca = marcas.find(m => m.cmarca === cmarca)?.xmarca ?? '';
                  autoSelectedMarca.current = true;
                  autoSelectedModelo.current = false;
                  setVehicle({ cmarca, marca: xmarca, cmodelo: '', modelo: '', cversion: '', ccategoria_uso: undefined, xcategoria_uso: '' });
                }}
              >
                <option value="">— Selecciona marca —</option>
                {marcas.map(m => (
                  <option key={m.cmarca} value={m.cmarca}>{m.xmarca}</option>
                ))}
              </Select>
            ) : vehicle.año ? (
              loadM ? (
                <div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin shrink-0" /> Cargando marcas…
                </div>
              ) : (
                <Input
                  value={vehicle.marca}
                  onChange={(e) => setVehicle({ marca: e.target.value, cmarca: '' })}
                  placeholder="Primero selecciona el año"
                />
              )
            ) : (
              <div className="w-full px-3.5 py-2.5 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                Selecciona el año primero
              </div>
            )}
          </Field>

          {/* Modelo */}
          <Field
            label={
              <span className="flex items-center gap-1.5">
                Modelo
                {loadMo && <Loader2 size={11} className="animate-spin text-indigo-400" />}
                {vehicle.cmodelo && !loadMo && <span className="text-[0.6rem] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">✓</span>}
              </span> as unknown as string
            }
            error={errors.modelo}
          >
            {modelos.length > 0 ? (
              <Select
                value={vehicle.cmodelo ?? ''}
                disabled={inmaBasicsLocked}
                onChange={(e) => {
                  const cmodelo = e.target.value;
                  const xmodelo = modelos.find(m => m.cmodelo === cmodelo)?.xmodelo ?? '';
                  autoSelectedModelo.current = true;
                  setVehicle({ cmodelo, modelo: xmodelo, cversion: '', ccategoria_uso: undefined, xcategoria_uso: '' });
                }}
              >
                <option value="">— Selecciona modelo —</option>
                {modelos.map(m => (
                  <option key={m.cmodelo} value={m.cmodelo}>{m.xmodelo}</option>
                ))}
              </Select>
            ) : vehicle.cmarca ? (
              loadMo ? (
                <div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin shrink-0" /> Cargando modelos…
                </div>
              ) : (
                <Input
                  value={vehicle.modelo}
                  onChange={(e) => setVehicle({ modelo: e.target.value, cmodelo: '' })}
                  placeholder="Corolla, Aveo…"
                />
              )
            ) : (
              <div className="w-full px-3.5 py-2.5 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                Selecciona la marca primero
              </div>
            )}
          </Field>

          {/* Versión + Uso — emparejados en la misma fila (cada uno media columna) */}
          {(vehicle.cmodelo || loadV) && (
            <Field
              label={
                <span className="flex items-center gap-1.5">
                  Versión
                  {loadV && <Loader2 size={11} className="animate-spin text-indigo-400" />}
                  {!vehicle.cversion && !loadV && (
                    <span className="text-[0.6rem] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                      requerido
                    </span>
                  )}
                </span> as unknown as string
              }
            >
              {versiones.length > 0 ? (
                <Select
                  value={vehicle.cversion ?? ''}
                  disabled={versionLocked}
                  onChange={(e) => {
                    const ver = versiones.find(v => v.cversion === e.target.value);
                    setVehicle({
                      cversion: e.target.value,
                      // ctipo determina qué planes RCV están disponibles (1=particular, 4=moto...)
                      ctipo: ver?.ctipo != null ? Number(ver.ctipo) : undefined,
                      // ccategotr → match con ccategoria_uso al cargar categorías
                      ccategotr: ver?.ccategotr ?? undefined,
                      // Reset; el efecto de match rellena el uso automáticamente
                      ccategoria_uso: undefined,
                      xcategoria_uso: '',
                      uso: '',
                    });
                  }}
                  className={!vehicle.cversion ? 'border-violet-300 focus:border-violet-500 ring-2 ring-violet-100' : ''}
                >
                  <option value="">— Selecciona la versión —</option>
                  {versiones.map(v => (
                    <option key={v.cversion} value={v.cversion}>{v.xversion}</option>
                  ))}
                </Select>
              ) : loadV ? (
                <div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin shrink-0" /> Cargando versiones…
                </div>
              ) : null}
            </Field>
          )}

          {/* Uso — categorías dinámicas según la versión seleccionada */}
          <Field
            error={errors.uso}
            label={
              <span className="flex items-center gap-1.5">
                ¿Para qué usas el vehículo? *
                {loadCu && <Loader2 size={11} className="animate-spin text-indigo-400" />}
                {vehicle.ccategoria_uso != null && vehicle.ccategoria_uso !== '' && !loadCu && (
                  <span className="text-[0.6rem] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">✓</span>
                )}
                {usoLockedByCcategotr && (
                  <span className="text-[0.6rem] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                    según versión
                  </span>
                )}
                {!vehicle.cversion && (
                  <span className="text-[0.6rem] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    selecciona la versión primero
                  </span>
                )}
              </span> as unknown as string
            }
            hint={
              !vehicle.cversion
                ? 'Selecciona la versión del vehículo para ver las categorías.'
                : usoLockedByCcategotr
                  ? 'Uso definido por la versión del vehículo (no editable).'
                  : undefined
            }
          >
            {!vehicle.cversion ? (
              <div className="w-full px-3.5 py-2.5 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                Selecciona la versión primero
              </div>
            ) : loadCu ? (
              <div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-500 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin shrink-0" /> Cargando categorías…
              </div>
            ) : categoriasUso.length > 0 ? (
              <Select
                value={vehicle.ccategoria_uso != null ? String(vehicle.ccategoria_uso) : ''}
                disabled={usoLockedByCcategotr}
                onChange={(e) => {
                  if (usoLockedByCcategotr) return;
                  const code = e.target.value;
                  const match = categoriasUso.find(c => String(c.ccategoria_uso) === code);
                  const nextCat = match ? match.ccategoria_uso : undefined;
                  setVehicle({
                    ccategoria_uso: nextCat,
                    xcategoria_uso: match?.xcategoria_uso ?? '',
                    uso: match?.xcategoria_uso ?? vehicle.uso,
                    ...(nextCat != null && !isCategoriaToneladas(nextCat) ? { ntoneladas: undefined } : {}),
                  });
                }}
                className={
                  usoLockedByCcategotr
                    ? 'bg-slate-50 text-slate-700 cursor-not-allowed'
                    : vehicle.ccategoria_uso == null
                      ? 'border-violet-300 focus:border-violet-500 ring-2 ring-violet-100'
                      : ''
                }
              >
                <option value="">— Selecciona la categoría de uso —</option>
                {categoriasUso.map(c => (
                  <option key={c.ccategoria_uso} value={String(c.ccategoria_uso)}>{c.xcategoria_uso}</option>
                ))}
              </Select>
            ) : (
              <Select value={vehicle.uso} onChange={(e) => setVehicle({ uso: e.target.value })}>
                <option value="Particular">Uso personal / familiar</option>
                <option value="Comercial">Negocio o empresa</option>
                <option value="Carga">Carga y transporte</option>
                <option value="Transporte público">Transporte de pasajeros</option>
              </Select>
            )}
          </Field>

          {rcvLaMundial && (
            <>
              <Field
                label="Actividades asociadas (Recargo RCV) *"
                hint="Porcentaje adicional sobre la prima RCV. Aplica a nacional, extranjera y binacional."
                error={errors.recargoRcv}
              >
                {recargosLoad ? (
                  <div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin shrink-0" /> Cargando recargos…
                  </div>
                ) : (
                  <Select
                    value={
                      vehicle.csustanc_rcv != null
                        ? String(vehicle.csustanc_rcv)
                        : String(recargosRcv.find((r) => Number(r.porcenta) === Number(vehicle.precargorcv ?? 0))?.csustanc ?? '')
                    }
                    onChange={(e) => {
                      const item = recargosRcv.find((r) => String(r.csustanc) === e.target.value);
                      if (!item) return;
                      setVehicle({
                        precargorcv: Number(item.porcenta),
                        csustanc_rcv: item.csustanc,
                        xsustanc_rcv: item.xsustanc,
                      });
                    }}
                  >
                    <option value="">— Selecciona actividad —</option>
                    {recargosRcv.map((r) => (
                      <option key={r.csustanc} value={String(r.csustanc)}>
                        {r.xsustanc}{Number(r.porcenta) > 0 ? ` (+${r.porcenta}%)` : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              {showToneladas && (
                <Field
                  label="Toneladas totales *"
                  error={errors.toneladas}
                  hint="Solo para categoría >12 TM. Si indica menos de 12, se usará 13 TM (regla La Mundial)."
                >
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={vehicle.ntoneladas ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setVehicle({
                        ntoneladas: raw === '' ? undefined : parseInt(raw, 10),
                      });
                    }}
                    onBlur={() => {
                      const normalized = normalizeToneladasForCategoria(
                        vehicle.ccategoria_uso,
                        vehicle.ntoneladas,
                      );
                      if (normalized != null && normalized !== vehicle.ntoneladas) {
                        setVehicle({ ntoneladas: normalized });
                      }
                    }}
                    placeholder="Ej. 15"
                  />
                </Field>
              )}
            </>
          )}

          {/* Confirmación amigable cuando el vehículo está completo */}
          {codesReady && (
            <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
              <ShieldCheck size={14} className="shrink-0 text-emerald-500" />
              <span>
                <strong>{vehicle.marca} {vehicle.modelo}</strong> listo para cotización — selecciona el plan en el siguiente paso.
              </span>
            </div>
          )}

          {!cotizadorRcv && (
          <>
          {/* Color */}
          <Field label="Color *" error={errors.color}>
            <div className="relative">
              <Input
                value={vehicle.color}
                disabled={qaIdentLock}
                onChange={(e) => setVehicle({ color: e.target.value.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '').slice(0, 15) })}
                placeholder="Plateado"
                maxLength={15}
                style={{ paddingLeft: '2.25rem' }}
              />
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-300 shadow-inner pointer-events-none"
                style={{ background: getColorSwatch(vehicle.color) }}
                aria-hidden
              />
            </div>
          </Field>

          {/* Serial de carrocería (VIN) */}
          <Field
            label="Serial de carrocería (VIN) *"
            error={errors.serial}
            hint={
              serialValidating
                ? 'Validando serial en Sis2000…'
                : 'Como en la licencia de tránsito (máx. 18 caracteres) · Al salir del campo se valida si está activo'
            }
          >
            <div className="relative">
              <Input
                value={vehicle.serial}
                onChange={(e) => {
                  lastValidatedSerial.current = '';
                  setVehicle({ serial: normalizeVehicleSerial(e.target.value) });
                }}
                onBlur={(e) => {
                  void validateSerialRemote(e.target.value);
                }}
                placeholder="150895 o VIN completo"
                className="font-mono uppercase tracking-wider"
                maxLength={VEHICLE_SERIAL_MAX_LEN}
                disabled={serialValidating || qaIdentLock}
              />
              {serialValidating && (
                <Loader2
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-500"
                />
              )}
            </div>
          </Field>

          {/* Serial del motor — opcional */}
          <Field label="Serial del motor" hint="Opcional · Máx. 60 caracteres · Aparece en el documento del vehículo">
            <Input
              value={vehicle.serialMotor ?? ''}
              disabled={qaIdentLock}
              onChange={(e) => setVehicle({ serialMotor: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 60) })}
              placeholder="Ej. 4A123456789"
              className="font-mono uppercase tracking-wider"
              maxLength={60}
            />
          </Field>

          {/* Cilindrada — carnet binacional Colombia (solo RCV La Mundial) */}
          {isBinacional && (
          <Field label="Cilindrada (CC)" hint="Opcional · Del carnet binacional colombiano">
            <Input
              value={vehicle.cilindrada ?? ''}
              disabled={qaIdentLock}
              onChange={(e) => setVehicle({ cilindrada: e.target.value.slice(0, 20) })}
              placeholder="Ej. 1.998"
              className="font-mono tracking-wider"
              maxLength={20}
            />
          </Field>
          )}
          </>
          )}
        </div>

        {/* Vista previa */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-3 sm:gap-4 flex-wrap">
          <p className="text-[0.62rem] font-black text-slate-500 uppercase tracking-widest inline-flex items-center gap-1.5">
            <Sparkles size={11} className="text-indigo-500" /> Vista previa
          </p>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
            {!cotizadorRcv && (
            <div className="rounded-md bg-white border-2 border-slate-900 px-3 py-1.5 font-mono font-black text-slate-900 text-sm tracking-widest shadow-sm">
              {vehicle.placa || 'AAA000'}
            </div>
            )}
            <span className="text-sm text-slate-700 font-bold truncate max-w-[200px]">
              {[vehicle.marca, vehicle.modelo].filter(Boolean).join(' ') || 'Marca · Modelo'}
            </span>
            {vehicle.año && <span className="text-xs text-slate-500 font-mono">{vehicle.año}</span>}
            {vehicle.color && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 capitalize">
                <span className="w-3 h-3 rounded-full ring-1 ring-slate-300" style={{ background: getColorSwatch(vehicle.color) }} />
                {vehicle.color}
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {!cotizadorRcv && (
      <SectionCard Icon={UserCog} title="¿Hay otro conductor?" description="Si alguien más conduce este vehículo con frecuencia, regístralo aquí">
        <ToggleSwitch
          checked={hasDriver} onChange={setHasDriver}
          label="Sí, hay otra persona que lo maneja"
          description="Puede ser un familiar, empleado o cualquier persona que utilice el vehículo con regularidad."
        />
        {hasDriver && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
              <Field
                label="Cédula o documento *"
                error={errors.cond_identificacion}
                hint="Al salir del campo se buscan los datos en Sis2000"
              >
                <IdentityInput
                  tipoDoc={conductor.tipoDoc ?? 'V'}
                  identificacion={conductor.identificacion}
                  maxLength={SECONDARY_IDENTIFICACION_MAX_LENGTH}
                  loading={conductorLookupLoading}
                  onTipoDocChange={(v) => {
                    lastConductorLookupCid.current = '';
                    setConductor({ tipoDoc: v });
                  }}
                  onIdentificacionChange={(v) => {
                    lastConductorLookupCid.current = '';
                    setConductor({ identificacion: clipPersonField('identificacion', v) });
                  }}
                  onIdentificacionBlur={
                    isRcvEmision
                      ? (id) => {
                          void lookupConductorByCedula(conductor.tipoDoc ?? 'V', id);
                        }
                      : undefined
                  }
                />
              </Field>
              <div className="hidden sm:block"></div>
              <Field label="Nombre *" error={errors.cond_nombre}>
                <Input
                  value={conductor.nombre}
                  onChange={(e) =>
                    setConductor({
                      nombre: String(e.target.value)
                        .replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '')
                        .slice(0, PERSON_FIELD_LIMITS.nombre),
                    })
                  }
                  placeholder="Nombre"
                  maxLength={PERSON_FIELD_LIMITS.nombre}
                />
              </Field>
              <Field label="Apellido *" error={errors.cond_apellido}>
                <Input
                  value={conductor.apellido}
                  onChange={(e) =>
                    setConductor({
                      apellido: String(e.target.value)
                        .replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '')
                        .slice(0, PERSON_FIELD_LIMITS.apellido),
                    })
                  }
                  placeholder="Apellido"
                  maxLength={PERSON_FIELD_LIMITS.apellido}
                />
              </Field>
              <Field label="Teléfono *" error={errors.cond_telefono} hint="Exactamente 11 dígitos, ej. 04121234567">
                <Input
                  value={formatTelefono(conductor.telefono ?? '')}
                  onChange={(e) => setConductor({ telefono: formatTelefono(e.target.value) })}
                  placeholder="(0412) 123-4567"
                  type="tel"
                  maxLength={PERSON_FIELD_LIMITS.telefonoDisplay}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Correo electrónico *" error={errors.cond_email}>
                <Input
                  value={conductor.email ?? ''}
                  onChange={(e) => setConductor({ email: clipPersonField('email', e.target.value) })}
                  placeholder="correo@ejemplo.com"
                  type="email"
                  inputMode="email"
                  maxLength={PERSON_FIELD_LIMITS.email}
                />
              </Field>
              <PersonLocationFields
                person={conductor}
                setPerson={setConductor}
                prefix="cond_"
                errors={errors as Record<string, string | undefined>}
                estados={catalogs.estados}
                ciuState={conductorCiudades}
                catalogsLoading={catalogs.loading}
                exelixiFlow={exelixiFlow}
              />
              <Field label="Fecha de nacimiento *">
                <Input value={conductor.fechaNac ?? ''} onChange={(e) => setConductor({ fechaNac: e.target.value })} type="date" />
              </Field>
              <Field label="Sexo *" error={errors.cond_sexo}>
                <SearchSelect
                  value={conductor.sexo}
                  options={catalogs.sexos.length > 0 ? catalogs.sexos.map((s) => ({ value: String(s.label), label: s.label })) : [{ value: 'Femenino', label: 'Femenino' }, { value: 'Masculino', label: 'Masculino' }]}
                  onChange={(value) => setConductor({ sexo: value })} placeholder="— Seleccionar —" loading={catalogs.loading}
                />
              </Field>
              <Field label="Estado civil *" error={errors.cond_estadoCivil}>
                <SearchSelect
                  value={conductor.estadoCivil}
                  options={catalogs.estadosCivil.length > 0 ? catalogs.estadosCivil.map((s) => ({ value: String(s.label), label: s.label })) : [{ value: 'Soltero(a)', label: 'Soltero(a)' }, { value: 'Casado(a)', label: 'Casado(a)' }, { value: 'Divorciado(a)', label: 'Divorciado(a)' }, { value: 'Viudo(a)', label: 'Viudo(a)' }]}
                  onChange={(value) => setConductor({ estadoCivil: value })} placeholder="— Seleccionar —" loading={catalogs.loading}
                />
              </Field>
              <div className="hidden sm:block"></div>
              <Field label="Dirección *" error={errors.cond_direccion} full>
                <Textarea
                  value={conductor.direccion ?? ''}
                  onChange={(e) =>
                    setConductor({ direccion: clipPersonField('direccion', e.target.value) })
                  }
                  placeholder="Dirección completa"
                  rows={2}
                  maxLength={PERSON_FIELD_LIMITS.direccion}
                />
              </Field>
              <Field label="Número de licencia de conducir *" error={errors.cond_licencia} hint="Máx. 20 caracteres alfanuméricos" full>
                <Input
                  value={conductor.licencia ?? ''}
                  onChange={(e) => setConductor({ licencia: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20) })}
                  placeholder="Ej. LIC-0234567"
                  className="uppercase font-mono tracking-wider"
                  maxLength={20}
                />
              </Field>
          </div>
        )}
      </SectionCard>
      )}
    </div>
  );
}
