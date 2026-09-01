import { useWizardStore } from '../store/wizardStore';

/**
 * Copia al titular (primer asegurado) los datos ya capturados en el paso 2:
 * tomador si es la misma persona, o el asegurado si el pagador es otro.
 */
export function syncTitularFromTomador(): void {
  const { sameInsured, tomador, asegurado, funeral, setFuneral } = useWizardStore.getState();
  const src = sameInsured !== false ? tomador : asegurado;
  const titular = funeral.asegurados[0];
  if (!titular || !src) return;

  setFuneral({
    asegurados: [
      {
        ...titular,
        tipoDoc: src.tipoDoc || 'V',
        identificacion: src.identificacion,
        nombre: src.nombre,
        apellido: src.apellido,
        fechaNac: src.fechaNac ?? '',
        sexo: src.sexo ?? '',
        parentesco: '1',
        telefono: src.telefono,
        email: src.email,
      },
    ],
  });
}
