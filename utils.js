// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — core/utils.js
// Funciones utilitarias globales
// Build 47 — Marzo 2026
//
// ESTADO: Archivo de referencia documentado
// Las funciones aún viven en index.html (líneas 7101-7120)
// Este archivo es la versión lista para extracción futura
// ══════════════════════════════════════════════════════════════════

// ── Toast notification ────────────────────────────────────────────
// Uso: toast('Mensaje') | toast('Error', true)
function toast(m = '✓ Guardado', err = false) {
  const t = document.getElementById('toast');
  t.textContent = m;
  t.className = err ? 'err show' : 'show';
  setTimeout(() => t.className = '', 2500);
}

// ── Unique ID generator ───────────────────────────────────────────
// Formato: timestamp_randomStr — e.g. "1772811423288_6cqae"
function uid() {
  return Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── Timestamps en español Guatemala ──────────────────────────────
function now()   { return new Date().toLocaleString('es-GT'); }
function today() { return new Date().toLocaleDateString('es-GT'); }

// ── DOM helpers ───────────────────────────────────────────────────
function v(id)        { return document.getElementById(id)?.value || ''; }
function set(id, val) { const e = document.getElementById(id); if (e) e.value = val; }

// ── Reloj en header ───────────────────────────────────────────────
function tick() {
  const now = new Date();
  document.getElementById('hclock').textContent = now.toLocaleTimeString('es-GT');
  const fd = now.toLocaleDateString('es-GT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const el = document.getElementById('fecha-hoy');
  if (el) el.textContent = fd;
}
setInterval(tick, 1000);
tick();

// ── Navegación entre secciones ────────────────────────────────────
// Uso: show('gastos-diarios', this)
// Depende de: AUTH_SESSION, authCanAccess(), toast()
// y todas las funciones render de cada módulo
function show(id, el) {
  closeNavOnMobile();
  if (AUTH_SESSION && id !== 'dashboard' && id !== 'usuarios') {
    if (!authCanAccess(id)) {
      toast('⚠ No tienes acceso a este módulo', true);
      return;
    }
  }
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + id)?.classList.add('active');
  if (el) {
    const ni = el.closest ? el.closest('.ni') : el;
    if (ni) ni.classList.add('active');
  } else {
    const found = document.querySelector('.ni[onclick*="show(\'' + id + '\'"]');
    if (found) found.classList.add('active');
  }
  try { sessionStorage.setItem('ajua_last_sec', id); } catch (e) {}
  // El switch completo de lazy render está en index.html L7140-7240
  // Se moverá acá en la extracción final
}

// ── Mobile nav ────────────────────────────────────────────────────
function closeNavOnMobile() {
  if (window.innerWidth <= 768) {
    document.getElementById('main-nav')?.classList.remove('open');
    document.getElementById('nav-overlay')?.classList.remove('open');
  }
}

// ══════════════════════════════════════════════════════════════════
// DEPENDENCIAS DE ESTE MÓDULO
// ══════════════════════════════════════════════════════════════════
// Externas (deben cargarse antes):
//   - core/auth.js  → AUTH_SESSION, authCanAccess()
//   - core/firebase.js → _fbLoaded, _fbReady, _fbDb
//
// Funciones que dependen de utils.js (en todos los módulos):
//   toast(), uid(), now(), today(), v(), set()
// ══════════════════════════════════════════════════════════════════
