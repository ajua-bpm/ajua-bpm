# AJÚA BPM — Mapa de Arquitectura
## Build 45 — Marzo 2026

## Estructura actual del index.html

| Bloque | Líneas | Descripción |
|--------|--------|-------------|
| `<head>` + fonts | L1–L23 | Meta, PWA, Google Fonts |
| `<link> main.css` | L24 | ✅ Extraído en Build 45 |
| HTML body | L25–L767 | Templates, login, nav, secciones |
| Script SW cleanup | L768–L779 | Desregistra Service Worker |
| Script Firebase ESM | L781–L798 | Imports Firebase v10.12 → window._ |
| **Script principal** | L3947–L15648 | Todo el JS de la app |

---

## Mapa del Script Principal (L3947–L15648)

### CORE — Infraestructura

| Archivo futuro | Líneas actuales | Funciones clave |
|----------------|-----------------|-----------------|
| `core/db.js` | L3949–L3964 | `DB_DEFAULT`, `DB`, localStorage init |
| `core/firebase.js` | L4702–L4804 + L5820–L5840 + L6830–L6900 | `fbCheckConfig()`, `fbSaveConfig()`, `initFirebase()`, `fbShowStatus()`, `fbExportBackup()`, `fbImportBackup()` |
| `core/auth.js` | L4212–L4701 | `AUTH_SESSION`, `login()`, `logout()`, `renderUsers()`, `saveUser()`, `deleteUser()` |
| `core/utils.js` | L3982–L4211 | `renderAll()`, `renderInvAll()`, `provTab()`, `toast()`, `save()` |
| `core/anti-loss.js` | L5840–L5940 | `backupToFirebase()`, `snapSave()`, `snapRestore()`, `startAutoBackup()` |

### MÓDULOS — Business Logic

| Archivo futuro | Líneas actuales | Tamaño |
|----------------|-----------------|--------|
| `modules/walmart/index.js` | L4805–L5839 | 1,034 líneas |
| `modules/gastos-diarios/index.js` | L5941–L6305 | 364 líneas |
| `modules/reportes/index.js` | L6306–L6654 | 348 líneas |
| `modules/nomina/index.js` | L6655–L9228 | 2,573 líneas |
| `modules/bpm/index.js` | L9229–L13682 | 4,453 líneas |
| `modules/helpers/index.js` | L13683–L13983 | 300 líneas |
| `modules/gastos-generales/index.js` | L13984–L14668 | 684 líneas |
| `modules/bulk/index.js` | L14669–L15070 | 401 líneas |
| `modules/cotizador/index.js` | L15071–L15648 | 577 líneas |

---

## Variables globales críticas

```javascript
// Firebase
let _fbReady   // true cuando Firebase está conectado
let _fbLoaded  // true cuando los datos se cargaron desde Firestore
let _fbDb      // objeto {db, doc, getDoc, setDoc, onSnapshot}
const DB_KEY      = 'ajua_bpm_v2'
const BACKUP_DOC  = 'backup_auto'

// Auth
let AUTH_SESSION  // { id, nombre, rol, modulos }
const AUTH_VERSION = 6
const AUTH_SESS_KEY = 'ajua_session_v6'

// DB
let DB  // objeto principal con todos los datos
const DB_DEFAULT  // estructura vacía de referencia
```

---

## Firebase Config (hardcodeada en fbCheckConfig)

```
Project ID:  ajuabmp
Auth Domain: ajuabmp.firebaseapp.com
App ID:      1:681963417089:web:96b3b75e8d995b0e501a00
```

---

## Estado de migración

| Fase | Estado | Build |
|------|--------|-------|
| Fase 1 — GitHub Actions + estructura | ✅ Completo | Build 44 |
| Fase 2 — CSS extraído | ✅ Completo | Build 45 |
| Fase 3 — core/ documentado | ✅ Completo | Build 46 |
| Fase 4 — módulos extraídos | ⏳ Pendiente | Build 47+ |

---

## Reglas de trabajo

- Nunca modificar más de un módulo por cambio
- Cada cambio pasa por `node --check` antes de subir
- El `index.html` sigue funcionando en paralelo
- Versionado: `build-XX` en cada commit
