# 📋 Módulo Formulario — Exelixi Platform

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![PM2](https://img.shields.io/badge/PM2-ready-2B037A?style=flat-square)

**Pasos 2 y 3 del flujo RCV · Formulario de datos + catálogos La Mundial**

[Documentación de la API](#-api-reference) · [Despliegue](#-despliegue) · [Contribuir](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

</div>

---

## 📋 Descripción

El módulo Formulario gestiona la **captura y validación** de los datos del tomador, asegurado y vehículo. Consume los catálogos oficiales de La Mundial de Seguros (estados, ciudades, sexo, marcas y modelos INMA) y pre-pobla los campos con los datos extraídos por el módulo OCR.

### Características principales

- ✅ Formulario multi-sección (tomador, asegurado, vehículo)
- ✅ Catálogos en tiempo real desde La Mundial de Seguros
- ✅ Búsqueda inteligente de marcas y modelos INMA
- ✅ Validación de campo en tiempo real
- ✅ Pre-llenado automático desde OCR (módulo 1)
- ✅ API REST documentada con Swagger/OpenAPI
- ✅ Gestión de procesos con PM2

---

## 🏗️ Arquitectura

```
modulo-formulario/
├── frontend/                  # React 18 + Vite 5 + TailwindCSS
│   ├── src/
│   │   ├── features/          # Secciones del formulario
│   │   ├── hooks/             # useCatalogs, useCiudades, etc.
│   │   └── ...
│   └── dist/                  # Build compilado (generado)
├── server/                    # Node.js 20 + Express
│   ├── src/
│   │   ├── routes/            # /api/valrep, /api/catalogo
│   │   ├── services/          # Proxy a La Mundial
│   │   └── ...
│   ├── .env.example
│   └── ...
├── logs/
├── ecosystem.config.js
├── ecosystem.dev.config.js
└── package.json
```

| Componente | Puerto | Proceso PM2  |
|:-----------|:------:|:------------:|
| Backend API | `4002` | `form-api`  |
| Frontend    | `5182` | `form-web`  |
| Swagger UI  | `4002/docs` | — |

---

## 🚀 Inicio rápido

### Prerrequisitos

| Herramienta | Versión mínima |
|:------------|:--------------:|
| Node.js     | 20.x           |
| npm         | 10.x           |
| PM2         | 5.x            |

### 1. Clonar el repositorio

```bash
git clone https://github.com/jsotoexelixitech/Formulario-modulo.git
cd Formulario-modulo
```

### 2. Instalar dependencias

```bash
npm install --prefix server
npm install --prefix frontend
```

### 3. Configurar variables de entorno

```bash
cp server/.env.example server/.env
```

Edita `server/.env`:

```env
NODE_ENV=production
PORT=4002
CORS_ORIGINS=http://localhost:5182

LAMUNDIAL_BASE_URL=https://qaapisys2000.lamundialdeseguros.com
LAMUNDIAL_APIKEY=TU_APIKEY_AQUI
LAMUNDIAL_TIMEOUT_MS=30000
```

> ⚠️ **Nunca comitas el archivo `.env` al repositorio.**

### 4. Compilar el frontend

```bash
npm run build --prefix frontend
```

### 5. Levantar con PM2

```bash
# Producción
pm2 start ecosystem.config.js --env production

# Desarrollo (hot-reload)
pm2 start ecosystem.dev.config.js
```

### 6. Verificar

```bash
curl http://localhost:4002/api/health
# {"status":"ok","module":"formulario","upstream":"https://qaapisys2000.lamundialdeseguros.com"}

# Probar catálogos
curl http://localhost:4002/api/valrep/state | head -c 200
curl "http://localhost:4002/api/catalogo/marcas?fano=2019" | head -c 200
```

---

## 📖 API Reference

### `GET /api/health`
Estado del servicio y upstream.

### `GET /api/valrep/state`
Lista de estados de Venezuela.

### `GET /api/valrep/city?estado={code}`
Ciudades de un estado.

### `GET /api/catalogo/marcas?fano={year}`
Marcas de vehículos disponibles para un año modelo.

### `GET /api/catalogo/modelos?fano={year}&marca={code}`
Modelos de una marca para un año modelo.

La especificación completa está en **Swagger UI**: `http://localhost:4002/docs`

---

## 🛠️ Gestión de procesos (PM2)

```bash
pm2 show form-api
pm2 show form-web
pm2 logs form-api
pm2 restart form-api
pm2 restart form-web
pm2 save
```

---

## 📁 Logs en disco

```
logs/
├── form-api.out.log
├── form-api.err.log
├── form-web.out.log
└── form-web.err.log
```

---

## 🔄 Actualizar el módulo

```bash
git pull origin main
npm install --prefix server
npm run build --prefix frontend
pm2 restart form-api
pm2 restart form-web
```

---

## 🗺️ Módulos relacionados

| # | Módulo | Repositorio |
|:-:|:-------|:-----------|
| 1 | OCR | [ocr-documentos-modulo](https://github.com/jsotoexelixitech/ocr-documentos-modulo) |
| **2-3** | **Formulario** ← _estás aquí_ | [Formulario-modulo](https://github.com/jsotoexelixitech/Formulario-modulo) |
| 4 | Emisión / Plan | [Emision-Plan-modulo](https://github.com/jsotoexelixitech/Emision-Plan-modulo) |
| 5-6 | Pagos / Póliza | [Pagos-Poliza-modulo](https://github.com/jsotoexelixitech/Pagos-Poliza-modulo) |

---

## 🤝 Contribuir

Lee [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo de trabajo y convenciones.

---

## 📄 Licencia

Distribuido bajo la licencia **MIT**. Consulta [LICENSE](LICENSE).

---

<div align="center">
Desarrollado por <strong>Exelixi Tech</strong> · 2026
</div>
