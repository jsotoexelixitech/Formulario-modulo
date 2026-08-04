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
  anio?: string;
  año?: string;
  serial?: string;
  color?: string;
  rif?: string;
  razonSocial?: string;
  fechaNacimiento?: string;
  sexo?: string;
  estadoCivil?: string;
}

export interface ExelixiOcrHandoff {
  productId: string;
  product?: BuilderCatalogProduct;
  ocrData: Partial<Record<OcrDocType, OcrFields>>;
  savedAt: number;
}
