/**
 * Rutas de catálogos INMA (vehículos) — Módulo Formulario.
 *
 * Fuente: sysip-nest-api (puerto 3002) que actúa como proxy centralizado a Sis2000.
 * Este módulo NO se conecta directamente a Sis2000.
 *
 * Cascada: anios → marcas (por año) → modelos → versiones → categorias-uso.
 *
 * Endpoints expuestos:
 *   GET  /api/catalogo/anios                              → sysip GET  /api/v1/inma/anios
 *   GET  /api/catalogo/marcas?fano=N                      → sysip POST /api/v1/inma/marcas
 *   GET  /api/catalogo/modelos?fano=N&cmarca=X            → sysip POST /api/v1/inma/modelo
 *   GET  /api/catalogo/versiones?fano=N&cmarca=X&cmodelo=Y → sysip POST /api/v1/inma/version
 *   GET  /api/catalogo/categorias-uso?...                 → sysip POST /api/v1/inma/categorias-uso
 *   GET  /api/catalogo/resolver?fano=N&marca=X&modelo=Y   → lógica local sobre marcas+modelos de sysip
 */
const express = require('express');
const axios   = require('axios');

const router = express.Router();

const SYSIP_BASE = (process.env.SYSIP_API_URL || 'http://localhost:3002').replace(/\/$/, '');
const TIMEOUT    = parseInt(process.env.LAMUNDIAL_TIMEOUT_MS, 10) || 15_000;

// ── Helpers ────────────────────────────────────────────────────────────────────

function logError(tag, err) {
  console.error(`[catalogo/${tag}]`, err?.response?.status, err?.message);
}

function normCatalogText(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Match de modelo INMA: evita elegir "BR" cuando el OCR trae "BR" y existe "BR200". */
function findModeloMatch(modelos, modelo) {
  if (!modelo || !modelos?.length) return null;
  const n     = normCatalogText(modelo);
  const label = (m) => normCatalogText(m.xmodelo);

  const exact = modelos.find((m) => label(m) === n);
  if (exact) return exact;

  const isShortPrefix = /^[A-Z]{1,4}$/.test(n) && !/\d/.test(n);
  if (isShortPrefix) {
    const byPrefix = modelos.filter((m) => label(m).startsWith(n));
    if (byPrefix.length) return byPrefix.reduce((best, cur) => label(cur).length > label(best).length ? cur : best);
  }

  const candidates = modelos.filter((m) => {
    const v = label(m);
    if (!v) return false;
    return v.startsWith(n) || n.startsWith(v) || v.includes(n) || n.includes(v);
  });
  if (!candidates.length) return null;
  return candidates.reduce((best, cur) => label(cur).length > label(best).length ? cur : best);
}

// ── Helpers sysip-nest-api ─────────────────────────────────────────────────────

async function fetchAnios() {
  const { data } = await axios.get(`${SYSIP_BASE}/api/v1/inma/anios`, { timeout: TIMEOUT });
  return data?.data ?? { min: 2000, max: new Date().getFullYear() + 1 };
}

async function fetchMarcas(fano) {
  const { data } = await axios.post(`${SYSIP_BASE}/api/v1/inma/marcas`, { fano }, { timeout: TIMEOUT });
  return data?.data?.marcas ?? [];
}

async function fetchModelos(fano, cmarca) {
  const { data } = await axios.post(`${SYSIP_BASE}/api/v1/inma/modelo`, { fano, cmarca }, { timeout: TIMEOUT });
  return data?.data?.info ?? [];
}

async function fetchVersiones(fano, cmarca, cmodelo) {
  const { data } = await axios.post(`${SYSIP_BASE}/api/v1/inma/version`, { fano, cmarca, cmodelo }, { timeout: TIMEOUT });
  return data?.data?.info ?? [];
}

async function fetchCategoriasUso(fano, cmarca, cmodelo, cversion) {
  const { data } = await axios.post(
    `${SYSIP_BASE}/api/v1/inma/categorias-uso`,
    { fano, cmarca, cmodelo, cversion },
    { timeout: TIMEOUT },
  );
  return data?.data?.categorias_uso ?? [];
}

// ── Rutas ──────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/catalogo/anios:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Rango de años de fabricación disponibles
 */
router.get('/anios', async (_req, res) => {
  try {
    const data = await fetchAnios();
    res.json({ success: true, ...data });
  } catch (err) {
    logError('anios', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

/**
 * @openapi
 * /api/catalogo/marcas:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Marcas de vehículos disponibles para un año
 *     parameters:
 *       - in: query
 *         name: fano
 *         required: true
 *         schema: { type: integer }
 */
router.get('/marcas', async (req, res) => {
  const fano = parseInt(req.query.fano, 10);
  if (!fano) return res.status(400).json({ success: false, message: 'fano requerido' });
  try {
    const data = await fetchMarcas(fano);
    res.json({ success: true, data });
  } catch (err) {
    logError('marcas', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

/**
 * @openapi
 * /api/catalogo/modelos:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Modelos disponibles para un año y marca
 */
router.get('/modelos', async (req, res) => {
  const fano   = parseInt(req.query.fano, 10);
  const cmarca = req.query.cmarca;
  if (!fano || !cmarca) return res.status(400).json({ success: false, message: 'fano y cmarca requeridos' });
  try {
    const data = await fetchModelos(fano, cmarca);
    res.json({ success: true, data });
  } catch (err) {
    logError('modelos', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

/**
 * @openapi
 * /api/catalogo/versiones:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Versiones disponibles para año, marca y modelo
 */
router.get('/versiones', async (req, res) => {
  const fano    = parseInt(req.query.fano, 10);
  const cmarca  = req.query.cmarca;
  const cmodelo = req.query.cmodelo;
  if (!fano || !cmarca || !cmodelo) {
    return res.status(400).json({ success: false, message: 'fano, cmarca y cmodelo requeridos' });
  }
  try {
    const data = await fetchVersiones(fano, cmarca, cmodelo);
    res.json({ success: true, data });
  } catch (err) {
    logError('versiones', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

/**
 * @openapi
 * /api/catalogo/categorias-uso:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Categorías de uso del vehículo
 */
router.get('/categorias-uso', async (req, res) => {
  const fano     = parseInt(req.query.fano, 10);
  const cmarca   = req.query.cmarca;
  const cmodelo  = req.query.cmodelo;
  const cversion = req.query.cversion;
  if (!fano || !cmarca || !cmodelo || !cversion) {
    return res.status(400).json({ success: false, message: 'fano, cmarca, cmodelo y cversion son requeridos' });
  }
  try {
    const data = await fetchCategoriasUso(fano, cmarca, cmodelo, cversion);
    res.json({ success: true, data });
  } catch (err) {
    logError('categorias-uso', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

/**
 * @openapi
 * /api/catalogo/resolver:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Resuelve marca y modelo a partir de texto libre (OCR)
 */
router.get('/resolver', async (req, res) => {
  const fano   = parseInt(req.query.fano, 10);
  const marca  = (req.query.marca  || '').trim();
  const modelo = (req.query.modelo || '').trim();
  if (!fano || !marca) return res.status(400).json({ success: false, message: 'fano y marca requeridos' });

  try {
    const marcas    = await fetchMarcas(fano);
    const normMarca = normCatalogText(marca);
    const marcaMatch =
      marcas.find(m => normCatalogText(m.xmarca) === normMarca) ??
      marcas.find(m => normCatalogText(m.xmarca).includes(normMarca) || normMarca.includes(normCatalogText(m.xmarca)));

    if (!marcaMatch) {
      return res.json({ success: false, fallback: true, message: `Marca "${marca}" no encontrada` });
    }

    const modelos     = await fetchModelos(fano, marcaMatch.cmarca);
    const modeloMatch = modelo ? findModeloMatch(modelos, modelo) : null;
    const resolvedModelo = modeloMatch ?? modelos[0];

    if (!resolvedModelo) {
      return res.json({ success: true, fallback: true, cmarca: marcaMatch.cmarca, xmarca: marcaMatch.xmarca });
    }

    const versiones = await fetchVersiones(fano, marcaMatch.cmarca, resolvedModelo.cmodelo);

    res.json({
      success: true,
      fallback: !modeloMatch,
      cmarca:  marcaMatch.cmarca,
      xmarca:  marcaMatch.xmarca,
      cmodelo: resolvedModelo.cmodelo,
      xmodelo: resolvedModelo.xmodelo,
      versiones,
    });
  } catch (err) {
    logError('resolver', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

module.exports = router;
