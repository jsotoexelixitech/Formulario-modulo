import type { BuilderCatalogProduct } from './exelixi-catalog';

export const EXELIXI_OCR_HANDOFF_KEY = 'exelixi_ocr_handoff';

export type OcrDocType = 'cedula' | 'licencia' | 'certificado' | 'rif';

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
  propietario?: string;
  identificacionPropietario?: string;
  tipoDocPropietario?: string;
}

export interface ExelixiOcrHandoff {
  productId: string;
  product?: BuilderCatalogProduct;
  ocrData: Partial<Record<OcrDocType, OcrFields>>;
  savedAt: number;
}
