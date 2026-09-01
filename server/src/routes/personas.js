/**
 * Funerario — consulta de póliza vigente por cédula (antes de avanzar).
 */
const express = require('express');
const { checkPolizaVigentePersonas } = require('../services/nestApiClient');

const router = express.Router();

router.post('/poliza-vigente', async (req, res) => {
  const rif = String(req.body?.rif ?? req.body?.identificacion ?? '').replace(/\D/g, '');
  const cramo = req.body?.cramo != null ? Number(req.body.cramo) : 9;

  if (rif.length < 6) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_CEDULA',
      message: 'La cédula debe tener al menos 6 dígitos.',
    });
  }

  try {
    const result = await checkPolizaVigentePersonas({ rif, cramo });
    if (result.hasVigente) {
      return res.status(200).json({
        success: true,
        blocked: true,
        code: 'PERSONAS_DUPLICATE',
        cnpoliza: result.cnpoliza,
        message: 'Ya existe una póliza funeraria vigente para esta cédula.',
      });
    }
    return res.json({
      success: true,
      blocked: false,
      message: 'No hay póliza funeraria vigente para esta cédula.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[personas/poliza-vigente]', msg);
    return res.status(err.status || 502).json({
      success: false,
      code: err.code || 'PERSONAS_POLIZA_CHECK_ERROR',
      message: msg,
    });
  }
});

module.exports = router;
