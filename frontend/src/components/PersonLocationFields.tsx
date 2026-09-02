import { Field, Input } from './ui/FormField';
import { SearchSelect } from './ui/SearchSelect';
import type { CatalogItem } from '../lib/api';
import { PERSON_FIELD_LIMITS, clipPersonField } from '../lib/field-limits';

interface PersonLike {
  cestado?: number;
  estado?: string;
  cciudad?: number;
  ciudad?: string;
}

interface CiudadesState {
  ciudades: CatalogItem[];
  loading: boolean;
}

interface PersonLocationFieldsProps {
  person: PersonLike;
  setPerson: (patch: Partial<PersonLike>) => void;
  prefix: string;
  errors: Record<string, string | undefined>;
  estados: CatalogItem[];
  ciuState: CiudadesState;
  catalogsLoading: boolean;
  /** Flujo Exélixi: estados locales + ciudad texto libre (sin valrep). */
  exelixiFlow: boolean;
}

export function PersonLocationFields({
  person,
  setPerson,
  prefix,
  errors,
  estados,
  ciuState,
  catalogsLoading,
  exelixiFlow,
}: PersonLocationFieldsProps) {
  return (
    <>
      <Field anchor={`cli-${prefix}estado`} label="Estado *" error={errors[`${prefix}estado`]}>
        <SearchSelect
          value={person.cestado}
          options={estados.map((s) => ({ value: String(s.code), label: s.label }))}
          onChange={(code, label) => {
            setPerson({
              estado: label,
              cestado: code ? Number(code) : undefined,
              ciudad: '',
              cciudad: undefined,
            });
          }}
          placeholder="Seleccione estado"
          loading={catalogsLoading}
        />
      </Field>
      <Field
        anchor={`cli-${prefix}ciudad`}
        label="Ciudad *"
        error={errors[`${prefix}ciudad`]}
        hint={
          exelixiFlow
            ? 'Nombre de la ciudad o municipio'
            : person.cestado
              ? 'Escribe para filtrar la ciudad'
              : 'Selecciona primero el estado'
        }
      >
        {exelixiFlow ? (
          <Input
            value={person.ciudad ?? ''}
            onChange={(e) =>
              setPerson({
                ciudad: clipPersonField('ciudad', e.target.value),
                cciudad: undefined,
              })
            }
            placeholder="Ej. Caracas, Valencia, Maracaibo…"
            disabled={!person.cestado}
            maxLength={PERSON_FIELD_LIMITS.ciudad}
          />
        ) : (
          <SearchSelect
            value={person.cciudad}
            options={ciuState.ciudades.map((c) => ({ value: String(c.code), label: c.label }))}
            onChange={(code, label) => {
              setPerson({
                ciudad: label,
                cciudad: code ? Number(code) : undefined,
              });
            }}
            placeholder={person.cestado ? 'Seleccione ciudad' : 'Selecciona primero el estado'}
            disabled={!person.cestado}
            loading={ciuState.loading}
          />
        )}
      </Field>
    </>
  );
}
