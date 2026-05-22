/**
 * Exelixi · Modulo Formulario
 *
 * Backend Express minimalista. Solo expone los endpoints relacionados
 * con catalogos (INMA y valrep La Mundial) usados por los formularios
 * de Tomador y Vehiculo.
 *
 * Endpoints:
 *   GET /api/health
 *   GET /api/catalogo/anios | /marcas | /modelos | /versiones | /categorias-uso | /resolver
 *   GET /api/valrep/state | /city | /list/:domain
 */
require('dotenv').config();
const cors = require('cors');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const catalogoRoutes = require('./routes/catalogo');
const valrepRoutes   = require('./routes/valrep');
const nexusAuth      = require('./middleware/nexusAuth');

const app = express();

const PORT = parseInt(process.env.PORT, 10) || 4002;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim());

app.use(cors({
  origin: CORS_ORIGINS.includes('*') ? true : CORS_ORIGINS,
  credentials: true,
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

// ── Swagger UI ────────────────────────────────────────────────────────────
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Formulario API · Exelixi',
  swaggerOptions: { persistAuthorization: true },
}));
app.get('/docs.json', (_req, res) => res.json(swaggerSpec));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    module: 'formulario',
    upstream: process.env.LAMUNDIAL_BASE_URL || 'no configurado',
    nexusAuth: process.env.NEXUS_AUTH_ENABLED === 'true',
  });
});

// Multi-tenant: las rutas de datos requieren nexus_token
app.use('/api/catalogo', nexusAuth, catalogoRoutes);
app.use('/api/valrep',   nexusAuth, valrepRoutes);

app.use((err, _req, res, _next) => {
  console.error('[modulo-formulario] error:', err);
  res.status(err.status || 500).json({
    success: false, code: err.code || 'INTERNAL', message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`[modulo-formulario] escuchando en http://localhost:${PORT}`);
  console.log(`[modulo-formulario] LAMUNDIAL_BASE_URL=${process.env.LAMUNDIAL_BASE_URL || '(no set)'}`);
  console.log(`[modulo-formulario] Swagger UI → http://localhost:${PORT}/docs`);
});
