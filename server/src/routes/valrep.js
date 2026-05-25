/**
 * /api/valrep — Catálogos de La Mundial de Seguros + Sis2000.
 *
 * Endpoints expuestos:
 *   GET /api/valrep/state          → estados       (La Mundial API: POST /api/v1/valrep/state)
 *   GET /api/valrep/city?cestado=N → ciudades       (La Mundial API: POST /api/v1/valrep/city)
 *   GET /api/valrep/list/:domain   → lista genérica (Sis2000 directo — La Mundial no expone este endpoint)
 *
 * Fuentes:
 *   state / city  → LAMUNDIAL_BASE_URL  (documentado y funcional en La Mundial QA)
 *   getLists      → Sis2000 SQL Server  (maparent para PARENTESCOS, madominio para el resto)
 */
const express = require('express');
const axios   = require('axios');
const sql     = require('mssql');

const router = express.Router();

const BASE_URL = (process.env.LAMUNDIAL_BASE_URL || 'https://qaapisys2000.lamundialdeseguros.com').replace(/\/$/, '');
const TIMEOUT  = parseInt(process.env.LAMUNDIAL_TIMEOUT_MS, 10) || 15_000;

// ── Sis2000 connection (lazy pool, reutilizado entre requests) ────────────────
const sis2000Config = {
  server:   process.env.SIS2000_SERVER   || '172.30.149.67',
  database: process.env.SIS2000_DATABASE || 'Sis2000',
  user:     process.env.SIS2000_USER     || 'sa',
  password: process.env.SIS2000_PASSWORD || '',
  options: {
    encrypt:                    process.env.SIS2000_ENCRYPT               === 'true',
    trustServerCertificate:     process.env.SIS2000_TRUST_CERT             !== 'false',
    enableArithAbort:           true,
    requestTimeout:             parseInt(process.env.SIS2000_TIMEOUT, 10) || 30_000,
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
};

let _sis2000Pool = null;

async function getSis2000Pool() {
  if (_sis2000Pool) return _sis2000Pool;
  _sis2000Pool = await sql.connect(sis2000Config);
  return _sis2000Pool;
}

// ── Fallback regulatorio (solo si Sis2000 no tiene la tabla) ─────────────────
// Estos valores son estándar del mercado asegurador venezolano (SUDESEG).
const REGULATORY_FALLBACK = {
  SEXO: [
    { cvalor: 'M', xdescripcion: 'Masculino' },
    { cvalor: 'F', xdescripcion: 'Femenino' },
  ],
  EDOCIVIL: [
    { cvalor: 'S', xdescripcion: 'Soltero(a)' },
    { cvalor: 'C', xdescripcion: 'Casado(a)' },
    { cvalor: 'D', xdescripcion: 'Divorciado(a)' },
    { cvalor: 'V', xdescripcion: 'Viudo(a)' },
    { cvalor: 'U', xdescripcion: 'Unión Estable de Hecho' },
  ],
  FRECUENCIAS: [
    { cvalor: 'A', xdescripcion: 'Anual' },
    { cvalor: 'S', xdescripcion: 'Semestral' },
    { cvalor: 'T', xdescripcion: 'Trimestral' },
    { cvalor: 'M', xdescripcion: 'Mensual' },
  ],
  MATIPCANAL: [
    { cvalor: '1', xdescripcion: 'Directo' },
    { cvalor: '2', xdescripcion: 'Broker' },
    { cvalor: '3', xdescripcion: 'Banca-Seguros' },
  ],
};

/**
 * Consulta Sis2000 para obtener la lista de un dominio.
 * Orden de intentos:
 *   1. maparent (para PARENTESCOS)
 *   2. madominio (tabla estándar de dominios en Sis2000 — puede existir tras fb_dom_maintenance)
 *   3. Fallback regulatorio (SUDESEG)
 */
async function getListFromSis2000(domain) {
  const pool = await getSis2000Pool();

  // PARENTESCOS → tabla dedicada maparent
  if (domain === 'PARENTESCOS') {
    const result = await pool.request().query(`
      SELECT TRIM(cparentesco) AS cvalor, TRIM(xparentesco) AS xdescripcion
      FROM maparent
      ORDER BY cparentesco
    `);
    if (result.recordset?.length > 0) return result.recordset;
  }

  // Resto → intentar madominio (tabla que La Mundial agrega en fb_dom_maintenance)
  try {
    const req = pool.request();
    req.input('cdom', sql.NVarChar(30), domain);
    const result = await req.query(`
      SELECT TRIM(cvalor) AS cvalor, TRIM(xdescripcion) AS xdescripcion
      FROM madominio
      WHERE cdominio = @cdom
      ORDER BY cvalor
    `);
    if (result.recordset?.length > 0) return result.recordset;
  } catch {
    // madominio no existe aún → usar fallback regulatorio
  }

  // Fallback: valores estándar del mercado asegurador venezolano
  const fallback = REGULATORY_FALLBACK[domain];
  if (fallback) return fallback;

  throw new Error(`No hay fuente disponible para el dominio ${domain}`);
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (process.env.LAMUNDIAL_APIKEY) h['apikey'] = process.env.LAMUNDIAL_APIKEY;
  return h;
}

function logUpstreamError(tag, err) {
  // Loguea el detalle real para debug, sin romper el handler.
  const status = err?.response?.status;
  const body   = err?.response?.data;
  const url    = err?.config?.url;
  console.error(`[${tag}] upstream error`,
    JSON.stringify({
      message: err?.message,
      status,
      url,
      body: typeof body === 'string' ? body.slice(0, 500) : body,
    }),
  );
}

async function proxyPost(path, body = {}) {
  const { data } = await axios.post(
    `${BASE_URL}${path}`,
    body,
    { headers: authHeaders(), timeout: TIMEOUT },
  );
  return data;
}

/**
 * @openapi
 * /api/valrep/state:
 *   get:
 *     tags: [Catálogo Valrep]
 *     summary: Lista de estados de Venezuela
 *     responses:
 *       200:
 *         description: Lista de estados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:    { type: boolean, example: true }
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/CatalogItem' }
 *       502:
 *         description: Error de comunicación con La Mundial
 *
 * /api/valrep/city:
 *   get:
 *     tags: [Catálogo Valrep]
 *     summary: Ciudades de un estado
 *     parameters:
 *       - in: query
 *         name: cestado
 *         required: true
 *         schema: { type: integer, example: 1 }
 *         description: Código del estado (obtenido de /valrep/state)
 *     responses:
 *       200:
 *         description: Lista de ciudades del estado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:      { type: boolean }
 *                 cestado: { type: integer }
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/CatalogItem' }
 *
 * /api/valrep/list/{domain}:
 *   get:
 *     tags: [Catálogo Valrep]
 *     summary: Lista genérica por dominio
 *     description: |
 *       Devuelve una lista de valores para el dominio indicado.
 *
 *       Dominios disponibles: `SEXO`, `EDOCIVIL`, `PARENTESCOS`, `FRECUENCIAS`, `MATIPCANAL`
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *           enum: [SEXO, EDOCIVIL, PARENTESCOS, FRECUENCIAS, MATIPCANAL]
 *         example: SEXO
 *     responses:
 *       200:
 *         description: Lista de ítems del dominio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:     { type: boolean }
 *                 domain: { type: string, example: 'SEXO' }
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/CatalogItem' }
 *       400:
 *         description: Dominio no permitido
 */
router.get('/state', async (_req, res) => {
  try {
    const data = await proxyPost('/api/v1/valrep/state');
    const items = data?.data?.state ?? [];
    res.json({
      ok: true,
      items: items.map((s) => ({ code: s.cestado, label: s.xdescripcion_l })),
    });
  } catch (err) {
    logUpstreamError('valrep/state', err);
    res.status(502).json({
      ok: false,
      error: 'No se pudo obtener la lista de estados',
      detail: err?.response?.data || err?.message,
    });
  }
});

// GET /api/valrep/city?cestado=<codigo>
router.get('/city', async (req, res) => {
  const cestadoRaw = req.query.cestado ?? req.query.estado ?? '';
  const cestado    = cestadoRaw ? parseInt(String(cestadoRaw), 10) : null;
  try {
    const body = cestado ? { cestado } : {};
    const data = await proxyPost('/api/v1/valrep/city', body);
    const items = data?.data?.city ?? data?.data?.state ?? [];
    res.json({
      ok: true,
      cestado: cestado ?? null,
      items: items.map((c) => ({ code: c.cciudad, label: c.xdescripcion_l })),
    });
  } catch (err) {
    logUpstreamError('valrep/city', err);
    res.status(502).json({
      ok: false,
      error: 'No se pudo obtener la lista de ciudades',
      detail: err?.response?.data || err?.message,
    });
  }
});

// GET /api/valrep/list/:domain
// Fuente: Sis2000 (172.30.149.67) — La Mundial no expone este endpoint externamente.
router.get('/list/:domain', async (req, res) => {
  const domain = (req.params.domain || '').toUpperCase();
  const ALLOWED = ['SEXO', 'EDOCIVIL', 'PARENTESCOS', 'FRECUENCIAS', 'MATIPCANAL'];
  if (!ALLOWED.includes(domain)) {
    return res.status(400).json({ ok: false, error: `Dominio no permitido: ${domain}` });
  }

  try {
    const raw = await getListFromSis2000(domain);
    const items = (Array.isArray(raw) ? raw : [])
      .map((i) => ({ code: String(i.cvalor ?? ''), label: String(i.xdescripcion ?? '') }))
      .filter((it) => it.code !== '' && it.label !== '');
    res.json({ ok: true, domain, source: 'sis2000', items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[valrep/list/${domain}] sis2000 error:`, msg);
    res.status(502).json({
      ok: false,
      error: `No se pudo obtener la lista ${domain} de Sis2000`,
      detail: msg,
    });
  }
});

module.exports = router;
