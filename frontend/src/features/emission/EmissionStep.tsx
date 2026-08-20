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
import { getProductId, isRcvLaMundialFlow } from '../../lib/product';
import {
  diligenciaLabel,
  isPersonaJuridica,
  preClasificarDiligencia,
} from '../../lib/diligencia';
import { searchProprietary } from '../../lib/api';
import {
  buildProprietaryCid,
  mapProprietaryToPerson,
  type PersonFormPatch,
  type ProprietaryInfo,
} from '../../lib/map-proprietary';
import { toast } from '../../store/toastStore';
import { User, Heart, ShieldAlert, FileText } from 'lucide-react';
import { formatTelefono, isValidPhonePrefix } from '../../lib/phone';
import { PERSON_FIELD_LIMITS, clipPersonField } from '../../lib/field-limits';

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

  const lookupByCedula = useCallback(
    async (
      prefix: string,
      tipoDoc: string,
      identificacion: string,
      setPerson: (patch: PersonFormPatch) => void,
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
        // Conservar el número que acaba de escribir el usuario si el API no trae cci_rif
        if (!patch.identificacion) patch.identificacion = digits;

        setPerson(patch);
        lastLookupCid.current[prefix] = matchedCid;
        toast.success('Datos cargados', 'Se completó el formulario con la información del cliente.', 2800);
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

  const validate = () => {
    const e: ValidationErrors = {};
    const req  = (v?: string) => !(v ?? '').trim();
    const len  = (v?: string) => (v ?? '').trim().length;
    const digs = (v?: string) => (v ?? '').replace(/\D/g, '').length;

    const validatePerson = (person: any, prefix: string) => {
      if (req(person.identificacion)) {
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

    validatePerson(tomador, 'tom_');
    if (isRcvEmision && !esPJ) {
      const hasProf = Boolean(tomador.cprofesion || tomador.xprofesion);
      const hasAct = Boolean(tomador.cactividad || tomador.xactividad);
      if (!hasProf && !hasAct) {
        e.tom_profesion = 'Indique profesión o actividad económica';
      }
    }
    if (!sameInsured) validatePerson(asegurado, 'aseg_');
    if (hasBeneficiary) validatePerson(beneficiario, 'benef_');

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  (window as any).__validateStep2 = validate;

  const renderPersonForm = (person: any, setPerson: any, prefix: string, ciuState: any) => (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
      <Field
        label="Cédula o documento *"
        error={errors[`${prefix}identificacion`]}
        hint={isRcvEmision ? 'Al salir del campo se buscan los datos en Sis2000' : undefined}
      >
        <IdentityInput
          tipoDoc={person.tipoDoc ?? 'V'}
          identificacion={person.identificacion ?? ''}
          maxLength={PERSON_FIELD_LIMITS.identificacion}
          loading={Boolean(lookupLoading[prefix])}
          onTipoDocChange={(v) => {
            lastLookupCid.current[prefix] = '';
            setPerson({ tipoDoc: v });
          }}
          onIdentificacionChange={(v) => {
            lastLookupCid.current[prefix] = '';
            setPerson({ identificacion: clipPersonField('identificacion', v) });
          }}
          onIdentificacionBlur={
            isRcvEmision
              ? (id) => {
                  void lookupByCedula(prefix, person.tipoDoc ?? 'V', id, setPerson);
                }
              : undefined
          }
        />
      </Field>
      <div className="hidden sm:block"></div>
      <Field label="Nombre *" error={errors[`${prefix}nombre`]}>
        <Input
          value={person.nombre ?? ''}
          onChange={(e) => setPerson({ nombre: clipLetters(e.target.value, PERSON_FIELD_LIMITS.nombre) })}
          placeholder="Nombre"
          maxLength={PERSON_FIELD_LIMITS.nombre}
        />
      </Field>
      <Field label="Apellido *" error={errors[`${prefix}apellido`]}>
        <Input
          value={person.apellido ?? ''}
          onChange={(e) => setPerson({ apellido: clipLetters(e.target.value, PERSON_FIELD_LIMITS.apellido) })}
          placeholder="Apellido"
          maxLength={PERSON_FIELD_LIMITS.apellido}
        />
      </Field>
      <Field label="Teléfono *" error={errors[`${prefix}telefono`]} hint="11 dígitos · Digitel 0412/0422 · Movistar 0414/0424 · Movilnet 0416/0426 · fijos 02XX">
        <Input
          value={formatTelefono(person.telefono ?? '')}
          onChange={(e) => setPerson({ telefono: formatTelefono(e.target.value) })}
          placeholder="(0412) 123-4567"
          type="tel"
          inputMode="numeric"
          maxLength={PERSON_FIELD_LIMITS.telefonoDisplay}
        />
      </Field>
      <Field label="Correo electrónico *" error={errors[`${prefix}email`]}>
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
      <Field label="Fecha de Nac. *" error={errors[`${prefix}fechaNac`]}>
        <Input
          value={person.fechaNac ?? ''}
          onChange={(e) => setPerson({ fechaNac: e.target.value })}
          type="date"
          max={new Date().toISOString().split('T')[0]}
        />
      </Field>
      <Field label="Sexo *" error={errors[`${prefix}sexo`]}>
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
      <Field label="Estado Civil *" error={errors[`${prefix}estadoCivil`]}>
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
      <Field label="Dirección *" error={errors[`${prefix}direccion`]} full>
        <Textarea
          value={person.direccion ?? ''}
          onChange={(e) => setPerson({ direccion: clipPersonField('direccion', e.target.value) })}
          placeholder="Dirección completa"
          rows={3}
          maxLength={PERSON_FIELD_LIMITS.direccion}
        />
      </Field>
      {prefix === 'tom_' && isRcvEmision && showProfesion && (
        <Field label="Profesión" error={errors.tom_profesion}>
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
        <Field label="Actividad económica" error={errors.tom_profesion}>
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
          {renderPersonForm(tomador, setTomador, 'tom_', ciudadesState)}
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
          {!sameInsured && renderPersonForm(asegurado, setAsegurado, 'aseg_', aseguradoCiudades)}
        </SectionCard>

        {/* Beneficiario */}
        <SectionCard
          Icon={Heart}
          title="Datos del Beneficiario Preferencial"
        >
          <ToggleSwitch
            checked={hasBeneficiary}
            onChange={setHasBeneficiary}
            label="¿Desea agregar un beneficiario preferencial a la póliza?"
          />
          {hasBeneficiary && renderPersonForm(beneficiario, setBeneficiario, 'benef_', beneficiarioCiudades)}
        </SectionCard>
      </div>
    </div>
  );
}
