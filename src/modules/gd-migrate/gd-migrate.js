// ═══════════════════════════════════════════════════════════════════
// AJÚA BPM — FASE A: Migrar gastosDiarios[] → colección gastosDiarios/{id}
// build-91
//
// USO (una sola vez desde consola F12):
//   await migrateGastosDiarios()
//
// Qué hace:
//   Lee DB.gastosDiarios[] en memoria
//   Sube cada gasto como documento individual a gastosDiarios/{id}
//   NO modifica ni borra nada de ajua_bpm/main
//   Si un documento ya existe en la colección, lo sobreescribe (idempotente)
//
// NUNCA llamar automáticamente.
// ═══════════════════════════════════════════════════════════════════

async function migrateGastosDiarios() {
  // ── Prerequisitos ──────────────────────────────────────────────
  // _fbDb es let (no var) en bpm.html — acceder directo, no via window
  if (typeof _fbDb === 'undefined' || !_fbDb) {
    console.error('❌ _fbDb no disponible. Recarga la página e intenta de nuevo.');
    return;
  }
  if (typeof DB === 'undefined' || !Array.isArray(DB.gastosDiarios)) {
    console.error('❌ DB.gastosDiarios no disponible.');
    return;
  }

  var d       = _fbDb;
  var gastos  = DB.gastosDiarios;
  var total   = gastos.length;
  var ok      = 0;
  var skipped = 0;
  var errors  = 0;

  console.log('🚀 FASE A — Migrando gastosDiarios a colección individual...');
  console.log('   Total registros en memoria: ' + total);

  for (var i = 0; i < gastos.length; i++) {
    var g = gastos[i];

    if (!g.id) {
      console.warn('  ⚠ Registro sin id (índice ' + i + '), saltando:', g);
      skipped++;
      continue;
    }

    try {
      await d.setDoc(d.doc(d.db, 'gastosDiarios', g.id), g);
      ok++;
      if (ok % 10 === 0 || ok === total - skipped) {
        console.log('  Migrado ' + ok + '/' + (total - skipped) + '...');
      }
    } catch(e) {
      errors++;
      console.error('  ❌ Error en gasto ' + g.id + ' (' + (g.fecha||'?') + '):', e.message);
    }
  }

  // ── Resultado ──────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('📊 Resultado FASE A:');
  console.log('   Subidos OK:      ' + ok);
  console.log('   Sin id (saltados): ' + skipped);
  console.log('   Errores:          ' + errors);
  console.log('   Total procesados: ' + total);

  if (errors === 0) {
    console.log('\n✅ FASE A completa — ' + ok + ' documentos en colección gastosDiarios/');
    console.log('   ajua_bpm/main NO fue modificado.');
    console.log('   Cuando estés listo, avanzá a FASE B.');
  } else {
    console.warn('\n⚠ FASE A con ' + errors + ' errores — revisá los mensajes arriba.');
    console.log('   Podés volver a correr migrateGastosDiarios() para reintentar.');
  }

  return { ok: ok, skipped: skipped, errors: errors, total: total };
}

// ═══════════════════════════════════════════════════════════════════
// FASE D — Eliminar gastosDiarios[] de ajua_bpm/main
// build-95
//
// USO (una sola vez, DESPUÉS de verificar FASE B y C):
//   await cleanGastosFromMain()
//
// Qué hace:
//   Lee ajua_bpm/main de Firestore
//   Elimina el campo gastosDiarios del documento
//   Escribe de vuelta (setDoc)
//
// SEGURIDAD:
//   - Solo borra si la colección gastosDiarios/ tiene más de 100 docs
//   - Pide confirmación antes de escribir
//   - NO toca nada más
// ═══════════════════════════════════════════════════════════════════

async function cleanGastosFromMain() {
  var colSnap = await _fbDb.getDocs(_fbDb.collection(_fbDb.db, 'gastosDiarios'));
  var colTotal = colSnap.size;
  console.log('Colección gastosDiarios:', colTotal, 'docs');

  if (colTotal < 200) {
    console.error('❌ Abortado — colección tiene solo ' + colTotal + ' (esperado >= 200)');
    return;
  }

  var antes = (DB.gastosDiarios || []).length;
  console.log('DB.gastosDiarios antes:', antes, 'registros');

  DB.gastosDiarios = [];
  save();

  console.log('✅ DB.gastosDiarios = [] — save() ejecutado');
  console.log('   antes:', antes, '→ después: 0');
  return { colTotal: colTotal, eliminados: antes };
}

window.migrateGastosDiarios = migrateGastosDiarios;
window.cleanGastosFromMain   = cleanGastosFromMain;

// ═══════════════════════════════════════════════════════════════════
// build-100 — Migrar colecciones fragmentadas
// USO desde consola F12:
//   await migrateAL()
//   await migrateGcConcursos()
//   await migrateISalidas()
//   await migrateCotizaciones()
//   await migrateGastosSemanales()
//
// Después de verificar que la colección tiene los datos:
//   await cleanFragFromMain('al')   etc.
// ═══════════════════════════════════════════════════════════════════

async function _migrateCollection(colName, items) {
  if (typeof _fbDb === 'undefined' || !_fbDb) {
    console.error('❌ _fbDb no disponible. Recargá la página.');
    return null;
  }
  if (!Array.isArray(items) || !items.length) {
    console.warn('⚠ ' + colName + ': array vacío o no existe en DB.');
    return null;
  }
  var d = _fbDb;
  var total = items.length;
  var ok = 0, skipped = 0, errors = 0;
  console.log('🚀 Migrando ' + colName + ' — ' + total + ' registros...');
  for (var i = 0; i < items.length; i++) {
    var rec = items[i];
    if (!rec.id) { console.warn('  ⚠ Sin id (índice ' + i + '), saltando'); skipped++; continue; }
    try {
      await d.setDoc(d.doc(d.db, colName, rec.id), rec);
      ok++;
      if (ok % 5 === 0 || ok === total - skipped) console.log('  Migrado ' + ok + '/' + (total - skipped) + '...');
    } catch(e) {
      errors++;
      console.error('  ❌ Error en ' + rec.id + ':', e.message);
    }
  }
  console.log('══════════════════════════════');
  if (errors === 0) {
    console.log('✅ ' + colName + ': ' + ok + ' docs subidos.');
    console.log('   Verificá en Firestore y luego: await cleanFragFromMain("' + colName + '")');
  } else {
    console.warn('⚠ ' + colName + ': ' + ok + ' ok, ' + errors + ' errores. Revisá y volvé a correr.');
  }
  return { ok: ok, skipped: skipped, errors: errors, total: total };
}

async function migrateAL() {
  return _migrateCollection('al', DB.al);
}
async function migrateGcConcursos() {
  return _migrateCollection('gcConcursos', DB.gcConcursos);
}
async function migrateISalidas() {
  return _migrateCollection('isalidas', DB.isalidas);
}
async function migrateCotizaciones() {
  return _migrateCollection('cotizaciones', DB.cotizaciones);
}
async function migrateGastosSemanales() {
  return _migrateCollection('gastosSemanales', DB.gastosSemanales);
}
async function migrateTL() {
  return _migrateCollection('tl', DB.tl);
}
async function migrateDT() {
  return _migrateCollection('dt', DB.dt);
}
async function migrateBAS() {
  return _migrateCollection('bas', DB.bas);
}
async function migrateROD() {
  return _migrateCollection('rod', DB.rod);
}
async function migrateFUM() {
  return _migrateCollection('fum', DB.fum);
}

// ═══════════════════════════════════════════════════════════════════
// cleanFragFromMain(colName) — Limpia un array de ajua_bpm/main
// SOLO después de verificar que la colección tiene los datos.
// ═══════════════════════════════════════════════════════════════════
async function cleanFragFromMain(colName) {
  var VALID = ['al', 'gcConcursos', 'isalidas', 'cotizaciones', 'gastosSemanales', 'tl', 'dt', 'bas', 'rod', 'fum'];
  if (VALID.indexOf(colName) === -1) {
    console.error('❌ colName inválido. Válidos: ' + VALID.join(', '));
    return;
  }
  var colSnap = await _fbDb.getDocs(_fbDb.collection(_fbDb.db, colName));
  var colTotal = colSnap.size;
  var dbTotal = (DB[colName] || []).length;
  console.log('Colección ' + colName + ': ' + colTotal + ' docs | DB en memoria: ' + dbTotal);
  if (colTotal < dbTotal) {
    console.error('❌ Abortado — colección (' + colTotal + ') tiene menos docs que DB (' + dbTotal + '). Migrá primero.');
    return;
  }
  var antes = dbTotal;
  DB[colName] = [];
  save();
  console.log('✅ DB.' + colName + ' = [] — save() ejecutado. Antes: ' + antes + ' → después: 0');
  return { colTotal: colTotal, eliminados: antes };
}

window.migrateAL              = migrateAL;
window.migrateGcConcursos     = migrateGcConcursos;
window.migrateISalidas        = migrateISalidas;
window.migrateCotizaciones    = migrateCotizaciones;
window.migrateGastosSemanales = migrateGastosSemanales;
window.migrateTL              = migrateTL;
window.migrateDT              = migrateDT;
window.migrateBAS             = migrateBAS;
window.migrateROD             = migrateROD;
window.migrateFUM             = migrateFUM;
window.cleanFragFromMain      = cleanFragFromMain;

console.log('✅ gd-migrate.js cargado — build-102');
console.log('   await migrateTL() | migrateDT() | migrateBAS() | migrateROD() | migrateFUM()');
