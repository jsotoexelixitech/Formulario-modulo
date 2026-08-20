/**
 * Rutas de catálogos INMA (vehículos) — Módulo Formulario.
 *
 * Fuente: nest-api (puerto 3002) — API central de Exelixi.
 *
 * Cascada: anios → marcas (por año) → modelos → versiones → categorias-uso.
 */
const express = require('express');
const {
  getInmaAnios,
  getInmaMarcas,
  getInmaModelos,
  getInmaVersiones,
  getCategoriasUso,
  getRecargosRcv,
} = require('../services/nestApiClient');
const { findMarcaInList } = require('../lib/inmaMarcaMatch');

const router = express.Router();

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
  const n = normCatalogText(modelo);
  const label = (m) => normCatalogText(m.xmodelo);

  const exact = modelos.find((m) => label(m) === n);
  if (exact) return exact;

  const isShortPrefix = /^[A-Z]{1,4}$/.test(n) && !/\d/.test(n);
  if (isShortPrefix) {
    const byPrefix = modelos.filter((m) => label(m).startsWith(n));
    if (byPrefix.length) {
      return byPrefix.reduce((best, cur) => (label(cur).length > label(best).length ? cur : best));
    }
  }

  const candidates = modelos.filter((m) => {
    const v = label(m);
    if (!v) return false;
    return v.startsWith(n) || n.startsWith(v) || v.includes(n) || n.includes(v);
  });
  if (!candidates.length) return null;
  return candidates.reduce((best, cur) => (label(cur).length > label(best).length ? cur : best));
}

function parseBinacional(req) {
  const v = req.query?.binacional ?? req.body?.binacional;
  return v === true || v === 1 || v === '1' || v === 'true';
}

router.get('/anios', async (req, res) => {
  try {
    const data = await getInmaAnios(parseBinacional(req));
    res.json({ success: true, ...data });
  } catch (err) {
    logError('anios', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/marcas', async (req, res) => {
  const fano = parseInt(req.query.fano, 10);
  if (!fano) return res.status(400).json({ success: false, message: 'fano requerido' });
  try {
    const data = await getInmaMarcas(fano, parseBinacional(req));
    res.json({ success: true, data });
  } catch (err) {
    logError('marcas', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/modelos', async (req, res) => {
  const fano = parseInt(req.query.fano, 10);
  const cmarca = req.query.cmarca;
  if (!fano || !cmarca) return res.status(400).json({ success: false, message: 'fano y cmarca requeridos' });
  try {
    const data = await getInmaModelos(fano, cmarca, parseBinacional(req));
    res.json({ success: true, data });
  } catch (err) {
    logError('modelos', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/versiones', async (req, res) => {
  const fano = parseInt(req.query.fano, 10);
  const cmarca = req.query.cmarca;
  const cmodelo = req.query.cmodelo;
  if (!fano || !cmarca || !cmodelo) {
    return res.status(400).json({ success: false, message: 'fano, cmarca y cmodelo requeridos' });
  }
  try {
    const data = await getInmaVersiones(fano, cmarca, cmodelo, parseBinacional(req));
    res.json({ success: true, data });
  } catch (err) {
    logError('versiones', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/categorias-uso', async (req, res) => {
  const fano = parseInt(req.query.fano, 10);
  const cmarca = req.query.cmarca;
  const cmodelo = req.query.cmodelo;
  const cversion = req.query.cversion;
  if (!fano || !cmarca || !cmodelo || !cversion) {
    return res.status(400).json({ success: false, message: 'fano, cmarca, cmodelo y cversion son requeridos' });
  }
  try {
    const data = await getCategoriasUso(fano, cmarca, cmodelo, cversion, parseBinacional(req));
    res.json({ success: true, data });
  } catch (err) {
    logError('categorias-uso', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/resolver', async (req, res) => {
  const fano = parseInt(req.query.fano, 10);
  const marca = (req.query.marca || '').trim();
  const modelo = (req.query.modelo || '').trim();
  if (!fano || !marca) return res.status(400).json({ success: false, message: 'fano y marca requeridos' });

  try {
    const binacional = parseBinacional(req);
    const serial = (req.query.serial || '').trim();
    const marcas = await getInmaMarcas(fano, binacional);
    const marcaMatch = findMarcaInList(marcas, marca, serial);

    if (!marcaMatch) {
      return res.json({ success: false, fallback: true, message: `Marca "${marca}" no encontrada` });
    }

    const modelos = await getInmaModelos(fano, marcaMatch.cmarca, binacional);
    const modeloMatch = modelo ? findModeloMatch(modelos, modelo) : null;
    const resolvedModelo = modeloMatch ?? modelos[0];

    if (!resolvedModelo) {
      return res.json({
        success: true,
        fallback: true,
        cmarca: marcaMatch.cmarca,
        xmarca: marcaMatch.xmarca,
      });
    }

    const versiones = await getInmaVersiones(fano, marcaMatch.cmarca, resolvedModelo.cmodelo, binacional);

    res.json({
      success: true,
      fallback: !modeloMatch,
      cmarca: marcaMatch.cmarca,
      xmarca: marcaMatch.xmarca,
      cmodelo: resolvedModelo.cmodelo,
      xmodelo: resolvedModelo.xmodelo,
      versiones,
    });
  } catch (err) {
    logError('resolver', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

/** Diagnóstico: marca OCR vs catálogo INMA general y binacional (ctarifabi). */
router.get('/marca-disponibilidad', async (req, res) => {
  const fano = parseInt(req.query.fano, 10);
  const marca = (req.query.marca || '').trim();
  const serial = (req.query.serial || '').trim();
  if (!fano || !marca) {
    return res.status(400).json({ success: false, message: 'fano y marca requeridos' });
  }

  try {
    const [marcasGeneral, marcasBinacional] = await Promise.all([
      getInmaMarcas(fano, false),
      getInmaMarcas(fano, true),
    ]);
    const matchGeneral = findMarcaInList(marcasGeneral, marca, serial);
    const matchBinacional = findMarcaInList(marcasBinacional, marca, serial);

    res.json({
      success: true,
      ocrMarca: marca,
      inGeneralCatalog: Boolean(matchGeneral),
      inBinacionalCatalog: Boolean(matchBinacional),
      xmarcaGeneral: matchGeneral?.xmarca ?? null,
      xmarcaBinacional: matchBinacional?.xmarca ?? null,
      cmarcaGeneral: matchGeneral?.cmarca ?? null,
      cmarcaBinacional: matchBinacional?.cmarca ?? null,
    });
  } catch (err) {
    logError('marca-disponibilidad', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/recargos-rcv', async (_req, res) => {
  try {
    const recargos = await getRecargosRcv(18);
    res.json({ success: true, data: recargos });
  } catch (err) {
    logError('recargos-rcv', err);
    res.status(502).json({ success: false, message: err.message });
  }
});

module.exports = router;
