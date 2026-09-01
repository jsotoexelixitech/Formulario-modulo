import type { BuilderCatalogProduct } from './exelixi-catalog';
import type { DiligenciaState } from './diligencia';
import type { PersonData } from '../types';

export const EXELIXI_OCR_HANDOFF_KEY = 'exelixi_ocr_handoff';

export type OcrDocType =
  | 'cedula'
  | 'cedula_titular'
  | 'cedula_beneficiario'
  | 'licencia'
  | 'certificado'
  | 'rif'
  | 'pasaporte';

export interface OcrFields {
  nombre?: string;
  apellido?: string;
  identificacion?: string;
  tipoDoc?: string;
  placa?: string;
  marca?: string;
  modelo?: string;
  linea?: string;
  anio?: string;
  año?: string;
  serial?: string;
  serialMotor?: string;
  cilindrada?: string;
  color?: string;
  tipoCarnet?: 'nacional' | 'binacional';
  tipoPlaca?: 'nacional' | 'extranjera' | 'binacional';
  rif?: string;
  razonSocial?: string;
  fechaNacimiento?: string;
  sexo?: string;
  estadoCivil?: string;
  numeroLicencia?: string;
  propietario?: string;
  propietarioIdentificacion?: string;
  identificacionPropietario?: string;
  tipoDocPropietario?: string;
}

export interface ExelixiOcrHandoff {
  productId: string;
  product?: BuilderCatalogProduct;
  ocrData: Partial<Record<OcrDocType, OcrFields>>;
  itipoDiligencia?: 'S' | 'C';
  documentosRequeridos?: string[];
  documentHashes?: Record<string, string>;
  diligencia?: DiligenciaState | null;
  hasDriver?: boolean;
  conductor?: Partial<PersonData>;
  sameInsured?: boolean;
  asegurado?: Partial<PersonData>;
  savedAt: number;
}
