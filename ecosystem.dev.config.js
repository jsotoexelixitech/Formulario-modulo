/**
 * PM2 — Módulo Formulario (Desarrollo)
 *
 * Uso:
 *   pm2 start ecosystem.dev.config.js
 *   pm2 logs form-api
 *   pm2 restart form-api
 */
const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: 'form-api',
      cwd: path.join(ROOT, 'server'),
      script: 'node_modules/.bin/nodemon',
      args: 'src/index.js',
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
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
      script: 'node_modules/.bin/vite',
      args: '--host',
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
      out_file:   path.join(ROOT, 'logs', 'form-web.out.log'),
      error_file: path.join(ROOT, 'logs', 'form-web.err.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
