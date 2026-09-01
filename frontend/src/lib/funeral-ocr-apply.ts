import { useWizardStore } from '../store/wizardStore';
import { getProductId } from './product';
import type { FuneralPerson, OcrResult } from '../types';

function digits(v?: string): string {
  return String(v ?? '').replace(/\D/g, '');
}

function personFromOcr(ocr?: OcrResult | null): FuneralPerson | null {
  if (!ocr) return null;
  const identificacion = digits(ocr.identificacion);
  if (!identificacion && !ocr.nombre && !ocr.apellido) return null;
  return {
    tipoDoc: ocr.tipoDoc || 'V',
    identificacion,
    nombre: ocr.nombre ?? '',
    apellido: ocr.apellido ?? '',
    fechaNac: ocr.fechaNacimiento ?? '',
    sexo: ocr.sexo ?? '',
    parentesco: '',
  };
}

/** Precarga tomador, titular y primer beneficiario (100 %) desde el OCR funerario. */
export function applyFuneralOcrCedulas(): void {
  if (getProductId() !== 'funerario') return;
  const {
    documents,
    funeral,
    setTomador,
    setAsegurado,
    setSameInsured,
    setBeneficiario,
    setHasBeneficiary,
    setFuneral,
  } = useWizardStore.getState();

  const tom = personFromOcr(documents.cedula?.ocr);
  const tit = personFromOcr(documents.cedula_titular?.ocr);
  const ben = personFromOcr(documents.cedula_beneficiario?.ocr);

  if (tom) {
    setTomador({
      tipoDoc: tom.tipoDoc,
      identificacion: tom.identificacion,
      nombre: tom.nombre,
      apellido: tom.apellido,
      fechaNac: tom.fechaNac,
      sexo: tom.sexo,
    });
  }

  if (tit) {
    setAsegurado({
      tipoDoc: tit.tipoDoc,
      identificacion: tit.identificacion,
      nombre: tit.nombre,
      apellido: tit.apellido,
      fechaNac: tit.fechaNac,
      sexo: tit.sexo,
    });
    setSameInsured(Boolean(tom?.identificacion) && tom?.identificacion === tit.identificacion);
    const rest = funeral.asegurados.slice(1);
    setFuneral({
      asegurados: [{ ...tit, parentesco: '1' }, ...rest],
    });
  }

  if (ben) {
    setHasBeneficiary(true);
    setBeneficiario({
      tipoDoc: ben.tipoDoc,
      identificacion: ben.identificacion,
      nombre: ben.nombre,
      apellido: ben.apellido,
      fechaNac: ben.fechaNac,
      sexo: ben.sexo,
      pporcen: 100,
    });
    setFuneral({
      beneficiarios: [{ ...ben, pporcen: 100 }],
    });
  }
}
