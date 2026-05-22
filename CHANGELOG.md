# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/) y el proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.0.0] — 2026-05-22

### Added
- Formulario multi-sección: datos del tomador, asegurado y vehículo
- Integración con catálogos de La Mundial: estados, ciudades, sexo, marcas INMA, modelos
- Búsqueda inteligente de marcas/modelos por año modelo (`fano`)
- Pre-llenado automático desde datos OCR (módulo 1)
- Validación de campos en tiempo real (cédula, teléfono, email, etc.)
- API REST proxy a La Mundial con caché de catálogos
- Health-check endpoint `GET /api/health`
- Soporte PM2 para producción y desarrollo con hot-reload
