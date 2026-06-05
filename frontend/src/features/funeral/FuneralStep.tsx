import { useState, useEffect } from 'react';
import { useWizardStore } from '../../store/wizardStore';
import { Field, Input, Textarea } from '../../components/ui/FormField';
import { IdentityInput } from '../../components/ui/IdentityInput';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { useCatalogs } from '../../hooks/useCatalogs';
import { SectionCard } from '../emission/EmissionStep';
import type { FuneralPerson } from '../../types';
import { Users, Heart, ShieldAlert, CalendarClock, Plus, Trash2 } from 'lucide-react';

/** Solo letras, tildes, ñ y espacios. */
function onlyLetters(v: string): string {
  return v.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/g, '');
}

const FRECUENCIAS = [
  { value: 'M', label: 'Mensual' },
  { value: 'T', label: 'Trimestral' },
  { value: 'C', label: 'Cuatrimestral' },
  { value: 'S', label: 'Semestral' },
  { value: 'A', label: 'Anual' },
];

interface PersonErrors {
  nombre?: string;
  apellido?: string;
  identificacion?: string;
  fechaNac?: string;
  sexo?: string;
  parentesco?: string;
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
  isReadOnly,
  onChange,
}: {
  person: FuneralPerson;
  errors: PersonErrors;
  isTitular: boolean;
  parentescoOptions: { value: string; label: string }[];
  sexoOptions: { value: string; label: string }[];
  loading: boolean;
  isReadOnly?: boolean;
  onChange: (patch: Partial<FuneralPerson>) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Identificación *" error={errors.identificacion}>
        <div className={isReadOnly ? "opacity-50 pointer-events-none" : ""}>
          <IdentityInput
            tipoDoc={person.tipoDoc || 'V'}
            identificacion={person.identificacion}
            onTipoDocChange={(v) => onChange({ tipoDoc: v })}
            onIdentificacionChange={(v) => onChange({ identificacion: v })}
          />
        </div>
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
            disabled={isReadOnly}
          />
        )}
      </Field>

      <Field label="Nombre *" error={errors.nombre}>
        <Input
          value={person.nombre}
          onChange={(e) => onChange({ nombre: onlyLetters(e.target.value) })}
          placeholder="Nombre"
          disabled={isReadOnly}
        />
      </Field>

      <Field label="Apellido *" error={errors.apellido}>
        <Input
          value={person.apellido}
          onChange={(e) => onChange({ apellido: onlyLetters(e.target.value) })}
          placeholder="Apellido"
          disabled={isReadOnly}
        />
      </Field>

      <Field label="Fecha de nacimiento *" error={errors.fechaNac}>
        <Input
          value={person.fechaNac}
          onChange={(e) => onChange({ fechaNac: e.target.value })}
          type="date"
          max={new Date().toISOString().split('T')[0]}
          disabled={isReadOnly}
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
          disabled={isReadOnly}
        />
      </Field>
    </div>
  );
}

export function FuneralStep() {
  const { tomador, funeral, setFuneral, differentPayer } = useWizardStore();

  useEffect(() => {
    if (!differentPayer) {
      const current = funeral.asegurados[0] || ({} as Partial<FuneralPerson>);
      const needsSync =
        current.identificacion !== tomador.identificacion ||
        current.nombre !== tomador.nombre ||
        current.apellido !== tomador.apellido ||
        current.fechaNac !== tomador.fechaNac ||
        current.sexo !== tomador.sexo;

      if (needsSync) {
        const nextAsegurados = [...funeral.asegurados];
        nextAsegurados[0] = {
          ...nextAsegurados[0],
          tipoDoc: tomador.tipoDoc || 'V',
          identificacion: tomador.identificacion,
          nombre: tomador.nombre,
          apellido: tomador.apellido,
          fechaNac: tomador.fechaNac,
          sexo: tomador.sexo,
          parentesco: '1',
        };
        setFuneral({ asegurados: nextAsegurados });
      }
    }
  }, [differentPayer, tomador, funeral.asegurados, setFuneral]);
  const catalogs = useCatalogs();
  const [asegErrors, setAsegErrors] = useState<PersonErrors[]>([]);
  const [benefErrors, setBenefErrors] = useState<PersonErrors[]>([]);
  const [decError, setDecError] = useState<{ terminos?: string; descripcion?: string }>({});

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
    updateAsegurado(0, {
      tipoDoc: tomador.tipoDoc || 'V',
      identificacion: tomador.identificacion,
      nombre: tomador.nombre,
      apellido: tomador.apellido,
      fechaNac: tomador.fechaNac,
      sexo: tomador.sexo,
      parentesco: '1',
    });
  };

  // ── Validación ──────────────────────────────────────────────────────────
  const validatePerson = (p: FuneralPerson, isTitular: boolean): PersonErrors => {
    const e: PersonErrors = {};
    const req = (v?: string) => !(v ?? '').trim();
    const digs = (v?: string) => (v ?? '').replace(/\D/g, '').length;

    if (req(p.identificacion)) e.identificacion = 'Obligatoria';
    else if (digs(p.identificacion) < 6) e.identificacion = 'Mínimo 6 dígitos';
    else if (digs(p.identificacion) > 9) e.identificacion = 'Máximo 9 dígitos';

    if (req(p.nombre)) e.nombre = 'Obligatorio';
    if (req(p.apellido)) e.apellido = 'Obligatorio';
    if (req(p.fechaNac)) {
      e.fechaNac = 'Obligatoria';
    } else if (new Date(p.fechaNac) > new Date()) {
      e.fechaNac = 'No puede ser mayor a hoy';
    }
    if (req(p.sexo)) e.sexo = 'Selecciona';
    if (!isTitular && req(p.parentesco)) e.parentesco = 'Selecciona';

    return e;
  };

  const validate = (): boolean => {
    const aErr = funeral.asegurados.map((p, i) => validatePerson(p, i === 0));
    const bErr = funeral.beneficiarios.map((p) => validatePerson(p, false));
    const dErr: { terminos?: string; descripcion?: string } = {};

    if (!funeral.aceptaTerminos) dErr.terminos = 'Debes aceptar los términos y condiciones';
    if (funeral.diagnosticoEnfermedad && !funeral.descripcionEnfermedad.trim()) {
      dErr.descripcion = 'Describe la enfermedad diagnosticada';
    }

    setAsegErrors(aErr);
    setBenefErrors(bErr);
    setDecError(dErr);

    const hasPersonError = [...aErr, ...bErr].some((e) => Object.keys(e).length > 0);
    return !hasPersonError && Object.keys(dErr).length === 0;
  };

  (window as unknown as Record<string, unknown>).__validateStep3 = validate;

  return (
    <div className="animate-fade-in space-y-5">
      {/* Asegurados */}
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
                isReadOnly={idx === 0 && !differentPayer}
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

      {/* Beneficiarios */}
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

      {/* Frecuencia de pago */}
      <SectionCard
        Icon={CalendarClock}
        title="Frecuencia de pago"
        description="¿Cada cuánto deseas pagar la póliza?"
      >
        <Field label="Frecuencia *">
          <SearchSelect
            value={funeral.frecuencia}
            options={FRECUENCIAS}
            onChange={(value) => setFuneral({ frecuencia: value })}
            placeholder="— Seleccionar —"
          />
        </Field>
      </SectionCard>

      {/* Declaraciones */}
      <SectionCard
        Icon={ShieldAlert}
        title="Declaración de salud y términos"
        description="Requerida por La Mundial de Seguros para la emisión de la póliza."
      >
        <div className="space-y-4">
          <ToggleSwitch
            checked={funeral.diagnosticoEnfermedad}
            onChange={(v) => setFuneral({ diagnosticoEnfermedad: v })}
            label="¿Has sido diagnosticado con alguna enfermedad?"
            description="Si seleccionas sí, indícanos brevemente cuál."
          />

          {funeral.diagnosticoEnfermedad && (
            <Field label="Describe la enfermedad *" error={decError.descripcion} full>
              <Textarea
                value={funeral.descripcionEnfermedad}
                onChange={(e) => setFuneral({ descripcionEnfermedad: e.target.value })}
                placeholder="Enfermedad, tratamiento, fecha de diagnóstico…"
                rows={3}
              />
            </Field>
          )}

          <div className={decError.terminos ? 'rounded-xl ring-1 ring-rose-300 p-1' : ''}>
            <ToggleSwitch
              checked={funeral.aceptaTerminos}
              onChange={(v) => setFuneral({ aceptaTerminos: v })}
              label="Acepto los términos y condiciones"
              description="Declaro que la información suministrada es verídica y acepto las condiciones de la póliza."
            />
          </div>
          {decError.terminos && (
            <p className="text-xs text-rose-500 font-medium">{decError.terminos}</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
