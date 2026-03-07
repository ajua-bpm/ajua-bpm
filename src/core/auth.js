// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — core/auth.js
// Sistema de autenticación y gestión de usuarios
// Build 48 — Marzo 2026
//
// ESTADO: Archivo de referencia documentado
// Las funciones viven en index.html L4212–L4701
// ══════════════════════════════════════════════════════════════════

// ── Constantes de sesión ──────────────────────────────────────────
const AUTH_VERSION  = 6;
const AUTH_SESS_KEY = 'ajua_session_v6'; // clave en sessionStorage
const AUTH_VER_KEY  = 'ajua_auth_ver';

// ── Estado global de sesión ───────────────────────────────────────
let AUTH_SESSION = null; // { id, nombre, rol, modulos[] }

// ── Roles disponibles ─────────────────────────────────────────────
const AUTH_ROLES = {
  superadmin: 'Super Admin',
  admin:      'Administrador',
  supervisor: 'Supervisor',
  operador:   'Operador',
};

// ── Lista completa de módulos del sistema ─────────────────────────
const AUTH_ALL_MODULES = [
  'dashboard','transporte-limpieza','despacho','bodega-limpieza',
  'fumigacion','roedores','capacitacion','empleados-enfermos',
  'acceso-lavado','visitas','vidrio','basculas','lavado-prod',
  'inv-stock','inv-entrada','inv-cotizador','maquila',
  'gastos-diarios','cotizador-rapido','inv-salida',
  'ventas-gt','ventas-int','reporte','inv-trazabilidad','inv-config',
  'proveedores','pedidos-walmart','empleados-db','usuarios',
];

// ── Módulos por defecto según rol ─────────────────────────────────
const AUTH_ROLE_DEFAULTS = {
  superadmin: AUTH_ALL_MODULES,
  admin:      AUTH_ALL_MODULES,
  supervisor: AUTH_ALL_MODULES.filter(m => m !== 'usuarios'),
  operador:   [
    'dashboard','transporte-limpieza','despacho','bodega-limpieza',
    'roedores','capacitacion','empleados-enfermos','acceso-lavado',
    'visitas','vidrio','basculas','lavado-prod','gastos-diarios',
  ],
};

// ── Labels para UI de permisos ────────────────────────────────────
const AUTH_MODULO_LABELS = {
  'dashboard':'Dashboard',
  'transporte-limpieza':'Limpieza Transporte',
  'despacho':'Despacho Transporte',
  'bodega-limpieza':'Limpieza Bodega',
  'fumigacion':'Fumigación',
  'roedores':'Control Roedores',
  'capacitacion':'Capacitación',
  'empleados-enfermos':'Empleados Enfermos',
  'acceso-lavado':'Acceso y Lavado',
  'visitas':'Visitas',
  'vidrio':'Vidrio y Plástico',
  'basculas':'Básculas',
  'lavado-prod':'Lavado Producto',
  'inv-stock':'Inventario Stock',
  'inv-entrada':'Ingresos Bodega',
  'inv-cotizador':'Cotizador',
  'maquila':'Gastos Generales',
  'gastos-diarios':'Gastos Diarios',
  'cotizador-rapido':'Cotizador Rápido',
  'inv-salida':'Despachos',
  'ventas-gt':'Ventas GT',
  'ventas-int':'Ventas Int.',
  'reporte':'Reportes',
  'inv-trazabilidad':'Trazabilidad',
  'inv-config':'Config Inventario',
  'proveedores':'Proveedores',
  'pedidos-walmart':'Pedidos Walmart',
  'empleados-db':'Base Empleados',
  'usuarios':'Usuarios',
};

// ── Inicialización DB de usuarios ─────────────────────────────────
// Crea admin por defecto si no hay usuarios
// Migra módulos con nombres viejos a nuevos
// index.html L4247
function authEnsureDB() { /* ver index.html L4247 */ }

// ── Sesión ────────────────────────────────────────────────────────
// Restaura sesión desde sessionStorage al recargar página
// index.html L4298
function authResumeSession() { /* ver index.html L4298 */ }

// Aplica sesión activa — oculta login, actualiza header, filtra nav
// index.html L4312
function authApplySession() { /* ver index.html L4312 */ }

// Filtra nav según módulos permitidos del usuario
// index.html L4335
function authFilterNav() { /* ver index.html L4335 */ }

// Verifica si el usuario puede acceder a un módulo
// index.html L4360 — usado en show() para bloquear acceso
function authCanAccess(moduleId) {
  if (!AUTH_SESSION) return false;
  if (AUTH_SESSION.rol === 'superadmin' || AUTH_SESSION.rol === 'admin') return true;
  return (AUTH_SESSION.modulos || []).includes(moduleId);
}

// ── Login / Logout ────────────────────────────────────────────────
// Espera hasta 8 segundos que Firebase cargue antes de validar
// index.html L4399
function authLogin()  { /* ver index.html L4399 */ }
function authDoLogin(nombre, clave) { /* ver index.html L4446 */ }
function authLogout() { /* ver index.html L4491 */ }

// Limpia caché, SW y recarga — botón para personal no técnico
function ajuaReset()  { /* ver index.html L4369 */ }

// ── CRUD de usuarios ──────────────────────────────────────────────
// index.html L4526–L4676
function saveUsuario()          { /* guarda nuevo o edita existente */ }
function editUsuario(id)        { /* carga usuario en formulario */ }
function cancelEditUsuario()    { /* limpia formulario */ }
function toggleUsuarioActivo(id){ /* activa/desactiva usuario */ }
function deleteUsuario(id)      { /* elimina usuario (no al admin principal) */ }
function renderUsuariosForm()   { /* renderiza checkboxes de módulos */ }
function renderUsuarios()       { /* renderiza lista de usuarios */ }
function usrRolChange()         { /* muestra/oculta sección de módulos según rol */ }
function usrSelectAll(val)      { /* selecciona/deselecciona todos los módulos */ }

// ── Mobile nav ────────────────────────────────────────────────────
// index.html L4679
function toggleNav()        { /* abre/cierra sidebar en móvil */ }
function closeNavOnMobile() { /* cierra nav al seleccionar un módulo */ }

// ══════════════════════════════════════════════════════════════════
// DEPENDENCIAS DE ESTE MÓDULO
// ══════════════════════════════════════════════════════════════════
// Externas (deben cargarse antes):
//   - DB, DB_KEY          → core/db.js
//   - save(), toast()     → core/utils.js + core/firebase.js
//   - uid()               → core/utils.js
//   - show()              → core/utils.js
//
// ⚠️  NOTA DE SEGURIDAD:
//   La API key de Anthropic está expuesta en el código (L4676).
//   En la extracción real mover a variable de entorno o Firebase Config.
// ══════════════════════════════════════════════════════════════════
