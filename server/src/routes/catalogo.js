/**
 * Rutas de catalogos INMA (vehiculos) — Modulo Formulario.
 *
 * Cascada: anios -> marcas (por anio) -> modelos -> versiones.
 * Ademas: categorias-uso por version y resolver para texto libre.
 */
const express = require('express');
const lamundialClient = require('../services/lamundialClient');

const router = express.Router();

/**
 * @openapi
 * /api/catalogo/anios:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Rango de años de fabricación disponibles
 *     description: Devuelve el año mínimo y máximo de vehículos registrados en el catálogo INMA de La Mundial.
 *     responses:
 *       200:
 *         description: Rango de años
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 min:     { type: integer, example: 1990 }
 *                 max:     { type: integer, example: 2025 }
 *       502:
 *         description: Error de comunicación con La Mundial
 *
 * /api/catalogo/marcas:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Marcas de vehículos disponibles para un año
 *     parameters:
 *       - in: query
 *         name: fano
 *         required: true
 *         schema: { type: integer, example: 2019 }
 *         description: Año de fabricación del vehículo
 *     responses:
 *       200:
 *         description: Lista de marcas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       cmarca: { type: integer, example: 1 }
 *                       xmarca: { type: string, example: 'TOYOTA' }
 *       400:
 *         description: Falta el parámetro fano
 *
 * /api/catalogo/modelos:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Modelos disponibles para un año y marca
 *     parameters:
 *       - in: query
 *         name: fano
 *         required: true
 *         schema: { type: integer, example: 2019 }
 *       - in: query
 *         name: cmarca
 *         required: true
 *         schema: { type: integer, example: 1 }
 *         description: Código de la marca (obtenido de /marcas)
 *     responses:
 *       200:
 *         description: Lista de modelos
 *
 * /api/catalogo/versiones:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Versiones disponibles para año, marca y modelo
 *     parameters:
 *       - in: query
 *         name: fano
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: cmarca
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: cmodelo
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de versiones con sus atributos
 *
 * /api/catalogo/categorias-uso:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Categorías de uso del vehículo
 *     parameters:
 *       - in: query
 *         name: fano
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: cmarca
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: cmodelo
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: cversion
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de categorías de uso (PARTICULAR, TAXI, TRANSPORTE PÚBLICO…)
 *
 * /api/catalogo/resolver:
 *   get:
 *     tags: [Catálogo INMA]
 *     summary: Resuelve marca y modelo a partir de texto libre (placa OCR)
 *     description: Útil para precargar campos cuando el OCR detectó marca/modelo como texto.
 *     parameters:
 *       - in: query
 *         name: fano
 *         required: true
 *         schema: { type: integer, example: 2019 }
 *       - in: query
 *         name: marca
 *         required: true
 *         schema: { type: string, example: 'TOYOTA' }
 *       - in: query
 *         name: modelo
 *         required: true
 *         schema: { type: string, example: 'COROLLA' }
 *     responses:
 *       200:
 *         description: Códigos resueltos de marca y modelo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:  { type: boolean }
 *                 cmarca:   { type: integer }
 *                 cmodelo:  { type: integer }
 *                 xmarca:   { type: string }
 *                 xmodelo:  { type: string }
 */
router.get('/anios', async (_req, res) => {
  try {
    const data = await lamundialClient.getInmaAnios();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/marcas', async (req, res) => {
  const fano = parseInt(req.query.fano, 10);
  if (!fano) return res.status(400).json({ success: false, message: 'fano requerido' });
  try {
    const data = await lamundialClient.getInmaMarcas(fano);
    res.json({ success: true, data });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/modelos', async (req, res) => {
  const fano   = parseInt(req.query.fano, 10);
  const cmarca = req.query.cmarca;
  if (!fano || !cmarca) return res.status(400).json({ success: false, message: 'fano y cmarca requeridos' });
  try {
    const data = await lamundialClient.getInmaModelos(fano, cmarca);
    res.json({ success: true, data });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/versiones', async (req, res) => {
  const fano    = parseInt(req.query.fano, 10);
  const cmarca  = req.query.cmarca;
  const cmodelo = req.query.cmodelo;
  if (!fano || !cmarca || !cmodelo) {
    return res.status(400).json({ success: false, message: 'fano, cmarca y cmodelo requeridos' });
  }
  try {
    const data = await lamundialClient.getInmaVersiones(fano, cmarca, cmodelo);
    res.json({ success: true, data });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/categorias-uso', async (req, res) => {
  const fano     = parseInt(req.query.fano, 10);
  const cmarca   = req.query.cmarca;
  const cmodelo  = req.query.cmodelo;
  const cversion = req.query.cversion;
  if (!fano || !cmarca || !cmodelo || !cversion) {
    return res.status(400).json({ success: false, message: 'fano, cmarca, cmodelo y cversion son requeridos' });
  }
  try {
    const data = await lamundialClient.getCategoriasUso({ fano, cmarca, cmodelo, cversion });
    res.json({ success: true, data });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
});

router.get('/resolver', async (req, res) => {
  const fano   = parseInt(req.query.fano, 10);
  const marca  = (req.query.marca  || '').trim();
  const modelo = (req.query.modelo || '').trim();
  if (!fano || !marca) return res.status(400).json({ success: false, message: 'fano y marca requeridos' });

  const norm = (s) =>
    String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

  try {
    const marcas = await lamundialClient.getInmaMarcas(fano);
    const normMarca = norm(marca);
    const marcaMatch = marcas.find(m => norm(m.xmarca) === normMarca)
      ?? marcas.find(m => norm(m.xmarca).includes(normMarca) || normMarca.includes(norm(m.xmarca)));

    if (!marcaMatch) {
      return res.json({ success: false, fallback: true, message: `Marca "${marca}" no encontrada` });
    }

    const modelos = await lamundialClient.getInmaModelos(fano, marcaMatch.cmarca);
    const normModelo = norm(modelo);
    const modeloMatch = modelo
      ? (modelos.find(m => norm(m.xmodelo) === normModelo)
        ?? modelos.find(m => norm(m.xmodelo).includes(normModelo) || normModelo.includes(norm(m.xmodelo))))
      : null;
    const resolvedModelo = modeloMatch ?? modelos[0];

    if (!resolvedModelo) {
      return res.json({
        success: true, fallback: true,
        cmarca: marcaMatch.cmarca, xmarca: marcaMatch.xmarca,
      });
    }

    const versiones = await lamundialClient.getInmaVersiones(fano, marcaMatch.cmarca, resolvedModelo.cmodelo);

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
    res.status(502).json({ success: false, message: err.message });
  }
});

module.exports = router;
