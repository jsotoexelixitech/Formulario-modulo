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
async function getInmaAnios() {
  const { data } = await axios.get(`${getBaseUrl()}/api/v1/inma/anios`, await axiosOpts());
  return data?.data ?? { min: 2000, max: new Date().getFullYear() + 1 };
}

/** @returns {Promise<Array<{ cmarca: string, xmarca: string }>>} */
async function getInmaMarcas(fano) {
  const { data } = await axios.post(
    `${getBaseUrl()}/api/v1/inma/marcas`,
    { fano },
    await axiosOpts(),
  );
  return data?.data?.marcas ?? [];
}

/** @returns {Promise<Array<{ cmodelo: string, cmarca: string, xmodelo: string }>>} */
async function getInmaModelos(fano, cmarca) {
  const { data } = await axios.post(
    `${getBaseUrl()}/api/v1/inma/modelo`,
    { fano, cmarca: String(cmarca).trim() },
    await axiosOpts(),
  );
  return data?.data?.info ?? [];
}

/** @returns {Promise<Array<{ cversion: string, xversion?: string }>>} */
async function getInmaVersiones(fano, cmarca, cmodelo) {
  const { data } = await axios.post(
    `${getBaseUrl()}/api/v1/inma/version`,
    { fano, cmarca: String(cmarca).trim(), cmodelo: String(cmodelo).trim() },
    await axiosOpts(),
  );
  return data?.data?.info ?? [];
}

/** @returns {Promise<Array<{ ccategoria_uso: number, xcategoria_uso: string }>>} */
async function getCategoriasUso(fano, cmarca, cmodelo, cversion) {
  const { data } = await axios.post(
    `${getBaseUrl()}/api/v1/inma/categorias-uso`,
    {
      fano,
      cmarca: String(cmarca).trim(),
      cmodelo: String(cmodelo).trim(),
      cversion: String(cversion).trim(),
    },
    await axiosOpts(),
  );
  return data?.data?.categorias_uso ?? [];
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

module.exports = {
  getBaseUrl,
  getTimeout,
  validateEmissionAutoViaNestApi,
  getInmaAnios,
  getInmaMarcas,
  getInmaModelos,
  getInmaVersiones,
  getCategoriasUso,
  getValrepList,
};
