/** Tope de captura del serial de carrocería en el formulario RCV. */
export const VEHICLE_SERIAL_MAX_LEN = 20;

/** Serial de motor en el formulario RCV (tope de captura). */
export const MOTOR_SERIAL_MAX_LEN = 20;

export function normalizeVehicleSerial(raw: string): string {
  return String(raw || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, VEHICLE_SERIAL_MAX_LEN);
}

export function normalizeMotorSerial(raw: string): string {
  return String(raw || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, MOTOR_SERIAL_MAX_LEN);
}

export function validateVehicleSerialMessage(serial?: string | null): string | undefined {
  const s = String(serial ?? '').trim();
  if (!s) return 'El serial del vehículo es obligatorio';
  if (s.length > VEHICLE_SERIAL_MAX_LEN) {
    return `El serial no puede superar ${VEHICLE_SERIAL_MAX_LEN} caracteres`;
  }
  return undefined;
}
