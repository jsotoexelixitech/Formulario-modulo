/**
 * /api/valrep — Catálogos de estados, ciudades y dominios.
 *
 * Fuente única: nest-api (:3002).
 */
const express = require('express');
const axios = require('axios');
const { getValrepList, getBaseUrl, getTimeout } = require('../services/nestApiClient');

const router = express.Router();

const NEST_API_BASE = getBaseUrl();
const TIMEOUT = getTimeout();

const ALLOWED = ['SEXO', 'EDOCIVIL', 'PARENTESCOS', 'FRECUENCIAS', 'MATIPCANAL'];

const LIST_FALLBACKS = {
  SEXO: [
    { code: 'M', label: 'Masculino' },
    { code: 'F', label: 'Femenino' },
  ],
  EDOCIVIL: [
    { code: 'S', label: 'Soltero(a)' },
    { code: 'C', label: 'Casado(a)' },
    { code: 'D', label: 'Divorciado(a)' },
    { code: 'V', label: 'Viudo(a)' },
  ],
  PARENTESCOS: [
    { code: 'T', label: 'TITULAR' },
    { code: 'C', label: 'CONYUGE' },
    { code: 'H', label: 'HIJO(A)' },
  ],
};

function normalizeItems(rows) {
  return (rows ?? [])
    .map((s) => ({
      code: s.code ?? s.cestado ?? s.cciudad,
      label: String(s.label ?? s.xdescripcion_l ?? '').trim(),
    }))
    .filter((it) => it.code != null && it.code !== '' && it.label !== '');
}

function logError(tag, err) {
  console.error(`[valrep/${tag}]`, err?.response?.status, err?.message);
}

router.get('/state', async (_req, res) => {
  try {
    const { data } = await axios.get(`${NEST_API_BASE}/api/v1/valrep/states`, { timeout: TIMEOUT });
    const states = data?.data?.states ?? [];
    const items = normalizeItems(states.map((s) => ({ code: s.cestado, label: s.xdescripcion_l })));
    if (!items.length) {
      console.warn('[valrep/state] nest-api devolvió 0 estados — verificar NEST_API_URL y BD maestados');
    }
    res.json({ ok: true, source: 'nest-api', items });
  } catch (err) {
    logError('state', err);
    res.status(502).json({ ok: false, error: 'No se pudo obtener estados' });
  }
});

router.get('/city', async (req, res) => {
  const cestado = req.query.cestado ?? req.query.estado ?? null;
  try {
    const url = cestado
      ? `${NEST_API_BASE}/api/v1/valrep/cities?cestado=${parseInt(cestado, 10)}`
      : `${NEST_API_BASE}/api/v1/valrep/cities`;
    const { data } = await axios.get(url, { timeout: TIMEOUT });
    const cities = data?.data?.cities ?? [];
    const items = normalizeItems(cities.map((c) => ({ code: c.cciudad, label: c.xdescripcion_l })));
    res.json({
      ok: true,
      source: 'nest-api',
      cestado: cestado ? parseInt(cestado, 10) : null,
      items,
    });
  } catch (err) {
    logError('city', err);
    res.status(502).json({ ok: false, error: 'No se pudo obtener ciudades' });
  }
});

router.get('/list/:domain', async (req, res) => {
  const domain = (req.params.domain || '').toUpperCase();
  if (!ALLOWED.includes(domain)) {
    return res.status(400).json({ ok: false, error: `Dominio no permitido: ${domain}` });
  }

  try {
    let items = await getValrepList(domain);
    if (!items.length && LIST_FALLBACKS[domain]) {
      console.warn(`[valrep/list/${domain}] nest-api vacío — usando fallback local`);
      items = LIST_FALLBACKS[domain];
    }
    res.json({ ok: true, domain, source: 'nest-api', items });
  } catch (err) {
    logError(`list/${domain}`, err);
    if (LIST_FALLBACKS[domain]) {
      return res.json({ ok: true, domain, source: 'fallback', items: LIST_FALLBACKS[domain] });
    }
    res.status(502).json({ ok: false, error: `No se pudo obtener la lista ${domain}` });
  }
});

router.post('/validate-vehicle', async (req, res) => {
  try {
    const { placa, serial } = req.body;
    const url = `${NEST_API_BASE}/api/v1/external/validateEmissionAuto`;
    const payload = {
      plan: 'RCVBAS',
      placa: placa || '',
      serial_carroceria: serial || '',
      serial_motor: serial || '',
    };

    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
      timeout: 10_000,
    });

    const d = response.data;
    const failed = d && (d.status === false || (d.error && d.status !== true));
    if (failed) {
      let errorMessage = 'Este vehículo ya cuenta con una póliza vigente.';
      if (d.message) errorMessage = Array.isArray(d.message) ? d.message[0] : d.message;
      else if (d.error) errorMessage = d.error;

      return res.status(400).json({
        success: false,
        code: 'PLATE_ALREADY_INSURED',
        message: errorMessage,
      });
    }

    res.json({ success: true, message: 'Valid' });
  } catch (err) {
    logError('validate-vehicle', err);
    res.status(502).json({ success: false, error: 'Error validando vehículo en nest-api' });
  }
});

module.exports = router;
