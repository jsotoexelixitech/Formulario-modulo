import { useState, useEffect } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { Field, Input } from '../../components/ui/FormField';
import { IdentityInput } from '../../components/ui/IdentityInput';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useProductConfig } from '../../hooks/useProductConfig';
import { getProductId } from '../../lib/product';
import { syncTitularFromTomador } from '../../lib/funeral-sync';
import { SectionCard } from '../emission/EmissionStep';
import type { FuneralPerson } from '../../types';
import { Users, Heart, Plus, Trash2 } from 'lucide-react';

const EMPRESA_ID = Number(import.meta.env.VITE_EMPRESA_ID ?? 1);

/** Solo letras, tildes, ñ y espacios. */
function onlyLetters(v: string): string {
  return v.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '');
}

import { formatTelefono, isValidPhonePrefix } from '../../lib/phone';
import { PERSON_FIELD_LIMITS, clipPersonField } from '../../lib/field-limits';

/** Aplica máscara visual al teléfono: (0414) 123-4567 */
function maskPhone(v: string | undefined): string {
  if (!v) return '';
  return formatTelefono(v);
}

const emailRe   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
interface PersonErrors {
  nombre?: string;
  apellido?: string;
  identificacion?: string;
  fechaNac?: string;
  sexo?: string;
  parentesco?: string;
  telefono?: string;
  email?: string;
}

/**
 * Tarjeta de una persona (asegurado o beneficiario). El titular (isTitular)
 * tiene el parentesco fijo en "Titular" y no se puede eliminar.
 */
function PersonFields({
  person,
  errors,
  isTitular,
  parentescoOptions,
  sexoOptions,
  loading,
  onChange,
}: {
  person: FuneralPerson;
  errors: PersonErrors;
  isTitular: boolean;
  parentescoOptions: { value: string; label: string }[];
  sexoOptions: { value: string; label: string }[];
  loading: boolean;
  onChange: (patch: Partial<FuneralPerson>) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Identificación *" error={errors.identificacion}>
        <IdentityInput
          tipoDoc={person.tipoDoc || 'V'}
          identificacion={person.identificacion}
          maxLength={PERSON_FIELD_LIMITS.identificacion}
          onTipoDocChange={(v) => onChange({ tipoDoc: v })}
          onIdentificacionChange={(v) =>
            onChange({ identificacion: clipPersonField('identificacion', v) })
          }
        />
      </Field>

      <Field label="Parentesco *" error={errors.parentesco}>
        {isTitular ? (
          <Input value="Titular" disabled readOnly />
        ) : (
          <SearchSelect
            value={person.parentesco}
            options={parentescoOptions}
            onChange={(value) => onChange({ parentesco: value })}
            placeholder="— Seleccionar —"
            loading={loading}
          />
        )}
      </Field>

      <Field label="Nombre *" error={errors.nombre}>
        <Input
          value={person.nombre}
          onChange={(e) =>
            onChange({
              nombre: onlyLetters(e.target.value).slice(0, PERSON_FIELD_LIMITS.nombre),
            })
          }
          placeholder="Nombre"
          autoComplete="given-name"
          maxLength={PERSON_FIELD_LIMITS.nombre}
        />
      </Field>

      <Field label="Apellido *" error={errors.apellido}>
        <Input
          value={person.apellido}
          onChange={(e) =>
            onChange({
              apellido: onlyLetters(e.target.value).slice(0, PERSON_FIELD_LIMITS.apellido),
            })
          }
          placeholder="Apellido"
          autoComplete="family-name"
          maxLength={PERSON_FIELD_LIMITS.apellido}
        />
      </Field>

      <Field label="Fecha de nacimiento *" error={errors.fechaNac}>
        <Input
          value={person.fechaNac}
          onChange={(e) => onChange({ fechaNac: e.target.value })}
          type="date"
          max={new Date().toISOString().split('T')[0]}
        />
      </Field>

      <Field label="Sexo *" error={errors.sexo}>
        <SearchSelect
          value={person.sexo}
          options={
            sexoOptions.length > 0
              ? sexoOptions
              : [
                  { value: 'Femenino', label: 'Femenino' },
                  { value: 'Masculino', label: 'Masculino' },
                ]
          }
          onChange={(value) => onChange({ sexo: value })}
          placeholder="— Seleccionar —"
          loading={loading}
        />
      </Field>

      <Field label="Teléfono (Opcional)" error={errors.telefono} hint="Ej. 04121234567">
        <Input
          value={maskPhone(person.telefono)}
          onChange={(e) => onChange({ telefono: formatTelefono(e.target.value) })}
          placeholder="(0412) 123-4567"
          type="tel"
          inputMode="numeric"
          maxLength={PERSON_FIELD_LIMITS.telefonoDisplay}
        />
      </Field>

      <Field label="Correo (Opcional)" error={errors.email}>
        <Input
          value={person.email ?? ''}
          onChange={(e) => onChange({ email: clipPersonField('email', e.target.value) })}
          placeholder="correo@ejemplo.com"
          type="email"
          inputMode="email"
          maxLength={PERSON_FIELD_LIMITS.email}
        />
      </Field>
    </div>
  );
}

export function FuneralStep() {
  const { tomador, funeral, setFuneral, differentPayer } = useWizardStore();

  const producto = getProductId();
  const { config } = useProductConfig(EMPRESA_ID, producto, 'formulario');
  const isSeccionActiva = (seccion: string) => {
    if (!config?.secciones) return true;
    if (Array.isArray(config.secciones)) {
      const found = config.secciones.find((s: any) => s.key === seccion);
      return found ? found.activo : false;
    }
    return config.secciones[seccion]?.activo ?? true;
  };

  useEffect(() => {
    if (!differentPayer) {
      syncTitularFromTomador();
    }
  }, [differentPayer, tomador.identificacion, tomador.nombre, tomador.apellido, tomador.fechaNac, tomador.sexo, tomador.telefono, tomador.email]);
  const catalogs = useCatalogs();
  const [asegErrors, setAsegErrors] = useState<PersonErrors[]>([]);
  const [benefErrors, setBenefErrors] = useState<PersonErrors[]>([]);

  const parentescoOptions =
    catalogs.parentescos.length > 0
      ? catalogs.parentescos
          // El titular (código 1) se asigna automáticamente; no se ofrece aquí.
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

  const sexoOptions = catalogs.sexos.map((s) => ({ value: String(s.label), label: s.label }));

  // ── Helpers de listas ─────────────────────────────────────────────────────
  const updateAsegurado = (idx: number, patch: Partial<FuneralPerson>) => {
    const next = funeral.asegurados.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    setFuneral({ asegurados: next });
  };
  const addAsegurado = () =>
    setFuneral({
      asegurados: [
        ...funeral.asegurados,
        { tipoDoc: 'V', identificacion: '', nombre: '', apellido: '', fechaNac: '', sexo: '', parentesco: '' },
      ],
    });
  const removeAsegurado = (idx: number) =>
    setFuneral({ asegurados: funeral.asegurados.filter((_, i) => i !== idx) });

  const updateBeneficiario = (idx: number, patch: Partial<FuneralPerson>) => {
    const next = funeral.beneficiarios.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    setFuneral({ beneficiarios: next });
  };
  const addBeneficiario = () =>
    setFuneral({
      beneficiarios: [
        ...funeral.beneficiarios,
        { tipoDoc: 'V', identificacion: '', nombre: '', apellido: '', fechaNac: '', sexo: '', parentesco: '' },
      ],
    });
  const removeBeneficiario = (idx: number) =>
    setFuneral({ beneficiarios: funeral.beneficiarios.filter((_, i) => i !== idx) });

  // Copia los datos del tomador (paso 2) al titular (primer asegurado).
  const usarDatosTomador = () => {
    syncTitularFromTomador();
  };

  // ── Validación ──────────────────────────────────────────────────────────
  const validatePerson = (p: FuneralPerson, isTitular: boolean): PersonErrors => {
    const e: PersonErrors = {};
    const req = (v?: string) => !(v ?? '').trim();
    const len = (v?: string) => (v ?? '').trim().length;
    const digs = (v?: string) => (v ?? '').replace(/\D/g, '').length;

    if (req(p.identificacion)) {
      e.identificacion = 'La identificación es obligatoria';
    } else if (digs(p.identificacion) < 1) {
      e.identificacion = 'Debe tener al menos 1 dígito';
    } else if (digs(p.identificacion) > PERSON_FIELD_LIMITS.identificacion) {
      e.identificacion = `No puede tener más de ${PERSON_FIELD_LIMITS.identificacion} dígitos`;
    }

    if (req(p.nombre)) {
      e.nombre = 'El nombre es obligatorio';
    } else if (len(p.nombre) < 2) {
      e.nombre = 'Debe tener al menos 2 caracteres';
    } else if (len(p.nombre) > PERSON_FIELD_LIMITS.nombre) {
      e.nombre = `No puede superar ${PERSON_FIELD_LIMITS.nombre} caracteres`;
    }

    if (req(p.apellido)) {
      e.apellido = 'El apellido es obligatorio';
    } else if (len(p.apellido) < 2) {
      e.apellido = 'Debe tener al menos 2 caracteres';
    } else if (len(p.apellido) > PERSON_FIELD_LIMITS.apellido) {
      e.apellido = `No puede superar ${PERSON_FIELD_LIMITS.apellido} caracteres`;
    }

    if (req(p.fechaNac)) {
      e.fechaNac = 'La fecha de nacimiento es obligatoria';
    } else if (new Date(p.fechaNac) > new Date()) {
      e.fechaNac = 'La fecha no puede ser mayor a hoy';
    }

    if (req(p.sexo)) e.sexo = 'Selecciona el sexo';
    if (!isTitular && req(p.parentesco)) e.parentesco = 'Selecciona el parentesco';

    if (p.telefono) {
      if (digs(p.telefono) !== 11) {
        e.telefono = 'El teléfono debe tener exactamente 11 dígitos (ej. 04121234567)';
      } else if (!isValidPhonePrefix(p.telefono)) {
        e.telefono = 'El prefijo debe ser válido en Venezuela (ej. 0414, 0412, 0212)';
      }
    }

    if (p.email && !emailRe.test(p.email)) {
      e.email = 'Ingresa un correo válido (ej. usuario@dominio.com)';
    } else if (p.email && len(p.email) > PERSON_FIELD_LIMITS.email) {
      e.email = `El correo no puede superar ${PERSON_FIELD_LIMITS.email} caracteres`;
    }

    return e;
  };

  const validate = (): boolean => {
    const aErr = funeral.asegurados.map((p, i) => validatePerson(p, i === 0));
    const bErr = funeral.beneficiarios.map((p) => validatePerson(p, false));

    setAsegErrors(aErr);
    setBenefErrors(bErr);

    const hasPersonError = [...aErr, ...bErr].some((e) => Object.keys(e).length > 0);
    return !hasPersonError;
  };

  (window as unknown as Record<string, unknown>).__validateStep3 = validate;

  return (
    <div className="animate-fade-in space-y-5">
      {/* Asegurados */}
      {isSeccionActiva('asegurados') && (
      <SectionCard
        Icon={Users}
        title="Personas aseguradas"
        description="El titular y las personas cubiertas por la póliza funeraria."
      >
        <div className="space-y-5">
          {funeral.asegurados.map((aseg, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[0.7rem] font-black uppercase tracking-wider text-indigo-600">
                  {idx === 0 ? 'Titular' : `Asegurado ${idx + 1}`}
                </span>
                <div className="flex items-center gap-2">
                  {idx === 0 && differentPayer && (
                    <button
                      type="button"
                      onClick={usarDatosTomador}
                      className="text-[0.7rem] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      Usar mis datos
                    </button>
                  )}
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => removeAsegurado(idx)}
                      className="inline-flex items-center gap-1 text-[0.7rem] font-bold text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 size={12} /> Quitar
                    </button>
                  )}
                </div>
              </div>
              <PersonFields
                person={aseg}
                errors={asegErrors[idx] ?? {}}
                isTitular={idx === 0}
                parentescoOptions={parentescoOptions}
                sexoOptions={sexoOptions}
                loading={catalogs.loading}
                onChange={(patch) => updateAsegurado(idx, patch)}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addAsegurado}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-bold hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
          >
            <Plus size={15} /> Agregar asegurado
          </button>
        </div>
      </SectionCard>
      )}

      {/* Beneficiarios */}
      {isSeccionActiva('beneficiario') && (
      <SectionCard
        Icon={Heart}
        title="Beneficiarios"
        description="Personas que reciben los beneficios de la póliza (opcional según el plan)."
      >
        <div className="space-y-5">
          {funeral.beneficiarios.length === 0 && (
            <p className="text-sm text-slate-500">No has agregado beneficiarios.</p>
          )}
          {funeral.beneficiarios.map((benef, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[0.7rem] font-black uppercase tracking-wider text-fuchsia-600">
                  Beneficiario {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeBeneficiario(idx)}
                  className="inline-flex items-center gap-1 text-[0.7rem] font-bold text-rose-500 hover:text-rose-600"
                >
                  <Trash2 size={12} /> Quitar
                </button>
              </div>
              <PersonFields
                person={benef}
                errors={benefErrors[idx] ?? {}}
                isTitular={false}
                parentescoOptions={parentescoOptions}
                sexoOptions={sexoOptions}
                loading={catalogs.loading}
                onChange={(patch) => updateBeneficiario(idx, patch)}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addBeneficiario}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-fuchsia-200 text-fuchsia-600 text-sm font-bold hover:border-fuchsia-400 hover:bg-fuchsia-50/50 transition-all"
          >
            <Plus size={15} /> Agregar beneficiario
          </button>
        </div>
      </SectionCard>
      )}

    </div>
  );
}
