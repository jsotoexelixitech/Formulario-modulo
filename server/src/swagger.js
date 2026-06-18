const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Exelixi · Módulo Formulario',
      version: '1.0.0',
      description: `
## Módulo Formulario — Catálogos y listas de referencia

Expone los catálogos necesarios para completar el formulario de suscripción RCV:
datos del tomador, del asegurado y del vehículo.

### Fuentes de datos
- **INMA** — Inventario Nacional de Marcas y Modelos (vehículos venezolanos)
- **La Mundial valrep** — Catálogos de valores de referencia (estados, ciudades, sexo, estado civil…)

### Integración con otros módulos
Los datos rellenados en este módulo alimentan el **Módulo Emisión** (cotización y emisión de póliza)
y el **Módulo Pagos** (datos del tomador para la transacción).

### Autenticación (OAuth 2.0)
Este módulo está protegido. Debe incluir un **Access Token** en la cabecera HTTP \`Authorization: Bearer <token>\`.
El token se obtiene intercambiando su **API Key** en el endpoint \`/api/access/token\` del servidor central (Nexus API).
      `.trim(),
      contact: {
        name: 'Exelixi / La Mundial de Seguros',
        email: 'soporte@lamundialdeseguros.com',
      },
    },
    servers: [
      { url: 'http://localhost:4002', description: 'Desarrollo local' },
    ],
    tags: [
      { name: 'Catálogo INMA',  description: 'Marcas, modelos, años y versiones de vehículos (INMA)' },
      { name: 'Catálogo Valrep', description: 'Listas de referencia de La Mundial (estados, ciudades, sexo…)' },
      { name: 'Sistema',         description: 'Estado del servicio' },
    ],
    security: [
      {
        bearerAuth: [],
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingrese su Access Token temporal (obtenido desde Nexus API vía /api/access/token)',
        },
      },
      schemas: {
        CatalogItem: {
          type: 'object',
          properties: {
            code:  { type: 'string', example: '1' },
            label: { type: 'string', example: 'TOYOTA' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            ok:    { type: 'boolean', example: false },
            error: { type: 'string', example: 'No se pudo obtener la lista de estados' },
          },
        },
      },
    },
    paths: {
      '/api/access/token': {
        post: {
          tags: ['Autenticación'],
          summary: 'Canjear API Key por Access Token',
          description: 'Obtiene un JWT temporal de 1 hora. **Nota:** Este endpoint es atendido por el servidor central (Nexus API).',
          servers: [{ url: 'http://192.168.8.120:3092' }],
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { tenantToken: { type: 'string', example: 'sk_test_123...' } }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Token generado exitosamente',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
                      expires_in: { type: 'integer', example: 3600 },
                      token_type: { type: 'string', example: 'Bearer' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
