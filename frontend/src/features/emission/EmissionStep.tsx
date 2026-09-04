import { useCallback, useEffect, useRef, useState } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { Field, Input, Textarea } from '../../components/ui/FormField';
import { IdentityInput } from '../../components/ui/IdentityInput';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { PersonLocationFields } from '../../components/PersonLocationFields';
import { useCatalogs, useCiudades } from '../../hooks/useCatalogs';
import { useProductConfig } from '../../hooks/useProductConfig';
import { isExelixiCatalogFlow } from '../../lib/exelixi-catalog';
import { isCotizadorFlow } from '../../lib/cotizador-flow';
import { getProductId, isFunerario, isRcvLaMundialFlow, usesFuneralStep } from '../../lib/product';
import { cedulaTienePolizaVigente } from '../../lib/funeral-cedula-check';
import {
  diligenciaLabel,
  isPersonaJuridica,
  preClasificarDiligencia,
} from '../../lib/diligencia';
import { searchProprietary } from '../../lib/api';
import {
  buildProprietaryCid,
  mapProprietaryToPerson,
  sis2000EmptyFill,
  type PersonFormPatch,
  type ProprietaryInfo,
} from '../../lib/map-proprietary';
import { funeralOcrIdentityPatch, funeralRoleFromPrefix } from '../../lib/funeral-ocr-apply';
import { toast } from '../../store/toastStore';
import { User, Heart, ShieldAlert, FileText } from 'lucide-react';
import { formatTelefono, isValidPhonePrefix, validateRequiredVePhone } from '../../lib/phone';
import { PERSON_FIELD_LIMITS, clipPersonField } from '../../lib/field-limits';
import {
  SECONDARY_IDENTIFICACION_MAX_LENGTH,
  validateSecondaryPersonIdentificacion,
} from '../../lib/person-identificacion';
import type { FuneralPerson } from '../../types';

/** Años cumplidos desde YYYY-MM-DD (calendario, sin UTC). */
function edadCumplida(iso?: string): number | null {
  const m = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const n = new Date();
  let e = n.getFullYear() - y;
  if (n.getMonth() + 1 < mo || (n.getMonth() + 1 === mo && n.getDate() < d)) e--;
  return e >= 0 ? e : null;
}

function emptyFuneralBeneficiario(pporcen = 100): FuneralPerson {
  return {
    tipoDoc: 'V',
    identificacion: '',
    nombre: '',
    apellido: '',
    fechaNac: '',
    sexo: '',
    parentesco: '',
    pporcen,
    telefono: '',
    email: '',
  };
}

export function SectionCard({
  title,
  description,
  Icon,
  children,
  statusLabel,
  statusTone = 'neutral',
}: {
  title: string;
  description?: string;
  Icon: React.ElementType;
  children: React.ReactNode;
  statusLabel?: string;
  statusTone?: 'neutral' | 'warning' | 'success';
}) {
  const toneClasses =
    statusTone === 'warning'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : statusTone === 'success'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3 p-4 sm:p-5 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 grid place-items-center flex-shrink-0 shadow-[0_4px_14px_rgba(15, 26, 90,0.3)]">
          <Icon size={16} className="text-white" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-slate-900 text-[0.95rem] leading-tight">{title}</h3>
          {description && (
            <p className="text-[0.78rem] text-slate-500 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        {statusLabel && (
          <div className="flex-shrink-0">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-md border text-[0.6rem] font-bold uppercase tracking-wider ${toneClasses}`}
            >
              {statusLabel}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

interface ValidationErrors {
  [key: string]: string;
}

const CLIENT_FIELD_ORDER = [
  'identificacion', 'nombre', 'apellido', 'telefono', 'email',
  'fechaNac', 'sexo', 'estadoCivil', 'estado', 'ciudad', 'direccion',
];
const CLIENT_PREFIXES = ['tom_', 'aseg_', 'benef_'];

function focusClientError(errors: ValidationErrors) {
  const extras = Object.keys(errors)
    .filter((k) => !CLIENT_PREFIXES.some((p) => CLIENT_FIELD_ORDER.some((f) => k === `${p}${f}`)))
    .sort();
  const ordered = [
    ...CLIENT_PREFIXES.flatMap((p) => CLIENT_FIELD_ORDER.map((f) => `${p}${f}`)),
    'tom_profesion',
    ...extras,
  ];
  const first = ordered.find((k) => errors[k]);
  const msg = (first && errors[first]) || 'Revisa los campos obligatorios marcados en rojo.';
  toast.warning('No se puede continuar', msg, 6000);
  if (!first) return;
  window.requestAnimationFrame(() => {
    const box = document.getElementById(`cli-${first}`);
    box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const control = box?.querySelector<HTMLElement>('input, select, textarea, button');
    control?.focus();
  });
}

const emailRe   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPRESA_ID = Number(import.meta.env.VITE_EMPRESA_ID ?? 1);

function onlyLetters(v: string): string {
  return v.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '');
}

function clipLetters(v: string, max: number): string {
  return onlyLetters(v).slice(0, max);
}

export function EmissionStep() {
  const {
    tomador, setTomador,
    sameInsured, setSameInsured,
    asegurado, setAsegurado,
    hasBeneficiary, setHasBeneficiary,
    beneficiario, setBeneficiario,
    funeral, setFuneral,
    diligencia, setDiligencia,
  } = useWizardStore();

  const catalogs = useCatalogs();
  const exelixiFlow = isExelixiCatalogFlow();
  const isRcvEmision = isRcvLaMundialFlow() && !isCotizadorFlow();
  const producto = getProductId();
  const { config: formConfig } = useProductConfig(EMPRESA_ID, producto, 'formulario');
  const showProfesion = isRcvEmision && formConfig?.campos?.cprofesion?.activo !== false;
  const showActividad = isRcvEmision && formConfig?.campos?.cactividad?.activo !== false;
  const esPJ = isPersonaJuridica(tomador.tipoDoc);
  const ciudadesState = useCiudades(tomador.cestado);
  const aseguradoCiudades = useCiudades(asegurado.cestado);

  useEffect(() => {
    if (!isRcvEmision) return;
    const itipo = preClasificarDiligencia(tomador.tipoDoc);
    setDiligencia({
      itipoDiligencia: itipo,
      clasificadoEn: 'formulario',
    });
    setTomador({ itipoDiligencia: itipo });
  }, [isRcvEmision, tomador.tipoDoc, setDiligencia, setTomador]);
  const beneficiarioCiudades = useCiudades(beneficiario.cestado);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [lookupLoading, setLookupLoading] = useState<Record<string, boolean>>({});
  const lastLookupCid = useRef<Record<string, string>>({});
  const lastFuneralCedula = useRef<Record<string, string>>({});
  const lastFuneralOk = useRef<Record<string, boolean>>({});
  const ocrForced = useRef<Record<string, string>>({});
  const checkFuneralFlow = isFunerario() || usesFuneralStep();
  const tomOcrFnac = useWizardStore((s) => s.documents.cedula?.ocr?.fechaNacimiento ?? '');
  const titOcrFnac = useWizardStore((s) => s.documents.cedula_titular?.ocr?.fechaNacimiento ?? '');

  useEffect(() => {
    if (!checkFuneralFlow) return;
    const force = (prefix: 'tom_' | 'aseg_', setter: (p: PersonFormPatch) => void) => {
      const role = prefix === 'tom_' ? 'tomador' : 'asegurado';
      const ocr = funeralOcrIdentityPatch(role);
      const key = `${ocr.identificacion ?? ''}|${ocr.fechaNac ?? ''}`;
      if (!ocr.fechaNac && !ocr.nombre) return;
      if (ocrForced.current[prefix] === key) return;
      ocrForced.current[prefix] = key;
      setter(ocr);
    };
    force('tom_', setTomador);
    if (!sameInsured) force('aseg_', setAsegurado);
  }, [checkFuneralFlow, sameInsured, tomOcrFnac, titOcrFnac, setTomador, setAsegurado]);

  const parentescoOptions =
    catalogs.parentescos.length > 0
      ? catalogs.parentescos
          .filter((p) => String(p.code) !== '1')
          .map((p) => ({ value: String(p.code), label: p.label }))
      : [
          { value: '2', label: 'Cónyuge' },
          { value: '3', label: 'Hijo (a)' },
          { value: '4', label: 'Abuelos (as)' },
          { value: '5', label: 'Tíos (as)' },
          { value: '6', label: 'Padres' },
          { value: '7', label: 'Hermano (a)' },
        ];

  const patchFuneralBeneficiario = (idx: number, patch: Partial<FuneralPerson>) => {
    const next = [...(funeral.beneficiarios ?? [])];
    next[idx] = { ...next[idx], ...patch };
    setFuneral({ beneficiarios: next });
  };

  useEffect(() => {
    if (!checkFuneralFlow) return;
    if ((funeral.beneficiarios ?? []).length > 0) return;
    const fromOcr = beneficiario.identificacion || beneficiario.nombre
      ? {
          tipoDoc: beneficiario.tipoDoc || 'V',
          identificacion: beneficiario.identificacion,
          nombre: beneficiario.nombre,
          apellido: beneficiario.apellido,
          fechaNac: beneficiario.fechaNac ?? '',
          sexo: beneficiario.sexo ?? '',
          parentesco: beneficiario.parentesco ?? '',
          pporcen: beneficiario.pporcen ?? 100,
          telefono: beneficiario.telefono ?? '',
          email: beneficiario.email ?? '',
        }
      : emptyFuneralBeneficiario(100);
    setFuneral({ beneficiarios: [fromOcr] });
    setHasBeneficiary(true);
  }, [checkFuneralFlow, funeral.beneficiarios, beneficiario, setFuneral, setHasBeneficiary]);

  const lookupByCedula = useCallback(
    async (
      prefix: string,
      tipoDoc: string,
      identificacion: string,
      setPerson: (patch: PersonFormPatch) => void,
      _current?: PersonFormPatch,
    ) => {
      const digits = String(identificacion || '').replace(/\D/g, '');
      if (digits.length < 1) return;

      const cid = buildProprietaryCid(tipoDoc || 'V', digits);
      if (lastLookupCid.current[prefix] === cid) return;

      setLookupLoading((s) => ({ ...s, [prefix]: true }));
      try {
        // Preferir dígitos (cci_rif) y luego con letra (cid)
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
          lastLookupCid.current[prefix] = cid;
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

        const store = useWizardStore.getState();
        const latest: PersonFormPatch =
          prefix === 'tom_'
            ? store.tomador
            : prefix === 'aseg_'
              ? store.asegurado
              : store.beneficiario;
        const role = funeralRoleFromPrefix(prefix);
        const ocrIdentity = role ? funeralOcrIdentityPatch(role) : {};
        // OCR manda en identidad; Sis2000 solo rellena huecos (teléfono, dirección…).
        const fill = sis2000EmptyFill({ ...latest, ...ocrIdentity }, patch);
        setPerson({ ...fill, ...ocrIdentity });

        const ocrFecha = String(ocrIdentity.fechaNac ?? '').slice(0, 10);
        const sisFecha = String(patch.fechaNac ?? '').slice(0, 10);
        const keptOcrFecha = Boolean(ocrFecha) && Boolean(sisFecha) && ocrFecha !== sisFecha;

        lastLookupCid.current[prefix] = matchedCid;
        toast.success(
          'Datos cargados',
          keptOcrFecha
            ? 'Se conservó la fecha de la cédula. El resto se completó desde Sis2000.'
            : 'Se completó el formulario con la información del cliente.',
          keptOcrFecha ? 4000 : 2800,
        );
      } catch {
        toast.warning(
          'Consulta no disponible',
          'No se pudo buscar el documento. Complete el formulario manualmente.',
          4000,
        );
      } finally {
        setLookupLoading((s) => ({ ...s, [prefix]: false }));
      }
    },
    [catalogs.sexos, catalogs.estadosCivil, catalogs.estados],
  );

  const checkFuneralCedula = useCallback(
    async (prefix: string, identificacion: string): Promise<boolean> => {
      const digits = String(identificacion || '').replace(/\D/g, '');
      if (digits.length < 6) return true;
      if (lastFuneralCedula.current[prefix] === digits) {
        return lastFuneralOk.current[prefix] !== false;
      }
      lastFuneralCedula.current[prefix] = digits;
      setLookupLoading((s) => ({ ...s, [prefix]: true }));
      try {
        const res = await cedulaTienePolizaVigente(digits);
        if (res.blocked) {
          lastFuneralOk.current[prefix] = false;
          setErrors((prev) => ({
            ...prev,
            [`${prefix}identificacion`]: res.message,
          }));
          toast.warning(
            'No se puede asegurar',
            res.cnpoliza
              ? `Ya existe una póliza funeraria vigente (${res.cnpoliza}).`
              : 'Esta cédula ya tiene una póliza funeraria activa. No se puede continuar.',
            8000,
          );
          return false;
        }
        lastFuneralOk.current[prefix] = true;
        setErrors((prev) => {
          const key = `${prefix}identificacion`;
          if (!prev[key]) return prev;
          const { [key]: _removed, ...rest } = prev;
          return rest;
        });
        toast.success(
          'Se puede asegurar',
          'No hay póliza funeraria vigente para esta cédula.',
          2800,
        );
        return true;
      } catch {
        lastFuneralCedula.current[prefix] = '';
        lastFuneralOk.current[prefix] = false;
        toast.warning(
          'No se pudo verificar la cédula',
          'Inténtalo de nuevo antes de continuar.',
          4000,
        );
        return false;
      } finally {
        setLookupLoading((s) => ({ ...s, [prefix]: false }));
      }
    },
    [],
  );

  const runFuneralCedulaAuto = useCallback(
    async (
      prefix: string,
      tipoDoc: string,
      identificacion: string,
      setPerson: (patch: PersonFormPatch) => void,
      current: PersonFormPatch,
    ): Promise<boolean> => {
      const digits = String(identificacion || '').replace(/\D/g, '');
      if (digits.length < 6) return true;
      const ok = await checkFuneralCedula(prefix, identificacion);
      if (!ok) return false;
      await lookupByCedula(prefix, tipoDoc || 'V', identificacion, setPerson, current);
      return true;
    },
    [checkFuneralCedula, lookupByCedula],
  );

  useEffect(() => {
    if (!checkFuneralFlow) return;
    const digits = String(tomador.identificacion || '').replace(/\D/g, '');
    if (digits.length < 6) return;
    const timer = window.setTimeout(() => {
      void runFuneralCedulaAuto(
        'tom_',
        tomador.tipoDoc ?? 'V',
        tomador.identificacion,
        setTomador,
        tomador,
      );
    }, 450);
    return () => window.clearTimeout(timer);
  }, [checkFuneralFlow, tomador.identificacion, tomador.tipoDoc, runFuneralCedulaAuto, setTomador]);

  useEffect(() => {
    if (!checkFuneralFlow || sameInsured) return;
    const digits = String(asegurado.identificacion || '').replace(/\D/g, '');
    if (digits.length < 6) return;
    const timer = window.setTimeout(() => {
      void runFuneralCedulaAuto(
        'aseg_',
        asegurado.tipoDoc ?? 'V',
        asegurado.identificacion,
        setAsegurado,
        asegurado,
      );
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    checkFuneralFlow,
    sameInsured,
    asegurado.identificacion,
    asegurado.tipoDoc,
    runFuneralCedulaAuto,
    setAsegurado,
  ]);

  const validate = async () => {
    const e: ValidationErrors = {};
    const req  = (v?: string) => !(v ?? '').trim();
    const len  = (v?: string) => (v ?? '').trim().length;
    const digs = (v?: string) => (v ?? '').replace(/\D/g, '').length;

    const validatePerson = (person: any, prefix: string, opts?: { secondaryIdent?: boolean }) => {
      if (opts?.secondaryIdent) {
        const idErr = validateSecondaryPersonIdentificacion(person.identificacion);
        if (idErr) e[`${prefix}identificacion`] = idErr;
      } else if (req(person.identificacion)) {
        e[`${prefix}identificacion`] = 'La identificación es obligatoria';
      } else if (digs(person.identificacion) < 1) {
        e[`${prefix}identificacion`] = 'La identificación debe tener al menos 1 dígito';
      } else if (digs(person.identificacion) > PERSON_FIELD_LIMITS.identificacion) {
        e[`${prefix}identificacion`] = `La identificación no puede tener más de ${PERSON_FIELD_LIMITS.identificacion} dígitos`;
      }

      if (req(person.nombre)) {
        e[`${prefix}nombre`] = 'El nombre es obligatorio';
      } else if (len(person.nombre) < 2) {
        e[`${prefix}nombre`] = 'El nombre debe tener al menos 2 caracteres';
      } else if (len(person.nombre) > PERSON_FIELD_LIMITS.nombre) {
        e[`${prefix}nombre`] = `El nombre no puede superar ${PERSON_FIELD_LIMITS.nombre} caracteres`;
      }

      if (req(person.apellido)) {
        e[`${prefix}apellido`] = 'El apellido es obligatorio';
      } else if (len(person.apellido) < 2) {
        e[`${prefix}apellido`] = 'El apellido debe tener al menos 2 caracteres';
      } else if (len(person.apellido) > PERSON_FIELD_LIMITS.apellido) {
        e[`${prefix}apellido`] = `El apellido no puede superar ${PERSON_FIELD_LIMITS.apellido} caracteres`;
      }

      if (req(person.sexo))       e[`${prefix}sexo`]        = 'Selecciona el sexo';
      if (req(person.estadoCivil)) e[`${prefix}estadoCivil`] = 'Selecciona el estado civil';

      if (req(person.telefono)) {
        e[`${prefix}telefono`] = 'El teléfono es obligatorio';
      } else if (digs(person.telefono) !== 11) {
        e[`${prefix}telefono`] = 'El teléfono debe tener exactamente 11 dígitos';
      } else if (!isValidPhonePrefix(person.telefono || '')) {
        e[`${prefix}telefono`] = 'El prefijo no es válido (Digitel 0412/0422 · Movistar 0414/0424 · Movilnet 0416/0426 · fijos 02XX)';
      }

      if (req(person.email)) {
        e[`${prefix}email`] = 'El correo electrónico es obligatorio';
      } else if (!emailRe.test((person.email || '').trim())) {
        e[`${prefix}email`] = 'Ingresa un correo válido';
      } else if (len(person.email) > PERSON_FIELD_LIMITS.email) {
        e[`${prefix}email`] = `El correo no puede superar ${PERSON_FIELD_LIMITS.email} caracteres`;
      }

      if (req(person.fechaNac)) e[`${prefix}fechaNac`] = 'La fecha de nacimiento es obligatoria';

      // SearchSelect usa cestado/cciudad; el texto estado/ciudad puede venir vacío del autofill
      const hasEstado =
        !req(person.estado) ||
        (person.cestado != null && String(person.cestado).trim() !== '' && Number.isFinite(Number(person.cestado)));
      const hasCiudad =
        !req(person.ciudad) ||
        (person.cciudad != null && String(person.cciudad).trim() !== '' && Number.isFinite(Number(person.cciudad)));

      if (!hasEstado) e[`${prefix}estado`] = 'El estado es obligatorio';
      if (!hasCiudad) {
        e[`${prefix}ciudad`] = 'La ciudad es obligatoria';
      } else if (len(person.ciudad) > PERSON_FIELD_LIMITS.ciudad) {
        e[`${prefix}ciudad`] = `La ciudad no puede superar ${PERSON_FIELD_LIMITS.ciudad} caracteres`;
      }

      if (req(person.direccion)) {
        e[`${prefix}direccion`] = 'La dirección es obligatoria';
      } else if (len(person.direccion) < 5) {
        e[`${prefix}direccion`] = 'La dirección debe tener al menos 5 caracteres';
      } else if (len(person.direccion) > PERSON_FIELD_LIMITS.direccion) {
        e[`${prefix}direccion`] = `La dirección no puede superar ${PERSON_FIELD_LIMITS.direccion} caracteres`;
      }
    };

    validatePerson(tomador, 'tom_', {
      secondaryIdent: checkFuneralFlow || (isRcvEmision && sameInsured !== false),
    });
    if (isRcvEmision && !esPJ) {
      const hasProf = Boolean(tomador.cprofesion || tomador.xprofesion);
      const hasAct = Boolean(tomador.cactividad || tomador.xactividad);
      if (!hasProf && !hasAct) {
        e.tom_profesion = 'Indique profesión o actividad económica';
      }
    }
    if (!sameInsured) validatePerson(asegurado, 'aseg_', { secondaryIdent: true });
    if (checkFuneralFlow) {
      const bens = funeral.beneficiarios ?? [];
      if (bens.length === 0) {
        e.funeral_benef = 'Agrega al menos un beneficiario';
      }
      let pctSum = 0;
      bens.forEach((b, i) => {
        const idErr = validateSecondaryPersonIdentificacion(b.identificacion);
        if (idErr) e[`fben_${i}_id`] = idErr;
        if (!(b.nombre ?? '').trim()) e[`fben_${i}_nombre`] = 'El nombre es obligatorio';
        if (!(b.apellido ?? '').trim()) e[`fben_${i}_apellido`] = 'El apellido es obligatorio';
        if (!(b.fechaNac ?? '').trim()) e[`fben_${i}_fnac`] = 'La fecha de nacimiento es obligatoria';
        if (!(b.parentesco ?? '').trim()) e[`fben_${i}_parentesco`] = 'El parentesco es obligatorio';
        const phoneErr = validateRequiredVePhone(b.telefono);
        if (phoneErr) e[`fben_${i}_tel`] = phoneErr;
        const pct = Number(b.pporcen);
        if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
          e[`fben_${i}_pct`] = 'El % de beneficio debe estar entre 1 y 100';
        } else {
          pctSum += pct;
        }
      });
      if (bens.length > 0 && pctSum !== 100) {
        e.funeral_benef_pct = 'El porcentaje de beneficio debe sumar 100%';
      }
    } else if (hasBeneficiary) {
      validatePerson(beneficiario, 'benef_', { secondaryIdent: true });
    }

    setErrors(e);
    if (Object.keys(e).length > 0) {
      focusClientError(e);
      return false;
    }

    if (checkFuneralFlow) {
      const first = (funeral.beneficiarios ?? [])[0];
      if (first) {
        setHasBeneficiary(true);
        setBeneficiario({
          tipoDoc: first.tipoDoc,
          identificacion: first.identificacion,
          nombre: first.nombre,
          apellido: first.apellido,
          fechaNac: first.fechaNac,
          sexo: first.sexo,
          parentesco: first.parentesco,
          pporcen: first.pporcen,
          telefono: first.telefono,
          email: first.email,
        });
      }
    }

    if (checkFuneralFlow) {
      const tomOk = await checkFuneralCedula('tom_', tomador.identificacion);
      if (!tomOk) return false;
      if (!sameInsured) {
        const asegOk = await checkFuneralCedula('aseg_', asegurado.identificacion);
        if (!asegOk) return false;
      }
    }
    return true;
  };

  (window as any).__validateStep2 = validate;

  const renderPersonForm = (
    person: any,
    setPerson: any,
    prefix: string,
    ciuState: any,
    opts?: { secondaryIdent?: boolean },
  ) => (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
      <Field
        anchor={`cli-${prefix}identificacion`}
        label="Cédula o documento *"
        error={errors[`${prefix}identificacion`]}
        hint={
          isRcvEmision
            ? 'Al salir del campo se buscan los datos en Sis2000'
            : checkFuneralFlow
              ? lookupLoading[prefix]
                ? 'Consultando Sis2000…'
                : 'Al completar la cédula se consulta si se puede asegurar y se cargan los datos'
              : undefined
        }
      >
        <IdentityInput
          tipoDoc={person.tipoDoc ?? 'V'}
          identificacion={person.identificacion ?? ''}
          maxLength={
            opts?.secondaryIdent
              ? SECONDARY_IDENTIFICACION_MAX_LENGTH
              : PERSON_FIELD_LIMITS.identificacion
          }
          loading={Boolean(lookupLoading[prefix])}
          onTipoDocChange={(v) => {
            lastLookupCid.current[prefix] = '';
            setPerson({ tipoDoc: v });
          }}
          onIdentificacionChange={(v) => {
            lastLookupCid.current[prefix] = '';
            lastFuneralCedula.current[prefix] = '';
            setPerson({ identificacion: clipPersonField('identificacion', v) });
          }}
          onIdentificacionBlur={
            isRcvEmision
              ? (id) => {
                  void lookupByCedula(prefix, person.tipoDoc ?? 'V', id, setPerson, person);
                }
              : checkFuneralFlow
                ? (id) => {
                    void runFuneralCedulaAuto(prefix, person.tipoDoc ?? 'V', id, setPerson, person);
                  }
                : undefined
          }
        />
      </Field>
      <div className="hidden sm:block"></div>
      <Field anchor={`cli-${prefix}nombre`} label="Nombre *" error={errors[`${prefix}nombre`]}>
        <Input
          value={person.nombre ?? ''}
          onChange={(e) => setPerson({ nombre: clipLetters(e.target.value, PERSON_FIELD_LIMITS.nombre) })}
          placeholder="Nombre"
          maxLength={PERSON_FIELD_LIMITS.nombre}
        />
      </Field>
      <Field anchor={`cli-${prefix}apellido`} label="Apellido *" error={errors[`${prefix}apellido`]}>
        <Input
          value={person.apellido ?? ''}
          onChange={(e) => setPerson({ apellido: clipLetters(e.target.value, PERSON_FIELD_LIMITS.apellido) })}
          placeholder="Apellido"
          maxLength={PERSON_FIELD_LIMITS.apellido}
        />
      </Field>
      <Field anchor={`cli-${prefix}telefono`} label="Teléfono *" error={errors[`${prefix}telefono`]} hint="11 dígitos · Digitel 0412/0422 · Movistar 0414/0424 · Movilnet 0416/0426 · fijos 02XX">
        <Input
          value={formatTelefono(person.telefono ?? '')}
          onChange={(e) => setPerson({ telefono: formatTelefono(e.target.value) })}
          placeholder="(0412) 123-4567"
          type="tel"
          inputMode="numeric"
          maxLength={PERSON_FIELD_LIMITS.telefonoDisplay}
        />
      </Field>
      <Field anchor={`cli-${prefix}email`} label="Correo electrónico *" error={errors[`${prefix}email`]}>
        <Input
          value={person.email ?? ''}
          onChange={(e) => setPerson({ email: clipPersonField('email', e.target.value) })}
          placeholder="correo@ejemplo.com"
          type="email"
          inputMode="email"
          maxLength={PERSON_FIELD_LIMITS.email}
        />
      </Field>
      <PersonLocationFields
        person={person}
        setPerson={setPerson}
        prefix={prefix}
        errors={errors}
        estados={catalogs.estados}
        ciuState={ciuState}
        catalogsLoading={catalogs.loading}
        exelixiFlow={exelixiFlow}
      />
      <Field
        anchor={`cli-${prefix}fechaNac`}
        label="Fecha de Nac. *"
        error={errors[`${prefix}fechaNac`]}
        hint={(() => {
          const edad = edadCumplida(person.fechaNac);
          if (edad == null) return undefined;
          return edad > 80
            ? `${edad} años cumplidos · el plan funerario admite hasta 80`
            : `${edad} años cumplidos`;
        })()}
      >
        <Input
          value={person.fechaNac ?? ''}
          onChange={(e) => setPerson({ fechaNac: e.target.value })}
          type="date"
          max={new Date().toISOString().split('T')[0]}
        />
      </Field>
      <Field anchor={`cli-${prefix}sexo`} label="Sexo *" error={errors[`${prefix}sexo`]}>
        <SearchSelect
          value={person.sexo}
          options={
            catalogs.sexos.length > 0
              ? catalogs.sexos.map((s) => ({ value: String(s.label), label: s.label }))
              : [
                  { value: 'Femenino',  label: 'Femenino'  },
                  { value: 'Masculino', label: 'Masculino' },
                ]
          }
          onChange={(value) => setPerson({ sexo: value })}
          placeholder="— Seleccionar —"
          loading={catalogs.loading}
        />
      </Field>
      <Field anchor={`cli-${prefix}estadoCivil`} label="Estado Civil *" error={errors[`${prefix}estadoCivil`]}>
        <SearchSelect
          value={person.estadoCivil}
          options={
            catalogs.estadosCivil.length > 0
              ? catalogs.estadosCivil.map((s) => ({ value: String(s.label), label: s.label }))
              : [
                  { value: 'Soltero(a)',     label: 'Soltero(a)'     },
                  { value: 'Casado(a)',      label: 'Casado(a)'      },
                  { value: 'Divorciado(a)',  label: 'Divorciado(a)'  },
                  { value: 'Viudo(a)',       label: 'Viudo(a)'       },
                ]
          }
          onChange={(value) => setPerson({ estadoCivil: value })}
          placeholder="— Seleccionar —"
          loading={catalogs.loading}
        />
      </Field>
      <div className="hidden sm:block"></div>
      <Field anchor={`cli-${prefix}direccion`} label="Dirección *" error={errors[`${prefix}direccion`]} full>
        <Textarea
          value={person.direccion ?? ''}
          onChange={(e) => setPerson({ direccion: clipPersonField('direccion', e.target.value) })}
          placeholder="Dirección completa"
          rows={3}
          maxLength={PERSON_FIELD_LIMITS.direccion}
        />
      </Field>
      {prefix === 'tom_' && isRcvEmision && showProfesion && (
        <Field anchor="cli-tom_profesion" label="Profesión *" error={errors.tom_profesion}>
          <SearchSelect
            value={person.cprofesion ?? ''}
            options={catalogs.profesiones.map((o) => ({ value: o.code, label: o.label }))}
            onChange={(code, label) => {
              setPerson({ cprofesion: code, xprofesion: label });
            }}
            placeholder="— Seleccionar —"
            loading={catalogs.loading}
            noOptionsText="Sin profesiones disponibles"
          />
        </Field>
      )}
      {prefix === 'tom_' && isRcvEmision && showActividad && (
        <Field label="Actividad económica *" error={errors.tom_profesion}>
          <SearchSelect
            value={person.cactividad ?? ''}
            options={catalogs.actividades.map((o) => ({ value: o.code, label: o.label }))}
            onChange={(code, label) => {
              setPerson({ cactividad: code, xactividad: label });
            }}
            placeholder="— Seleccionar (si no indicó profesión) —"
            loading={catalogs.loading}
            noOptionsText="Sin actividades disponibles"
          />
        </Field>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="space-y-5">
        {/* Tomador (Base) */}
        <SectionCard
          Icon={User}
          title="Datos de la persona que pagará la Póliza (Tomador)"
          statusLabel={isRcvEmision && diligencia ? diligenciaLabel(diligencia.itipoDiligencia).split(' ')[0] : undefined}
          statusTone={isRcvEmision && diligencia?.itipoDiligencia === 'C' ? 'warning' : 'success'}
        >
          {isRcvEmision && esPJ && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Persona jurídica: aplica <strong>diligencia completa (DDC)</strong> según circular SAA-02-1079-2026.
            </div>
          )}
          {renderPersonForm(tomador, setTomador, 'tom_', ciudadesState, {
            secondaryIdent: checkFuneralFlow,
          })}
        </SectionCard>

        {/* Declaración Legal */}
        <SectionCard
          Icon={ShieldAlert}
          title="Declaración legal"
          description="Requerida por la Superintendencia de la Actividad Aseguradora (SUDEASEG)"
        >
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800 leading-relaxed mb-4">
            <strong>¿Qué es una Persona Políticamente Expuesta (PPE)?</strong> Es aquella que desempeña o ha desempeñado
            funciones públicas prominentes en Venezuela o en el extranjero, en los últimos 5 años.
          </div>
          <ToggleSwitch
            checked={tomador.personaPoliticamenteExpuesta}
            onChange={(v) => setTomador({ personaPoliticamenteExpuesta: v })}
            label="Soy una Persona Políticamente Expuesta (PPE)"
          />
        </SectionCard>

        {/* Asegurado (Titular) */}
        <SectionCard
          Icon={FileText}
          title="Datos de la persona que será asegurada (Titular)"
        >
          <ToggleSwitch
            checked={!sameInsured}
            onChange={(v) => setSameInsured(!v)}
            label="¿La persona que pagará la Póliza es diferente a la que será asegurada?"
          />
          {!sameInsured && renderPersonForm(asegurado, setAsegurado, 'aseg_', aseguradoCiudades, { secondaryIdent: true })}
        </SectionCard>

        {checkFuneralFlow ? (
          <SectionCard
            Icon={Heart}
            title="Beneficiarios"
            description="El porcentaje de todos debe sumar 100% (como en Sis2000 pporce)."
            statusLabel={errors.funeral_benef_pct || errors.funeral_benef}
            statusTone={errors.funeral_benef_pct || errors.funeral_benef ? 'warning' : 'neutral'}
          >
            <div className="space-y-4">
              {(funeral.beneficiarios ?? []).map((ben, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.7rem] font-black uppercase tracking-wider text-fuchsia-600">
                      Beneficiario {idx + 1}
                    </span>
                    {idx > 0 && (
                      <button
                        type="button"
                        className="text-[0.7rem] font-bold text-rose-500"
                        onClick={() =>
                          setFuneral({
                            beneficiarios: funeral.beneficiarios.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field anchor={`cli-fben_${idx}_id`} label="Cédula *" error={errors[`fben_${idx}_id`]}>
                      <IdentityInput
                        tipoDoc={ben.tipoDoc || 'V'}
                        identificacion={ben.identificacion}
                        maxLength={SECONDARY_IDENTIFICACION_MAX_LENGTH}
                        onTipoDocChange={(v) => patchFuneralBeneficiario(idx, { tipoDoc: v })}
                        onIdentificacionChange={(v) =>
                          patchFuneralBeneficiario(idx, {
                            identificacion: v.slice(0, SECONDARY_IDENTIFICACION_MAX_LENGTH),
                          })
                        }
                      />
                    </Field>
                    <Field
                      anchor={`cli-fben_${idx}_pct`}
                      label="% Beneficio *"
                      error={errors[`fben_${idx}_pct`]}
                      hint="La suma de todos debe ser 100"
                    >
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={ben.pporcen ?? ''}
                        onChange={(ev) =>
                          patchFuneralBeneficiario(idx, { pporcen: Number(ev.target.value) })
                        }
                      />
                    </Field>
                    <Field anchor={`cli-fben_${idx}_nombre`} label="Nombre *" error={errors[`fben_${idx}_nombre`]}>
                      <Input
                        value={ben.nombre}
                        onChange={(ev) =>
                          patchFuneralBeneficiario(idx, {
                            nombre: clipLetters(ev.target.value, PERSON_FIELD_LIMITS.nombre),
                          })
                        }
                      />
                    </Field>
                    <Field anchor={`cli-fben_${idx}_apellido`} label="Apellido *" error={errors[`fben_${idx}_apellido`]}>
                      <Input
                        value={ben.apellido}
                        onChange={(ev) =>
                          patchFuneralBeneficiario(idx, {
                            apellido: clipLetters(ev.target.value, PERSON_FIELD_LIMITS.apellido),
                          })
                        }
                      />
                    </Field>
                    <Field anchor={`cli-fben_${idx}_fnac`} label="Fecha de Nac. *" error={errors[`fben_${idx}_fnac`]}>
                      <Input
                        type="date"
                        value={ben.fechaNac ?? ''}
                        onChange={(ev) => patchFuneralBeneficiario(idx, { fechaNac: ev.target.value })}
                      />
                    </Field>
                    <Field anchor={`cli-fben_${idx}_parentesco`} label="Parentesco *" error={errors[`fben_${idx}_parentesco`]}>
                      <SearchSelect
                        value={ben.parentesco}
                        options={parentescoOptions}
                        onChange={(value) => patchFuneralBeneficiario(idx, { parentesco: value })}
                        placeholder="— Seleccionar —"
                        loading={catalogs.loading}
                      />
                    </Field>
                    <Field anchor={`cli-fben_${idx}_tel`} label="Teléfono *" error={errors[`fben_${idx}_tel`]}>
                      <Input
                        value={formatTelefono(ben.telefono ?? '')}
                        onChange={(ev) =>
                          patchFuneralBeneficiario(idx, { telefono: formatTelefono(ev.target.value) })
                        }
                        type="tel"
                        maxLength={PERSON_FIELD_LIMITS.telefonoDisplay}
                      />
                    </Field>
                    <Field label="Sexo">
                      <SearchSelect
                        value={ben.sexo}
                        options={
                          catalogs.sexos.length
                            ? catalogs.sexos.map((s) => ({ value: String(s.label), label: s.label }))
                            : [
                                { value: 'Masculino', label: 'Masculino' },
                                { value: 'Femenino', label: 'Femenino' },
                              ]
                        }
                        onChange={(value) => patchFuneralBeneficiario(idx, { sexo: value })}
                        placeholder="— Seleccionar —"
                        loading={catalogs.loading}
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-fuchsia-200 text-fuchsia-600 text-sm font-bold"
                onClick={() =>
                  setFuneral({
                    beneficiarios: [
                      ...(funeral.beneficiarios ?? []),
                      emptyFuneralBeneficiario(0),
                    ],
                  })
                }
              >
                Agregar beneficiario
              </button>
            </div>
          </SectionCard>
        ) : (
          <SectionCard
            Icon={Heart}
            title="Datos del Beneficiario Preferencial"
          >
            <ToggleSwitch
              checked={hasBeneficiary}
              onChange={setHasBeneficiary}
              label="¿Desea agregar un beneficiario preferencial a la póliza?"
            />
            {hasBeneficiary && renderPersonForm(beneficiario, setBeneficiario, 'benef_', beneficiarioCiudades, { secondaryIdent: true })}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
