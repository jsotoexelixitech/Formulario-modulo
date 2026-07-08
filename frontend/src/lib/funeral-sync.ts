import { useWizardStore } from '../store/wizardStore';

/**
 * Copia los datos del tomador (paso 2) al titular (primer asegurado funerario).
 * Solo aplica cuando el tomador es también el titular (`differentPayer = false`).
 */
export function syncTitularFromTomador(): void {
  const { differentPayer, tomador, funeral, setFuneral } = useWizardStore.getState();
  if (differentPayer) return;

  const titular = funeral.asegurados[0];
  if (!titular) return;

  setFuneral({
    asegurados: [
      {
        ...titular,
        tipoDoc: tomador.tipoDoc || 'V',
        identificacion: tomador.identificacion,
        nombre: tomador.nombre,
        apellido: tomador.apellido,
        fechaNac: tomador.fechaNac,
        sexo: tomador.sexo,
        parentesco: '1',
        telefono: tomador.telefono,
        email: tomador.email,
      },
      ...funeral.asegurados.slice(1),
    ],
  });
}
