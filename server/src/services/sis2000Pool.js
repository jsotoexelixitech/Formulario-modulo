/**
 * sis2000Pool.js — ELIMINADO
 *
 * Este módulo fue removido porque el módulo Formulario no debe conectarse
 * directamente a Sis2000 (SQL Server de La Mundial).
 *
 * Los catálogos INMA (vehículos) y valrep (estados/ciudades/dominios)
 * deben ser consumidos a través de la API de La Mundial (LAMUNDIAL_BASE_URL)
 * o delegados al servicio centralizado sysip-nest-api.
 *
 * Si necesitas catálogos Sis2000, utiliza: nexus-api o sysip-nest-api.
 */

throw new Error(
  '[modulo-formulario] sis2000Pool fue eliminado de este módulo. ' +
  'Usa LAMUNDIAL_BASE_URL o sysip-nest-api para obtener catálogos.'
);
