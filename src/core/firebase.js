// ══════════════════════════════════════════════════════════════════
// AJÚA BPM — core/firebase.js
// Conexión Firebase Firestore + sistema de guardado
// Build 47 — Marzo 2026
//
// ESTADO: Archivo de referencia documentado
// Las funciones aún viven en index.html en estas líneas:
//   - fbSaveConfig, fbSkipConfig, fbCheckConfig → L4702–L4804
//   - fbShowStatus, initFirebase               → L6796–L7039
//   - save()                                   → L7040–L7100
//   - Variables _fb*                           → L5832–L5840
// ══════════════════════════════════════════════════════════════════

// ── Firebase ESM — se carga en <head> via script type="module" ────
// Ver index.html L781–L798
// Expone al window global:
//   window._fbInitializeApp, window._fbGetFirestore
//   window._fbInitFirestore, window._fbPersistCache
//   window._fbMultiTab,      window._fbDoc
//   window._fbGetDoc,        window._fbSetDoc
//   window._fbOnSnapshot,    window._fbModulesReady

// ── Variables de estado Firebase ─────────────────────────────────
// (declaradas en index.html L5832–L5840)
let _fbReady  = false; // true cuando Firebase está conectado y listo
let _fbLoaded = false; // true cuando los datos se cargaron desde Firestore
let _fbDb     = null;  // { db, doc, getDoc, setDoc }
let _fbSaveQ  = null;  // setTimeout handle para debounce de save()
let _fbSaving = false; // true mientras hay un setDoc en vuelo
let _lastKnownTotal = 0; // máximo de registros conocido — guard anti-borrado

// ── Constantes ────────────────────────────────────────────────────
const DB_KEY     = 'ajua_bpm_v2';   // clave localStorage
const BACKUP_DOC = 'backup_auto';   // documento separado en Firestore

// ── Credenciales Firebase (hardcodeadas en fbCheckConfig) ─────────
// Project: ajuabmp
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCbYbUyMgNxcmkawV3vtOieUT-Hdgr08iY",
  authDomain:        "ajuabmp.firebaseapp.com",
  projectId:         "ajuabmp",
  appId:             "1:681963417089:web:96b3b75e8d995b0e501a00",
  storageBucket:     "ajuabmp.firebasestorage.app",
  messagingSenderId: "681963417089",
};

// ── Estado visual en header y login ──────────────────────────────
// index.html L6796 | Estados: loading | online | saving | offline | config
function fbShowStatus(status) { /* ver index.html L6796 */ }

// ── Punto de entrada — llamado al arrancar la app ─────────────────
// index.html L4764 — fbCheckConfig()
// Carga credenciales hardcodeadas y llama a initFirebase()
function fbCheckConfig() { /* ver index.html L4739 */ }

// ── Inicialización completa de Firebase ──────────────────────────
// index.html L6830
// Flujo:
//   1. Espera módulos ESM (window._fbModulesReady)
//   2. initializeFirestore con persistencia multi-tab
//   3. Lee 'ajua_bpm/main' desde Firestore
//   4. Si main tiene <10 registros → auto-restore desde backup_auto
//   5. Merge cloud → DB local
//   6. _fbLoaded = true → desbloquea save()
//   7. startAutoBackup() → backup cada 5 minutos
//   8. onSnapshot listener → sync en tiempo real
async function initFirebase(firebaseConfig) { /* ver index.html L6830 */ }

// ── Guardar DB en Firestore + localStorage ────────────────────────
// index.html L7040
// Guards de seguridad:
//   GUARD 0: bloqueado si !_fbLoaded (Firebase no terminó de cargar)
//   GUARD 1: bloqueado si !_fbReady  (sin conexión)
//   GUARD 2: bloqueado si currentTotal < 60% de _lastKnownTotal
//   GUARD 3: bloqueado si DB completamente vacía (0 registros)
// Debounce: 500ms para agrupar múltiples saves seguidos
function save() { /* ver index.html L7040 */ }

// ── Backup / Restore manual ───────────────────────────────────────
// index.html L4782 y L4793
function fbExportBackup() { /* descarga DB como JSON */ }
function fbImportBackup(input) { /* restaura DB desde JSON */ }

// ── Sistema anti-pérdida nivel 2 ─────────────────────────────────
// index.html L5840–L5940
// Backup automático a 'ajua_bpm/backup_auto' cada 5 minutos
// NUNCA sobreescribe si nuevo total < 50% del backup existente
function backupToFirebase() { /* ver index.html L5880 */ }
function startAutoBackup()  { /* ver index.html L5930 */ }

// ══════════════════════════════════════════════════════════════════
// DEPENDENCIAS DE ESTE MÓDULO
// ══════════════════════════════════════════════════════════════════
// Externas (deben estar disponibles):
//   - DB, DB_DEFAULT, DB_KEY    → core/db.js
//   - toast(), renderAll()      → core/utils.js
//   - authEnsureDB()            → core/auth.js
//   - _dbTotalRecords()         → core/anti-loss.js
//   - window._fb*               → <script type="module"> en index.html
//
// Módulos que dependen de firebase.js:
//   - TODOS los módulos usan save()
//   - El sistema BPM completo depende de _fbLoaded y _fbReady
// ══════════════════════════════════════════════════════════════════
