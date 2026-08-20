/**
 * Cliente HTTP hacia nest-api — catálogos INMA y valrep (sin La Mundial externa).
 */
const axios = require('axios');
const { buildAuthHeaders } = require('./nestTokenService');

/** @returns {string} Base URL de nest-api (:3002 en srv001). */
function getBaseUrl() {
  return (
    process.env.NEST_API_URL ||
    process.env.SYSIP_API_URL ||
    'http://127.0.0.1:3002'
  ).replace(/\/$/, '');
}

function getTimeout() {
  return parseInt(process.env.LAMUNDIAL_TIMEOUT_MS, 10) || 15_000;
}

async function axiosOpts(extra = {}) {
  return {
    headers: await buildAuthHeaders(),
    timeout: getTimeout(),
    ...extra,
  };
}

function mapValidatePlateError(message) {
  const lower = String(message || '').toLowerCase();
  if (
    lower.includes('exist') ||
    lower.includes('vigente') ||
    lower.includes('póliza rel') ||
    lower.includes('poliza rel') ||
    lower.includes('serial carrocer') ||
    lower.includes('placa')
  ) {
    return 'PLATE_ALREADY_INSURED';
  }
  return 'VALIDATE_EMISSION_ERROR';
}

function extractValidateAutoResponse(body, httpStatus = 200) {
  const result = body?.result ?? {};
  const failed = httpStatus >= 400 || body?.status === false || result?.status === false;
  return {
    failed,
    message: result?.message || body?.message,
    error: result?.error || body?.error,
    code: result?.code,
  };
}

function toClientValidateCode(code, fallbackMessage) {
  const resolved = code || mapValidatePlateError(fallbackMessage);
  if (
    resolved === 'PLATE_ALREADY_INSURED' ||
    resolved === 'SERIAL_ALREADY_INSURED' ||
    resolved === 'VEHICLE_ALREADY_INSURED'
  ) {
    return 'PLATE_ALREADY_INSURED';
  }
  return resolved;
}

/** Valida placa/serial contra nest-api (speeValidateAutomovilGeneral). */
async function validateEmissionAutoViaNestApi(params) {
  const url = `${getBaseUrl()}/api/v1/external/validateEmissionAuto`;
  const plan = params.plan || process.env.LAMUNDIAL_PLAN_DEFAULT || 'RCVBAS';
  const payload = {
    plan,
    placa: String(params.placa || '').trim(),
    serial_carroceria: String(params.serial_carroceria || '').trim(),
  };

  const response = await axios.post(url, payload, await axiosOpts({ validateStatus: () => true }));

  const body = response.data ?? {};
  const parsed = extractValidateAutoResponse(body, response.status);

  if (!parsed.failed) {
    return {
      success: true,
      message: parsed.message || 'El vehículo puede asegurarse. No hay póliza vigente con esta placa ni serial.',
    };
  }

  const errorMessage = Array.isArray(parsed.error) ? parsed.error[0] : String(parsed.error || `HTTP ${response.status}`);
  const err = new Error(errorMessage);
  err.code = toClientValidateCode(parsed.code, errorMessage);
  throw err;
}

/** @returns {Promise<{ min: number, max: number }>} */
async function getInmaAnios(binacional = false) {
  const qs = binacional ? '?binacional=1' : '';
  const { data } = await axios.get(`${getBaseUrl()}/api/v1/inma/anios${qs}`, await axiosOpts());
  return data?.data ?? { min: 2000, max: new Date().getFullYear() + 1 };
}

/** @returns {Promise<Array<{ cmarca: string, xmarca: string }>>} */
async function getInmaMarcas(fano, binacional = false) {
  const { data } = await axios.post(
    `${getBaseUrl()}/api/v1/inma/marcas`,
    { fano, binacional: Boolean(binacional) || undefined },
    await axiosOpts(),
  );
  return data?.data?.marcas ?? [];
}

/** @returns {Promise<Array<{ cmodelo: string, cmarca: string, xmodelo: string }>>} */
async function getInmaModelos(fano, cmarca, binacional = false) {
  const { data } = await axios.post(
    `${getBaseUrl()}/api/v1/inma/modelo`,
    { fano, cmarca: String(cmarca).trim(), binacional: Boolean(binacional) || undefined },
    await axiosOpts(),
  );
  return data?.data?.info ?? [];
}

/** @returns {Promise<Array<{ cversion: string, xversion?: string }>>} */
async function getInmaVersiones(fano, cmarca, cmodelo, binacional = false) {
  const { data } = await axios.post(
    `${getBaseUrl()}/api/v1/inma/version`,
    {
      fano,
      cmarca: String(cmarca).trim(),
      cmodelo: String(cmodelo).trim(),
      binacional: Boolean(binacional) || undefined,
    },
    await axiosOpts(),
  );
  return data?.data?.info ?? [];
}

/** @returns {Promise<Array<{ ccategoria_uso: number, xcategoria_uso: string }>>} */
async function getCategoriasUso(fano, cmarca, cmodelo, cversion, binacional = false) {
  const { data } = await axios.post(
    `${getBaseUrl()}/api/v1/inma/categorias-uso`,
    {
      fano,
      cmarca: String(cmarca).trim(),
      cmodelo: String(cmodelo).trim(),
      cversion: String(cversion).trim(),
      binacional: Boolean(binacional) || undefined,
    },
    await axiosOpts(),
  );
  return data?.data?.categorias_uso ?? [];
}

/** Actividades asociadas / recargo RCV (masustac ramo 18). */
async function getRecargosRcv(cramo = 18) {
  const { data } = await axios.get(
    `${getBaseUrl()}/api/v1/valrep/recargosRCV`,
    await axiosOpts({ validateStatus: () => true }),
  );
  if (data?.status === false) {
    throw new Error(data?.message || 'No se pudo cargar recargos RCV');
  }
  return data?.recargos ?? data?.data?.recargos ?? [];
}

/** @returns {Promise<Array<{ cestado: number, xdescripcion_l: string }>>} */
async function getValrepStates() {
  const { data } = await axios.get(`${getBaseUrl()}/api/v1/valrep/states`, await axiosOpts());
  return data?.data?.states ?? [];
}

/** @returns {Promise<Array<{ cciudad: number, xdescripcion_l: string }>>} */
async function getValrepCities(cestado) {
  const base = `${getBaseUrl()}/api/v1/valrep/cities`;
  const url =
    cestado != null && cestado !== ''
      ? `${base}?cestado=${parseInt(String(cestado), 10)}`
      : base;
  const { data } = await axios.get(url, await axiosOpts());
  return data?.data?.cities ?? [];
}

/** @returns {Promise<Array<{ code: string, label: string }>>} */
async function getValrepList(domain) {
  const response = await axios.post(
    `${getBaseUrl()}/api/v1/valrep/getLists`,
    { cdominio: domain, xtipo_orden: 'ASC' },
    await axiosOpts({ validateStatus: () => true }),
  );
  if (response.status >= 400 || response.data?.status === false) {
    throw new Error(response.data?.message || `HTTP ${response.status} getLists/${domain}`);
  }
  const raw = response.data?.data?.listas ?? [];
  return raw
    .map((i) => ({ code: String(i.cvalor ?? ''), label: String(i.xdescripcion ?? '') }))
    .filter((it) => it.code !== '' && it.label !== '');
}

function mapValrepGetList(raw) {
  return (raw ?? [])
    .map((i) => ({ code: String(i.cvalor ?? ''), label: String(i.xdescripcion ?? '') }))
    .filter((it) => it.code !== '' && it.label !== '');
}

/** Profesiones — sp_get_ocupaciones_nexus @returns {Promise<Array<{ code: string, label: string }>>} */
async function getValrepOcupaciones() {
  const { data } = await axios.get(`${getBaseUrl()}/api/v1/valrep/ocupaciones`, await axiosOpts());
  return mapValrepGetList(data?.data?.listas);
}

/** Actividades económicas — sp_get_actividades_nexus @returns {Promise<Array<{ code: string, label: string }>>} */
async function getValrepActividades() {
  const { data } = await axios.get(`${getBaseUrl()}/api/v1/valrep/actividades`, await axiosOpts());
  return mapValrepGetList(data?.data?.listas);
}

/** @returns {Promise<Record<string, unknown>|null>} */
async function searchProprietaryViaNestApi({ cid, xrif_cliente } = {}) {
  const url = `${getBaseUrl()}/api/v1/emissions/automobile_new/propietary`;
  const payload = {
    cid: cid != null && String(cid).trim() !== '' ? String(cid).trim() : undefined,
    xrif_cliente:
      xrif_cliente != null && String(xrif_cliente).trim() !== ''
        ? String(xrif_cliente).trim()
        : undefined,
  };

  const response = await axios.post(url, payload, await axiosOpts({ validateStatus: () => true }));
  const body = response.data ?? {};

  if (response.status === 404 || body?.status === false) {
    return null;
  }
  if (response.status >= 400) {
    const err = new Error(body?.message || `HTTP ${response.status} proprietary lookup`);
    err.status = response.status;
    err.code = body?.code || 'PROPRIETARY_LOOKUP_ERROR';
    throw err;
  }

  return body?.data ?? body?.info ?? null;
}

/**
 * Valida placa vía nest-api `POST /api/v1/emissions/automobile/vehicle`
 * (`dbo.fn_validar_placa`).
 *
 * Nota SysIP: `status: true` significa placa ACTIVA (bloqueante);
 * `status: false` significa placa disponible.
 *
 * @returns {{ is_active: boolean, message?: string, status: boolean }}
 */
async function validatePlacaViaNestApi({ xplaca, placa, fdesde, type } = {}) {
  const url = `${getBaseUrl()}/api/v1/emissions/automobile/vehicle`;
  const payload = {
    xplaca: String(xplaca || placa || '').trim(),
    fdesde: String(fdesde || new Date().toISOString().slice(0, 10)),
    type: type != null ? String(type) : undefined,
  };

  const response = await axios.post(url, payload, await axiosOpts({ validateStatus: () => true }));
  const body = response.data ?? {};

  if (response.status >= 400) {
    const err = new Error(body?.message || `HTTP ${response.status} validate placa`);
    err.status = response.status;
    err.code = body?.code || 'VALIDATE_PLACA_ERROR';
    throw err;
  }

  const isActive = Boolean(body?.is_active ?? body?.status === true);
  return {
    status: Boolean(body?.status),
    is_active: isActive,
    message: body?.message,
  };
}

/**
 * Valida serial de carrocería vía nest-api `POST /api/v1/emissions/automobile/serial`
 * (`dbo.fn_validar_serialCar`).
 *
 * Nota SysIP: `status: true` significa serial ACTIVO (bloqueante);
 * `status: false` significa serial disponible.
 *
 * @returns {{ is_active: boolean, message?: string, status: boolean }}
 */
async function validateSerialViaNestApi({ xsercar, xserialcarroceria, fdesde, type } = {}) {
  const url = `${getBaseUrl()}/api/v1/emissions/automobile/serial`;
  const payload = {
    xsercar: String(xsercar || xserialcarroceria || '').trim(),
    fdesde: String(fdesde || new Date().toISOString().slice(0, 10)),
    type: type != null ? String(type) : undefined,
  };

  const response = await axios.post(url, payload, await axiosOpts({ validateStatus: () => true }));
  const body = response.data ?? {};

  if (response.status >= 400) {
    const err = new Error(body?.message || `HTTP ${response.status} validate serial`);
    err.status = response.status;
    err.code = body?.code || 'VALIDATE_SERIAL_ERROR';
    throw err;
  }

  const isActive = Boolean(body?.is_active ?? body?.status === true);
  return {
    status: Boolean(body?.status),
    is_active: isActive,
    message: body?.message,
  };
}

module.exports = {
  getBaseUrl,
  getTimeout,
  validateEmissionAutoViaNestApi,
  searchProprietaryViaNestApi,
  validatePlacaViaNestApi,
  validateSerialViaNestApi,
  getInmaAnios,
  getInmaMarcas,
  getInmaModelos,
  getInmaVersiones,
  getCategoriasUso,
  getRecargosRcv,
  getValrepStates,
  getValrepCities,
  getValrepList,
  getValrepOcupaciones,
  getValrepActividades,
};
