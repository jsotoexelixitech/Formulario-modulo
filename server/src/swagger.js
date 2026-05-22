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
    components: {
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
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
