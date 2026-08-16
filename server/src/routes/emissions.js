/**
 * /api/emissions — proxies a nest-api (server-api-sys).
 */
const express = require('express');
const { searchProprietaryViaNestApi } = require('../services/nestApiClient');

const router = express.Router();

/**
 * POST /api/emissions/propietary
 * Body: { xrif_cliente?: string, cid?: string }
 */
router.post('/propietary', async (req, res) => {
  const cid = String(req.body?.cid ?? req.body?.xrif_cliente ?? '').trim();
  if (!cid) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION',
      message: 'Debe enviar xrif_cliente o cid.',
    });
  }

  try {
    const info = await searchProprietaryViaNestApi({ cid, xrif_cliente: cid });
    if (!info) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Propietario no encontrado',
      });
    }
    return res.status(200).json({ success: true, data: info, info });
  } catch (err) {
    const status = err.status || 502;
    console.error('[emissions/propietary]', err.message);
    return res.status(status).json({
      success: false,
      code: err.code || 'UPSTREAM_ERROR',
      message: err.message || 'Error consultando propietario.',
    });
  }
});

module.exports = router;
