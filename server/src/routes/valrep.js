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
 *   getLists      → Sis2000 SQL Server  (tabla macatvalores — SEXO, EDOCIVIL, PARENTESCOS, FRECUENCIAS, MATIPCANAL)
 */
const express = require('express');
const axios   = require('axios');
const { getSis2000Pool, sql } = require('../services/sis2000Pool');

const router = express.Router();

const BASE_URL = (process.env.LAMUNDIAL_BASE_URL || 'https://qaapisys2000.lamundialdeseguros.com').replace(/\/$/, '');
const TIMEOUT  = parseInt(process.env.LAMUNDIAL_TIMEOUT_MS, 10) || 15_000;

/**
 * Consulta Sis2000 para obtener la lista de un dominio.
 * Fuente: tabla macatvalores (confirmada en Sis2000 con SEXO, EDOCIVIL,
 * FRECUENCIAS, MATIPCANAL, PARENTESCOS — todas con bactivo=true).
 *
 * Estructura: macatdominios (cdominio, xnombre) + macatvalores (cdominio, cvalor, xdescripcion, iorden, bactivo)
 */
async function getListFromSis2000(domain) {
  const pool = await getSis2000Pool();
  const req  = pool.request();
  req.input('cdom', sql.NVarChar(30), domain);

  const result = await req.query(`
    SELECT TRIM(cvalor)       AS cvalor,
           TRIM(xdescripcion) AS xdescripcion
    FROM   macatvalores
    WHERE  cdominio = @cdom
      AND  bactivo  = 1
    ORDER  BY iorden, cvalor
  `);

  if (!result.recordset?.length) {
    throw new Error(`Dominio ${domain} no encontrado en macatvalores (Sis2000)`);
  }

  return result.recordset;
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
// GET /api/valrep/state — Sis2000 producción (maestados), datos limpios sin basura de QA
router.get('/state', async (_req, res) => {
  try {
    const pool   = await getSis2000Pool();
    const result = await pool.request().query(`
      SELECT cestado AS code, TRIM(xdescripcion_l) AS label
      FROM   maestados
      WHERE  cpais = 58
      ORDER  BY xdescripcion_l
    `);
    res.json({ ok: true, source: 'sis2000', items: result.recordset });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[valrep/state] sis2000 error:', msg);
    res.status(502).json({ ok: false, error: 'No se pudo obtener estados de Sis2000', detail: msg });
  }
});

// GET /api/valrep/city?cestado=<codigo> — Sis2000 producción (maciudades), datos limpios
router.get('/city', async (req, res) => {
  const cestado = req.query.cestado ?? req.query.estado ?? null;
  try {
    const pool = await getSis2000Pool();
    const req2 = pool.request();
    let query;
    if (cestado) {
      req2.input('cestado', sql.Int, parseInt(String(cestado), 10));
      query = `
        SELECT cciudad AS code, TRIM(xdescripcion_l) AS label
        FROM   maciudades
        WHERE  cestado = @cestado
        ORDER  BY xdescripcion_l
      `;
    } else {
      query = `
        SELECT cciudad AS code, TRIM(xdescripcion_l) AS label
        FROM   maciudades
        ORDER  BY xdescripcion_l
      `;
    }
    const result = await req2.query(query);
    res.json({ ok: true, source: 'sis2000', cestado: cestado ? parseInt(cestado, 10) : null, items: result.recordset });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[valrep/city] sis2000 error:', msg);
    res.status(502).json({ ok: false, error: 'No se pudo obtener ciudades de Sis2000', detail: msg });
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

// POST /api/valrep/validate-vehicle
// Validar si el vehículo está asegurado proxying a sysip-nest-api
router.post('/validate-vehicle', async (req, res) => {
  try {
    const { placa, serial } = req.body;
    
    // sysip-nest-api (localhost:3002) es la puerta de entrada a La Mundial (Sis2000 SP)
    const baseUrl = (process.env.SYSIP_API_URL || 'http://localhost:3002').replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/externalChannels/validateEmissionAuto`;
    
    const payload = {
      plan: 'RCVBAS',
      placa: placa || '',
      serial_carroceria: serial || '',
      serial_motor: serial || '',
    };

    console.log(`[valrep/validate-vehicle] calling La Mundial via sysip-nest-api: ${url}`, payload);

    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
      timeout: 10000,
    });

    const data = response.data;
    console.log('[valrep/validate-vehicle] sysip-nest-api response:', JSON.stringify(data));

    // sysip-nest-api responde: { status: false, error: '...' } cuando el vehículo ya está asegurado
    const alreadyInsured = data && (data.status === false || (data.error && data.status !== true));
    if (alreadyInsured) {
      return res.status(400).json({
        success: false,
        code: 'LAMUNDIAL_PLATE_ALREADY_INSURED',
        message: data.error || 'Este vehículo ya cuenta con una póliza vigente en La Mundial.',
      });
    }

    res.json({ success: true, message: 'Valid' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[valrep/validate-vehicle] error proxying to nest-api:`, msg);
    res.status(502).json({
      success: false,
      error: 'Error validando vehículo en API central',
      detail: msg,
    });
  }
});

module.exports = router;
