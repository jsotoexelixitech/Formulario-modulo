/**
 * /api/emissions — proxies a nest-api (server-api-sys).
 */
const express = require('express');
const {
  searchProprietaryViaNestApi,
  validatePlacaViaNestApi,
  validateSerialViaNestApi,
} = require('../services/nestApiClient');

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

/**
 * POST /api/emissions/vehicle
 * Body: { xplaca|placa, fdesde?, type? }
 * Proxy a nest-api automobile/vehicle (fn_validar_placa).
 */
router.post('/vehicle', async (req, res) => {
  const xplaca = String(req.body?.xplaca ?? req.body?.placa ?? '').trim();
  if (!xplaca) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION',
      message: 'Debe enviar xplaca o placa.',
    });
  }

  const fdesde =
    String(req.body?.fdesde ?? '').trim() || new Date().toISOString().slice(0, 10);
  const type = req.body?.type != null ? String(req.body.type) : 'warning';

  try {
    const result = await validatePlacaViaNestApi({ xplaca, fdesde, type });
    return res.status(200).json({
      success: !result.is_active,
      blocked: result.is_active,
      is_active: result.is_active,
      status: result.status,
      message: result.message,
    });
  } catch (err) {
    const status = err.status || 502;
    console.error('[emissions/vehicle]', err.message);
    return res.status(status).json({
      success: false,
      code: err.code || 'UPSTREAM_ERROR',
      message: err.message || 'Error validando placa.',
    });
  }
});

/**
 * POST /api/emissions/serial
 * Body: { xsercar|xserialcarroceria, fdesde?, type? }
 * Proxy a nest-api automobile/serial (fn_validar_serialCar).
 */
router.post('/serial', async (req, res) => {
  const xsercar = String(req.body?.xsercar ?? req.body?.xserialcarroceria ?? '').trim();
  if (!xsercar) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION',
      message: 'Debe enviar xsercar o xserialcarroceria.',
    });
  }

  const fdesde =
    String(req.body?.fdesde ?? '').trim() || new Date().toISOString().slice(0, 10);
  const type = req.body?.type != null ? String(req.body.type) : 'warning';

  try {
    const result = await validateSerialViaNestApi({ xsercar, fdesde, type });
    return res.status(200).json({
      success: !result.is_active,
      blocked: result.is_active,
      is_active: result.is_active,
      status: result.status,
      message: result.message,
    });
  } catch (err) {
    const status = err.status || 502;
    console.error('[emissions/serial]', err.message);
    return res.status(status).json({
      success: false,
      code: err.code || 'UPSTREAM_ERROR',
      message: err.message || 'Error validando serial de carrocería.',
    });
  }
});

module.exports = router;
