/**
 * /api/valrep — Catálogos de estados, ciudades y dominios.
 *
 * Fuente única: sysip-nest-api (:3002).
 */
const express = require('express');
const axios = require('axios');
const { getValrepList, getBaseUrl, getTimeout } = require('../services/sysipClient');

const router = express.Router();

const SYSIP_BASE = getBaseUrl();
const TIMEOUT = getTimeout();

const ALLOWED = ['SEXO', 'EDOCIVIL', 'PARENTESCOS', 'FRECUENCIAS', 'MATIPCANAL'];

function logError(tag, err) {
  console.error(`[valrep/${tag}]`, err?.response?.status, err?.message);
}

router.get('/state', async (_req, res) => {
  try {
    const { data } = await axios.get(`${SYSIP_BASE}/api/v1/valrep/states`, { timeout: TIMEOUT });
    const states = data?.data?.states ?? [];
    const items = states.map((s) => ({ code: s.cestado, label: s.xdescripcion_l?.trim() }));
    res.json({ ok: true, source: 'sysip-nest-api', items });
  } catch (err) {
    logError('state', err);
    res.status(502).json({ ok: false, error: 'No se pudo obtener estados' });
  }
});

router.get('/city', async (req, res) => {
  const cestado = req.query.cestado ?? req.query.estado ?? null;
  try {
    const url = cestado
      ? `${SYSIP_BASE}/api/v1/valrep/cities?cestado=${parseInt(cestado, 10)}`
      : `${SYSIP_BASE}/api/v1/valrep/cities`;
    const { data } = await axios.get(url, { timeout: TIMEOUT });
    const cities = data?.data?.cities ?? [];
    const items = cities.map((c) => ({ code: c.cciudad, label: c.xdescripcion_l?.trim() }));
    res.json({
      ok: true,
      source: 'sysip-nest-api',
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
    const items = await getValrepList(domain);
    res.json({ ok: true, domain, source: 'sysip-nest-api', items });
  } catch (err) {
    logError(`list/${domain}`, err);
    res.status(502).json({ ok: false, error: `No se pudo obtener la lista ${domain}` });
  }
});

router.post('/validate-vehicle', async (req, res) => {
  try {
    const { placa, serial } = req.body;
    const url = `${SYSIP_BASE}/api/v1/external/validateEmissionAuto`;
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
    res.status(502).json({ success: false, error: 'Error validando vehículo en sysip-nest-api' });
  }
});

module.exports = router;
