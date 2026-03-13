# AJÚA BPM — Contexto del proyecto

## Qué es
Sistema BPM interno para AGROINDUSTRIA AJÚA — importación y distribución de vegetales, Guatemala.
Usuario: Ricardo Sagastume (agroajua@gmail.com)
URL producción: https://agroajua.com/bpm.html

## Stack
- `bpm.html` — app principal monolítica (~16,000 líneas), JS vanilla puro, sin frameworks
- Firebase Firestore — proyecto `ajuabmp` | documento único `ajua_bpm/main`
- Deploy: push a main → GitHub Action → GitHub Pages → agroajua.com
- Repo: github.com/ajua-bpm/ajua-bpm

## Estructura
```
ajua-bpm/
├── index.html
├── bpm.html
├── CLAUDE.md                            ← este archivo
└── src/modules/
    ├── guatecompras/guatecompras.js
    ├── banco-import/banco-import.js
    ├── bpm/bpm.js
    ├── al-edit/al-edit.js
    └── backup-auto/backup-auto.js
```

## Firebase — arquitectura crítica
```
ajua_bpm/main         ← TODA la data de producción
ajua_bpm/backup_auto  ← backup automático, NUNCA sobreescribir con menos datos
```

### Variables globales Firebase
- `DB` — objeto JS con todos los arrays
- `_fbDb` — `{db, doc, getDoc, setDoc}`
- `_fbReady` — true cuando Firebase listo para escribir
- `_fbLoaded` — true cuando carga inicial terminó
- `save()` — guarda localStorage + Firebase (con guards)
- `_dbTotalRecords(DB)` — cuenta registros totales

### Guards en save() — NUNCA romper
1. Bloquea si `!_fbLoaded`
2. Bloquea si `currentTotal < _lastKnownTotal * 0.6`
3. Aborta si `finalTotal === 0`
⚠️ NUNCA llamar save() automáticamente — solo desde acciones del usuario

## Arrays principales en DB
gastosDiarios, gastosSemanales, pedidosWalmart, vgtVentas, vintVentas,
empleados, conductores, clientes, proveedores,
tl, dt, al, bas, rod, fum,
gcConcursos, gcDescubiertos, iAnticipo,
cotizadorRapido, iProductos, usuarios

## Reglas
- PowerShell: `Copy-Item` en vez de `rename`
- Módulos: `var` o `window.X` para globales
- Módulos tienen acceso a: `DB`, `save()`, `uid()`, `now()`, `toast()`, `GD_CATS`
- Siempre: `node --check archivo.js` antes de subir
- Deploy: `git add . && git commit -m "build-XX: desc" && git push`

## Build actual
- bpm.html: build-81
- guatecompras.js: build-80
- banco-import.js: build-81

## Errores críticos — NO repetir
1. `setTimeout(()=>{ save(); }, 800)` en módulo → borró toda la DB
2. save() con DB vacía en memoria → borró producción
→ Restaurar: `const {db,doc,getDoc,setDoc}=_fbDb; const s=await getDoc(doc(db,'ajua_bpm','backup_auto')); await setDoc(doc(db,'ajua_bpm','main'),s.data())`

## Pendientes
- [ ] Verificar banco-import.js con Excel BAC
- [ ] Tab Descubiertos Guatecompras — probar
- [ ] Scraper gc-scraper (repo separado)
- [ ] Tienda tienda.agroajua.com
- [ ] Reporte Excel completo
