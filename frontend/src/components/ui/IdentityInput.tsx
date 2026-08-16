import { ChevronDown } from 'lucide-react';
import { PERSON_FIELD_LIMITS } from '../../lib/field-limits';

/**
 * Input compuesto: nacionalidad (V/E/J/P) + numero de identificacion.
 *
 * Visualmente se siente como UN solo control:
 *   - El borde y el focus ring son del contenedor, no de cada hijo.
 *   - El select queda pegado a la izquierda con un separador vertical sutil.
 *   - El input ocupa el resto del ancho.
 *
 * Conserva el mismo lenguaje visual del resto de inputs (border-slate-200,
 * rounded-xl, focus indigo).
 */

const NATIONALITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'V', label: 'V - Venezolano' },
  { value: 'E', label: 'E - Extranjero' },
  { value: 'J', label: 'J - Jurídico' },
  { value: 'P', label: 'P - Pasaporte' },
];

interface IdentityInputProps {
  tipoDoc: string;
  identificacion: string;
  onTipoDocChange: (v: string) => void;
  onIdentificacionChange: (v: string) => void;
  onIdentificacionBlur?: (identificacion: string) => void;
  placeholder?: string;
  inputId?: string;
  loading?: boolean;
  /** Máximo de caracteres del número (default: límite Sis2000 cci_rif = 13). */
  maxLength?: number;
}

export function IdentityInput({
  tipoDoc,
  identificacion,
  onTipoDocChange,
  onIdentificacionChange,
  onIdentificacionBlur,
  placeholder = 'Ej. 18456329',
  inputId,
  loading = false,
  maxLength = PERSON_FIELD_LIMITS.identificacion,
}: IdentityInputProps) {
  return (
    <div
      className={
        'group flex items-stretch w-full rounded-xl border border-slate-200 bg-white overflow-hidden transition-all duration-200 ' +
        'hover:border-slate-300 ' +
        'focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100'
      }
    >
      {/* Selector de nacionalidad */}
      <div className="relative shrink-0">
        <select
          aria-label="Tipo de documento"
          value={tipoDoc || 'V'}
          onChange={(e) => onTipoDocChange(e.target.value)}
          disabled={loading}
          className={
            'h-full appearance-none cursor-pointer bg-slate-50/70 ' +
            'pl-3.5 pr-8 py-2.5 ' +
            'text-sm font-bold text-slate-800 outline-none ' +
            'border-r border-slate-200 ' +
            'hover:bg-slate-100 transition-colors disabled:opacity-60'
          }
        >
          {NATIONALITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
      </div>

      {/* Numero de identificacion */}
      <input
        id={inputId}
        type="text"
        inputMode={['V', 'E', 'J'].includes(tipoDoc) ? 'numeric' : 'text'}
        maxLength={maxLength}
        value={identificacion}
        disabled={loading}
        onChange={(e) => {
          let val = e.target.value;
          if (['V', 'E', 'J'].includes(tipoDoc)) {
            val = val.replace(/\D/g, '');
          }
          if (val.length > maxLength) val = val.slice(0, maxLength);
          onIdentificacionChange(val);
        }}
        onBlur={(e) => onIdentificacionBlur?.(e.target.value)}
        placeholder={placeholder}
        className={
          'flex-1 min-w-0 px-3.5 py-2.5 bg-white text-sm text-slate-900 outline-none ' +
          'placeholder:text-slate-300 disabled:opacity-60'
        }
      />
      {loading && (
        <div className="flex items-center pr-3 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-500">
          Buscando…
        </div>
      )}
    </div>
  );
}

/**
 * Etiqueta legible de la nacionalidad para mostrar en summary u otros lugares
 * donde no haya espacio para el selector.
 */
export function nationalityLabel(value: string): string {
  return NATIONALITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
