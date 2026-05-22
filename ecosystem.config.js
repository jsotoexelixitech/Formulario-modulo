/**
 * PM2 — Módulo Formulario (Producción)
 *
 * Uso:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js
 *   pm2 stop form-api form-web
 */
const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: 'form-api',
      cwd: path.join(ROOT, 'server'),
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '256M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4002,
      },
      out_file:   path.join(ROOT, 'logs', 'form-api.out.log'),
      error_file: path.join(ROOT, 'logs', 'form-api.err.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'form-web',
      cwd: path.join(ROOT, 'frontend'),
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --host --port 5182 --strictPort',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '256M',
      env_production: {
        NODE_ENV: 'production',
      },
      out_file:   path.join(ROOT, 'logs', 'form-web.out.log'),
      error_file: path.join(ROOT, 'logs', 'form-web.err.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
