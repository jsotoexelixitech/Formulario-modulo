/**
 * /api/valrep — Catálogos de estados, ciudades y dominios.
 *
 * Fuente: sysip-nest-api (puerto 3002) que actúa como proxy centralizado a Sis2000.
 * Este módulo NO se conecta directamente a Sis2000.
 *
 * Endpoints expuestos:
 *   GET /api/valrep/state          → estados (→ sysip-nest-api GET /api/v1/valrep/states)
 *   GET /api/valrep/city?cestado=N → ciudades (→ sysip-nest-api GET /api/v1/valrep/cities)
 *   GET /api/valrep/list/:domain   → lista genérica (→ sysip-nest-api POST /api/v1/valrep/getLists)
 *   POST /api/valrep/validate-vehicle → validar si vehículo ya está asegurado
 */
const express = require('express');
const axios   = require('axios');

const router = express.Router();

const SYSIP_BASE = (process.env.SYSIP_API_URL || 'http://localhost:3002').replace(/\/$/, '');
const TIMEOUT    = parseInt(process.env.LAMUNDIAL_TIMEOUT_MS, 10) || 15_000;

// ── Helpers ────────────────────────────────────────────────────────────────────

function logError(tag, err) {
  console.error(`[valrep/${tag}]`, err?.response?.status, err?.message);
}

// ── GET /api/valrep/state ──────────────────────────────────────────────────────
/**
 * @openapi
 * /api/valrep/state:
 *   get:
 *     tags: [Catálogo Valrep]
 *     summary: Lista de estados de Venezuela
 *     responses:
 *       200:
 *         description: Lista de estados
 */
router.get('/state', async (_req, res) => {
  try {
    const { data } = await axios.get(`${SYSIP_BASE}/api/v1/valrep/states`, { timeout: TIMEOUT });
    // sysip-nest-api responde: { status: true, data: { states: [...] } }
    const states = data?.data?.states ?? [];
    const items  = states.map(s => ({ code: s.cestado, label: s.xdescripcion_l?.trim() }));
    res.json({ ok: true, source: 'sysip-nest-api', items });
  } catch (err) {
    logError('state', err);
    res.status(502).json({ ok: false, error: 'No se pudo obtener estados' });
  }
});

// ── GET /api/valrep/city ───────────────────────────────────────────────────────
/**
 * @openapi
 * /api/valrep/city:
 *   get:
 *     tags: [Catálogo Valrep]
 *     summary: Ciudades de un estado
 *     parameters:
 *       - in: query
 *         name: cestado
 *         required: false
 *         schema: { type: integer }
 */
router.get('/city', async (req, res) => {
  const cestado = req.query.cestado ?? req.query.estado ?? null;
  try {
    const url = cestado
      ? `${SYSIP_BASE}/api/v1/valrep/cities?cestado=${parseInt(cestado, 10)}`
      : `${SYSIP_BASE}/api/v1/valrep/cities`;

    const { data } = await axios.get(url, { timeout: TIMEOUT });
    // sysip-nest-api responde: { status: true, data: { cities: [...] } }
    const cities = data?.data?.cities ?? [];
    const items  = cities.map(c => ({ code: c.cciudad, label: c.xdescripcion_l?.trim() }));
    res.json({ ok: true, source: 'sysip-nest-api', cestado: cestado ? parseInt(cestado, 10) : null, items });
  } catch (err) {
    logError('city', err);
    res.status(502).json({ ok: false, error: 'No se pudo obtener ciudades' });
  }
});

// ── GET /api/valrep/list/:domain ───────────────────────────────────────────────
/**
 * @openapi
 * /api/valrep/list/{domain}:
 *   get:
 *     tags: [Catálogo Valrep]
 *     summary: Lista genérica por dominio
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *           enum: [SEXO, EDOCIVIL, PARENTESCOS, FRECUENCIAS, MATIPCANAL]
 */
router.get('/list/:domain', async (req, res) => {
  const domain  = (req.params.domain || '').toUpperCase();
  const ALLOWED = ['SEXO', 'EDOCIVIL', 'PARENTESCOS', 'FRECUENCIAS', 'MATIPCANAL'];
  if (!ALLOWED.includes(domain)) {
    return res.status(400).json({ ok: false, error: `Dominio no permitido: ${domain}` });
  }
  try {
    const { data } = await axios.post(
      `${SYSIP_BASE}/api/v1/valrep/getLists`,
      { cdominio: domain, xtipo_orden: 'ASC' },
      { timeout: TIMEOUT },
    );
    // sysip-nest-api responde: { status: true, data: { listas: [...] } }
    const raw   = data?.data?.listas ?? [];
    const items = raw.map(i => ({ code: String(i.cvalor ?? ''), label: String(i.xdescripcion ?? '') }))
                     .filter(it => it.code !== '' && it.label !== '');
    res.json({ ok: true, domain, source: 'sysip-nest-api', items });
  } catch (err) {
    logError(`list/${domain}`, err);
    res.status(502).json({ ok: false, error: `No se pudo obtener la lista ${domain}` });
  }
});

// ── POST /api/valrep/validate-vehicle ─────────────────────────────────────────
router.post('/validate-vehicle', async (req, res) => {
  try {
    const { placa, serial } = req.body;

    const url     = `${SYSIP_BASE}/api/v1/external/validateEmissionAuto`;
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
      let errorMessage = 'Este vehículo ya cuenta con una póliza vigente en La Mundial.';
      if (d.message) errorMessage = Array.isArray(d.message) ? d.message[0] : d.message;
      else if (d.error) errorMessage = d.error;

      return res.status(400).json({
        success: false,
        code: 'LAMUNDIAL_PLATE_ALREADY_INSURED',
        message: errorMessage,
      });
    }

    res.json({ success: true, message: 'Valid' });
  } catch (err) {
    logError('validate-vehicle', err);
    res.status(502).json({ success: false, error: 'Error validando vehículo en API central' });
  }
});

module.exports = router;
